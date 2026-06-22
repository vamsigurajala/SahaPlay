const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const loginKeys = {
  "usernameOrEmailRequired": "Username or Email is required",
  "loginFailed": "Login failed",
  "googleLoginFailed": "Google Login failed",
  "googleFailed": "Google Login was unsuccessful",
  "enterGuestNameError": "Please enter a display name to join as guest"
};

const LANGUAGES = ['es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'pt', 'ar', 'ru', 'it', 'te', 'ta', 'bn', 'mr', 'gu', 'ml', 'kn', 'pa'];

function translateSingle(text, targetLang) {
  return new Promise((resolve) => {
    const tl = targetLang === 'zh' ? 'zh-CN' : targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const parts = parsed[0].map(seg => seg[0]).filter(Boolean);
          resolve(parts.join('').trim());
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => {
      resolve(text);
    });
  });
}

async function translateBatch(texts, targetLang) {
  const separator = "\n###\n";
  const combined = texts.join(separator);
  const tl = targetLang === 'zh' ? 'zh-CN' : targetLang;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(combined)}`;
  
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          const parts = parsed[0].map(seg => seg[0]).filter(Boolean);
          const translatedCombined = parts.join('');
          
          const rawParts = translatedCombined.split(/###|＃＃＃/).map(p => p.trim());
          if (rawParts.length === texts.length) {
            resolve(rawParts);
          } else {
            console.log(`Length mismatch for ${targetLang}: got ${rawParts.length}, expected ${texts.length}. Translating individually...`);
            const individual = [];
            for (const text of texts) {
              individual.push(await translateSingle(text, targetLang));
              await new Promise(r => setTimeout(r, 100));
            }
            resolve(individual);
          }
        } catch (e) {
          console.log(`Error parsing translation for ${targetLang}, translating individually...`);
          const individual = [];
          for (const text of texts) {
            individual.push(await translateSingle(text, targetLang));
            await new Promise(r => setTimeout(r, 100));
          }
          resolve(individual);
        }
      });
    }).on('error', async () => {
      const individual = [];
      for (const text of texts) {
        individual.push(await translateSingle(text, targetLang));
      }
      resolve(individual);
    });
  });
}

async function run() {
  const scriptPath = path.join(__dirname, 'translate_chats_i18n.js');
  let scriptCode = fs.readFileSync(scriptPath, 'utf8');
  
  const regex = /const\s+translations\s*=\s*(\{[\s\S]*?\});/;
  const match = scriptCode.match(regex);
  if (!match) {
    console.error("Could not parse translations object from translate_chats_i18n.js");
    process.exit(1);
  }
  
  const translationsStr = match[1];
  let translations;
  eval(`translations = ${translationsStr}`);
  
  if (!translations.en) translations.en = {};
  for (const k in loginKeys) {
    translations.en[k] = loginKeys[k];
  }
  
  const keys = Object.keys(loginKeys);
  const englishTexts = keys.map(k => loginKeys[k]);
  
  for (const lang of LANGUAGES) {
    console.log(`Translating login keys to: ${lang}...`);
    if (!translations[lang]) translations[lang] = {};
    
    const translatedTexts = await translateBatch(englishTexts, lang);
    for (let i = 0; i < keys.length; i++) {
      translations[lang][keys[i]] = translatedTexts[i];
    }
    console.log(`Finished translating for ${lang}`);
    await new Promise(r => setTimeout(r, 200));
  }
  
  const updatedTranslationsStr = JSON.stringify(translations, null, 2);
  scriptCode = scriptCode.replace(translationsStr, updatedTranslationsStr);
  
  fs.writeFileSync(scriptPath, scriptCode, 'utf8');
  console.log("Successfully updated translate_chats_i18n.js with login translations!");
  
  try {
    console.log("Compiling i18n.js...");
    execSync('node translate_chats_i18n.js', { stdio: 'inherit' });
    console.log("i18n.js successfully compiled!");
  } catch (e) {
    console.error("Failed to compile i18n.js", e);
  }
}

run();
