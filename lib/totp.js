const crypto = require('crypto');

/**
 * Decodes a base32 encoded string into a Buffer.
 * @param {string} str - Base32 string
 * @returns {Buffer}
 */
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanStr = str.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const val = alphabet.indexOf(cleanStr[i]);
    if (val === -1) {
      throw new Error('Invalid base32 character: ' + cleanStr[i]);
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Encodes a Buffer into a base32 string.
 * @param {Buffer} buffer - Buffer to encode
 * @returns {string}
 */
function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Generates a TOTP token for a given secret and counter/time-step.
 * @param {string} secret - Base32 secret
 * @param {number} timeStep - Counter/time-step
 * @returns {string} 6-digit TOTP token
 */
function generateTOTP(secret, timeStep) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  
  // Write 64-bit integer
  buffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = code % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a TOTP token against a secret.
 * @param {string} secret - Base32 secret
 * @param {string} token - 6-digit user input
 * @param {number} [window=1] - Verification window size
 * @returns {boolean}
 */
function verifyTOTP(secret, token, window = 1) {
  if (!token || token.length !== 6) return false;
  
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secret, timeStep + i) === token) {
      return true;
    }
  }
  return false;
}

/**
 * Generates a new 2FA secret and setup URL.
 * @param {string} email - Admin email address
 * @param {string} [issuer='SaLiTeSt Launch'] - App issuer name
 * @returns {{secret: string, otpauthUrl: string}}
 */
function generateSecret(email = 'admin@salitest.org', issuer = 'SaLiTeSt Launch') {
  const randomBytes = crypto.randomBytes(20);
  const secret = base32Encode(randomBytes).replace(/=/g, '');
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  return { secret, otpauthUrl };
}

module.exports = {
  generateSecret,
  verifyTOTP,
  generateTOTP,
  base32Encode,
  base32Decode
};
