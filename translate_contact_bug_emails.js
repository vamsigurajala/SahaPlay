const fs = require('fs');
const path = require('path');
const https = require('https');

const newKeys = {
  // Contact Us email
  "emailContactSubject": "We received your message — SahaPlay",
  "emailContactTitle": "We got your message!",
  "emailContactSubtitle": "SahaPlay Support",
  "emailContactHi": "Hi",
  "emailContactBody": "Thanks for reaching out! We received your message and will get back to you within 48 hours.",
  "emailContactYourMsg": "Your message",
  "emailContactUrgent": "Need urgent help? Email us at",
  "emailContactFooter": "SahaPlay Team",

  // Bug Report email
  "emailBugSubject": "Bug Report Received",
  "emailBugTitle": "Bug Report Received",
  "emailBugSubtitle": "SahaPlay Bug Tracker",
  "emailBugBody1": "We received your bug report about",
  "emailBugBody2": "Our team will investigate it and we'll update you here when it's resolved.",
  "emailBugDetails": "Report Details",
  "emailBugReportId": "Report ID",
  "emailBugType": "Bug Type",
  "emailBugSeverity": "Severity",
  "emailBugHint": "We'll email you at this address when the issue is resolved.",
  "emailBugUrgent": "For urgent help:",
  "emailBugFooter": "SahaPlay Team",

  // API responses for forgot-password
  "apiResetEmailOrUsernameRequired": "Email or username is required",
  "apiResetSuccessGeneric": "If an account matches that email, a password reset link has been sent.",
  "apiResetSuccess": "Password reset link sent to your email!",
  "apiErrorFallback": "Something went wrong. Please try again.",

  // API responses for contact
  "apiContactSuccess": "Message sent!",
  "apiContactErrorAuth": "Email configuration error. Please try again later or contact us directly.",
  "apiContactErrorConnection": "Cannot connect to email server. Please try again later or email sahaaplay@gmail.com directly.",
  "apiContactErrorFallback": "Failed to send message. Please try again or email sahaaplay@gmail.com directly.",

  // API responses for report-bug
  "apiBugErrorName": "Name must be at least 2 characters.",
  "apiBugErrorEmail": "Please provide a valid email address.",
  "apiBugErrorType": "Please select a valid bug type.",
  "apiBugErrorSeverity": "Please select a severity level.",
  "apiBugErrorHappened": "Please describe what happened (min 20 characters).",
  "apiBugErrorExpected": "Please describe what you expected (min 10 characters).",
  "apiBugErrorActual": "Please describe what actually happened (min 10 characters).",
  "apiBugErrorBrowser": "Please enter your browser.",
  "apiBugErrorOs": "Please enter your operating system.",
  "apiBugErrorNoConfig": "Email service not configured. Please email sahaaplay@gmail.com directly.",
  "apiBugErrorAuth": "Email authentication failed. Please email sahaaplay@gmail.com directly.",
  "apiBugErrorConnection": "Cannot connect to email server. Please try again later or email sahaaplay@gmail.com directly.",
  "apiBugErrorFallback": "Failed to submit bug report. Please try again or email sahaaplay@gmail.com directly."
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
  const emailTranslationsPath = path.join(__dirname, 'backend', 'email-translations.js');
  let emailTranslations = {};
  if (fs.existsSync(emailTranslationsPath)) {
    emailTranslations = require(emailTranslationsPath);
  }

  // Ensure 'en' has the keys
  if (!emailTranslations.en) emailTranslations.en = {};
  for (const k of Object.keys(newKeys)) {
    emailTranslations.en[k] = newKeys[k];
  }

  const keys = Object.keys(newKeys);
  const englishTexts = keys.map(k => newKeys[k]);

  for (const lang of LANGUAGES) {
    if (!emailTranslations[lang]) emailTranslations[lang] = {};
    const missingKeys = keys.filter(k => !emailTranslations[lang][k]);
    if (missingKeys.length === 0) { console.log(`[${lang}] all present, skip.`); continue; }

    console.log(`[${lang}] translating ${missingKeys.length} keys...`);
    const missingTexts = missingKeys.map(k => newKeys[k]);
    const results = await translateBatch(missingTexts, lang);
    for (let j = 0; j < missingKeys.length; j++) {
      emailTranslations[lang][missingKeys[j]] = results[j];
    }
    console.log(`[${lang}] done.`);
    await new Promise(r => setTimeout(r, 300));
  }

  const code = `// Auto-generated — do not edit manually\nmodule.exports = ${JSON.stringify(emailTranslations, null, 2)};\n`;
  fs.writeFileSync(emailTranslationsPath, code, 'utf8');
  console.log('✓ email-translations.js updated successfully!');
}

run();
