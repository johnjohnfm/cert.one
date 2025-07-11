// generateCert.js
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Updated template path for v2_flat
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'CERTONEv2_flat.pdf');

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

  const draw = (text, x, y, font = monoFont, size = 8) => {
    page.drawText(text || '-', {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  };

  // Helper: wrap long strings (e.g. hashes, URLs)
  const wrapText = (text, max = 64) => {
    const lines = [];
    for (let i = 0; i < text.length; i += max) {
      lines.push(text.slice(i, i + max));
    }
    return lines;
  };

  // Spacing constants
  let y = 520;
  const x = 140;
  const step = 16;

  // USER INFO
  draw(userName,   x, y); y -= step;
  draw(email,      x, y); y -= step;
  draw(title,      x, y); y -= step;
  draw(fileName,   x, y); y -= step;
  draw(merkleRoot, x, y); y -= step;

  // ASSET INFO — includes wrapped fields
  wrapText(certificateId).forEach((line, i) => draw(line, x, y - (i * step)));
  y -= step * (wrapText(certificateId).length || 1);

  wrapText(fileHash).forEach((line, i) => draw(line, x, y - (i * step)));
  y -= step * (wrapText(fileHash).length || 1);

  draw(timestamp,   x, y); y -= step;
  draw(blockchain,  x, y); y -= step;

  wrapText(verificationLink).forEach((line, i) => draw(line, x, y - (i * step)));

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

module.exports = generateCert;
