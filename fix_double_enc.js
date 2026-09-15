const fs = require('fs');
const path = require('path');

function fixDoubleEncoding(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      fixDoubleEncoding(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      
      // If the file contains telltale double-encoded UTF-8 sequences for Turkish:
      // Ã§ (ç), Ä± (ı), Ã¼ (ü), Ã¶ (ö), ÅŸ (ş), ÄŸ (ğ)
      if (content.includes('Ã§') || content.includes('Ä±') || content.includes('Ã¼') || 
          content.includes('Ã¶') || content.includes('ÅŸ') || content.includes('ÄŸ') ||
          content.includes('Ä°') || content.includes('Ã‡') || content.includes('Ã–') ||
          content.includes('Ãœ') || content.includes('Åž') || content.includes('Äž')) {
          
          console.log("Fixing double-encoding for:", p);
          
          try {
            // Convert to latin1 buffer then read as utf8
            let fixed = Buffer.from(content, 'latin1').toString('utf8');
            
            // Remove BOM if it accidentally got converted to \uFFFD
            fixed = fixed.replace(/^\uFFFD/, '');
            
            fs.writeFileSync(p, fixed, 'utf8');
          } catch (e) {
            console.error("Failed to fix:", p, e);
          }
      }
    }
  }
}

fixDoubleEncoding('src/app');
fixDoubleEncoding('src/components');
fixDoubleEncoding('src/lib');