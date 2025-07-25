/**
 * Make.com Webhook Integration for CERT.ONE
 * Sends certificate data to Make webhook for email automation
 */

/**
 * Sends certificate data to Make webhook
 * @param {Object} certificateData - Complete certificate information
 * @param {Buffer} pdfBuffer - PDF certificate buffer for attachment
 * @returns {Promise<{success: boolean, details: string, error?: any}>}
 */
async function sendToMakeWebhook(certificateData, pdfBuffer) {
  try {
    const webhookUrl = process.env.MAKE_WEBHOOK_URL;
    const webhookEnabled = process.env.MAKE_WEBHOOK_ENABLED !== 'false';

    // Check if webhook is configured and enabled
    if (!webhookUrl) {
      console.log('⚠️ [Make Webhook] URL not configured, skipping email notification');
      return {
        success: false,
        details: 'Webhook URL not configured',
        error: null
      };
    }

    // Validate and fix webhook URL format
    let validWebhookUrl = webhookUrl.trim();
    
    // Handle common Make webhook URL formats
    if (validWebhookUrl.includes('@hook.') && !validWebhookUrl.startsWith('http')) {
      // Convert format like "p1n28ve7pm8djlycvww159xs61fxwcsq@hook.us2.make.com" 
      // to "https://hook.us2.make.com/p1n28ve7pm8djlycvww159xs61fxwcsq"
      const parts = validWebhookUrl.split('@');
      if (parts.length === 2) {
        const [id, domain] = parts;
        validWebhookUrl = `https://${domain}/${id}`;
        console.log('🔧 [Make Webhook] Converted URL format to:', validWebhookUrl);
      }
    } else if (!validWebhookUrl.startsWith('http')) {
      // Add https:// if missing
      validWebhookUrl = `https://${validWebhookUrl}`;
      console.log('🔧 [Make Webhook] Added https:// to URL:', validWebhookUrl);
    }

    // Basic URL validation
    try {
      new URL(validWebhookUrl);
    } catch (urlError) {
      console.error('❌ [Make Webhook] Invalid URL format:', validWebhookUrl);
      return {
        success: false,
        details: `Invalid webhook URL format: ${webhookUrl}. Expected format: https://hook.us2.make.com/YOUR_WEBHOOK_ID`,
        error: urlError
      };
    }

    if (!webhookEnabled) {
      console.log('⚠️ [Make Webhook] Disabled via environment variable');
      return {
        success: false,
        details: 'Webhook disabled via configuration',
        error: null
      };
    }

    // Skip if no email provided
    if (!certificateData.email || certificateData.email.trim() === '') {
      console.log('⚠️ [Make Webhook] No email provided, skipping webhook');
      return {
        success: false,
        details: 'No email address provided',
        error: null
      };
    }

    console.log('📧 [Make Webhook] Preparing to send certificate data to Make');
    console.log('📧 [Make Webhook] Certificate ID:', certificateData.certificate_id);
    console.log('📧 [Make Webhook] Recipient:', certificateData.email);

    // Prepare webhook payload
    const payload = {
      // Certificate identification
      certificate_id: certificateData.certificate_id,
      certificate_number: certificateData.certificate_number || certificateData.certificate_id,
      
      // User information
      user_name: certificateData.user_name,
      email: certificateData.email,
      title: certificateData.title,
      
      // File information
      file_name: certificateData.file_name,
      file_hash: certificateData.file_hash,
      
      // Timestamp and verification
      timestamp: certificateData.timestamp,
      created_at: certificateData.created_at,
      blockchain: certificateData.blockchain,
      verification_url: certificateData.verification_url,
      merkle_root: certificateData.merkle_root,
      
      // IPFS information (if available)
      ipfs_cid: certificateData.ipfs_cid,
      ipfs_url: certificateData.ipfs_url,
      ipfs_certificate_url: certificateData.ipfs_url,
      ipfs_metadata_url: certificateData.ipfs_metadata_url,
      ipfs_original_url: certificateData.ipfs_original_url,
      
      // OTS information
      ots_url: certificateData.ots_url,
      
      // PDF attachment (base64 encoded)
      pdf_attachment: {
        filename: `CERT_${certificateData.certificate_id}.pdf`,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf'
      },
      
      // Additional metadata
      system_info: {
        generated_by: 'CERT.ONE',
        api_version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    };

    console.log('📤 [Make Webhook] Payload prepared, sending to webhook...');

    // Send to Make webhook
    const response = await fetch(validWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CERT.ONE-Backend/1.0.0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log('✅ [Make Webhook] Successfully sent to Make:', response.status);
    console.log('✅ [Make Webhook] Response:', responseText);

    return {
      success: true,
      details: `Email notification sent to Make webhook (${response.status})`,
      error: null,
      response: responseText
    };

  } catch (error) {
    console.error('❌ [Make Webhook] Failed to send to webhook:', error);
    return {
      success: false,
      details: `Webhook failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Sends certificate data to Make webhook (non-blocking)
 * This version doesn't throw errors and is safe for fire-and-forget usage
 * @param {Object} certificateData - Complete certificate information
 * @param {Buffer} pdfBuffer - PDF certificate buffer for attachment
 * @returns {Promise<{success: boolean, details: string}>}
 */
async function sendToMakeWebhookSafe(certificateData, pdfBuffer) {
  try {
    return await sendToMakeWebhook(certificateData, pdfBuffer);
  } catch (error) {
    console.error('❌ [Make Webhook] Unexpected error in safe wrapper:', error);
    return {
      success: false,
      details: `Unexpected webhook error: ${error.message}`,
      error: error
    };
  }
}

module.exports = {
  sendToMakeWebhook,
  sendToMakeWebhookSafe
};
