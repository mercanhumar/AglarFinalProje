// WebRTC configuration
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

let localStream;
let peerConnection;
let remoteStream;
let isCallInitiator = false;

// DOM elements
const callControls = document.getElementById('call-controls');
const toggleAudioBtn = document.getElementById('toggle-audio');
const endCallBtn = document.getElementById('end-call');
const callTimer = document.getElementById('call-timer');

// Initialize WebRTC
async function initializeCall(isInitiator) {
  isCallInitiator = isInitiator;
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;

    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Handle remote stream
    peerConnection.ontrack = event => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
      remoteStream = event.streams[0];
    };
    
    // ICE candidate handling
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          recipientId: currentCallUser,
          candidate: event.candidate
        });
      }
    };
    
    // Show call controls
    callControls.style.display = 'flex';
    
    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('webrtc:offer', {
        recipientId: currentCallUser,
        sdp: offer
      });
    }
  } catch (error) {
    console.error('Error initializing call:', error);
    endCall();
  }
}

// Handle incoming WebRTC offer
socket.on('webrtc:offer', async ({ callerId, sdp }) => {
  if (!peerConnection) {
    await initializeCall(false);
  }
  
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  socket.emit('webrtc:answer', {
    callerId,
    sdp: answer
  });
});

// Handle WebRTC answer
socket.on('webrtc:answer', async ({ sdp }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

// Handle ICE candidates
socket.on('webrtc:ice-candidate', async ({ candidate }) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

// Toggle audio
toggleAudioBtn.addEventListener('click', () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  toggleAudioBtn.innerHTML = audioTrack.enabled ? 
      '<i class="fas fa-microphone"></i>' : 
      '<i class="fas fa-microphone-slash"></i>';
});

// End call
endCallBtn.addEventListener('click', () => {
  socket.emit('call:end', { callId: currentCallId });
  endCall();
});

// Clean up WebRTC
function cleanupWebRTC() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  if (peerConnection) {
    peerConnection.close();
  }
  localStream = null;
  remoteStream = null;
  peerConnection = null;
  callControls.style.display = 'none';
}

// Update existing endCall function
function endCall() {
  cleanupWebRTC();
  stopCallTimer();
  currentCallUser = null;
  currentCallId = null;
}

// Audio control functions
function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
    }
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
    }
  }
}

// Export functions
window.startCall = initializeCall;
window.endCall = endCall;
window.toggleAudio = toggleAudio;
window.toggleVideo = toggleVideo;
