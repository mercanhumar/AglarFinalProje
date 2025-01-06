const Call = require('../models/Call');
const { iceServers } = require('../config/turnServer');

class CallController {
    constructor(io) {
        this.io = io;
        this.activeUsers = new Map(); // userId -> socketId
        this.activeCalls = new Map(); // callId -> Call object
    }

    handleConnection(socket) {
        // Store user connection
        this.activeUsers.set(socket.userId, socket.id);

        // Handle call signaling
        socket.on('call:initiate', async (data) => {
            const { recipientId } = data;
            const recipientSocketId = this.activeUsers.get(recipientId);

            if (!recipientSocketId) {
                socket.emit('call:error', { message: 'User is offline' });
                return;
            }

            // Create call record
            const call = new Call({
                callerId: socket.userId,
                recipientId: recipientId,
                startTime: new Date(),
                status: 'initiated'
            });
            await call.save();

            // Send call offer to recipient
            this.io.to(recipientSocketId).emit('call:incoming', {
                callId: call._id,
                callerId: socket.userId,
                iceServers
            });

            this.activeCalls.set(call._id.toString(), call);
        });

        socket.on('call:accept', async (data) => {
            const { callId } = data;
            const call = this.activeCalls.get(callId);
            
            if (call) {
                call.status = 'connected';
                await Call.findByIdAndUpdate(callId, { status: 'connected' });
                
                const callerSocketId = this.activeUsers.get(call.callerId);
                this.io.to(callerSocketId).emit('call:accepted', { callId });
            }
        });

        socket.on('call:reject', async (data) => {
            const { callId } = data;
            const call = this.activeCalls.get(callId);
            
            if (call) {
                call.status = 'rejected';
                call.endTime = new Date();
                await Call.findByIdAndUpdate(callId, { 
                    status: 'rejected',
                    endTime: new Date()
                });

                const callerSocketId = this.activeUsers.get(call.callerId);
                this.io.to(callerSocketId).emit('call:rejected', { callId });
                this.activeCalls.delete(callId);
            }
        });

        socket.on('call:end', async (data) => {
            const { callId } = data;
            const call = this.activeCalls.get(callId);
            
            if (call) {
                call.status = 'ended';
                call.endTime = new Date();
                await Call.findByIdAndUpdate(callId, { 
                    status: 'ended',
                    endTime: new Date()
                });

                // Notify both parties
                const otherPartyId = call.callerId === socket.userId ? call.recipientId : call.callerId;
                const otherPartySocketId = this.activeUsers.get(otherPartyId);
                
                if (otherPartySocketId) {
                    this.io.to(otherPartySocketId).emit('call:ended', { callId });
                }
                
                this.activeCalls.delete(callId);
            }
        });

        // WebRTC Signaling
        socket.on('webrtc:offer', (data) => {
            const { recipientId, sdp } = data;
            const recipientSocketId = this.activeUsers.get(recipientId);
            
            if (recipientSocketId) {
                this.io.to(recipientSocketId).emit('webrtc:offer', {
                    callerId: socket.userId,
                    sdp
                });
            }
        });

        socket.on('webrtc:answer', (data) => {
            const { callerId, sdp } = data;
            const callerSocketId = this.activeUsers.get(callerId);
            
            if (callerSocketId) {
                this.io.to(callerSocketId).emit('webrtc:answer', {
                    recipientId: socket.userId,
                    sdp
                });
            }
        });

        socket.on('webrtc:ice-candidate', (data) => {
            const { recipientId, candidate } = data;
            const recipientSocketId = this.activeUsers.get(recipientId);
            
            if (recipientSocketId) {
                this.io.to(recipientSocketId).emit('webrtc:ice-candidate', {
                    senderId: socket.userId,
                    candidate
                });
            }
        });
    }

    handleDisconnection(socket) {
        // End any active calls
        this.activeCalls.forEach(async (call) => {
            if (call.callerId === socket.userId || call.recipientId === socket.userId) {
                call.status = 'ended';
                call.endTime = new Date();
                await Call.findByIdAndUpdate(call._id, {
                    status: 'ended',
                    endTime: new Date()
                });

                const otherPartyId = call.callerId === socket.userId ? call.recipientId : call.callerId;
                const otherPartySocketId = this.activeUsers.get(otherPartyId);
                
                if (otherPartySocketId) {
                    this.io.to(otherPartySocketId).emit('call:ended', { callId: call._id });
                }
                
                this.activeCalls.delete(call._id.toString());
            }
        });

        this.activeUsers.delete(socket.userId);
    }
}

module.exports = CallController;
