const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

// Helper function to find template path
function findTemplatePath() {
  const possiblePaths = [
    path.join(__dirname, '../templates/cert.hbs'),
    path.join(__dirname, '../../templates/cert.hbs'),
    path.join(process.cwd(), 'templates/cert.hbs'),
    path.join(process.cwd(), 'backend/templates/cert.hbs')
  ];
  
  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }
  
  throw new Error('Certificate template not found. Checked paths: ' + possiblePaths.join(', '));
}

async function generatePdf(data) {
  try {
    console.log('Starting PDF generation with data:', data);
    
    // Validate input data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided for PDF generation');
    }

    // Read and compile template
    const templatePath = findTemplatePath();
    console.log('Using template at:', templatePath);
    
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    console.log('Template loaded successfully');
    
    const template = handlebars.compile(templateHtml);
    const html = template(data);
    console.log('Template compiled successfully');

    // For now, just return the HTML as a fallback
    // This will help us test if the basic functionality works
    console.log('Returning HTML content as fallback');
    return Buffer.from(html, 'utf8');
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

module.exports = generatePdf;
