const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

// Auth-specific rate limiter (more strict)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 login attempts per hour
    message: {
        error: 'Too many login attempts from this IP, please try again later.'
    }
});

// WebSocket connection limiter
const wsConnectionLimiter = {
    connections: new Map(),
    maxConnections: 5, // Max connections per IP
    windowMs: 60 * 1000, // 1 minute window

    checkLimit(ip) {
        const now = Date.now();
        const userConnections = this.connections.get(ip) || [];
        
        // Remove expired connections
        const activeConnections = userConnections.filter(
            timestamp => now - timestamp < this.windowMs
        );
        
        if (activeConnections.length >= this.maxConnections) {
            return false;
        }
        
        activeConnections.push(now);
        this.connections.set(ip, activeConnections);
        return true;
    },

    cleanup() {
        const now = Date.now();
        for (const [ip, timestamps] of this.connections) {
            const activeConnections = timestamps.filter(
                timestamp => now - timestamp < this.windowMs
            );
            if (activeConnections.length === 0) {
                this.connections.delete(ip);
            } else {
                this.connections.set(ip, activeConnections);
            }
        }
    }
};

// Start cleanup interval
setInterval(() => wsConnectionLimiter.cleanup(), 60 * 1000);

module.exports = {
    apiLimiter,
    authLimiter,
    wsConnectionLimiter
};
