const crypto = require('crypto');

// Encryption key generation from password
function generateKey(password) {
    return crypto.scryptSync(password, 'salt', 32);
}

// Encrypt message
function encryptMessage(message, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag.toString('hex')
    };
}

// Decrypt message
function decryptMessage(encryptedMsg, key) {
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(encryptedMsg.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedMsg.authTag, 'hex'));
    let decrypted = decipher.update(encryptedMsg.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = {
    generateKey,
    encryptMessage,
    decryptMessage
};
