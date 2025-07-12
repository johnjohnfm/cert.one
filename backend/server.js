const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const generatePdf = require('./utils/generatePdf');
const { hashText, hashFile, generateCertificateId } = require('./utils/hasher');
const { createTimestamp, createTimestampAPI } = require('./utils/opentimestamps');
const { uploadToIPFS, uploadMetadataToIPFS, createCertificateMetadata } = require('./utils/ipfs');

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, but you can restrict as needed
    cb(null, true);
  }
});

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Restrict in production
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

// Original certificate endpoint (for JSON data)
app.post('/certify', async (req, res, next) => {
  try {
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

// New endpoint for text-based certification
app.post('/certify-text', async (req, res, next) => {
  try {
    const { text, userName, email, title } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text content is required' });
    }
    
    // Generate hash
    const fileHash = hashText(text);
    const certificateId = generateCertificateId(fileHash);
    
    // Create OpenTimestamps proof
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
      verificationLink: timestampData.verificationUrl,
      merkleRoot: timestampData.otsData || ''
    };
    
    // Upload metadata to IPFS (optional)
    let ipfsResult = null;
    try {
      const metadata = createCertificateMetadata(certData, fileHash, timestampData);
      ipfsResult = await uploadMetadataToIPFS(metadata, `cert-${certificateId}`);
    } catch (ipfsError) {
      console.warn('IPFS upload failed:', ipfsError.message);
    }
    
    // Generate PDF certificate
    const pdfBuffer = await generatePdf(certData);
    
    // Return both PDF and metadata
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

// New endpoint for file-based certification
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
    
    // Create OpenTimestamps proof
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
      verificationLink: timestampData.verificationUrl,
      merkleRoot: timestampData.otsData || ''
    };
    
    // Upload file to IPFS (optional)
    let ipfsResult = null;
    try {
      ipfsResult = await uploadToIPFS(file.buffer, file.originalname, {
        certificateId,
        userName,
        hash: fileHash
      });
    } catch (ipfsError) {
      console.warn('IPFS upload failed:', ipfsError.message);
    }
    
    // Upload metadata to IPFS (optional)
    let metadataResult = null;
    try {
      const metadata = createCertificateMetadata(certData, fileHash, timestampData);
      if (ipfsResult) {
        metadata.ipfs.fileHash = ipfsResult.ipfsHash;
        metadata.ipfs.gatewayUrl = ipfsResult.gatewayUrl;
      }
      metadataResult = await uploadMetadataToIPFS(metadata, `cert-${certificateId}`);
    } catch (ipfsError) {
      console.warn('IPFS metadata upload failed:', ipfsError.message);
    }
    
    // Generate PDF certificate
    const pdfBuffer = await generatePdf(certData);
    
    // Return PDF with metadata headers
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
    
    // If OTS data is provided, verify it
    let verificationResult = null;
    if (otsData) {
      const { verifyTimestamp } = require('./utils/opentimestamps');
      verificationResult = await verifyTimestamp(hash, otsData);
    }
    
    res.json({
      hash,
      verified: verificationResult?.verified || false,
      timestamp: new Date().toISOString(),
      verificationUrl: `https://ots.tools/verify`,
      message: verificationResult?.verified ? 
        'Hash verified on blockchain' : 
        'Hash verification pending or failed'
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
    
    // This would typically query a database
    // For now, return a placeholder response
    res.json({
      certificateId: id,
      status: 'This endpoint will be implemented with database integration',
      message: 'Certificate lookup functionality coming soon'
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
      'POST /certify - Generate certificate from JSON data',
      'POST /certify-text - Generate certificate from text',
      'POST /certify-file - Generate certificate from file upload',
      'POST /verify - Verify a hash',
      'GET /certificate/:id - Get certificate metadata',
      'GET /health - Health check'
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
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CERT.ONE Server listening on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /certify - Generate certificate from JSON`);
  console.log(`   POST /certify-text - Generate certificate from text`);
  console.log(`   POST /certify-file - Generate certificate from file`);
  console.log(`   POST /verify - Verify hash`);
  console.log(`   GET /health - Health check`);
});

module.exports = app;
