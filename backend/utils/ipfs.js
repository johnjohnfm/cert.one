// backend/utils/ipfs.js
const FormData = require('form-data');
const fetch = require('node-fetch');

/**
 * Upload file to IPFS using Pinata
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} fileName - Name of the file
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} - IPFS upload result
 */
async function uploadToIPFS(fileBuffer, fileName, metadata = {}) {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
  
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('Pinata API credentials not configured');
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
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        ...form.getHeaders()
      },
      body: form
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${result.error || 'Unknown error'}`);
    }
    
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`
    };
    
  } catch (error) {
    throw new Error(`IPFS upload error: ${error.message}`);
  }
}

/**
 * Upload JSON metadata to IPFS
 * @param {object} metadata - JSON metadata object
 * @param {string} name - Name for the metadata file
 * @returns {Promise<object>} - IPFS upload result
 */
async function uploadMetadataToIPFS(metadata, name = 'certificate-metadata') {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
  
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('Pinata API credentials not configured');
  }
  
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
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
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Pinata JSON upload failed: ${result.error || 'Unknown error'}`);
    }
    
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`
    };
    
  } catch (error) {
    throw new Error(`IPFS metadata upload error: ${error.message}`);
  }
}

/**
 * Create certificate metadata object for IPFS storage
 * @param {object} certData - Certificate data
 * @param {string} fileHash - SHA256 hash of original file
 * @param {string} timestampData - OpenTimestamps data
 * @returns {object} - Structured metadata object
 */
function createCertificateMetadata(certData, fileHash, timestampData) {
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
      timestamp: timestampData.timestamp,
      verificationUrl: timestampData.verificationUrl,
      otsData: timestampData.otsData
    },
    ipfs: {
      uploadedAt: new Date().toISOString(),
      network: 'IPFS via Pinata'
    }
  };
}

/**
 * Alternative: Upload to web3.storage (if preferred over Pinata)
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} fileName - Name of the file
 * @returns {Promise<object>} - Web3.storage upload result
 */
async function uploadToWeb3Storage(fileBuffer, fileName) {
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
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Web3.Storage upload failed: ${result.message || 'Unknown error'}`);
    }
    
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
  uploadMetadataToIPFS,
  createCertificateMetadata,
  uploadToWeb3Storage
};
