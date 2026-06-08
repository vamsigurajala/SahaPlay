// Fix 2: Insert app_* keys for all remaining languages (fr through pa)
// Process in REVERSE order so line shifts don't affect earlier entries
import { readFileSync, writeFileSync } from 'fs';

const filePath = './frontend/src/i18n.js';
const content = readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Known catQuickActions positions (1-indexed from previous run output)
// Format: [lineNumber1based, lang, app_custom, app_screenshare, app_upload]
// English (110) and Spanish (1601) already done.
const insertions = [
  { line: 28508, lang: 'pa', custom: 'URL ਪੇਸਟ ਕਰੋ',           screenshare: 'ਸਕ੍ਰੀਨ ਸ਼ੇਅਰ',        upload: 'ਫਾਈਲ ਅਪਲੋਡ ਕਰੋ' },
  { line: 27011, lang: 'kn', custom: 'URL ಅಂಟಿಸಿ',               screenshare: 'ಸ್ಕ್ರೀನ್ ಶೇರ್',          upload: 'ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ' },
  { line: 25514, lang: 'ml', custom: 'URL ഒട്ടിക്കുക',            screenshare: 'സ്ക്രീൻ ഷെയർ',           upload: 'ഫയൽ അപ്‌ലോഡ് ചെയ്യുക' },
  { line: 24027, lang: 'gu', custom: 'URL પેસ્ટ કરો',            screenshare: 'સ્ક્રીન શેર',              upload: 'ફાઇલ અપલોડ કરો' },
  { line: 22541, lang: 'mr', custom: 'URL पेस्ट करा',             screenshare: 'स्क्रीन शेअर',             upload: 'फाइल अपलोड करा' },
  { line: 21045, lang: 'bn', custom: 'URL পেস্ট করুন',            screenshare: 'স্ক্রিন শেয়ার',            upload: 'ফাইল আপলোড করুন' },
  { line: 19557, lang: 'ta', custom: 'URL ஒட்டவும்',              screenshare: 'திரை பகிர்வு',             upload: 'கோப்பை பதிவேற்றவும்' },
  { line: 18065, lang: 'te', custom: 'URL పేస్ట్ చేయండి',         screenshare: 'స్క్రీన్ షేర్',             upload: 'ఫైల్ అప్‌లోడ్' },
  { line: 16567, lang: 'it', custom: 'Incolla URL',                screenshare: 'Condividi Schermo',         upload: 'Carica File' },
  { line: 15069, lang: 'ru', custom: 'Вставить ссылку',            screenshare: 'Поделиться экраном',        upload: 'Загрузить файл' },
  { line: 13571, lang: 'ar', custom: 'لصق رابط',                   screenshare: 'مشاركة الشاشة',            upload: 'رفع ملف' },
  { line: 12073, lang: 'pt', custom: 'Colar URL',                  screenshare: 'Compartilhar Tela',         upload: 'Enviar Arquivo' },
  { line: 10580, lang: 'hi', custom: 'URL पेस्ट करें',             screenshare: 'स्क्रीन शेयर',             upload: 'फ़ाइल अपलोड करें' },
  { line:  9084, lang: 'zh', custom: '粘贴链接',                    screenshare: '屏幕共享',                  upload: '上传文件' },
  { line:  7588, lang: 'ko', custom: 'URL 붙여넣기',               screenshare: '화면 공유',                 upload: '파일 업로드' },
  { line:  6092, lang: 'ja', custom: 'URLを貼る',                   screenshare: '画面共有',                  upload: 'ファイルをアップロード' },
  { line:  4596, lang: 'de', custom: 'URL einfügen',               screenshare: 'Bildschirm teilen',         upload: 'Datei hochladen' },
  { line:  3100, lang: 'fr', custom: "Coller une URL",             screenshare: "Partager l'Écran",          upload: 'Téléverser un Fichier' },
];

// Get the indentation from the catQuickActions line
function getIndent(lineStr) {
  return lineStr.match(/^(\s*)/)[1];
}

let successCount = 0;

// Process in reverse order (already ordered highest to lowest line numbers)
for (const item of insertions) {
  const idx = item.line - 1; // Convert to 0-based index
  const catQALine = lines[idx];
  
  if (!catQALine || !catQALine.includes('catQuickActions')) {
    console.warn(`⚠️  [${item.lang}] Line ${item.line} does not contain catQuickActions: "${catQALine?.trim()}"`);
    continue;
  }
  
  // Check if app_screenshare already exists right after (lines[idx+1], [idx+2], [idx+3])
  const nextThree = [lines[idx+1], lines[idx+2], lines[idx+3]].join(' ');
  if (nextThree.includes('app_screenshare')) {
    console.log(`  [${item.lang}] app_* already inserted, skipping`);
    continue;
  }
  
  const indent = getIndent(catQALine);
  const newLines = [
    `${indent}"app_custom": "${item.custom}",`,
    `${indent}"app_screenshare": "${item.screenshare}",`,
    `${indent}"app_upload": "${item.upload}",`,
  ];
  
  // Insert AFTER the catQuickActions line
  lines.splice(idx + 1, 0, ...newLines);
  console.log(`  ✓ [${item.lang}] Inserted app_* keys after line ${item.line}`);
  successCount++;
}

const newContent = lines.join('\n');
writeFileSync(filePath, newContent, 'utf8');
console.log(`\n✅ Done! Inserted app_* in ${successCount} languages. File: ${newContent.length} bytes`);
