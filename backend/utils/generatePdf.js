const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const chromium = require('chrome-aws-lambda');

async function generatePdf(data) {
  const templatePath = path.join(__dirname, '..', 'templates', 'cert.hbs');
  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  const compile = handlebars.compile(templateHtml);
  const html = compile(data);

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath, // this will resolve to bundled Chrome
    headless: chromium.headless
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();

  return pdfBuffer;
}

module.exports = generatePdf;
