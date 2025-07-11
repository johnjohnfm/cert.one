// backend/server.js

const express = require('express');
const bodyParser = require('body-parser');
const generateCert = require('./utils/generateCert');  // ← correct relative path to your util

const app = express();

// parse JSON bodies (and bump the limit if you expect larger payloads)
app.use(bodyParser.json({ limit: '1mb' }));

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

    // generateCert() should now return a Node Buffer
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
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="CERTONE_${Date.now()}.pdf"`,
        'Content-Length':      pdfBuffer.length
      })
      .send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// listen on whatever port Render (or your environment) gives you
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Listening on ${PORT}`));
