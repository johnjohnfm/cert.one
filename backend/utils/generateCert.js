// generateCert.js
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Cert template must be placed in backend/templates/
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'CERTONEv2.pdf');

async function generateCert({
  userName,
  email,
  title,
  fileName,
  merkleRoot = '',
  certificateId,
  fileHash,
  timestamp,
  blockchain,
  verificationLink
}) {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const draw = (text, x, y, font = monoFont, size = 10) => {
    page.drawText(text || '-', {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  };

  // Approximate coordinates for fields (adjust as needed)
  // USER BLOCK
  draw(userName,       140, 520);
  draw(email,          140, 500);
  draw(title,          140, 480);
  draw(fileName,       140, 460);
  draw(merkleRoot,     140, 440);

  // ASSET BLOCK
  draw(certificateId,  140, 400);
  draw(fileHash,       140, 380);
  draw(timestamp,      140, 360);
  draw(blockchain,     140, 340);
  draw(verificationLink, 140, 320);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

module.exports = generateCert;
