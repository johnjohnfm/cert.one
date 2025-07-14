const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

// Simple template path finder
function findTemplatePath() {
  const paths = [
    path.join(__dirname, '../templates/CERTONEv3.hbs'),
    path.join(__dirname, '../../templates/CERTONEv3.hbs'),
    path.join(process.cwd(), 'templates/CERTONEv3.hbs'),
    path.join(process.cwd(), 'backend/templates/CERTONEv3.hbs')
  ];
  
  for (const templatePath of paths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }
  
  throw new Error('Template not found in: ' + paths.join(', '));
}

// Main PDF generation function
async function generatePdf(data) {
  let browser;
  try {
    console.log('Starting PDF generation with data:', data);
    
    // Validate input
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided');
    }

    // Load template
    const templatePath = findTemplatePath();
    console.log('Using template at:', templatePath);
    
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    console.log('Template loaded successfully');
    
    // Compile template
    const template = handlebars.compile(templateHtml);
    const html = template(data);
    console.log('Template compiled successfully');

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-logging',
        '--silent'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    // Disable console output in the page
    await page.evaluateOnNewDocument(() => {
      console.log = () => {};
      console.error = () => {};
      console.warn = () => {};
      console.info = () => {};
    });
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      preferCSSPageSize: true
    });
    
    console.log('PDF generated successfully');
    return pdfBuffer;
    
  } catch (error) {
    console.error('PDF generation error:', error);
    
    // Fallback: return HTML if PDF generation fails
    try {
      const templatePath = findTemplatePath();
      const templateHtml = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateHtml);
      const html = template(data);
      console.log('Falling back to HTML output');
      return Buffer.from(html, 'utf8');
    } catch (fallbackError) {
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Export the function
module.exports = generatePdf;
