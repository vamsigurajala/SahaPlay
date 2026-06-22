// Check and fix translations for MediaSelectorModal and Room cast strings
import { readFileSync, writeFileSync } from 'fs';

const filePath = './frontend/src/i18n.js';
const content = readFileSync(filePath, 'utf8');

// Check which keys already exist
const keysToCheck = ['appDirectory', 'urlInputPlaceholder', 'launchBtn', 'castScreen', 'castToTv'];
console.log('Checking existing keys:');
keysToCheck.forEach(k => {
  const count = (content.match(new RegExp(`"${k}"`, 'g')) || []).length;
  console.log(`  "${k}": ${count} occurrences`);
});
