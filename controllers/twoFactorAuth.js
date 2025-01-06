// controllers/twoFactorAuth.js
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

function generate2FASecret() {
  const secret = speakeasy.generateSecret({ length: 20 });
  return { base32: secret.base32, otpauth_url: secret.otpauth_url };
}

function verify2FAToken(secret, token) {
  return speakeasy.totp.verify({ secret, encoding: 'base32', token });
}

async function generateQRCode(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

module.exports = { generate2FASecret, verify2FAToken, generateQRCode };
