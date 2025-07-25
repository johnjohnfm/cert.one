const supabase = require('./supabaseClient');

/**
 * Logs a certificate record to the Supabase 'certificates' table.
 * @param {Object} certData - Certificate data matching the table schema.
 * @returns {Promise<{data: any, error: any, success: boolean, details: string}>}
 */
async function logCertificate(certData) {
  try {
    console.log('🔍 [Supabase] Attempting to log certificate:', {
      certificate_id: certData.certificate_id,
      user_name: certData.user_name,
      file_name: certData.file_name
    });

    // Only include fields that exist in the table
    const {
      certificate_id,
      user_name,
      email,
      title,
      file_name,
      file_hash,
      timestamp,
      blockchain,
      verification_url,
      certificate_number,
      merkle_root,
      ipfs_cid,
      ipfs_url,
      ots_url,
      created_at
    } = certData;

    // Prepare the insert data
    const insertData = {
      certificate_id,
      user_name,
      email,
      title,
      file_name,
      file_hash,
      timestamp,
      blockchain,
      verification_url,
      certificate_number,
      merkle_root,
      ipfs_cid,
      ipfs_url,
      ots_url,
      created_at: created_at || new Date().toISOString()
    };

    console.log('📤 [Supabase] Insert data prepared:', insertData);

    const { data, error } = await supabase
      .from('certificates')
      .insert([insertData]);

    if (error) {
      console.error('❌ [Supabase] Insert failed:', error);
      return {
        data: null,
        error: error,
        success: false,
        details: `Database insert failed: ${error.message}`
      };
    }

    console.log('✅ [Supabase] Insert successful:', data);
    return {
      data: data,
      error: null,
      success: true,
      details: 'Certificate logged successfully to Supabase'
    };

  } catch (unexpectedError) {
    console.error('💥 [Supabase] Unexpected error during logging:', unexpectedError);
    return {
      data: null,
      error: unexpectedError,
      success: false,
      details: `Unexpected error: ${unexpectedError.message}`
    };
  }
}

module.exports = { logCertificate };
