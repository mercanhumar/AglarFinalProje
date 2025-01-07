// WebRTC configuration
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let isCallActive = false;
let currentCallUser = null;
let timerInterval = null;

// Audio constraints for better quality
const audioConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16
  },
  video: false
};

// DOM elements
const callUI = document.getElementById('call-ui');
const callControls = document.getElementById('call-controls');
const toggleAudioBtn = document.getElementById('toggle-audio');
const endCallBtn = document.getElementById('end-call');
const callTimerDisplay = document.getElementById('call-timer');

// Initialize WebRTC
async function startCall(recipientId, isInitiator = true) {
  try {
    console.log('Starting call with:', recipientId);
    
    // Reset any existing call state
    await endCall();
    
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    console.log('Got local stream:', localStream.getTracks());

    // Create peer connection
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track);
      peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = async (event) => {
      console.log('Received remote track:', event.track);
      remoteStream = event.streams[0];
      
      // Create audio element if it doesn't exist
      let remoteAudio = document.getElementById('remoteAudio');
      if (!remoteAudio) {
        remoteAudio = document.createElement('audio');
        remoteAudio.id = 'remoteAudio';
        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
        document.body.appendChild(remoteAudio);
      }
      
      // Configure audio element
      remoteAudio.srcObject = null; // Clear existing source
      remoteAudio.muted = false;
      remoteAudio.volume = 1.0;
      remoteAudio.srcObject = remoteStream;
      
      try {
        await remoteAudio.play();
        console.log('Remote audio playing successfully');
      } catch (error) {
        console.error('Error playing remote audio:', error);
        // Try to play on user interaction
        const playAudio = async () => {
          try {
            await remoteAudio.play();
            console.log('Audio playing after user interaction');
            document.removeEventListener('click', playAudio);
          } catch (err) {
            console.error('Error playing audio after click:', err);
          }
        };
        document.addEventListener('click', playAudio);
      }
      
      // Log audio track info for debugging
      const audioTracks = remoteStream.getAudioTracks();
      console.log('Remote audio tracks:', audioTracks);
      audioTracks.forEach(track => {
        console.log('Audio track:', {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          id: track.id
        });
      });
    };

    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        socket.emit('webrtc:ice-candidate', {
          to: recipientId,
          candidate: event.candidate
        });
      }
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed:', peerConnection.connectionState);
      const callStatus = document.getElementById('callStatus');
      
      switch (peerConnection.connectionState) {
        case 'connected':
          console.log('Call connected!');
          isCallActive = true;
          if (callStatus) callStatus.textContent = 'Connected';
          startCallTimer();
          break;
        case 'disconnected':
        case 'failed':
          console.log('Call ended');
          if (callStatus) callStatus.textContent = 'Call Ended';
          stopCallTimer();
          endCall();
          break;
        case 'closed':
          if (callStatus) callStatus.textContent = 'Call Ended';
          stopCallTimer();
          break;
      }
    };

    if (isInitiator) {
      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      console.log('Sending offer');
      socket.emit('webrtc:offer', {
        to: recipientId,
        sdp: offer
      });
    }

    return true;
  } catch (error) {
    console.error('Error in startCall:', error);
    await endCall();
    return false;
  }
}

// Timer functions
function startCallTimer() {
  console.log('Starting call timer');
  if (timerInterval) clearInterval(timerInterval);
  
  const startTime = Date.now();
  const timerDisplay = document.getElementById('callTimer');
  
  // Update immediately
  if (timerDisplay) {
    timerDisplay.textContent = '00:00';
  }
  
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (timerDisplay) {
      timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
  }, 1000);
}

function stopCallTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timerDisplay = document.getElementById('callTimer');
  if (timerDisplay) {
    timerDisplay.textContent = '00:00';
  }
}

async function endCall() {
  console.log('Ending call');
  stopCallTimer();
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }
  
  const remoteAudio = document.getElementById('remoteAudio');
  if (remoteAudio) {
    remoteAudio.srcObject = null;
    remoteAudio.remove();
  }
  
  isCallActive = false;
  if (currentCallUser) {
    socket.emit('call_ended', { to: currentCallUser });
    currentCallUser = null;
  }
}

// Handle incoming call
socket.on('incoming_call', async (data) => {
  console.log('Received incoming call:', data);
  const { callerId, callerUsername } = data;
  
  if (confirm(`Incoming call from ${callerUsername}. Accept?`)) {
    try {
      const success = await startCall(callerId, false);
      
      if (success) {
        socket.emit('call_accepted', { to: callerId });
      } else {
        throw new Error('Failed to initialize call');
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      socket.emit('call_rejected', { to: callerId });
      await endCall();
    }
  } else {
    socket.emit('call_rejected', { to: callerId });
  }
});

// WebRTC signaling
socket.on('webrtc:offer', async (data) => {
  try {
    console.log('Received offer');
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      console.log('Sending answer');
      socket.emit('webrtc:answer', {
        to: data.from,
        sdp: answer
      });
    }
  } catch (error) {
    console.error('Error handling offer:', error);
    await endCall();
  }
});

socket.on('webrtc:answer', async (data) => {
  try {
    console.log('Received answer');
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  } catch (error) {
    console.error('Error handling answer:', error);
    await endCall();
  }
});

socket.on('webrtc:ice-candidate', async (data) => {
  try {
    console.log('Received ICE candidate');
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
});

// Call ended by remote peer
socket.on('call_ended', async () => {
  console.log('Call ended by remote peer');
  await endCall();
});

// Toggle audio
function toggleAudio() {
  if (!localStream) {
    console.warn('Cannot toggle audio - no local stream');
    return;
  }

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) {
    console.warn('No audio track found in local stream');
    return;
  }

  audioTrack.enabled = !audioTrack.enabled;
  console.log('Audio track enabled:', audioTrack.enabled);
  
  toggleAudioBtn.innerHTML = audioTrack.enabled ? 
    '<i class="fas fa-microphone"></i>' : 
    '<i class="fas fa-microphone-slash"></i>';
}

// Event listeners
toggleAudioBtn.addEventListener('click', toggleAudio);
endCallBtn.addEventListener('click', endCall);

// Export functions
window.startCall = startCall;
window.endCall = endCall;
window.toggleAudio = toggleAudio;
