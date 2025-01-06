const Turn = require('node-turn');

function startTurnServer() {
    const server = new Turn({
        // TURN server configuration
        authMech: 'long-term',
        credentials: {
            username: "turnserver",
            password: "turnserver"
        },
        listeningPort: 3478,
        relayIps: ['0.0.0.0']
    });

    server.start();
    console.log('TURN Server started on port 3478');
    
    return server;
}

// STUN/TURN configuration for WebRTC
const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: 'turn:localhost:3478',
        username: 'turnserver',
        credential: 'turnserver'
    }
];

module.exports = {
    startTurnServer,
    iceServers
};
