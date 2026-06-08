const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ── All keys to translate (Signup + Login alerts + ForgotPassword) ──────────
const allKeys = {
  // --- Signup page ---
  "createAccount": "Create Account",
  "alreadyHaveOne": "Already have one?",
  "usernameLabel": "Username",
  "usernamePlaceholder": "Username",
  "emailAddressLabel": "Email Address",
  "emailPlaceholder": "name@example.com",
  "passwordLabel": "Password",
  "passwordPlaceholder": "Password",
  "confirmPasswordLabel": "Confirm Password",
  "confirmPasswordPlaceholder": "Confirm your password",
  "saveRecoveryPhrase": "Save Recovery Phrase",
  "recoveryTooltip": "After signup you'll receive a 24-letter recovery key. It's the only way to recover your encrypted messages if you forget your password or change your device. The server never sees your messages.",
  "creatingAccount": "Creating account...",
  "signUp": "Sign Up",
  "orSignUpWith": "OR SIGN UP WITH",
  "joinFutureWatching": "Join the future of watching.",
  "signupSubtitle": "Create your free account and start watching with friends in synchronized rooms — with end-to-end encrypted chat.",
  "usernameRequired": "Username is required",
  "usernameTooShort": "At least 3 characters",
  "emailRequired": "Email is required",
  "emailInvalid": "Enter a valid email",
  "passwordTooShort": "At least 8 characters",
  "passwordUpper": "Include at least 1 uppercase letter",
  "passwordNumber": "Include at least 1 number",
  "passwordSpecial": "Include at least 1 special character",
  "passwordsMismatch": "Passwords do not match",
  "signupFailed": "Signup failed",
  "networkError": "Network error. Please try again.",
  "networkErrorGoogle": "Network error during Google Auth",
  "googleSignupFailed": "Google Signup failed",
  "googleUnsuccessful": "Google Signup was unsuccessful",
  "appleNotConfigured": "Apple Sign-In is not yet configured",
  "accountCreatedVerify": "Account created! Please check your email to verify your account.",

  // --- Login page alerts ---
  "usernameOrEmailRequired": "Username or Email is required",
  "passwordRequired": "Password is required",
  "loginFailed": "Login failed",
  "googleLoginFailed": "Google Login failed",
  "googleFailed": "Google Login was unsuccessful",
  "enterGuestNameError": "Please enter a display name to join as guest",
  "networkErrorLater": "Network error. Please try again later.",

  // --- ForgotPassword page ---
  "forgotPasswordTitle": "Forgot your password?",
  "noProblem": "No problem.",
  "forgotPasswordLeftDesc": "Enter your email and we'll send you a secure link to reset your password. Takes less than a minute.",
  "resetPasswordTitle": "Reset Password",
  "resetPasswordDesc": "Enter your email or username and we'll send you a reset link.",
  "emailOrUsernameLabel": "Email or Username",
  "emailOrUsernamePlaceholder": "name@example.com or username",
  "sendingLink": "Sending link...",
  "sendResetLink": "Send Reset Link",
  "rememberPassword": "Remember your password?",
  "enterEmailOrUsernameError": "Please enter your email or username.",
  "emailOrUsernameRequired": "Email or username is required",
  "somethingWentWrongError": "Something went wrong. Please try again.",
  "networkErrorLaterFP": "Network error. Please try again later.",
  "checkYourInbox": "Check your inbox!",
  "resetLinkSentDesc": "We sent a reset link to {{email}}. It expires in 10 minutes.",
  "dontSeeItTitle": "Don't see it?",
  "dontSeeItText": "Check your Spam or Promotions folder. It may take 1–2 minutes.",
  "backToLoginBtn": "Back to Login",
  "backToLogin": "Back to Login",

  // --- Shared / Navigation ---
  "backToHome": "Back to Home",
  "logIn": "Log In",
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
    }).on('error', () => resolve(text));
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
            console.log(`  Length mismatch for ${targetLang}: got ${rawParts.length}, expected ${texts.length}. Translating individually...`);
            const individual = [];
            for (const text of texts) {
              individual.push(await translateSingle(text, targetLang));
              await new Promise(r => setTimeout(r, 120));
            }
            resolve(individual);
          }
        } catch (e) {
          console.log(`  Error parsing for ${targetLang}, translating individually...`);
          const individual = [];
          for (const text of texts) {
            individual.push(await translateSingle(text, targetLang));
            await new Promise(r => setTimeout(r, 120));
          }
          resolve(individual);
        }
      });
    }).on('error', async () => {
      const individual = [];
      for (const text of texts) {
        individual.push(await translateSingle(text, targetLang));
        await new Promise(r => setTimeout(r, 120));
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

  let translations;
  eval(`translations = ${match[1]}`);

  // Ensure EN exists and add all keys
  if (!translations.en) translations.en = {};
  const keys = Object.keys(allKeys);
  for (const k of keys) translations.en[k] = allKeys[k];

  // Translate to each language (only keys that are missing or all keys)
  const englishTexts = keys.map(k => allKeys[k]);

  for (const lang of LANGUAGES) {
    console.log(`\nTranslating ${keys.length} keys to [${lang}]...`);
    if (!translations[lang]) translations[lang] = {};

    // Filter to only missing keys to avoid re-translating
    const missingKeys = keys.filter(k => !translations[lang][k]);
    if (missingKeys.length === 0) {
      console.log(`  All keys already present for [${lang}], skipping.`);
      continue;
    }

    const missingTexts = missingKeys.map(k => allKeys[k]);
    console.log(`  Translating ${missingKeys.length} missing keys...`);

    // Translate in chunks of 20 to avoid URL length issues
    const CHUNK_SIZE = 20;
    for (let i = 0; i < missingKeys.length; i += CHUNK_SIZE) {
      const chunkKeys = missingKeys.slice(i, i + CHUNK_SIZE);
      const chunkTexts = missingTexts.slice(i, i + CHUNK_SIZE);
      const translatedChunk = await translateBatch(chunkTexts, lang);
      for (let j = 0; j < chunkKeys.length; j++) {
        translations[lang][chunkKeys[j]] = translatedChunk[j];
      }
      if (i + CHUNK_SIZE < missingKeys.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    console.log(`  Done [${lang}].`);
    await new Promise(r => setTimeout(r, 250));
  }

  // Write back to translate_chats_i18n.js
  const updatedStr = JSON.stringify(translations, null, 2);
  scriptCode = scriptCode.replace(match[1], updatedStr);
  fs.writeFileSync(scriptPath, scriptCode, 'utf8');
  console.log('\n✓ Updated translate_chats_i18n.js');

  // Recompile i18n.js
  try {
    console.log('Compiling i18n.js...');
    execSync('node translate_chats_i18n.js', { stdio: 'inherit', cwd: __dirname });
    console.log('✓ i18n.js compiled successfully!');
  } catch (e) {
    console.error('Failed to compile i18n.js:', e.message);
  }
}

run();
