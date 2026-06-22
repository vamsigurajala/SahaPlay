const fs = require('fs');
const { parse } = require('@babel/parser');

const code = fs.readFileSync('./src/Profile.jsx', 'utf8');
try {
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log('No syntax errors found!');
} catch (e) {
  console.error('Error at line', e.loc && e.loc.line, 'column', e.loc && e.loc.column);
  console.error(e.message);
}
