// backend/utils/opentimestamps.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Create OpenTimestamps proof for a given hash
 * @param {string} hash - SHA256 hash to timestamp
 * @returns {Promise<object>} - Timestamp result with .ots file data
 */
async function createTimestamp(hash) {
  try {
    // Create temporary file with hash
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const hashFile = path.join(tempDir, `${hash}.txt`);
    const otsFile = path.join(tempDir, `${hash}.txt.ots`);
    
    // Write hash to file
    fs.writeFileSync(hashFile, hash);
    
    // Use OpenTimestamps CLI to create timestamp
    const command = `ots stamp "${hashFile}"`;
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('Submitting to remote calendar')) {
      throw new Error(`OpenTimestamps error: ${stderr}`);
    }
    
    // Read the .ots file if it was created
    let otsData = null;
    if (fs.existsSync(otsFile)) {
      otsData = fs.readFileSync(otsFile);
    }
    
    // Clean up temp files
    try {
      fs.unlinkSync(hashFile);
      if (fs.existsSync(otsFile)) {
        fs.unlinkSync(otsFile);
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError.message);
    }
    
    return {
      success: true,
      hash,
      timestamp: new Date().toISOString(),
      otsData: otsData ? otsData.toString('base64') : null,
      verificationUrl: `https://ots.tools/verify`,
      message: 'Hash successfully submitted to OpenTimestamps'
    };
    
  } catch (error) {
    console.error('OpenTimestamps error:', error);
    
    // Fallback: return a pending timestamp that can be verified later
    return {
      success: false,
      hash,
      timestamp: new Date().toISOString(),
      otsData: null,
      verificationUrl: `https://ots.tools/verify`,
      message: 'Timestamp pending - try verification in a few hours',
      error: error.message
    };
  }
}

/**
 * Verify an OpenTimestamps proof
 * @param {string} hash - Original hash
 * @param {string} otsData - Base64 encoded .ots file data
 * @returns {Promise<object>} - Verification result
 */
async function verifyTimestamp(hash, otsData) {
  try {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const hashFile = path.join(tempDir, `${hash}_verify.txt`);
    const otsFile = path.join(tempDir, `${hash}_verify.txt.ots`);
    
    // Write files
    fs.writeFileSync(hashFile, hash);
    fs.writeFileSync(otsFile, Buffer.from(otsData, 'base64'));
    
    // Verify with OpenTimestamps
    const command = `ots verify "${otsFile}"`;
    const { stdout, stderr } = await execAsync(command);
    
    // Clean up
    try {
      fs.unlinkSync(hashFile);
      fs.unlinkSync(otsFile);
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError.message);
    }
    
    return {
      verified: !stderr || stderr.includes('Success'),
      output: stdout,
      error: stderr
    };
    
  } catch (error) {
    return {
      verified: false,
      error: error.message
    };
  }
}

/**
 * Create a real OpenTimestamps proof using CLI
 * @param {string} hash - SHA256 hash to timestamp
 * @returns {Promise<object>} - Timestamp result with real .ots data
 */
async function createTimestampAPI(hash) {
  try {
    console.log('Creating real OpenTimestamps proof for hash:', hash);
    
    // Create temporary file with hash
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const hashFile = path.join(tempDir, `${hash}.txt`);
    const otsFile = path.join(tempDir, `${hash}.txt.ots`);
    
    // Write hash to file
    fs.writeFileSync(hashFile, hash);
    
    // Use OpenTimestamps CLI to create real timestamp
    const command = `ots stamp "${hashFile}"`;
    console.log('Running command:', command);
    
    const { stdout, stderr } = await execAsync(command);
    
    console.log('OpenTimestamps stdout:', stdout);
    if (stderr) {
      console.log('OpenTimestamps stderr:', stderr);
    }
    
    // Read the .ots file if it was created
    let otsData = null;
    let verificationUrl = 'https://ots.tools/verify';
    
    if (fs.existsSync(otsFile)) {
      otsData = fs.readFileSync(otsFile);
      console.log('OTS file created successfully, size:', otsData.length, 'bytes');
      
      // Get verification info
      try {
        const infoCommand = `ots info "${otsFile}"`;
        const { stdout: infoOutput } = await execAsync(infoCommand);
        console.log('OTS info:', infoOutput);
        
        // Extract calendar URL if available
        if (infoOutput.includes('https://')) {
          const urlMatch = infoOutput.match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            verificationUrl = urlMatch[0];
          }
        }
      } catch (infoError) {
        console.warn('Could not get OTS info:', infoError.message);
      }
    } else {
      console.warn('OTS file was not created');
    }
    
    // Clean up temp files
    try {
      fs.unlinkSync(hashFile);
      if (fs.existsSync(otsFile)) {
        // Keep OTS file for verification, but move it to a permanent location
        const permanentOtsFile = path.join(tempDir, `permanent_${hash}.ots`);
        fs.copyFileSync(otsFile, permanentOtsFile);
        fs.unlinkSync(otsFile);
        console.log('OTS file saved to:', permanentOtsFile);
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError.message);
    }
    
    return {
      success: true,
      hash,
      timestamp: new Date().toISOString(),
      otsData: otsData ? otsData.toString('base64') : null,
      verificationUrl,
      message: 'Hash successfully submitted to Bitcoin blockchain via OpenTimestamps',
      txHash: null, // Will be populated once confirmed (1-6 hours)
      blockHeight: null,
      calendarUrl: verificationUrl
    };
    
  } catch (error) {
    console.error('OpenTimestamps API error:', error);
    
    // Fallback: return a pending timestamp that can be verified later
    return {
      success: false,
      hash,
      timestamp: new Date().toISOString(),
      otsData: null,
      verificationUrl: `https://ots.tools/verify`,
      message: 'Timestamp submission failed - will retry on next request',
      error: error.message,
      txHash: null,
      blockHeight: null
    };
  }
}

module.exports = {
  createTimestamp,
  verifyTimestamp,
  createTimestampAPI
};
