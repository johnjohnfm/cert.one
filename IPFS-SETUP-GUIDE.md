# IPFS Setup Guide for CERT.ONE

## Pinata Configuration Issue: "NO_SCOPES_FOUND"

You're getting this error because your Pinata API key doesn't have the required permissions (scopes) enabled.

### How to Fix Pinata Scopes:

1. **Go to Pinata Dashboard**
   - Visit: https://app.pinata.cloud/
   - Log into your account

2. **Navigate to API Keys**
   - Click on "API Keys" in the left sidebar
   - Find your current API key OR create a new one

3. **Enable Required Scopes**
   Your API key MUST have these permissions enabled:
   - ✅ **pinFileToIPFS** - Required for uploading PDF certificates and files
   - ✅ **pinJSONToIPFS** - Required for uploading metadata
   - ✅ **userPinnedDataTotal** - Optional but recommended

4. **Generate New API Key (Recommended)**
   - Click "New Key"
   - Enable all the scopes above
   - Give it a descriptive name like "CERT.ONE Backend"
   - Copy the API Key and Secret

5. **Update Your .env File**
   Choose ONE of these methods:

   **Method A: Using API Key + Secret (Recommended)**
   ```
   PINATA_API_KEY=your_new_api_key_here
   PINATA_SECRET_KEY=your_new_secret_here
   ```

   **Method B: Using JWT Token**
   ```
   PINATA_JWT=your_jwt_token_here
   ```

6. **Restart Your Server**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   cd backend && node server.js
   ```

### Test IPFS Integration

1. Visit: http://localhost:3000/test-ipfs-integration.html
2. Click "Test IPFS Connectivity"
3. You should see a success message with a test CID

### Troubleshooting

**If you still get errors:**

1. **Verify Credentials**
   - Double-check API key and secret are copied correctly
   - No extra spaces or quotes in .env file

2. **Check Pinata Account**
   - Ensure your Pinata account is in good standing
   - Check if you have available storage quota

3. **Test Manually**
   - Try uploading a file directly in Pinata dashboard
   - Verify your API key works there first

### Expected Success Response

When working correctly, you should see:
```json
{
  "status": "success",
  "message": "IPFS connectivity test successful",
  "timestamp": "2025-07-20T08:xx:xx.xxxZ",
  "testCid": "QmSomeHashHere",
  "testUrl": "https://gateway.pinata.cloud/ipfs/QmSomeHashHere"
}
```

### Need Help?

If you continue having issues:
1. Check the server terminal for detailed error messages
2. Verify your Pinata account status
3. Try creating a completely new API key with fresh permissions
