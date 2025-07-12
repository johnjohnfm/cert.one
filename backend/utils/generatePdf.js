const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Try to use chrome-aws-lambda first, fallback to puppeteer
let browser;
try {
  browser = require('chrome-aws-lambda');
} catch (e) {
  console.warn('chrome-aws-lambda not available, falling back to puppeteer');
  try {
    browser = require('puppeteer');
  } catch (e2) {
    console.error('Neither chrome-aws-lambda nor puppeteer available');
    throw new Error('No browser engine available');
  }
}

async function generatePdf(data) {
  try {
    // Read and compile template
    const templatePath = path.join(__dirname, '..', 'templates', 'cert.hbs');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const compile = handlebars.compile(templateHtml);
    const html = compile(data);

    let browserInstance;
    let page;

    try {
      // Try chrome-aws-lambda first
      if (browser.puppeteer) {
        browserInstance = await browser.puppeteer.launch({
          args: browser.args,
          defaultViewport: browser.defaultViewport,
          executablePath: await browser.executablePath,
          headless: browser.headless || true
        });
      } else {
        // Fallback to regular puppeteer
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
            '--disable-prefetch'
          ]
        });
      }

      page = await browserInstance.newPage();
      
      // Set content and wait for rendering
      await page.setContent(html, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 10000
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({ 
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        printBackground: true
      });

      return pdfBuffer;

    } finally {
      // Clean up
      if (page) {
        await page.close();
      }
      if (browserInstance) {
        await browserInstance.close();
      }
    }

  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

module.exports = generatePdf;
