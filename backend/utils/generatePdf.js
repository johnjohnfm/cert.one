const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib'); // Add this at the top

// Template caching
let cachedTemplate = null;
let cachedTemplatePath = null;

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

// Get compiled template (with caching)
function getCompiledTemplate() {
  const templatePath = findTemplatePath();
  
  // Return cached template if available and path hasn't changed
  if (cachedTemplate && cachedTemplatePath === templatePath) {
    return cachedTemplate;
  }
  
  // Load and compile template
  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  cachedTemplate = handlebars.compile(templateHtml);
  cachedTemplatePath = templatePath;
  
  return cachedTemplate;
}

// Helper to set PDF metadata using pdf-lib, including custom fields
async function setPdfMetadata(pdfBuffer, { title, author, subject, producer, creator, custom }) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  if (title) pdfDoc.setTitle(title);
  if (author) pdfDoc.setAuthor(author);
  if (subject) pdfDoc.setSubject(subject);
  if (producer) pdfDoc.setProducer(producer);
  if (creator) pdfDoc.setCreator(creator);

  // Embed custom metadata fields for notarization/blockchain
  if (custom && typeof custom === 'object') {
    for (const [key, value] of Object.entries(custom)) {
      if (value !== undefined && value !== null) {
        // pdf-lib sets custom metadata as info dict entries
        pdfDoc.setCustomMetadata(key, String(value));
      }
    }
  }
  return await pdfDoc.save();
}

// Main PDF generation function
async function generatePdf(data) {
  let browser;
  try {
    console.log('Starting PDF generation with data:', data);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided');
    }
    
    // Use cached template
    const template = getCompiledTemplate();
    const html = template(data);

    // Launch Puppeteer with optimized settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-logging',
        '--silent',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    // Optimize page settings
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Set content with minimal wait
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    // Generate PDF with optimized settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      omitBackground: false
    });
    
    await browser.close();
    console.log('PDF generated successfully');

    // --- Set professional PDF metadata using pdf-lib ---
    const meta = {
      title: 'Blockchain Certificate', // Always fixed
      author: 'CERT.ONE by JOHNJOHNFM, LLC.',
      subject: 'Blockchain Certificate of Authenticity',
      producer: 'CERT.ONE Certificate Generator',
      creator: 'CERT.ONE Backend (Node.js, Puppeteer, pdf-lib)',
      custom: {
        file_hash: data.file_hash || data.fileHash,
        certificate_id: data.certificate_id || data.certificateId,
        certificate_number: data.certificate_number,
        merkle_root: data.merkle_root,
        blockchain: data.blockchain,
        verification_url: data.verification_url || data.verificationLink,
        cid: data.cid,
        block_id: data.block_id,
        ipfs_cid: data.ipfs_cid,
        // Add any other notarization-relevant fields here
      }
    };
    const finalPdfBuffer = await setPdfMetadata(pdfBuffer, meta);
    return finalPdfBuffer;
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    console.error('Error generating PDF, falling back to HTML:', err);
    // Fallback: return HTML as a Buffer
    try {
      const template = getCompiledTemplate();
      const html = template(data);
      return Buffer.from(html, 'utf8');
    } catch (fallbackErr) {
      throw new Error('PDF and HTML generation failed: ' + fallbackErr.message);
    }
  }
}

module.exports = generatePdf;
