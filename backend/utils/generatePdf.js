const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Simple template path finder for certv3.hbs
function findTemplatePath() {
  const paths = [
    path.join(__dirname, '../templates/certv3.hbs'),
    path.join(__dirname, '../../templates/certv3.hbs'),
    path.join(process.cwd(), 'templates/certv3.hbs'),
    path.join(process.cwd(), 'backend/templates/certv3.hbs')
  ];
  
  for (const templatePath of paths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }
  
  throw new Error('Template not found in: ' + paths.join(', '));
}

// Main PDF generation function
async function generatePdf(data) {
  try {
    console.log('Starting PDF generation with data:', data);
    
    // Validate input
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided');
    }

    // Load template
    const templatePath = findTemplatePath();
    console.log('Using template at:', templatePath);
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);
    const html = template(data);

    // Return HTML as a Buffer (for now, not PDF)
    return Buffer.from(html, 'utf8');
  } catch (err) {
    console.error('Error generating PDF:', err);
    throw err;
  }
}

module.exports = generatePdf;
