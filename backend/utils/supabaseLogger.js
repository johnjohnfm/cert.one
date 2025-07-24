const supabase = require('./supabaseClient');

/**
 * Logs a certificate record to the Supabase 'certificates' table.
 * @param {Object} certData - Certificate data matching the table schema.
 * @returns {Promise<{data: any, error: any}>}
 */
async function logCertificate(certData) {
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
    merle_root,
    ipfs_cid,
    ipfs_url,
    ots_url,
    created_at
  } = certData;

  const { data, error } = await supabase
    .from('certificates')
    .insert([
      {
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
        merle_root,
        ipfs_cid,
        ipfs_url,
        ots_url,
        created_at: created_at || new Date().toISOString()
      }
    ]);

  return { data, error };
}

module.exports = { logCertificate };
