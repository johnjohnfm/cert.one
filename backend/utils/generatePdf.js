const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Simple template path finder
function findTemplatePath() {
  const paths = [
    path.join(__dirname, '../templates/cert.hbs'),
    path.join(__dirname, '../../templates/cert.hbs'),
    path.join(process.cwd(), 'templates/cert.hbs'),
    path.join(process.cwd(), 'backend/templates/cert.hbs')
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
    console.log('Template loaded successfully');
    
    // Compile template
    const template = handlebars.compile(templateHtml);
    const html = template(data);
    console.log('Template compiled successfully');

    // Return HTML as buffer
    console.log('Returning HTML content');
    return Buffer.from(html, 'utf8');
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

// Export the function
module.exports = generatePdf;
