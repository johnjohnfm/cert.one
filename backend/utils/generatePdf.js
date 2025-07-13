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
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreHTTPSErrors: true,
      timeout: 30000
    };
    
    // Add executable path if specified in environment
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      console.log('Using custom Chrome executable:', process.env.PUPPETEER_EXECUTABLE_PATH);
    } else {
      // Try to find system Chrome as fallback
      const { execSync } = require('child_process');
      try {
        const chromePath = execSync('which google-chrome || which chromium-browser || which chrome', { encoding: 'utf8' }).trim();
        if (chromePath) {
          launchOptions.executablePath = chromePath;
          console.log('Using system Chrome executable:', chromePath);
        }
      } catch (error) {
        console.log('No system Chrome found, using bundled Chromium');
      }
    }
    
    console.log('Launch options:', JSON.stringify(launchOptions, null, 2));
    
    browserInstance = await puppeteer.launch(launchOptions);
    console.log('Browser launched successfully');

    page = await browserInstance.newPage();
    console.log('New page created');
    
    // Set content with timeout handling
    console.log('Setting page content...');
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });
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
      timeout: 30000
    });

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
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
    
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    // Cleanup resources
    await cleanup(page, browserInstance);
  }
}

module.exports = generatePdf;
