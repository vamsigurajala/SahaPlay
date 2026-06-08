const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const newKey = { "invalidCredentials": "Invalid credentials" };
const LANGUAGES = ['es','fr','de','ja','ko','zh','hi','pt','ar','ru','it','te','ta','bn','mr','gu','ml','kn','pa'];

function translateSingle(text, targetLang) {
  return new Promise((resolve) => {
    const tl = targetLang === 'zh' ? 'zh-CN' : targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)[0].map(s => s[0]).filter(Boolean).join('').trim()); }
        catch { resolve(text); }
      });
    }).on('error', () => resolve(text));
  });
}

async function run() {
  const scriptPath = path.join(__dirname, 'translate_chats_i18n.js');
  let scriptCode = fs.readFileSync(scriptPath, 'utf8');
  const regex = /const\s+translations\s*=\s*(\{[\s\S]*?\});/;
  const match = scriptCode.match(regex);
  if (!match) { console.error('Cannot parse translations'); process.exit(1); }
  let translations; eval(`translations = ${match[1]}`);

  if (!translations.en) translations.en = {};
  translations.en.invalidCredentials = "Invalid credentials";

  for (const lang of LANGUAGES) {
    if (!translations[lang]) translations[lang] = {};
    process.stdout.write(`Translating [${lang}]... `);
    translations[lang].invalidCredentials = await translateSingle("Invalid credentials", lang);
    console.log(`→ "${translations[lang].invalidCredentials}"`);
    await new Promise(r => setTimeout(r, 150));
  }

  scriptCode = scriptCode.replace(match[1], JSON.stringify(translations, null, 2));
  fs.writeFileSync(scriptPath, scriptCode, 'utf8');
  console.log('\n✓ translate_chats_i18n.js updated');

  execSync('node translate_chats_i18n.js', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ i18n.js recompiled!');
}

run();
