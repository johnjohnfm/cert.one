/**
 * Puppeteer configuration to control Chrome download behavior
 * This prevents automatic Chrome download during npm install
 */
module.exports = {
  // Skip downloading Chrome during npm install
  skipDownload: true,
  
  // Use system Chrome if available
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
  
  // Cache directory for Chrome downloads (when needed)
  cacheDirectory: '.cache/puppeteer'
};
