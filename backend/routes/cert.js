const express = require('express');
const router = express.Router();
const generateCert = require('../utils/generateCert');

router.post('/certify', async (req, res) => {
  try {
    const {
      userName,
      email,
      title,
      fileName,
      merkleRoot,
      certificateId,
      fileHash,
      timestamp,
      blockchain,
      verificationLink
    } = req.body;

    if (!email || !fileHash || !timestamp || !certificateId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pdfBuffer = await generateCert({
      userName,
      email,
      title,
      fileName,
      merkleRoot,
      certificateId,
      fileHash,
      timestamp,
      blockchain,
      verificationLink
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CERTONE_${Date.now()}.pdf"`
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating cert:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
