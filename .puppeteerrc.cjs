/**
 * Puppeteer configuration to control Chrome download behavior
 */
module.exports = {
  // Allow Puppeteer to download Chromium
  skipDownload: false,
  
  // Cache directory for Chrome downloads
  cacheDirectory: '.cache/puppeteer'
};
