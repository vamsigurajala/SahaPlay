import fs from 'fs';
import path from 'path';

const filesToEdit = [
  'src/Home.jsx',
  'src/HowItWorks.jsx',
  'src/Features.jsx',
  'src/Terms.jsx',
  'src/Safety.jsx',
  'src/Cookies.jsx',
  'src/AppSettings.jsx',
  'src/Profile.jsx',
  'src/PublicRooms.jsx'
];

filesToEdit.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace overflowX: 'hidden' or overflowX: "hidden" with nothing, taking care of commas
  // e.g. style={{ minHeight: '100vh', overflowX: 'hidden' }}
  // e.g. style={{ minHeight: '100vh', overflowX: 'hidden', ... }}
  
  // Case 1: ", overflowX: 'hidden'" or ", overflowX: \"hidden\""
  content = content.replace(/,\s*overflowX:\s*['"]hidden['"]/g, '');
  
  // Case 2: "overflowX: 'hidden', " or "overflowX: \"hidden\", "
  content = content.replace(/overflowX:\s*['"]hidden['"],\s*/g, '');
  
  // Case 3: "overflowX: 'hidden'" or "overflowX: \"hidden\"" (if it's the only property)
  content = content.replace(/overflowX:\s*['"]hidden['"]/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
