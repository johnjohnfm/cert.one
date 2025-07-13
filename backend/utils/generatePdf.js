const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

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
    browserInstance = await puppeteer.launch({
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
    });
    console.log('Browser launched successfully');

    page = await browserInstance.newPage();
    console.log('New page created');
    
    // Set content with timeout handling
  await page.setContent(htmlContent, {
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
    if (error.message && error.message.includes('executable')) {
      console.error(
        'Hint: Chrome/Chromium may not be installed or PUPPETEER_EXECUTABLE_PATH is incorrect.'
      );
    }
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    // Cleanup resources
    await cleanup(page, browserInstance);
  }
}
