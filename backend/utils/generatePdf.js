const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

async function generatePdf(data) {
  const templatePath = path.join(__dirname, '..', 'templates', 'cert.hbs');
  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  const compileTemplate = handlebars.compile(templateHtml);
  const html = compileTemplate(data);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();

  return pdfBuffer;
}

module.exports = generatePdf;
