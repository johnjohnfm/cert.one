/**
 * Puppeteer configuration to control Chrome download behavior
 * This prevents automatic Chrome download during npm install
 */
module.exports = {
  // Skip downloading Chrome during npm install
  skipDownload: false,  // Changed to false to allow Puppeteer to download its own Chromium
  
  // Cache directory for Chrome downloads (when needed)
  cacheDirectory: '.cache/puppeteer'
};
