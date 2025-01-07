const WebRTC = require('node-webrtc');
const Call = require('../models/Call');

class WebRTCService {
    constructor(io) {
        this.io = io;
        this.peers = new Map();
        this.calls = new Map();
        
        // STUN servers configuration
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:your-turn-server.com:3478',
                username: process.env.TURN_USERNAME,
                credential: process.env.TURN_PASSWORD
            }
        ];
    }

    initialize() {
        this.io.on('connection', (socket) => {
            socket.on('call:start', async (data) => {
                await this.handleCallStart(socket, data);
            });

            socket.on('call:accept', async (data) => {
                await this.handleCallAccept(socket, data);
            });

            socket.on('call:reject', async (data) => {
                await this.handleCallReject(socket, data);
            });

            socket.on('call:end', async (data) => {
                await this.handleCallEnd(socket, data);
            });

            socket.on('call:ice-candidate', (data) => {
                this.handleIceCandidate(socket, data);
            });

            socket.on('call:offer', (data) => {
                this.handleOffer(socket, data);
            });

            socket.on('call:answer', (data) => {
                this.handleAnswer(socket, data);
            });
        });
    }

    async handleCallStart(socket, { recipientId }) {
        try {
            const call = new Call({
                caller: socket.userId,
                recipient: recipientId,
                startTime: new Date(),
                status: 'initiated'
            });
            await call.save();

            this.calls.set(call._id.toString(), {
                callId: call._id,
                caller: socket.userId,
                recipient: recipientId,
                status: 'initiated'
            });

            const recipientSocket = this.io.sockets.sockets.get(this.peers.get(recipientId));
            if (recipientSocket) {
                recipientSocket.emit('call:incoming', {
                    callId: call._id,
                    caller: socket.userId
                });
                
                // Update call status to ringing
                call.status = 'ringing';
                await call.save();
            } else {
                // Recipient is offline
                call.status = 'missed';
                await call.save();
                socket.emit('call:error', { message: 'Recipient is offline' });
            }
        } catch (error) {
            console.error('Error starting call:', error);
            socket.emit('call:error', { message: 'Failed to start call' });
        }
    }

    async handleCallAccept(socket, { callId }) {
        try {
            const call = await Call.findById(callId);
            if (!call) {
                throw new Error('Call not found');
            }

            call.status = 'connected';
            await call.save();

            const callerSocket = this.io.sockets.sockets.get(this.peers.get(call.caller));
            if (callerSocket) {
                callerSocket.emit('call:accepted', { callId });
            }

            // Create and configure WebRTC connection
            const peerConnection = new WebRTC.RTCPeerConnection({
                iceServers: this.iceServers
            });

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('call:ice-candidate', {
                        callId,
                        candidate: event.candidate
                    });
                }
            };

            // Add to active calls
            this.calls.set(callId, {
                ...this.calls.get(callId),
                peerConnection,
                status: 'connected'
            });
        } catch (error) {
            console.error('Error accepting call:', error);
            socket.emit('call:error', { message: 'Failed to accept call' });
        }
    }

    async handleCallReject(socket, { callId, reason = 'rejected' }) {
        try {
            const call = await Call.findById(callId);
            if (!call) {
                throw new Error('Call not found');
            }

            call.status = 'rejected';
            call.terminationReason = reason;
            call.endTime = new Date();
            await call.save();

            const callerSocket = this.io.sockets.sockets.get(this.peers.get(call.caller));
            if (callerSocket) {
                callerSocket.emit('call:rejected', { callId, reason });
            }

            this.calls.delete(callId);
        } catch (error) {
            console.error('Error rejecting call:', error);
            socket.emit('call:error', { message: 'Failed to reject call' });
        }
    }

    async handleCallEnd(socket, { callId, reason = 'completed' }) {
        try {
            const call = await Call.findById(callId);
            if (!call) {
                throw new Error('Call not found');
            }

            await call.endCall(reason);

            // Notify both parties
            const otherPartyId = call.caller.toString() === socket.userId ? call.recipient : call.caller;
            const otherPartySocket = this.io.sockets.sockets.get(this.peers.get(otherPartyId));
            
            if (otherPartySocket) {
                otherPartySocket.emit('call:ended', { callId, reason });
            }

            // Clean up WebRTC connection
            const activeCall = this.calls.get(callId);
            if (activeCall && activeCall.peerConnection) {
                activeCall.peerConnection.close();
            }
            this.calls.delete(callId);
        } catch (error) {
            console.error('Error ending call:', error);
            socket.emit('call:error', { message: 'Failed to end call' });
        }
    }

    handleIceCandidate(socket, { callId, candidate }) {
        const activeCall = this.calls.get(callId);
        if (activeCall && activeCall.peerConnection) {
            activeCall.peerConnection.addIceCandidate(new WebRTC.RTCIceCandidate(candidate))
                .catch(error => {
                    console.error('Error adding ICE candidate:', error);
                });
        }
    }

    handleOffer(socket, { callId, offer }) {
        const activeCall = this.calls.get(callId);
        if (activeCall && activeCall.peerConnection) {
            activeCall.peerConnection.setRemoteDescription(new WebRTC.RTCSessionDescription(offer))
                .then(() => activeCall.peerConnection.createAnswer())
                .then(answer => activeCall.peerConnection.setLocalDescription(answer))
                .then(() => {
                    socket.emit('call:answer', {
                        callId,
                        answer: activeCall.peerConnection.localDescription
                    });
                })
                .catch(error => {
                    console.error('Error handling offer:', error);
                    socket.emit('call:error', { message: 'Failed to process offer' });
                });
        }
    }

    handleAnswer(socket, { callId, answer }) {
        const activeCall = this.calls.get(callId);
        if (activeCall && activeCall.peerConnection) {
            activeCall.peerConnection.setRemoteDescription(new WebRTC.RTCSessionDescription(answer))
                .catch(error => {
                    console.error('Error handling answer:', error);
                    socket.emit('call:error', { message: 'Failed to process answer' });
                });
        }
    }
}

module.exports = WebRTCService;
