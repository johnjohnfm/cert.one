// backend/utils/hasher.js
const crypto = require('crypto');

/**
 * Generate SHA256 hash from text input
 * @param {string} text - Text to hash
 * @returns {string} - SHA256 hash in hex format
 */
function hashText(text) {
  if (!text) throw new Error('Text input is required');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Generate SHA256 hash from file buffer
 * @param {Buffer} buffer - File buffer to hash
 * @returns {string} - SHA256 hash in hex format
 */
function hashFile(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Valid buffer is required');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate SHA256 hash from file path (for server-side files)
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} - SHA256 hash in hex format
 */
async function hashFileFromPath(filePath) {
  const fs = require('fs').promises;
  try {
    const buffer = await fs.readFile(filePath);
    return hashFile(buffer);
  } catch (error) {
    throw new Error(`Failed to hash file from path: ${error.message}`);
  }
}

/**
 * Generate multiple hash formats for comprehensive verification
 * @param {Buffer|string} input - Input to hash (buffer for files, string for text)
 * @returns {object} - Object containing multiple hash formats
 */
function generateHashBundle(input) {
  const isBuffer = Buffer.isBuffer(input);
  const sha256 = isBuffer ? hashFile(input) : hashText(input);
  
  // Additional hash formats for enhanced verification
  const md5 = crypto.createHash('md5').update(input).digest('hex');
  const sha1 = crypto.createHash('sha1').update(input).digest('hex');
  const sha512 = crypto.createHash('sha512').update(input).digest('hex');
  
  return {
    sha256,
    md5,
    sha1,
    sha512,
    timestamp: new Date().toISOString(),
    size: isBuffer ? input.length : Buffer.byteLength(input, 'utf8')
  };
}

/**
 * Verify hash against original content
 * @param {Buffer|string} input - Original content
 * @param {string} expectedHash - Expected SHA256 hash
 * @returns {boolean} - True if hash matches
 */
function verifyHash(input, expectedHash) {
  const actualHash = Buffer.isBuffer(input) ? hashFile(input) : hashText(input);
  return actualHash === expectedHash;
}

/**
 * Generate a unique certificate ID based on hash and timestamp
 * @param {string} hash - SHA256 hash
 * @returns {string} - Unique certificate identifier
 */
function generateCertificateId(hash) {
  const timestamp = Date.now().toString();
  const combined = hash + timestamp;
  return 'CERT_' + crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16).toUpperCase();
}

module.exports = {
  hashText,
  hashFile,
  hashFileFromPath,
  generateHashBundle,
  verifyHash,
  generateCertificateId
};
