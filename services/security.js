const crypto = require('crypto');
const { promisify } = require('util');
const sodium = require('libsodium-wrappers');
const generateKeyPair = promisify(crypto.generateKeyPair);
const User = require('../models/User');
const bcrypt = require('bcrypt');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-256-bit-secret'; // 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

class SecurityService {
    constructor() {
        this.userKeys = new Map(); // Store user public/private keypairs
        this.inactivityTimeouts = new Map(); // Store inactivity timeouts
        this.sessionTokens = new Map(); // Store active session tokens
        this.INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
        this.initSodium();
    }

    async initSodium() {
        await sodium.ready;
        console.log('Sodium initialized for E2E encryption');
    }

    // Inactivity monitoring
    monitorUserActivity(userId, socket = null) {
        // Clear existing timeout if any
        if (this.inactivityTimeouts.has(userId)) {
            clearTimeout(this.inactivityTimeouts.get(userId));
        }

        // Set new timeout
        const timeout = setTimeout(async () => {
            try {
                // Update user status in database
                await User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastSeen: new Date()
                });

                // Invalidate session token
                this.sessionTokens.delete(userId);

                // If socket is provided, disconnect it
                if (socket) {
                    socket.emit('session_expired', { message: 'Session expired due to inactivity' });
                    socket.disconnect(true);
                }

                console.log(`User ${userId} logged out due to inactivity`);
            } catch (error) {
                console.error('Error handling user inactivity:', error);
            }
        }, this.INACTIVITY_TIMEOUT);

        this.inactivityTimeouts.set(userId, timeout);
    }

    // Reset inactivity timer
    resetInactivityTimer(userId, socket = null) {
        this.monitorUserActivity(userId, socket);
    }

    // Clean up when user logs out
    handleUserLogout(userId) {
        if (this.inactivityTimeouts.has(userId)) {
            clearTimeout(this.inactivityTimeouts.get(userId));
            this.inactivityTimeouts.delete(userId);
        }
        this.sessionTokens.delete(userId);
        this.userKeys.delete(userId);
    }

    async generateUserKeys(userId) {
        try {
            await sodium.ready;
            const keyPair = sodium.crypto_box_keypair();
            const publicKeyBase64 = sodium.to_base64(keyPair.publicKey);
            const privateKeyBase64 = sodium.to_base64(keyPair.privateKey);
            
            // Store in memory for current session
            this.userKeys.set(userId, {
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey,
                publicKeyBase64,
                privateKeyBase64
            });
            
            // Store in database
            await User.findByIdAndUpdate(userId, {
                publicKey: publicKeyBase64,
                privateKey: privateKeyBase64
            });
            
            return { publicKey: publicKeyBase64 };
        } catch (error) {
            console.error('Error generating keys:', error);
            throw new Error('Failed to generate encryption keys');
        }
    }

    async getUserKeys(userId) {
        try {
            // First check memory cache
            let keys = this.userKeys.get(userId);
            if (keys) {
                return keys;
            }

            // If not in memory, get from database
            const user = await User.findById(userId);
            if (!user || !user.publicKey || !user.privateKey) {
                return null;
            }

            // Convert base64 keys to Uint8Array
            const publicKey = sodium.from_base64(user.publicKey);
            const privateKey = sodium.from_base64(user.privateKey);

            // Store in memory cache
            keys = {
                publicKey,
                privateKey,
                publicKeyBase64: user.publicKey,
                privateKeyBase64: user.privateKey
            };
            this.userKeys.set(userId, keys);

            return keys;
        } catch (error) {
            console.error('Error getting user keys:', error);
            return null;
        }
    }

    getUserPublicKey(userId) {
        const keys = this.userKeys.get(userId);
        return keys ? keys.publicKey : null;
    }

    async encryptMessage(message, recipientId) {
        try {
            const recipientKeys = await this.getUserKeys(recipientId);
            if (!recipientKeys) {
                throw new Error('Recipient public key not found');
            }

            const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
            const messageBytes = sodium.from_string(message);
            
            const encryptedMessage = sodium.crypto_box_easy(
                messageBytes,
                nonce,
                recipientKeys.publicKey,
                recipientKeys.privateKey
            );

            // Combine nonce and encrypted message
            const fullMessage = new Uint8Array(nonce.length + encryptedMessage.length);
            fullMessage.set(nonce);
            fullMessage.set(encryptedMessage, nonce.length);

            // Convert to base64 for storage
            return sodium.to_base64(fullMessage);
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt message');
        }
    }

    async decryptMessage(encryptedMessage, userId) {
        try {
            const userKeys = await this.getUserKeys(userId);
            if (!userKeys) {
                throw new Error('User keys not found');
            }

            // Convert from base64 and split nonce and message
            const fullMessage = sodium.from_base64(encryptedMessage);
            const nonce = fullMessage.slice(0, sodium.crypto_box_NONCEBYTES);
            const message = fullMessage.slice(sodium.crypto_box_NONCEBYTES);

            const decrypted = sodium.crypto_box_open_easy(
                message,
                nonce,
                userKeys.publicKey,
                userKeys.privateKey
            );

            return sodium.to_string(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt message');
        }
    }

    // Create middleware for inactivity monitoring
    createInactivityMiddleware() {
        return (req, res, next) => {
            const userId = req.user?.userId;
            if (userId) {
                this.resetInactivityTimer(userId);
            }
            next();
        };
    }

    // Generate session key for WebRTC
    generateSessionKey() {
        return crypto.randomBytes(32).toString('base64');
    }

    // Hash sensitive data (for logging)
    hashSensitiveData(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // Validate input to prevent injection attacks
    validateInput(input, type = 'text') {
        const patterns = {
            text: /^[a-zA-Z0-9\s.,!?-]{1,500}$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            username: /^[a-zA-Z0-9_-]{3,20}$/,
            password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
        };

        if (!patterns[type]) {
            throw new Error('Invalid validation type');
        }

        return patterns[type].test(input);
    }

    // Sanitize output to prevent XSS
    sanitizeOutput(data) {
        if (typeof data !== 'string') return data;
        
        return data
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    static async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }

    static async comparePassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    static encryptMessage(text) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    static decryptMessage(text) {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    static generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }
}

module.exports = SecurityService;
