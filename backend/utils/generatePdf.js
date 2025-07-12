const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Try to use chrome-aws-lambda first, fallback to puppeteer
let browser;
let useLambda = false;

try {
  browser = require('chrome-aws-lambda');
  useLambda = true;
  console.log('Using chrome-aws-lambda for PDF generation');
} catch (e) {
  console.warn('chrome-aws-lambda not available, falling back to puppeteer');
  try {
    browser = require('puppeteer');
    useLambda = false;
    console.log('Using puppeteer for PDF generation');
  } catch (e2) {
    console.error('Neither chrome-aws-lambda nor puppeteer available');
    throw new Error('No browser engine available');
  }
}

async function generatePdf(data) {
  try {
    console.log('Starting PDF generation with data:', data);
    
    // Validate input data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided for PDF generation');
    }

    // Read and compile template
    const templatePath = path.join(__dirname, '..', 'templates', 'cert.hbs');
    console.log('Looking for template at:', templatePath);
    
    if (!fs.existsSync(templatePath)) {
      // Try alternative paths
      const altPaths = [
        path.join(__dirname, 'templates', 'cert.hbs'),
        path.join(process.cwd(), 'templates', 'cert.hbs'),
        path.join(process.cwd(), 'backend', 'templates', 'cert.hbs')
      ];
      
      let found = false;
      for (const altPath of altPaths) {
        if (fs.existsSync(altPath)) {
          console.log(`Found template at alternative path: ${altPath}`);
          templatePath = altPath;
          found = true;
          break;
        }
      }
      
      if (!found) {
        throw new Error(`Template not found at any of these paths: ${[templatePath, ...altPaths].join(', ')}`);
      }
    }
    
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    console.log('Template loaded successfully');
    
    const compile = handlebars.compile(templateHtml);
    const html = compile(data);
    console.log('Template compiled successfully');

    let browserInstance;
    let page;

    try {
      // Launch browser
      if (useLambda && browser.puppeteer) {
        console.log('Launching chrome-aws-lambda browser...');
        browserInstance = await browser.puppeteer.launch({
          args: browser.args,
          defaultViewport: browser.defaultViewport,
          executablePath: await browser.executablePath,
          headless: browser.headless !== false
        });
      } else {
        console.log('Launching puppeteer browser...');
        browserInstance = await browser.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-javascript',
            '--disable-plugins-discovery',
            '--disable-preconnect',
            '--disable-prefetch',
            '--single-process',
            '--no-zygote'
          ]
        });
      }

      console.log('Browser launched successfully');
      page = await browserInstance.newPage();
      console.log('New page created');
      
      // Set content and wait for rendering
      await page.setContent(html, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });
      console.log('Content set on page');

      // Generate PDF
      const pdfBuffer = await page.pdf({ 
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      });

      console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;

    } finally {
      // Clean up
      if (page) {
        try {
          await page.close();
          console.log('Page closed');
        } catch (closeError) {
          console.warn('Error closing page:', closeError);
        }
      }
      if (browserInstance) {
        try {
          await browserInstance.close();
          console.log('Browser closed');
        } catch (closeError) {
          console.warn('Error closing browser:', closeError);
        }
      }
    }

  } catch (error) {
    console.error('PDF generation error:', error);
    console.error('Stack trace:', error.stack);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

module.exports = generatePdf;
