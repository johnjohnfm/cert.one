const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

// Helper function to find template path
function findTemplatePath() {
  const possiblePaths = [
    path.join(__dirname, '../templates/cert.hbs'),
    path.join(__dirname, '../../templates/cert.hbs'),
    path.join(process.cwd(), 'templates/cert.hbs'),
    path.join(process.cwd(), 'backend/templates/cert.hbs')
  ];
  
  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }
  
  throw new Error('Certificate template not found. Checked paths: ' + possiblePaths.join(', '));
}

// Helper function to cleanup browser resources
async function cleanup(page, browserInstance) {
  try {
    if (page) {
      await page.close();
    }
    if (browserInstance) {
      await browserInstance.close();
    }
  } catch (error) {
    console.warn('Cleanup warning:', error.message);
  }
}

// Helper function to find Chromium executable
function findChromiumExecutable() {
  const { execSync } = require('child_process');
  
  // Check common system Chrome locations
  const chromePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/opt/google/chrome/chrome'
  ];
  
  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      console.log('Found system Chrome at:', chromePath);
      return chromePath;
    }
  }
  
  // Try to find via which command
  try {
    const chromePath = execSync('which google-chrome || which chromium-browser || which chrome', { encoding: 'utf8' }).trim();
    if (chromePath && fs.existsSync(chromePath)) {
      console.log('Found system Chrome via which:', chromePath);
      return chromePath;
    }
  } catch (error) {
    console.log('No system Chrome found via which command');
  }
  
  return null;
}

// Fallback PDF generation using a simple approach
async function generatePdfFallback(data) {
  console.log('Using fallback PDF generation method...');
  
  // Try to use the new sophisticated template if available
  let templatePath = path.join(__dirname, '..', 'templates', 'CERTONEv2_flat.html');
  let templateHtml;
  
  if (fs.existsSync(templatePath)) {
    console.log('Using sophisticated template for fallback');
    templateHtml = fs.readFileSync(templatePath, 'utf8');
    
    // Replace static content with dynamic data
    // This is a basic replacement - you may want to convert this to proper Handlebars
    let html = templateHtml
      .replace(/Test User/g, data.userName || 'Unknown User')
      .replace(/test@example.com/g, data.email || 'No Email')
      .replace(/Test Certificate/g, data.title || 'Certificate')
      .replace(/CERT_123/g, data.certificateId || 'Unknown ID')
      .replace(/hash123/g, data.fileHash || 'No Hash')
      .replace(/2025-07-13T06:39:31.245Z/g, data.timestamp || new Date().toISOString())
      .replace(/Bitcoin/g, data.blockchain || 'Unknown Blockchain')
      .replace(/https:\/\/example.com/g, data.verificationLink || '#');
    
    console.log('Sophisticated template processed for fallback');
    return Buffer.from(html, 'utf8');
  } else {
    console.log('Sophisticated template not found, using basic fallback');
    
    // Use the original basic template
    templatePath = findTemplatePath();
    templateHtml = fs.readFileSync(templatePath, 'utf8');
    const compile = handlebars.compile(templateHtml);
    const html = compile(data);
    
    // Create a simple HTML document with embedded styles
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
      color: #333;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 30px;
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .field {
      margin-bottom: 15px;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .label {
      font-weight: bold;
      color: #555;
      display: inline-block;
      width: 150px;
    }
    .value {
      color: #333;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="title">CERT.ONE Certificate</div>
  <div class="field"><span class="label">User:</span> <span class="value">${data.userName}</span></div>
  <div class="field"><span class="label">Email:</span> <span class="value">${data.email}</span></div>
  <div class="field"><span class="label">Title:</span> <span class="value">${data.title}</span></div>
  <div class="field"><span class="label">File Name:</span> <span class="value">${data.fileName}</span></div>
  <div class="field"><span class="label">Certificate ID:</span> <span class="value">${data.certificateId}</span></div>
  <div class="field"><span class="label">File Hash:</span> <span class="value">${data.fileHash}</span></div>
  <div class="field"><span class="label">Timestamp:</span> <span class="value">${data.timestamp}</span></div>
  <div class="field"><span class="label">Blockchain:</span> <span class="value">${data.blockchain}</span></div>
  <div class="field"><span class="label">Verify:</span> <span class="value">${data.verificationLink}</span></div>
  <div class="footer">
    Generated by CERT.ONE - Blockchain Certificate Service
  </div>
</body>
</html>`;
    
    console.log('Fallback method: Returning HTML content (PDF generation not available)');
    return Buffer.from(fullHtml, 'utf8');
  }
}

async function generatePdf(data) {
  let browserInstance;
  let page;

  try {
    console.log('Starting PDF generation with data:', data);
    
    // Validate input data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided for PDF generation');
    }

    // Read and compile template
    const templatePath = findTemplatePath();
    console.log('Using template at:', templatePath);
    
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    console.log('Template loaded successfully');
    
    const compile = handlebars.compile(templateHtml);
    const html = compile(data);
    console.log('Template compiled successfully');

    // Launch browser with proper configuration
    console.log('Launching Puppeteer browser...');
    console.log('Puppeteer version:', require('puppeteer/package.json').version);
    
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--deterministic-fetch',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ],
      ignoreHTTPSErrors: true,
      timeout: 15000,
      protocolTimeout: 15000
    };
    
    // Try to find Chrome executable
    const chromePath = findChromiumExecutable();
    if (chromePath) {
      launchOptions.executablePath = chromePath;
      console.log('Using system Chrome executable:', chromePath);
    } else {
      console.log('No system Chrome found, will try bundled Chromium');
      
      // Check if bundled Chromium exists
      const puppeteerPath = path.dirname(require.resolve('puppeteer'));
      const chromiumPaths = [
        path.join(puppeteerPath, '.local-chromium'),
        path.join(puppeteerPath, 'chromium'),
        path.join(puppeteerPath, '.cache', 'chrome'),
        process.env.PUPPETEER_EXECUTABLE_PATH
      ].filter(Boolean);
      
      let chromiumFound = false;
      for (const chromiumPath of chromiumPaths) {
        if (chromiumPath && fs.existsSync(chromiumPath)) {
          console.log('Found bundled Chromium at:', chromiumPath);
          launchOptions.executablePath = chromiumPath;
          chromiumFound = true;
          break;
        }
      }
      
      if (!chromiumFound) {
        console.log('No bundled Chromium found, skipping PDF generation attempt');
        console.log('Falling back to HTML generation...');
        return await generatePdfFallback(data);
      }
    }
    
    console.log('Launch options:', JSON.stringify(launchOptions, null, 2));
    
    // Quick timeout for browser launch
    const browserPromise = puppeteer.launch(launchOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Browser launch timeout')), 10000)
    );
    
    browserInstance = await Promise.race([browserPromise, timeoutPromise]);
    console.log('Browser launched successfully');

    page = await browserInstance.newPage();
    console.log('New page created');
    
    // Set content with timeout handling
    console.log('Setting page content...');
    await page.setContent(html, {
      waitUntil: ['domcontentloaded'],
      timeout: 10000
    });
    
    // Wait a bit for any dynamic content to settle
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Content set on page');

    // Generate PDF with A4 format
    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({ 
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 15000,
      displayHeaderFooter: false,
      omitBackground: false,
      scale: 1.0,
      landscape: false
    });

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
    
    // Validate PDF buffer
    if (pdfBuffer.length < 100) {
      throw new Error('Generated PDF is too small, likely corrupted');
    }
    
    // Check if it's actually a PDF (should start with %PDF)
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    console.log('PDF header check:', `"${pdfHeader}"`);
    
    if (pdfHeader !== '%PDF') {
      console.warn('Generated content does not appear to be a valid PDF, falling back to HTML');
      console.warn('First 20 bytes as hex:', pdfBuffer.toString('hex', 0, 20));
      console.warn('First 20 bytes as ascii:', pdfBuffer.toString('ascii', 0, 20));
      return await generatePdfFallback(data);
    }
    
    console.log('PDF validation passed, returning PDF buffer');
    return pdfBuffer;

  } catch (error) {
    console.error('PDF generation error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Check for specific Puppeteer errors
    if (error.message && error.message.includes('executable')) {
      console.error('Chrome/Chromium executable not found. Please ensure Chrome is installed or set PUPPETEER_EXECUTABLE_PATH');
    }
    
    if (error.message && error.message.includes('timeout')) {
      console.error('PDF generation timed out. This might be due to slow system resources.');
    }
    
    if (error.message && error.message.includes('ECONNREFUSED')) {
      console.error('Connection refused. This might be a network or firewall issue.');
    }
    
    // Log environment info for debugging
    console.error('Environment info:');
    console.error('- Node version:', process.version);
    console.error('- Platform:', process.platform);
    console.error('- Architecture:', process.arch);
    console.error('- Current working directory:', process.cwd());
    console.error('- PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH || 'not set');
    
    // Try fallback method
    console.log('Attempting fallback PDF generation...');
    try {
      return await generatePdfFallback(data);
    } catch (fallbackError) {
      console.error('Fallback PDF generation also failed:', fallbackError);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  } finally {
    // Cleanup resources
    await cleanup(page, browserInstance);
  }
}

module.exports = generatePdf;
