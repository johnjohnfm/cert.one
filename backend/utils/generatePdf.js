const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Browser detection and initialization
let browserEngine;
let engineType = null;

// Try chrome-aws-lambda first (for serverless/Render)
try {
  const chromeLambda = require('chrome-aws-lambda');
  browserEngine = chromeLambda;
  engineType = 'chrome-aws-lambda';
  console.log('Using chrome-aws-lambda for PDF generation');
} catch (e) {
  console.warn('chrome-aws-lambda not available, trying puppeteer-core');
  
  // Try puppeteer-core
  try {
    const puppeteerCore = require('puppeteer-core');
    browserEngine = puppeteerCore;
    engineType = 'puppeteer-core';
    console.log('Using puppeteer-core for PDF generation');
  } catch (e2) {
    console.error('No browser engine available:', e2.message);
    throw new Error('No browser engine available for PDF generation');
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
    browserInstance = await launchBrowser();
    console.log('Browser launched successfully');

    page = await browserInstance.newPage();
    console.log('New page created');
    
    // Set content with timeout handling
    await page.setContent(html, { 
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });
    console.log('Content set on page');

    // Generate PDF with A4 format
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
      timeout: 30000
    });

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;

  } catch (error) {
    console.error('PDF generation error:', error);
    console.error('Stack trace:', error.stack);
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    // Cleanup resources
    await cleanup(page, browserInstance);
  }
}

/**
 * Find template file in various possible locations
 */
function findTemplatePath() {
  const possiblePaths = [
    path.join(__dirname, '..', 'templates', 'cert.hbs'),
    path.join(__dirname, 'templates', 'cert.hbs'),
    path.join(process.cwd(), 'templates', 'cert.hbs'),
    path.join(process.cwd(), 'backend', 'templates', 'cert.hbs'),
    path.join(process.cwd(), 'src', 'backend', 'templates', 'cert.hbs')
  ];
  
  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }
  
  throw new Error(`Template not found at any of these paths: ${possiblePaths.join(', ')}`);
}

/**
 * Launch browser with appropriate configuration
 */
async function launchBrowser() {
  if (engineType === 'chrome-aws-lambda') {
    console.log('Launching chrome-aws-lambda browser...');
    
    const executablePath = await browserEngine.executablePath;
    console.log('Chrome executable path:', executablePath);
    
    // Use puppeteer-core that comes with chrome-aws-lambda
    const puppeteer = browserEngine.puppeteer;
    
    return await puppeteer.launch({
      args: browserEngine.args,
      defaultViewport: browserEngine.defaultViewport,
      executablePath: executablePath,
      headless: browserEngine.headless,
      ignoreHTTPSErrors: true,
      timeout: 30000
    });
  } else if (engineType === 'puppeteer-core') {
    console.log('Launching puppeteer-core browser...');
    
    // Look for Chromium in common locations
    const possiblePaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      process.env.PUPPETEER_EXECUTABLE_PATH,
      path.join(process.cwd(), 'node_modules/puppeteer/.local-chromium'),
      path.join(process.cwd(), '.cache/puppeteer')
    ].filter(Boolean);
    
    let executablePath = null;
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        executablePath = chromePath;
        break;
      }
    }
    
    // If no Chrome found, try to find the downloaded Chromium
    if (!executablePath) {
      const puppeteerDir = path.join(process.cwd(), 'node_modules/puppeteer');
      if (fs.existsSync(puppeteerDir)) {
        const chromiumDirs = fs.readdirSync(puppeteerDir).filter(dir => dir.includes('chromium'));
        if (chromiumDirs.length > 0) {
          executablePath = path.join(puppeteerDir, chromiumDirs[0], 'chrome');
        }
      }
    }
    
    if (!executablePath) {
      throw new Error('Chrome/Chromium executable not found. Please ensure Chrome is installed.');
    }
    
    console.log('Using Chrome executable at:', executablePath);
    
    return await browserEngine.launch({
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ],
      headless: true,
      ignoreHTTPSErrors: true,
      timeout: 30000
    });
  } else {
    throw new Error('No browser engine available');
  }
}

/**
 * Clean up browser resources
 */
async function cleanup(page, browserInstance) {
  if (page) {
    try {
      await page.close();
      console.log('Page closed');
    } catch (closeError) {
      console.warn('Error closing page:', closeError.message);
    }
  }
  
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log('Browser closed');
    } catch (closeError) {
      console.warn('Error closing browser:', closeError.message);
    }
  }
}

module.exports = generatePdf;
