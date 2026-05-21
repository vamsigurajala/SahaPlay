const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'frontend', 'src', 'i18n.js');
let code = fs.readFileSync(i18nPath, 'utf8');

// Strip ESM syntax to make it evaluatable in Node
let cleanCode = code
  .replace(/import\s+i18n\s+from\s+'i18next';/, '//')
  .replace(/import\s+\{\s*initReactI18next\s*\}\s+from\s+'react-i18next';/, '//')
  .replace(/export\s+default\s+i18n;/, '//');

global.resourcesObj = null;

const i18n = {
  use: function() { return this; },
  init: function(options) {
    global.resourcesObj = options.resources;
  }
};
const initReactI18next = {};
const localStorage = {
  getItem: () => 'en'
};

// Eval the clean code to get resourcesObj
eval(cleanCode);

const resources = global.resourcesObj;
if (!resources) {
  console.error("Failed to parse resources from i18n.js");
  process.exit(1);
}

const profileTranslations = {
  en: {
    shareProfileUrl: "Share Profile URL",
    blockUserSuccess: "You have blocked {{username}}",
    country: "Country",
    india: "India",
    unitedstates: "United States"
  },
  es: {
    shareProfileUrl: "Compartir URL del perfil",
    blockUserSuccess: "Has bloqueado a {{username}}",
    country: "País",
    india: "India",
    unitedstates: "Estados Unidos"
  },
  fr: {
    shareProfileUrl: "Partager l'URL du profil",
    blockUserSuccess: "Vous avez bloqué {{username}}",
    country: "Pays",
    india: "Inde",
    unitedstates: "États-Unis"
  },
  de: {
    shareProfileUrl: "Profil-URL teilen",
    blockUserSuccess: "Du hast {{username}} blockiert",
    country: "Land",
    india: "Indien",
    unitedstates: "Vereinigte Staaten"
  },
  ja: {
    shareProfileUrl: "プロフィールURLを共有",
    blockUserSuccess: "{{username}}をブロックしました",
    country: "国",
    india: "インド",
    unitedstates: "アメリカ合衆国"
  },
  ko: {
    shareProfileUrl: "프로필 URL 공유",
    blockUserSuccess: "{{username}}님을 차단했습니다",
    country: "국가",
    india: "인도",
    unitedstates: "미국"
  },
  zh: {
    shareProfileUrl: "分享个人资料链接",
    blockUserSuccess: "您已屏蔽了 {{username}}",
    country: "国家",
    india: "印度",
    unitedstates: "美国"
  },
  hi: {
    shareProfileUrl: "प्रोफ़ाइल यूआरएल साझा करें",
    blockUserSuccess: "आपने {{username}} को ब्लॉक कर दिया है",
    country: "देश",
    india: "भारत",
    unitedstates: "संयुक्त राज्य अमेरिका"
  },
  pt: {
    shareProfileUrl: "Compartilhar URL do perfil",
    blockUserSuccess: "Você bloqueou {{username}}",
    country: "País",
    india: "Índia",
    unitedstates: "Estados Unidos"
  },
  ar: {
    shareProfileUrl: "مشاركة رابط الملف الشخصي",
    blockUserSuccess: "لقد قمت بحظر {{username}}",
    country: "البلد",
    india: "الهند",
    unitedstates: "الولايات المتحدة"
  },
  ru: {
    shareProfileUrl: "Поделиться ссылкой на профиль",
    blockUserSuccess: "Вы заблокировали {{username}}",
    country: "Страна",
    india: "Индия",
    unitedstates: "США"
  },
  it: {
    shareProfileUrl: "Condividi URL del profilo",
    blockUserSuccess: "Hai bloccato {{username}}",
    country: "Paese",
    india: "India",
    unitedstates: "Stati Uniti"
  },
  te: {
    shareProfileUrl: "ప్రొఫైల్ URL ని షేర్ చేయి",
    blockUserSuccess: "మీరు {{username}} ని బ్లాక్ చేసారు",
    country: "దేశం",
    india: "భారతదేశం",
    unitedstates: "అమెరికా"
  },
  ta: {
    shareProfileUrl: "சுயவிவர URL ஐப் பகிரவும்",
    blockUserSuccess: "நீங்கள் {{username}} ஐ முடக்கியுள்ளீர்கள்",
    country: "நாடு",
    india: "இந்தியா",
    unitedstates: "அமெரிக்கா"
  },
  bn: {
    shareProfileUrl: "প্রোফাইল ইউআরএল শেয়ার করুন",
    blockUserSuccess: "আপনি {{username}} কে ব্লক করেছেন",
    country: "দেশ",
    india: "ভারত",
    unitedstates: "মার্কিন যুক্তরাষ্ট্র"
  },
  mr: {
    shareProfileUrl: "प्रोफाइल URL शेअर करा",
    blockUserSuccess: "तुम्ही {{username}} ला ब्लॉक केले आहे",
    country: "देश",
    india: "भारत",
    unitedstates: "अमेरिका"
  },
  gu: {
    shareProfileUrl: "પ્રોફાઇલ URL શેર કરો",
    blockUserSuccess: "તમે {{username}} ને બ્લોક કર્યા છે",
    country: "દેશ",
    india: "ભારત",
    unitedstates: "યુનાઇટેડ સ્ટેટ્સ"
  },
  ml: {
    shareProfileUrl: "പ്രൊഫൈൽ URL പങ്കിടുക",
    blockUserSuccess: "നിങ്ങൾ {{username}} ബ്ലോക്ക് ചെയ്തു",
    country: "രാജ്യം",
    india: "ഇന്ത്യ",
    unitedstates: "അമേരിക്ക"
  },
  kn: {
    shareProfileUrl: "ಪ್ರೊಫೈಲ್ URL ಹಂಚಿಕೊಳ್ಳಿ",
    blockUserSuccess: "ನೀವು {{username}} ಅವರನ್ನು ಬ್ಲಾಕ್ ಮಾಡಿದ್ದೀರಿ",
    country: "ದೇಶ",
    india: "ಭಾರತ",
    unitedstates: "ಅಮೆರಿಕ"
  },
  pa: {
    shareProfileUrl: "ਪ੍ਰੋਫਾਈਲ URL ਸਾਂਝਾ ਕਰੋ",
    blockUserSuccess: "ਤੁਸੀਂ {{username}} ਨੂੰ ਬਲਾਕ ਕਰ ਦਿੱਤਾ ਹੈ",
    country: "ਦੇਸ਼",
    india: "ਭਾਰਤ",
    unitedstates: "ਅਮਰੀਕਾ"
  }
};

// Inject and sort translations
for (const lang in profileTranslations) {
  if (!resources[lang]) {
    resources[lang] = { translation: {} };
  }
  if (!resources[lang].translation) {
    resources[lang].translation = {};
  }
  
  for (const key in profileTranslations[lang]) {
    resources[lang].translation[key] = profileTranslations[lang][key];
  }
  
  // Sort alphabetically
  const sorted = {};
  Object.keys(resources[lang].translation).sort().forEach(k => {
    sorted[k] = resources[lang].translation[k];
  });
  resources[lang].translation = sorted;
}

// Generate Resources Block
const newResourcesBlock = "const resources = " + JSON.stringify(resources, null, 2) + ";";

const startMarker = "const resources =";
const startIndex = code.indexOf(startMarker);
if (startIndex === -1) {
  console.error("Could not find resources block start");
  process.exit(1);
}

const endMatch = code.match(/i18n\s*\.use/);
if (!endMatch) {
  console.error("Could not find resources block end");
  process.exit(1);
}
const endIndex = endMatch.index;

const originalDeclaration = code.substring(startIndex, endIndex);
const updatedCode = code.replace(originalDeclaration, newResourcesBlock + "\n\n");

fs.writeFileSync(i18nPath, updatedCode, 'utf8');
console.log("Successfully updated and sorted profile options translations in i18n.js!");
