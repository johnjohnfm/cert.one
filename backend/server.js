const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const generatePdf = require('./utils/generatePdf');
const { hashText, hashFile, generateCertificateId } = require('./utils/hasher');
const { createTimestampAPI } = require('./utils/opentimestamps');
const { uploadToIPFS, uploadMetadataToIPFS, createCertificateMetadata } = require('./utils/ipfs');

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CERT.ONE Backend API',
    version: '1.0.0',
    endpoints: [
      'GET /health - Health check',
      'POST /certify - Generate certificate from JSON data',
      'POST /certify-text - Generate certificate from text',
      'POST /certify-file - Generate certificate from file upload',
      'POST /verify - Verify a hash',
      'GET /certificate/:id - Get certificate metadata'
    ]
  });
});

// Original certificate endpoint (for JSON data)
app.post('/certify', async (req, res, next) => {
  try {
    console.log('Received certify request:', req.body);
    
    // Validate required fields
    const { userName, fileName, fileHash } = req.body;
    if (!userName || !fileName || !fileHash) {
      return res.status(400).json({ 
        error: 'Missing required fields: userName, fileName, fileHash' 
      });
    }

    const pdfBuffer = await generatePdf(req.body);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CERTONE_${Date.now()}.pdf"`,
      'Content-Length': pdfBuffer.length
    }).send(pdfBuffer);
  } catch (err) {
    console.error('[ERROR] PDF generation failed:', err);
    next(err);
  }
});

// Text-based certification endpoint
app.post('/certify-text', async (req, res, next) => {
  try {
    const { text, userName, email, title } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text content is required' });
    }
    
    // Generate hash
    const fileHash = hashText(text);
    const certificateId = generateCertificateId(fileHash);
    
    // Create timestamp (simplified version)
    const timestampData = await createTimestampAPI(fileHash);
    
    // Prepare certificate data
    const certData = {
      userName: userName || 'Anonymous',
      email: email || '',
      title: title || 'Text Document',
      fileName: `text-${Date.now()}.txt`,
      certificateId,
      fileHash,
      timestamp: new Date().toISOString(),
      blockchain: 'Bitcoin (OpenTimestamps)',
      verificationLink: timestampData.verificationUrl || 'https://ots.tools/verify',
      merkleRoot: timestampData.otsData || ''
    };
    
    // Optional IPFS upload (only if credentials are configured)
    let ipfsResult = null;
    if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
      try {
        const metadata = createCertificateMetadata(certData, fileHash, timestampData);
        ipfsResult = await uploadMetadataToIPFS(metadata, `cert-${certificateId}`);
      } catch (ipfsError) {
        console.warn('IPFS upload failed:', ipfsError.message);
      }
    }
    
    // Generate PDF certificate
    const pdfBuffer = await generatePdf(certData);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CERT_${certificateId}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'X-Certificate-ID': certificateId,
      'X-File-Hash': fileHash,
      'X-IPFS-Hash': ipfsResult?.ipfsHash || 'none'
    }).send(pdfBuffer);
    
  } catch (err) {
    console.error('[ERROR] Text certification failed:', err);
    next(err);
  }
});

// File-based certification endpoint
app.post('/certify-file', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    const { userName, email, title } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }
    
    // Generate hash
    const fileHash = hashFile(file.buffer);
    const certificateId = generateCertificateId(fileHash);
    
    // Create timestamp
    const timestampData = await createTimestampAPI(fileHash);
    
    // Prepare certificate data
    const certData = {
      userName: userName || 'Anonymous',
      email: email || '',
      title: title || 'File Document',
      fileName: file.originalname,
      certificateId,
      fileHash,
      timestamp: new Date().toISOString(),
      blockchain: 'Bitcoin (OpenTimestamps)',
      verificationLink: timestampData.verificationUrl || 'https://ots.tools/verify',
      merkleRoot: timestampData.otsData || ''
    };
    
    // Optional IPFS upload
    let ipfsResult = null;
    let metadataResult = null;
    
    if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
      try {
        ipfsResult = await uploadToIPFS(file.buffer, file.originalname, {
          certificateId,
          userName,
          hash: fileHash
        });
        
        const metadata = createCertificateMetadata(certData, fileHash, timestampData);
        if (ipfsResult) {
          metadata.ipfs.fileHash = ipfsResult.ipfsHash;
          metadata.ipfs.gatewayUrl = ipfsResult.gatewayUrl;
        }
        metadataResult = await uploadMetadataToIPFS(metadata, `cert-${certificateId}`);
      } catch (ipfsError) {
        console.warn('IPFS upload failed:', ipfsError.message);
      }
    }
    
    // Generate PDF certificate
    const pdfBuffer = await generatePdf(certData);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CERT_${certificateId}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'X-Certificate-ID': certificateId,
      'X-File-Hash': fileHash,
      'X-IPFS-File-Hash': ipfsResult?.ipfsHash || 'none',
      'X-IPFS-Metadata-Hash': metadataResult?.ipfsHash || 'none'
    }).send(pdfBuffer);
    
  } catch (err) {
    console.error('[ERROR] File certification failed:', err);
    next(err);
  }
});

// Endpoint to verify a hash
app.post('/verify', async (req, res, next) => {
  try {
    const { hash, otsData } = req.body;
    
    if (!hash) {
      return res.status(400).json({ error: 'Hash is required for verification' });
    }
    
    // Basic hash format validation
    if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: 'Invalid SHA256 hash format' });
    }
    
    res.json({
      hash,
      verified: false, // Would implement actual verification logic here
      timestamp: new Date().toISOString(),
      verificationUrl: `https://ots.tools/verify`,
      message: 'Hash received - verification functionality coming soon'
    });
    
  } catch (err) {
    console.error('[ERROR] Verification failed:', err);
    next(err);
  }
});

// Endpoint to get certificate metadata
app.get('/certificate/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    res.json({
      certificateId: id,
      status: 'Certificate lookup functionality coming soon',
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('[ERROR] Certificate lookup failed:', err);
    next(err);
  }
});

// Fallback route
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableEndpoints: [
      'GET / - API information',
      'GET /health - Health check',
      'POST /certify - Generate certificate from JSON data',
      'POST /certify-text - Generate certificate from text',
      'POST /certify-file - Generate certificate from file upload',
      'POST /verify - Verify a hash',
      'GET /certificate/:id - Get certificate metadata'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 50MB'
      });
    }
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CERT.ONE Server listening on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET / - API information`);
  console.log(`   GET /health - Health check`);
  console.log(`   POST /certify - Generate certificate from JSON`);
  console.log(`   POST /certify-text - Generate certificate from text`);
  console.log(`   POST /certify-file - Generate certificate from file`);
  console.log(`   POST /verify - Verify hash`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   IPFS: ${process.env.PINATA_API_KEY ? 'Enabled' : 'Disabled'}`);
});

module.exports = app;
