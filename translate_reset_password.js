const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ── Keys for ResetPassword.jsx UI + Email template strings ──────────────────
const newKeys = {
  // ResetPassword page UI
  "createNewPassword": "Create your new password.",
  "staySecure": "Stay secure.",
  "resetPasswordLeftDesc": "Choose a strong password with at least 8 characters, one uppercase letter, and one number.",
  "newPasswordTitle": "New Password",
  "newPasswordDesc": "Choose a strong password for your account.",
  "invalidResetToken": "Invalid or missing reset token. Please request a new reset link.",
  "invalidResetTokenShort": "Invalid reset token.",
  "resetPasswordMinLength": "Must be at least 8 characters",
  "resetPasswordUppercase": "Must include at least one uppercase letter",
  "resetPasswordNumber": "Must include at least one number",
  "invalidRecoveryKey": "Invalid recovery key format.",
  "passwordResetFailed": "Password reset failed. Please try again.",
  "requestNewResetLink": "Request a new reset link →",
  "newPasswordLabel": "New Password",
  "newPasswordPlaceholder": "Min 8 chars, 1 uppercase, 1 number",
  "reenterPasswordPlaceholder": "Re-enter your new password",
  "recoveryKeyLabel": "Recovery Key",
  "optionalRecommended": "(Optional but recommended)",
  "recoveryKeyPlaceholder": "e.g. ABCD EFGH IJKL MNOP QRST UVWX",
  "recoveryKeyInfoText": "If you enter your recovery key, your password will be updated without losing any data. If you leave this blank, your old encrypted messages will be permanently erased for your security.",
  "resettingText": "Resetting...",
  "resetPasswordBtn": "Reset Password",
  "backToLoginArrow": "← Back to Login",
  "passwordResetSuccess": "Password Reset!",
  "passwordResetSuccessDesc": "Your password has been updated successfully. You can now log in with your new password.",
  "goToLogin": "Go to Login",

  // Email template strings (for backend)
  "emailResetSubject": "Reset your SahaPlay password",
  "emailResetTagline": "Watch Together. Anywhere.",
  "emailResetHeading": "Reset Your Password",
  "emailResetBody1": "We received a request to reset the password for your SahaPlay account associated with",
  "emailResetBody2": "Click the button below to create a new password. This link expires in",
  "emailResetExpiry": "10 minutes",
  "emailResetBtn": "Reset My Password",
  "emailResetIgnore": "If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.",
  "emailResetCopyLink": "Or copy and paste this link in your browser:",
  "emailResetFooter": "© 2026 SahaPlay · All rights reserved",
};

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

async function translateBatch(texts, targetLang) {
  const sep = "\n###\n";
  const combined = texts.join(sep);
  const tl = targetLang === 'zh' ? 'zh-CN' : targetLang;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(combined)}`;
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', async () => {
        try {
          const parts = JSON.parse(data)[0].map(s => s[0]).filter(Boolean).join('');
          const split = parts.split(/###|＃＃＃/).map(p => p.trim());
          if (split.length === texts.length) { resolve(split); return; }
          console.log(`  Length mismatch for ${targetLang}, translating individually...`);
        } catch {}
        const individual = [];
        for (const t of texts) { individual.push(await translateSingle(t, targetLang)); await new Promise(r => setTimeout(r, 120)); }
        resolve(individual);
      });
    }).on('error', async () => {
      const individual = [];
      for (const t of texts) { individual.push(await translateSingle(t, targetLang)); await new Promise(r => setTimeout(r, 120)); }
      resolve(individual);
    });
  });
}

async function run() {
  // ── 1. Update i18n translations ──────────────────────────────────────────
  const scriptPath = path.join(__dirname, 'translate_chats_i18n.js');
  let scriptCode = fs.readFileSync(scriptPath, 'utf8');
  const regex = /const\s+translations\s*=\s*(\{[\s\S]*?\});/;
  const match = scriptCode.match(regex);
  if (!match) { console.error('Cannot parse translations'); process.exit(1); }
  let translations; eval(`translations = ${match[1]}`);

  if (!translations.en) translations.en = {};
  const keys = Object.keys(newKeys);
  for (const k of keys) translations.en[k] = newKeys[k];

  const englishTexts = keys.map(k => newKeys[k]);
  const CHUNK = 15;

  for (const lang of LANGUAGES) {
    if (!translations[lang]) translations[lang] = {};
    const missingKeys = keys.filter(k => !translations[lang][k]);
    if (missingKeys.length === 0) { console.log(`[${lang}] all present, skip.`); continue; }
    console.log(`\n[${lang}] translating ${missingKeys.length} keys...`);
    const missingTexts = missingKeys.map(k => newKeys[k]);
    for (let i = 0; i < missingKeys.length; i += CHUNK) {
      const ck = missingKeys.slice(i, i + CHUNK);
      const ct = missingTexts.slice(i, i + CHUNK);
      const results = await translateBatch(ct, lang);
      for (let j = 0; j < ck.length; j++) translations[lang][ck[j]] = results[j];
      if (i + CHUNK < missingKeys.length) await new Promise(r => setTimeout(r, 300));
    }
    console.log(`[${lang}] done.`);
    await new Promise(r => setTimeout(r, 250));
  }

  scriptCode = scriptCode.replace(match[1], JSON.stringify(translations, null, 2));
  fs.writeFileSync(scriptPath, scriptCode, 'utf8');
  console.log('\n✓ translate_chats_i18n.js updated');
  execSync('node translate_chats_i18n.js', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ i18n.js recompiled!');

  // ── 2. Build email-translations.js for backend ────────────────────────────
  const emailKeys = Object.keys(newKeys).filter(k => k.startsWith('email'));
  const emailMap = { en: {} };
  for (const k of emailKeys) emailMap.en[k] = newKeys[k];
  for (const lang of LANGUAGES) {
    emailMap[lang] = {};
    for (const k of emailKeys) emailMap[lang][k] = translations[lang]?.[k] || newKeys[k];
  }

  const emailTranslationsPath = path.join(__dirname, 'backend', 'email-translations.js');
  const emailTranslationsCode = `// Auto-generated — do not edit manually\nmodule.exports = ${JSON.stringify(emailMap, null, 2)};\n`;
  fs.writeFileSync(emailTranslationsPath, emailTranslationsCode, 'utf8');
  console.log('✓ backend/email-translations.js created!');
}

run();
