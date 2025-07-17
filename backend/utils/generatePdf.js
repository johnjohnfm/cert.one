const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { PDFDocument, PDFName, PDFString, PDFHexString, PDFRawStream, PDFDict } = require('pdf-lib'); // Add PDFRawStream, PDFDict
const crypto = require('crypto'); // Add at the top for password generation
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

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

// Helper to build XMP XML string
function buildXmpXml({ title, author, subject, producer, creator, custom, creationDate, modificationDate, format }) {
  // Escape XML special chars
  const esc = (str) => (str ? String(str).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[c]) : '');

  // Format dates for XMP (ISO 8601 format)
  const formatXmpDate = (date) => {
    if (!date) return new Date().toISOString();
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') return date;
    return new Date().toISOString();
  };

  // Custom fields as <rdf:Description> children
  let customFields = '';
  if (custom && typeof custom === 'object') {
    for (const [key, value] of Object.entries(custom)) {
      if (value !== undefined && value !== null) {
        customFields += `      <certone:${esc(key)}>${esc(value)}</certone:${esc(key)}>\n`;
      }
    }
  }

  // Format field (if provided) - use PDF/A format specification
  const formatField = format ? `      <dc:format>${esc(format)}</dc:format>\n` : '';

  return `<?xpacket begin='' id='W5M0MpCehiHzreSzNTczkc9d'?>\n` +
`<x:xmpmeta xmlns:x='adobe:ns:meta/' xmlns:certone='https://cert.one/schema/'>\n` +
`  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>\n` +
`    <rdf:Description rdf:about='' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:xmp='http://ns.adobe.com/xap/1.0/' xmlns:xmpRights='http://ns.adobe.com/xap/1.0/rights/'>\n` +
`      <dc:title><rdf:Alt><rdf:li xml:lang='x-default'>${esc(title)}</rdf:li></rdf:Alt></dc:title>\n` +
`      <dc:creator><rdf:Seq><rdf:li>${esc(author)}</rdf:li></rdf:Seq></dc:creator>\n` +
`      <dc:description><rdf:Alt><rdf:li xml:lang='x-default'>${esc(subject)}</rdf:li></rdf:Alt></dc:description>\n` +
`      <dc:publisher><rdf:Seq><rdf:li>${esc(producer)}</rdf:li></rdf:Seq></dc:publisher>\n` +
`      <dc:contributor><rdf:Seq><rdf:li>${esc(creator)}</rdf:li></rdf:Seq></dc:contributor>\n` +
formatField +
`      <xmp:CreateDate>${formatXmpDate(creationDate)}</xmp:CreateDate>\n` +
`      <xmp:ModifyDate>${formatXmpDate(modificationDate)}</xmp:ModifyDate>\n` +
`      <xmpRights:Marked>True</xmpRights:Marked>\n` +
`      <xmpRights:CopyrightNotice>© 2025 CERT.ONE | JOHNJOHNFM, LLC. All rights reserved.</xmpRights:CopyrightNotice>\n` +
customFields +
`    </rdf:Description>\n` +
`  </rdf:RDF>\n` +
`</x:xmpmeta>\n` +
`<?xpacket end='w'?>`;
}

// Helper to inject XMP metadata into PDF
async function injectXmpMetadata(pdfDoc, xmpXml) {
  const xmpBytes = Buffer.from(xmpXml, 'utf8');
  const xmpStream = pdfDoc.context.flateStream(xmpBytes, {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
  });
  const xmpRef = pdfDoc.context.register(xmpStream);

  // Set /Metadata entry in the PDF catalog (handle both property and function)
  const catalog = typeof pdfDoc.catalog === 'function' ? pdfDoc.catalog() : pdfDoc.catalog;
  catalog.set(PDFName.of('Metadata'), xmpRef);
}

// Helper to set PDF metadata using pdf-lib, including custom fields and XMP
async function setPdfMetadata(pdfBuffer, { title, author, subject, producer, creator, custom }) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  
  // Set basic metadata
  if (title) pdfDoc.setTitle(title);
  if (author) pdfDoc.setAuthor(author);
  if (subject) pdfDoc.setSubject(subject);
  if (producer) pdfDoc.setProducer(producer);
  if (creator) pdfDoc.setCreator(creator);
  
  // Set creation and modification dates
  const now = new Date();
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);
  
  // Extract metadata for XMP (autofill values)
  const creationDate = now;
  const modificationDate = now;
  const format = 'PDF-1.7'; // PDF format version

  // Embed custom metadata fields for notarization/blockchain in the Info dictionary
  const keyMap = {
    file_hash: 'FileHash',
    fileHash: 'FileHash',
    certificate_id: 'CertificateId',
    certificateId: 'CertificateId',
    certificate_number: 'CertificateNumber',
    merkle_root: 'MerkleRoot',
    blockchain: 'Blockchain',
    verification_url: 'VerificationUrl',
    verificationLink: 'VerificationUrl',
    cid: 'Cid',
    block_id: 'BlockId',
    ipfs_cid: 'IpfsCid',
    // Add more mappings as needed
  };
  if (custom && typeof custom === 'object') {
    try {
      // Ensure /Info dictionary exists
      let infoRef = pdfDoc.context.trailer.get(PDFName.of('Info'));
      let infoDict;
      if (!infoRef) {
        infoDict = pdfDoc.context.obj({});
        infoRef = pdfDoc.context.register(infoDict);
        pdfDoc.context.trailer.set(PDFName.of('Info'), infoRef);
      } else {
        infoDict = pdfDoc.context.lookup(infoRef, PDFDict);
        // If lookup fails, create a new dictionary
        if (!infoDict) {
          console.log('Info dictionary lookup failed, creating new one');
          infoDict = pdfDoc.context.obj({});
          infoRef = pdfDoc.context.register(infoDict);
          pdfDoc.context.trailer.set(PDFName.of('Info'), infoRef);
        }
      }
      
      // Set custom metadata fields with error handling
      for (const [key, value] of Object.entries(custom)) {
        if (value !== undefined && value !== null) {
          try {
            const pdfKey = keyMap[key] || key;
            infoDict.set(PDFName.of(pdfKey), PDFString.of(String(value)));
          } catch (fieldError) {
            console.warn(`Failed to set metadata field ${key}:`, fieldError.message);
          }
        }
      }
    } catch (metadataError) {
      console.warn('Failed to set custom metadata:', metadataError.message);
      // Continue without custom metadata rather than failing completely
    }
  }

  // --- XMP Injection ---
  try {
    const xmpXml = buildXmpXml({ 
      title, 
      author, 
      subject, 
      producer, 
      creator, 
      custom, 
      creationDate, 
      modificationDate, 
      format 
    });
    await injectXmpMetadata(pdfDoc, xmpXml);
  } catch (xmpError) {
    console.warn('Failed to inject XMP metadata:', xmpError.message);
    // Continue without XMP metadata rather than failing completely
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
    let finalPdfBuffer = await setPdfMetadata(pdfBuffer, meta);

    // --- Encrypt PDF as the last step using qpdf CLI ---
    const password = crypto.randomBytes(12).toString('base64url');
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `certone-in-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    const outputPath = path.join(tmpDir, `certone-out-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(inputPath, finalPdfBuffer);
    
    // Correct qpdf syntax for encryption with permissions
    const qpdfArgs = [
      '--encrypt', password, password, '256',
      '--print=full', '--extract=y', '--annotate=y',
      '--modify=n', '--form=n', '--assembly=n',
      '--', inputPath, outputPath
    ];
    
    try {
      await execFileAsync('qpdf', qpdfArgs);
      const encryptedBuffer = fs.readFileSync(outputPath);
      // Clean up temp files
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      return encryptedBuffer; // Return just the buffer for compatibility
    } catch (qpdfErr) {
      // Clean up temp files if they exist
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      throw new Error('PDF encryption failed: ' + qpdfErr.message);
    }
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
