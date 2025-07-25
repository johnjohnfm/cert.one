// Load environment variables first
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const generatePdf = require('./utils/generatePdf');
const { hashText, hashFile, generateCertificateId } = require('./utils/hasher');
const { createTimestampAPI } = require('./utils/opentimestamps');
const { uploadToIPFS, uploadCertificateToIPFS, uploadMetadataToIPFS, createCertificateMetadata, uploadCompleteCertificatePackage } = require('./utils/ipfs');
const { logCertificate } = require('./utils/supabaseLogger');
const { sendToMakeWebhookSafe } = require('./utils/makeWebhook');

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files (for testing)
app.use(express.static(__dirname + '/../'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint to check if static files are being served
app.get('/test-file-access', (req, res) => {
  res.json({
    message: 'This endpoint works',
    timestamp: new Date().toISOString(),
    test: 'Testing if static files are being served'
  });
});

// Test Supabase connectivity endpoint
app.get('/test-supabase', async (req, res) => {
  try {
    const hasCredentials = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE);
    
    if (!hasCredentials) {
      return res.json({
        status: 'disabled',
        message: 'Supabase credentials not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    const supabase = require('./utils/supabaseClient');
    
    // Test basic connectivity
    const { data, error } = await supabase
      .from('certificates')
      .select('count')
      .limit(1);
    
    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Supabase connectivity test failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      status: 'success',
      message: 'Supabase connectivity test successful',
      timestamp: new Date().toISOString(),
      connection: 'Working'
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Supabase connectivity test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test IPFS connectivity endpoint
app.get('/test-ipfs', async (req, res) => {
  try {
    const hasCredentials = !!(process.env.PINATA_JWT || (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY));
    
    if (!hasCredentials) {
      return res.json({
        status: 'disabled',
        message: 'IPFS credentials not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    // Test with a simple file upload (works with just "Files" permission)
    const testContent = `CERT.ONE IPFS Connectivity Test
Generated: ${new Date().toISOString()}
Test Hash: ${Math.random().toString(36)}`;
    
    const testBuffer = Buffer.from(testContent, 'utf8');
    
    const { uploadToIPFS } = require('./utils/ipfs');
    const result = await uploadToIPFS(testBuffer, 'ipfs-connectivity-test.txt', {
      type: 'connectivity-test',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      status: 'success',
      message: 'IPFS file upload test successful',
      timestamp: new Date().toISOString(),
      testCid: result.ipfsHash,
      testUrl: result.gatewayUrl,
      permissions: 'File upload working'
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'IPFS connectivity test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test PDF generation endpoint
app.get('/test-pdf', async (req, res, next) => {
  try {
    console.log('Testing PDF generation...');
    
    const testData = {
      userName: 'Test User',
      email: 'test@example.com',
      title: 'Test Certificate',
      fileName: 'test.txt',
      certificateId: 'TEST123',
      fileHash: 'a'.repeat(64), // 64 character hash
      timestamp: new Date().toISOString(),
      blockchain: 'Bitcoin (OpenTimestamps)',
      verificationLink: 'https://ots.tools/verify',
      merkleRoot: 'test-merkle-root'
    };
    
    console.log('Test data:', testData);
    const templateData = mapToTemplateFormat(testData);
    const pdfBuffer = await generatePdf(templateData);
    
    // Check if the result is actually HTML (fallback method)
    const isHtml = pdfBuffer.toString('utf8').trim().startsWith('<!DOCTYPE html>');
    
    if (isHtml) {
      // Fallback method returned HTML
      res.set({
        'Content-Type': 'text/html',
        'Content-Disposition': 'attachment; filename="test-certificate.html"'
      });
      res.end(pdfBuffer);
    } else {
      // Normal PDF response
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="test-certificate.pdf"'
      });
      res.end(pdfBuffer);
    }
    
  } catch (err) {
    console.error('[ERROR] PDF test failed:', err);
    res.status(500).json({
      error: 'PDF Test Failed',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Simple test endpoint without generatePdf
app.get('/test-simple', async (req, res, next) => {
  try {
    console.log('Testing simple endpoint...');
    
    res.json({
      message: 'Simple test successful',
      timestamp: new Date().toISOString(),
      test: 'This endpoint works without generatePdf'
    });
    
  } catch (err) {
    console.error('[ERROR] Simple test failed:', err);
    res.status(500).json({
      error: 'Simple Test Failed',
      message: err.message
    });
  }
});

// Dedicated routes for test pages
app.get('/test-ipfs-integration.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../test-ipfs-integration.html'));
});

app.get('/test-ipfs-integration', (req, res) => {
  res.sendFile(path.join(__dirname, '../test-ipfs-integration.html'));
});

app.get('/test-certificate.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../test-certificate.html'));
});

app.get('/deployed-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../deployed-test.html'));
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CERT.ONE Backend API',
    version: '1.0.0',
    status: 'operational',
    endpoints: [
      'GET /health - Health check',
      'GET /test-supabase - Test Supabase connectivity',
      'GET /test-ipfs - Test IPFS connectivity',
      'GET /test-ipfs-integration.html - IPFS integration test page',
      'POST /certify - Generate certificate from JSON data',
      'POST /certify-text - Generate certificate from text',
      'POST /certify-file - Generate certificate from file upload',
      'POST /verify - Verify a hash',
      'GET /certificate/:id - Get certificate metadata'
    ]
  });
});

// Helper function to map server variables to template variables
function mapToTemplateFormat(data) {
  return {
    certificate_id: data.certificateId,
    certificate_number: data.certificateId, // Map certificateId to certificate_number
    file_hash: data.fileHash,
    timestamp: data.timestamp,
    blockchain: data.blockchain,
    verification_url: data.verificationLink,
    user_name: data.userName,
    email: data.email,
    title: data.title,
    file_name: data.fileName,
    merkle_root: data.merkleRoot
  };
}

// Debug endpoint to log JSON payload
app.post('/debug-payload', (req, res) => {
  console.log('=== DEBUG PAYLOAD ===');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Body keys:', Object.keys(req.body));
  console.log('====================');
  
  res.json({
    received: true,
    bodyKeys: Object.keys(req.body),
    body: req.body
  });
});

// Original certificate endpoint (for JSON data)
app.post('/certify', async (req, res, next) => {
  try {
    console.log('Received certify request:', req.body);
    
    // Flexible field extraction with fallbacks
    const userName = req.body.userName || req.body.user_name || req.body.name;
    const fileName = req.body.fileName || req.body.file_name || req.body.filename;
    const fileHash = req.body.fileHash || req.body.file_hash || req.body.hash;
    
    // Validate required fields
    if (!userName || !fileName || !fileHash) {
      return res.status(400).json({ 
        error: 'Missing required fields. Need: userName/user_name/name, fileName/file_name/filename, fileHash/file_hash/hash',
        received: {
          userName: !!userName,
          fileName: !!fileName,
          fileHash: !!fileHash
        },
        bodyKeys: Object.keys(req.body)
      });
    }

    // Validate fileHash format
    if (!/^[a-fA-F0-9]{64}$/.test(fileHash)) {
      return res.status(400).json({ 
        error: 'Invalid fileHash format. Must be a 64-character SHA256 hash' 
      });
    }

    // Add default values for missing fields
    const certData = {
      userName,
      fileName,
      fileHash,
      email: req.body.email || '',
      title: req.body.title || 'Document Certificate',
      certificateId: req.body.certificateId || req.body.certificate_id || generateCertificateId(fileHash),
      timestamp: req.body.timestamp || new Date().toISOString(),
      blockchain: req.body.blockchain || 'Bitcoin (OpenTimestamps)',
      verificationLink: req.body.verificationLink || req.body.verification_url || 'https://ots.tools/verify',
      merkleRoot: req.body.merkleRoot || req.body.merkle_root || ''
    };

    console.log('Generating PDF with data:', certData);
    const templateData = mapToTemplateFormat(certData);
    const pdfBuffer = await generatePdf(templateData);

    // Prepare data for logging to Supabase
    const logData = {
      certificate_id: certData.certificateId,
      user_name: certData.userName,
      email: certData.email,
      title: certData.title,
      file_name: certData.fileName,
      file_hash: certData.fileHash,
      timestamp: certData.timestamp,
      blockchain: certData.blockchain,
      verification_url: certData.verificationLink,
      certificate_number: certData.certificateId,
      merkle_root: certData.merkleRoot,
      created_at: new Date().toISOString()
    };

    // Log to Supabase and capture result
    const supabaseResult = await logCertificate(logData);
    console.log('📊 [/certify] Supabase logging result:', supabaseResult);

    // Send to Make webhook (non-blocking)
    const makeResult = await sendToMakeWebhookSafe(logData, pdfBuffer);
    console.log('📧 [/certify] Make webhook result:', makeResult);

    // Check if the result is actually HTML (fallback method)
    const isHtml = pdfBuffer.toString('utf8').trim().startsWith('<!DOCTYPE html>');
    
    // Set response headers with Supabase and Make status
    const responseHeaders = {
      'X-Supabase-Success': supabaseResult.success ? 'true' : 'false',
      'X-Supabase-Details': supabaseResult.details || 'none',
      'X-Supabase-Error': supabaseResult.error ? supabaseResult.error.message : 'none',
      'X-Make-Success': makeResult.success ? 'true' : 'false',
      'X-Make-Details': makeResult.details || 'none'
    };

    if (isHtml) {
      // Fallback method returned HTML
      res.set({
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="CERTONE_${certData.certificateId}.html"`,
        ...responseHeaders
      });
    } else {
      // Normal PDF response
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CERTONE_${certData.certificateId}.pdf"`,
        ...responseHeaders
      });
    }
    
    res.end(pdfBuffer);

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
    
    // Generate PDF certificate first
    const templateData = mapToTemplateFormat(certData);
    const pdfBuffer = await generatePdf(templateData);
    
    // Upload complete certificate package to IPFS (if credentials are configured)
    let ipfsResults = null;
    if (process.env.PINATA_JWT || (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY)) {
      try {
        ipfsResults = await uploadCompleteCertificatePackage(
          pdfBuffer, 
          Buffer.from(text), // Use text as original file
          certData, 
          fileHash, 
          timestampData
        );
        console.log('✅ Complete certificate package uploaded to IPFS');
      } catch (ipfsError) {
        console.warn('❌ IPFS upload failed:', ipfsError.message);
        ipfsResults = { success: false, errors: [ipfsError.message] };
      }
    }
    
    // Prepare data for logging to Supabase
    const logDataText = {
      certificate_id: certData.certificateId,
      user_name: certData.userName,
      email: certData.email,
      title: certData.title,
      file_name: certData.fileName,
      file_hash: certData.fileHash,
      timestamp: certData.timestamp,
      blockchain: certData.blockchain,
      verification_url: certData.verificationLink,
      certificate_number: certData.certificateId,
      merkle_root: certData.merkleRoot,
      ipfs_cid: ipfsResults?.certificate?.ipfsHash,
      ipfs_url: ipfsResults?.certificate?.gatewayUrl,
      ots_url: certData.verificationLink,
      created_at: new Date().toISOString()
    };

    // Log to Supabase and capture result
    const supabaseResult = await logCertificate(logDataText);
    console.log('📊 [/certify-text] Supabase logging result:', supabaseResult);

    // Send to Make webhook (non-blocking)
    const makeResult = await sendToMakeWebhookSafe(logDataText, pdfBuffer);
    console.log('📧 [/certify-text] Make webhook result:', makeResult);

    // Check if the result is actually HTML (fallback method)
    const isHtml = pdfBuffer.toString('utf8').trim().startsWith('<!DOCTYPE html>');
    
    // Prepare all response headers including Supabase and Make status
    const allHeaders = {
      'X-Certificate-ID': certificateId,
      'X-File-Hash': fileHash,
      'X-IPFS-Certificate-CID': ipfsResults?.certificate?.ipfsHash || 'none',
      'X-IPFS-Metadata-CID': ipfsResults?.metadata?.ipfsHash || 'none',
      'X-IPFS-Original-CID': ipfsResults?.originalFile?.ipfsHash || 'none',
      'X-IPFS-Success': ipfsResults?.success ? 'true' : 'false',
      'X-Supabase-Success': supabaseResult.success ? 'true' : 'false',
      'X-Supabase-Details': supabaseResult.details || 'none',
      'X-Supabase-Error': supabaseResult.error ? supabaseResult.error.message : 'none',
      'X-Make-Success': makeResult.success ? 'true' : 'false',
      'X-Make-Details': makeResult.details || 'none'
    };

    if (isHtml) {
      // Fallback method returned HTML
      res.set({
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="CERT_${certificateId}.html"`,
        ...allHeaders
      });
    } else {
      // Normal PDF response
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CERT_${certificateId}.pdf"`,
        ...allHeaders
      });
    }
    
    res.end(pdfBuffer);

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
    
    // Generate PDF certificate first
    const templateData = mapToTemplateFormat(certData);
    const pdfBuffer = await generatePdf(templateData);
    
    // Upload complete certificate package to IPFS (if credentials are configured)
    let ipfsResults = null;
    if (process.env.PINATA_JWT || (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY)) {
      try {
        ipfsResults = await uploadCompleteCertificatePackage(
          pdfBuffer, 
          file.buffer, // Original file buffer
          certData, 
          fileHash, 
          timestampData
        );
        console.log('✅ Complete certificate package uploaded to IPFS');
      } catch (ipfsError) {
        console.warn('❌ IPFS upload failed:', ipfsError.message);
        ipfsResults = { success: false, errors: [ipfsError.message] };
      }
    }
    
    // Prepare data for logging to Supabase
    const logDataFile = {
      certificate_id: certData.certificateId,
      user_name: certData.userName,
      email: certData.email,
      title: certData.title,
      file_name: certData.fileName,
      file_hash: certData.fileHash,
      timestamp: certData.timestamp,
      blockchain: certData.blockchain,
      verification_url: certData.verificationLink,
      certificate_number: certData.certificateId,
      merkle_root: certData.merkleRoot,
      ipfs_cid: ipfsResults?.certificate?.ipfsHash,
      ipfs_url: ipfsResults?.certificate?.gatewayUrl,
      ots_url: certData.verificationLink,
      created_at: new Date().toISOString()
    };

    // Log to Supabase and capture result
    const supabaseResult = await logCertificate(logDataFile);
    console.log('📊 [/certify-file] Supabase logging result:', supabaseResult);

    // Send to Make webhook (non-blocking)
    const makeResult = await sendToMakeWebhookSafe(logDataFile, pdfBuffer);
    console.log('📧 [/certify-file] Make webhook result:', makeResult);

    // Check if the result is actually HTML (fallback method)
    const isHtml = pdfBuffer.toString('utf8').trim().startsWith('<!DOCTYPE html>');
    
    // Prepare all response headers including Supabase and Make status
    const allHeaders = {
      'X-Certificate-ID': certificateId,
      'X-File-Hash': fileHash,
      'X-IPFS-Certificate-CID': ipfsResults?.certificate?.ipfsHash || 'none',
      'X-IPFS-Metadata-CID': ipfsResults?.metadata?.ipfsHash || 'none',
      'X-IPFS-Original-CID': ipfsResults?.originalFile?.ipfsHash || 'none',
      'X-IPFS-Success': ipfsResults?.success ? 'true' : 'false',
      'X-Supabase-Success': supabaseResult.success ? 'true' : 'false',
      'X-Supabase-Details': supabaseResult.details || 'none',
      'X-Supabase-Error': supabaseResult.error ? supabaseResult.error.message : 'none',
      'X-Make-Success': makeResult.success ? 'true' : 'false',
      'X-Make-Details': makeResult.details || 'none'
    };

    if (isHtml) {
      // Fallback method returned HTML
      res.set({
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="CERT_${certificateId}.html"`,
        ...allHeaders
      });
    } else {
      // Normal PDF response
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CERT_${certificateId}.pdf"`,
        ...allHeaders
      });
    }
    
    res.end(pdfBuffer);

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
    
    let verificationResult = {
      hash,
      verified: false,
      timestamp: new Date().toISOString(),
      verificationUrl: `https://ots.tools/verify`,
      message: 'Verification not available'
    };
    
    // If OTS data is provided, verify it
    if (otsData) {
      try {
        const { verifyTimestamp } = require('./utils/opentimestamps');
        const result = await verifyTimestamp(hash, otsData);
        verificationResult = {
          ...verificationResult,
          verified: result.verified,
          message: result.verified ? 'Hash verified on Bitcoin blockchain' : 'Hash verification failed',
          details: result.output,
          error: result.error
        };
      } catch (verifyError) {
        verificationResult.error = verifyError.message;
        verificationResult.message = 'Verification process failed';
      }
    } else {
      // Check if we have a stored OTS file for this hash
      try {
        const fs = require('fs');
        const path = require('path');
        const tempDir = path.join(__dirname, 'temp');
        const otsFile = path.join(tempDir, `permanent_${hash}.ots`);
        
        if (fs.existsSync(otsFile)) {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          // Verify using stored OTS file
          const command = `ots verify "${otsFile}"`;
          const { stdout, stderr } = await execAsync(command);
          
          verificationResult = {
            ...verificationResult,
            verified: !stderr || stderr.includes('Success'),
            message: !stderr || stderr.includes('Success') ? 'Hash verified on Bitcoin blockchain' : 'Hash verification failed',
            details: stdout,
            error: stderr
          };
        } else {
          verificationResult.message = 'No timestamp proof found for this hash';
        }
      } catch (fileError) {
        verificationResult.message = 'Could not check for stored timestamp proof';
        verificationResult.error = fileError.message;
      }
    }
    
    res.json(verificationResult);
    
  } catch (err) {
    console.error('[ERROR] Verification failed:', err);
    next(err);
  }
});

// Endpoint to get certificate metadata
app.get('/certificate/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Fetch from Supabase
    const supabase = require('./utils/supabaseClient');
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('certificate_id', id)
      .single();
    if (error || !data) {
      return res.status(404).json({
        certificateId: id,
        status: 'Not found in Supabase',
        error: error ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      certificateId: id,
      status: 'Found',
      data,
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
      'GET /test-ipfs - Test IPFS connectivity',
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
  console.error('Stack trace:', err.stack);
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 50MB'
      });
    }
  }
  
  // Handle specific error types
  if (err.message && err.message.includes('Template not found')) {
    return res.status(500).json({
      error: 'Template Error',
      message: 'PDF template file not found'
    });
  }
  
  if (err.message && err.message.includes('PDF generation failed')) {
    return res.status(500).json({
      error: 'PDF Generation Error',
      message: 'Failed to generate PDF certificate'
    });
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
  console.log(`   GET /test-ipfs - Test IPFS connectivity`);
  console.log(`   POST /certify - Generate certificate from JSON`);
  console.log(`   POST /certify-text - Generate certificate from text`);
  console.log(`   POST /certify-file - Generate certificate from file`);
  console.log(`   POST /verify - Verify hash`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   IPFS: ${(process.env.PINATA_JWT || process.env.PINATA_API_KEY) ? 'Enabled' : 'Disabled'}`);
});

module.exports = app;

app.get('/test-generatePdf-type', (req, res) => {
  try {
    res.json({
      type: typeof generatePdf,
      isFunction: typeof generatePdf === 'function',
      toString: generatePdf.toString().slice(0, 100) // first 100 chars
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
