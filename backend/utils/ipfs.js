// backend/utils/ipfs.js
const FormData = require('form-data');

// Import fetch conditionally
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  console.warn('node-fetch not available, IPFS functionality will be limited');
  fetch = null;
}

/**
 * Get Pinata authentication headers
 * @returns {object} - Authentication headers
 */
function getPinataAuthHeaders() {
  const PINATA_JWT = process.env.PINATA_JWT;
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
  
  if (PINATA_JWT) {
    return {
      'Authorization': `Bearer ${PINATA_JWT}`
    };
  } else if (PINATA_API_KEY && PINATA_SECRET_KEY) {
    return {
      'pinata_api_key': PINATA_API_KEY,
      'pinata_secret_api_key': PINATA_SECRET_KEY
    };
  } else {
    throw new Error('Pinata credentials not configured. Please set PINATA_JWT or PINATA_API_KEY and PINATA_SECRET_KEY');
  }
}

/**
 * Upload file to IPFS using Pinata
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} fileName - Name of the file
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} - IPFS upload result
 */
async function uploadToIPFS(fileBuffer, fileName, metadata = {}) {
  if (!fetch) {
    throw new Error('node-fetch not available for IPFS uploads');
  }

  try {
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: 'application/octet-stream'
    });
    
    // Add metadata
    const pinataMetadata = {
      name: fileName,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        ...metadata
      }
    };
    
    form.append('pinataMetadata', JSON.stringify(pinataMetadata));
    
    const authHeaders = getPinataAuthHeaders();
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...form.getHeaders()
      },
      body: form
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata upload failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`,
      cid: result.IpfsHash // Alias for compatibility
    };
    
  } catch (error) {
    throw new Error(`IPFS upload error: ${error.message}`);
  }
}

/**
 * Upload PDF certificate to IPFS
 * @param {Buffer} pdfBuffer - PDF certificate buffer
 * @param {string} certificateId - Certificate ID
 * @param {object} certData - Certificate data for metadata
 * @returns {Promise<object>} - IPFS upload result
 */
async function uploadCertificateToIPFS(pdfBuffer, certificateId, certData = {}) {
  if (!fetch) {
    throw new Error('node-fetch not available for IPFS uploads');
  }

  try {
    const fileName = `CERTONE_${certificateId}.pdf`;
    
    const form = new FormData();
    form.append('file', pdfBuffer, {
      filename: fileName,
      contentType: 'application/pdf'
    });
    
    // Add certificate-specific metadata
    const pinataMetadata = {
      name: fileName,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        type: 'certificate-pdf',
        certificateId: certificateId,
        userName: certData.userName || 'Unknown',
        fileName: certData.fileName || 'Unknown',
        fileHash: certData.fileHash || 'Unknown',
        title: certData.title || 'Document Certificate'
      }
    };
    
    form.append('pinataMetadata', JSON.stringify(pinataMetadata));
    
    const authHeaders = getPinataAuthHeaders();
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...form.getHeaders()
      },
      body: form
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Certificate upload failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`,
      cid: result.IpfsHash,
      fileName: fileName
    };
    
  } catch (error) {
    throw new Error(`Certificate IPFS upload error: ${error.message}`);
  }
}

/**
 * Upload JSON metadata to IPFS
 * @param {object} metadata - JSON metadata object
 * @param {string} name - Name for the metadata file
 * @returns {Promise<object>} - IPFS upload result
 */
async function uploadMetadataToIPFS(metadata, name = 'certificate-metadata') {
  if (!fetch) {
    throw new Error('node-fetch not available for IPFS uploads');
  }

  try {
    const authHeaders = getPinataAuthHeaders();
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: name,
          keyvalues: {
            uploadedAt: new Date().toISOString(),
            type: 'certificate-metadata'
          }
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata JSON upload failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`,
      cid: result.IpfsHash
    };
    
  } catch (error) {
    throw new Error(`IPFS metadata upload error: ${error.message}`);
  }
}

/**
 * Create comprehensive certificate metadata object for IPFS storage
 * @param {object} certData - Certificate data
 * @param {string} fileHash - SHA256 hash of original file
 * @param {object} timestampData - OpenTimestamps data
 * @param {object} ipfsData - IPFS upload results
 * @returns {object} - Structured metadata object
 */
function createCertificateMetadata(certData, fileHash, timestampData, ipfsData = {}) {
  return {
    version: '1.0',
    type: 'blockchain-certificate',
    createdAt: new Date().toISOString(),
    certificate: {
      id: certData.certificateId,
      userName: certData.userName,
      email: certData.email,
      title: certData.title,
      fileName: certData.fileName
    },
    verification: {
      fileHash,
      hashAlgorithm: 'SHA256',
      blockchain: certData.blockchain || 'Bitcoin (OpenTimestamps)',
      timestamp: timestampData.timestamp || new Date().toISOString(),
      verificationUrl: timestampData.verificationUrl || 'https://ots.tools/verify',
      otsData: timestampData.otsData || null
    },
    ipfs: {
      uploadedAt: new Date().toISOString(),
      network: 'IPFS via Pinata',
      certificateCid: ipfsData.certificateCid || null,
      certificateUrl: ipfsData.certificateUrl || null,
      metadataCid: ipfsData.metadataCid || null,
      metadataUrl: ipfsData.metadataUrl || null,
      originalFileCid: ipfsData.originalFileCid || null,
      originalFileUrl: ipfsData.originalFileUrl || null
    },
    verification: {
      certificateUrl: ipfsData.certificateUrl || null,
      metadataUrl: ipfsData.metadataUrl || null,
      blockchainProof: timestampData.otsData || null,
      verificationEndpoint: `/verify?hash=${fileHash}`
    }
  };
}

/**
 * Upload complete certificate package to IPFS
 * @param {Buffer} pdfBuffer - PDF certificate buffer
 * @param {Buffer} originalFileBuffer - Original file buffer (optional)
 * @param {object} certData - Certificate data
 * @param {string} fileHash - SHA256 hash of original file
 * @param {object} timestampData - OpenTimestamps data
 * @returns {Promise<object>} - Complete IPFS upload results
 */
async function uploadCompleteCertificatePackage(pdfBuffer, originalFileBuffer, certData, fileHash, timestampData) {
  const results = {
    success: false,
    certificate: null,
    metadata: null,
    originalFile: null,
    errors: []
  };

  try {
    // 1. Upload PDF certificate
    try {
      results.certificate = await uploadCertificateToIPFS(pdfBuffer, certData.certificateId, certData);
      console.log(`✅ Certificate uploaded to IPFS: ${results.certificate.ipfsHash}`);
    } catch (error) {
      results.errors.push(`Certificate upload failed: ${error.message}`);
      console.error('❌ Certificate upload failed:', error.message);
    }

    // 2. Upload original file (if provided)
    if (originalFileBuffer && certData.fileName) {
      try {
        results.originalFile = await uploadToIPFS(originalFileBuffer, certData.fileName, {
          certificateId: certData.certificateId,
          type: 'original-file'
        });
        console.log(`✅ Original file uploaded to IPFS: ${results.originalFile.ipfsHash}`);
      } catch (error) {
        results.errors.push(`Original file upload failed: ${error.message}`);
        console.error('❌ Original file upload failed:', error.message);
      }
    }

    // 3. Create and upload metadata
    try {
      const metadata = createCertificateMetadata(certData, fileHash, timestampData, {
        certificateCid: results.certificate?.ipfsHash,
        certificateUrl: results.certificate?.gatewayUrl,
        originalFileCid: results.originalFile?.ipfsHash,
        originalFileUrl: results.originalFile?.gatewayUrl
      });

      results.metadata = await uploadMetadataToIPFS(metadata, `cert-metadata-${certData.certificateId}`);
      console.log(`✅ Metadata uploaded to IPFS: ${results.metadata.ipfsHash}`);
    } catch (error) {
      results.errors.push(`Metadata upload failed: ${error.message}`);
      console.error('❌ Metadata upload failed:', error.message);
    }

    // Determine overall success
    results.success = results.certificate !== null || results.metadata !== null;

    return results;

  } catch (error) {
    results.errors.push(`Package upload failed: ${error.message}`);
    throw new Error(`Complete certificate package upload failed: ${error.message}`);
  }
}

/**
 * Alternative: Upload to web3.storage (if preferred over Pinata)
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} fileName - Name of the file
 * @returns {Promise<object>} - Web3.storage upload result
 */
async function uploadToWeb3Storage(fileBuffer, fileName) {
  if (!fetch) {
    throw new Error('node-fetch not available for Web3.Storage uploads');
  }

  const WEB3_STORAGE_TOKEN = process.env.WEB3_STORAGE_TOKEN;
  
  if (!WEB3_STORAGE_TOKEN) {
    throw new Error('Web3.Storage token not configured');
  }
  
  try {
    const form = new FormData();
    form.append('file', fileBuffer, fileName);
    
    const response = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WEB3_STORAGE_TOKEN}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Web3.Storage upload failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      cid: result.cid,
      gatewayUrl: `https://${result.cid}.ipfs.w3s.link`,
      publicUrl: `https://ipfs.io/ipfs/${result.cid}`
    };
    
  } catch (error) {
    throw new Error(`Web3.Storage upload error: ${error.message}`);
  }
}

module.exports = {
  uploadToIPFS,
  uploadCertificateToIPFS,
  uploadMetadataToIPFS,
  createCertificateMetadata,
  uploadCompleteCertificatePackage,
  uploadToWeb3Storage
};
