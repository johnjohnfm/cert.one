const express = require('express');
const bodyParser = require('body-parser');
const generatePdf = require('./utils/generatePdf');

const app = express();

// Middleware
app.use(bodyParser.json());

// (Optional) Enable CORS if testing from browser or Postman
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // limit in prod
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Certificate endpoint
app.post('/certify', async (req, res, next) => {
  try {
    const pdfBuffer = await generatePdf(req.body);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CERTONE_${Date.now()}.pdf"`,
      'Content-Length': pdfBuffer.length
    }).send(pdfBuffer);
  } catch (err) {
    console.error('[ERROR] PDF generation failed:', err);
    next(err); // Pass error to error handler below
  }
});

// Fallback route
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Listening on port ${PORT}`);
});
