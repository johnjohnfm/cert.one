// backend/server.js
const express = require('express');
const bodyParser = require('body-parser');
const generateCert = require('./generateCert');

const app = express();
app.use(bodyParser.json());

app.post('/certify', async (req, res, next) => {
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

    // generateCert now returns a Buffer
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

    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CERTONE_${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length
      })
      .send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
