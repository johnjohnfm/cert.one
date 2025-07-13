async function generatePdfFallback(data) {
  console.log('Using fallback PDF generation method...');
  
  // Use the sophisticated Handlebars template
  const templatePath = findTemplatePath();
  console.log('Using template at:', templatePath);
  
  try {
    // Load and compile template
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    console.log('Template loaded successfully');
    
    const template = handlebars.compile(templateSource);
    console.log('Template compiled successfully');
    
    // Generate HTML with data
    const html = template(data);
    console.log('HTML generated with data');
    
    // Return the HTML content
    console.log('Fallback method: Returning HTML content (PDF generation not available)');
    return html;
    
  } catch (error) {
    console.error('Error in fallback generation:', error);
    
    // Return a simple HTML fallback if template fails
    return `
      <html>
        <head>
          <title>Certificate</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .cert { border: 2px solid #333; padding: 20px; margin: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .field { margin: 10px 0; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="cert">
            <div class="title">Certificate</div>
            <div class="field"><span class="label">User:</span> ${data.userName || 'Unknown'}</div>
            <div class="field"><span class="label">Title:</span> ${data.title || 'Certificate'}</div>
            <div class="field"><span class="label">Certificate ID:</span> ${data.certificateId || 'N/A'}</div>
            <div class="field"><span class="label">Date:</span> ${data.timestamp || 'N/A'}</div>
            <div class="field"><span class="label">File Hash:</span> ${data.fileHash || 'N/A'}</div>
            <div class="field"><span class="label">Blockchain:</span> ${data.blockchain || 'N/A'}</div>
          </div>
        </body>
      </html>
    `;
  }
}
