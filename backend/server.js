const express = require('express');
const bodyParser = require('body-parser');
const generatePdf = require('./utils/generatePdf');

const app = express();
app.use(bodyParser.json());

app.post('/certify', async (req, res, next) => {
  try {
    const pdfBuffer = await generatePdf(req.body);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CERTONE_${Date.now()}.pdf"`
    }).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Listening on ${PORT}`));
