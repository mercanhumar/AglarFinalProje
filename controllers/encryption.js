// controllers/encryption.js
const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(String(process.env.ENCRYPTION_KEY || 'default_key'))
  .digest('base64')
  .substr(0, 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) {
    throw new Error('Text to encrypt is required');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
  if (!encryptedText.includes(':')) {
    throw new Error('Invalid encrypted text format');
  }
  const [iv, content] = encryptedText.split(':');
  if (!iv || !content) {
    throw new Error('Invalid encrypted text format');
  }
  if (iv.length !== IV_LENGTH * 2) {
    throw new Error(`Invalid IV length. Expected ${IV_LENGTH * 2} hex chars, got ${iv.length}`);
  }
  const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
