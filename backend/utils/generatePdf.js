const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

// Simple template path finder for certv3.hbs
function findTemplatePath() {
  const paths = [
    path.join(__dirname, '../templates/certv3.hbs'),
    path.join(__dirname, '../../templates/certv3.hbs'),
    path.join(process.cwd(), 'templates/certv3.hbs'),
    path.join(process.cwd(), 'backend/templates/certv3.hbs')
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
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided');
    }
    const templatePath = findTemplatePath();
    console.log('Using template at:', templatePath);
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);
    const html = template(data);

    // Launch Puppeteer and generate PDF
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
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      preferCSSPageSize: true
    });
    await browser.close();
    console.log('PDF generated successfully');
    return pdfBuffer;
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    console.error('Error generating PDF, falling back to HTML:', err);
    // Fallback: return HTML as a Buffer
    try {
      const templatePath = findTemplatePath();
      const templateHtml = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateHtml);
      const html = template(data);
      return Buffer.from(html, 'utf8');
    } catch (fallbackErr) {
      throw new Error('PDF and HTML generation failed: ' + fallbackErr.message);
    }
  }
}

module.exports = generatePdf;
