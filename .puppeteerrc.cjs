/**
 * Puppeteer configuration for Render.com
 */
const path = require('path');

module.exports = {
  // Use absolute path for cache directory
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
  
  // Skip download and use system Chrome if issues persist
  skipDownload: process.env.PUPPETEER_SKIP_DOWNLOAD === 'true'
};
