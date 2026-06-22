import { readFileSync, writeFileSync } from 'fs';

const filePath = './frontend/src/i18n.js';
let content = readFileSync(filePath, 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Translations for the 5 category keys + 3 quick-action app keys
// for each non-English language code.
// ─────────────────────────────────────────────────────────────────────────────
const langTranslations = {
  // Translations per language (non-english)
  es: {
    catMoviesVideo:    'Películas y Video',
    catMusicPodcasts:  'Música y Podcasts',
    catQuickActions:   'Acciones Rápidas',
    catSocialMedia:    'Redes Sociales',
    catWebGames:       'Juegos Web',
    app_screenshare:   'Compartir Pantalla',
    app_custom:        'Pegar URL',
    app_upload:        'Subir Archivo',
  },
  fr: {
    catMoviesVideo:    'Films et Vidéos',
    catMusicPodcasts:  'Musique et Podcasts',
    catQuickActions:   'Actions Rapides',
    catSocialMedia:    'Réseaux Sociaux',
    catWebGames:       'Jeux Web',
    app_screenshare:   'Partager l\'Écran',
    app_custom:        'Coller une URL',
    app_upload:        'Téléverser un Fichier',
  },
  de: {
    catMoviesVideo:    'Filme & Video',
    catMusicPodcasts:  'Musik & Podcasts',
    catQuickActions:   'Schnellaktionen',
    catSocialMedia:    'Soziale Medien',
    catWebGames:       'Webspiele',
    app_screenshare:   'Bildschirm teilen',
    app_custom:        'URL einfügen',
    app_upload:        'Datei hochladen',
  },
  ja: {
    catMoviesVideo:    '映画・動画',
    catMusicPodcasts:  '音楽・ポッドキャスト',
    catQuickActions:   'クイックアクション',
    catSocialMedia:    'ソーシャルメディア',
    catWebGames:       'ウェブゲーム',
    app_screenshare:   '画面共有',
    app_custom:        'URLを貼る',
    app_upload:        'ファイルをアップロード',
  },
  ko: {
    catMoviesVideo:    '영화 & 비디오',
    catMusicPodcasts:  '음악 & 팟캐스트',
    catQuickActions:   '빠른 작업',
    catSocialMedia:    '소셜 미디어',
    catWebGames:       '웹 게임',
    app_screenshare:   '화면 공유',
    app_custom:        'URL 붙여넣기',
    app_upload:        '파일 업로드',
  },
  zh: {
    catMoviesVideo:    '影视视频',
    catMusicPodcasts:  '音乐与播客',
    catQuickActions:   '快速操作',
    catSocialMedia:    '社交媒体',
    catWebGames:       '网页游戏',
    app_screenshare:   '屏幕共享',
    app_custom:        '粘贴链接',
    app_upload:        '上传文件',
  },
  hi: {
    catMoviesVideo:    'फिल्में और वीडियो',
    catMusicPodcasts:  'संगीत और पॉडकास्ट',
    catQuickActions:   'त्वरित क्रियाएं',
    catSocialMedia:    'सोशल मीडिया',
    catWebGames:       'वेब गेम्स',
    app_screenshare:   'स्क्रीन शेयर',
    app_custom:        'URL पेस्ट करें',
    app_upload:        'फ़ाइल अपलोड करें',
  },
  pt: {
    catMoviesVideo:    'Filmes e Vídeos',
    catMusicPodcasts:  'Música e Podcasts',
    catQuickActions:   'Ações Rápidas',
    catSocialMedia:    'Redes Sociais',
    catWebGames:       'Jogos Web',
    app_screenshare:   'Compartilhar Tela',
    app_custom:        'Colar URL',
    app_upload:        'Enviar Arquivo',
  },
  ar: {
    catMoviesVideo:    'أفلام وفيديو',
    catMusicPodcasts:  'موسيقى وبودكاست',
    catQuickActions:   'إجراءات سريعة',
    catSocialMedia:    'وسائل التواصل الاجتماعي',
    catWebGames:       'ألعاب الويب',
    app_screenshare:   'مشاركة الشاشة',
    app_custom:        'لصق رابط',
    app_upload:        'رفع ملف',
  },
  ru: {
    catMoviesVideo:    'Фильмы и Видео',
    catMusicPodcasts:  'Музыка и Подкасты',
    catQuickActions:   'Быстрые Действия',
    catSocialMedia:    'Социальные Сети',
    catWebGames:       'Веб-игры',
    app_screenshare:   'Поделиться экраном',
    app_custom:        'Вставить ссылку',
    app_upload:        'Загрузить файл',
  },
  it: {
    catMoviesVideo:    'Film e Video',
    catMusicPodcasts:  'Musica e Podcast',
    catQuickActions:   'Azioni Rapide',
    catSocialMedia:    'Social Media',
    catWebGames:       'Giochi Web',
    app_screenshare:   'Condividi Schermo',
    app_custom:        'Incolla URL',
    app_upload:        'Carica File',
  },
  te: {
    catMoviesVideo:    'చలనచిత్రాలు & వీడియో',
    catMusicPodcasts:  'సంగీతం & పాడ్‌కాస్ట్‌లు',
    catQuickActions:   'త్వరిత చర్యలు',
    catSocialMedia:    'సోషల్ మీడియా',
    catWebGames:       'వెబ్ గేమ్స్',
    app_screenshare:   'స్క్రీన్ షేర్',
    app_custom:        'URL పేస్ట్ చేయండి',
    app_upload:        'ఫైల్ అప్‌లోడ్',
  },
  ta: {
    catMoviesVideo:    'திரைப்படங்கள் & வீடியோ',
    catMusicPodcasts:  'இசை & பாட்காஸ்ட்கள்',
    catQuickActions:   'விரைவு நடவடிக்கைகள்',
    catSocialMedia:    'சமூக ஊடகம்',
    catWebGames:       'வலை விளையாட்டுகள்',
    app_screenshare:   'திரை பகிர்வு',
    app_custom:        'URL ஒட்டவும்',
    app_upload:        'கோப்பை பதிவேற்றவும்',
  },
  bn: {
    catMoviesVideo:    'চলচ্চিত্র ও ভিডিও',
    catMusicPodcasts:  'সঙ্গীত ও পডকাস্ট',
    catQuickActions:   'দ্রুত কার্যক্রম',
    catSocialMedia:    'সোশ্যাল মিডিয়া',
    catWebGames:       'ওয়েব গেমস',
    app_screenshare:   'স্ক্রিন শেয়ার',
    app_custom:        'URL পেস্ট করুন',
    app_upload:        'ফাইল আপলোড করুন',
  },
  mr: {
    catMoviesVideo:    'चित्रपट आणि व्हिडिओ',
    catMusicPodcasts:  'संगीत आणि पॉडकास्ट',
    catQuickActions:   'जलद क्रिया',
    catSocialMedia:    'सोशल मीडिया',
    catWebGames:       'वेब गेम्स',
    app_screenshare:   'स्क्रीन शेअर',
    app_custom:        'URL पेस्ट करा',
    app_upload:        'फाइल अपलोड करा',
  },
  gu: {
    catMoviesVideo:    'ફિલ્મો અને વિડીયો',
    catMusicPodcasts:  'સંગીત અને પૉડકાસ્ટ',
    catQuickActions:   'ઝડપી ક્રિયાઓ',
    catSocialMedia:    'સોશ્યલ મીડિયા',
    catWebGames:       'વેબ ગેમ્સ',
    app_screenshare:   'સ્ક્રીન શેર',
    app_custom:        'URL પેસ્ટ કરો',
    app_upload:        'ફાઇલ અપલોડ કરો',
  },
  ml: {
    catMoviesVideo:    'സിനിമകൾ & വീഡിയോ',
    catMusicPodcasts:  'സംഗീതം & പോഡ്കാസ്റ്റുകൾ',
    catQuickActions:   'ദ്രുത പ്രവർത്തനങ്ങൾ',
    catSocialMedia:    'സോഷ്യൽ മീഡിയ',
    catWebGames:       'വെബ് ഗെയിമുകൾ',
    app_screenshare:   'സ്ക്രീൻ ഷെയർ',
    app_custom:        'URL ഒട്ടിക്കുക',
    app_upload:        'ഫയൽ അപ്‌ലോഡ് ചെയ്യുക',
  },
  kn: {
    catMoviesVideo:    'ಚಲನಚಿತ್ರಗಳು & ವೀಡಿಯೊ',
    catMusicPodcasts:  'ಸಂಗೀತ & ಪಾಡ್‌ಕಾಸ್ಟ್‌ಗಳು',
    catQuickActions:   'ತ್ವರಿತ ಕ್ರಮಗಳು',
    catSocialMedia:    'ಸೋಶಿಯಲ್ ಮೀಡಿಯಾ',
    catWebGames:       'ವೆಬ್ ಗೇಮ್‌ಗಳು',
    app_screenshare:   'ಸ್ಕ್ರೀನ್ ಶೇರ್',
    app_custom:        'URL ಅಂಟಿಸಿ',
    app_upload:        'ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
  },
  pa: {
    catMoviesVideo:    'ਫਿਲਮਾਂ ਅਤੇ ਵੀਡੀਓ',
    catMusicPodcasts:  'ਸੰਗੀਤ ਅਤੇ ਪੋਡਕਾਸਟ',
    catQuickActions:   'ਤੇਜ਼ ਕਾਰਵਾਈਆਂ',
    catSocialMedia:    'ਸੋਸ਼ਲ ਮੀਡੀਆ',
    catWebGames:       'ਵੈੱਬ ਗੇਮਾਂ',
    app_screenshare:   'ਸਕ੍ਰੀਨ ਸ਼ੇਅਰ',
    app_custom:        'URL ਪੇਸਟ ਕਰੋ',
    app_upload:        'ਫਾਈਲ ਅਪਲੋਡ ਕਰੋ',
  },
};

// English keys to add app_* entries
const englishAppKeys = {
  app_screenshare: 'Screen Share',
  app_custom:      'Paste URL',
  app_upload:      'Upload File',
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 – Fix untranslated catXxx values in non-English sections
//  For each language code we know the old (English) values and their
//  replacement translated values. We do a targeted find-replace that only
//  runs inside the right language block.
// ─────────────────────────────────────────────────────────────────────────────

// Keys that were left as English in non-English sections:
const untranslatedEnglishValues = {
  catMoviesVideo:   '"Movies & Video"',
  catMusicPodcasts: '"Music & Podcasts"',
  catQuickActions:  '"Quick Actions"',
  catSocialMedia:   '"Social Media"',
  catWebGames:      '"Web Games"',
};

// Helper: escape string for use in a RegExp
function escRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// We'll find each language block by locating its opening marker, then
// replace the English-valued keys within that range.
const lines = content.split('\n');
console.log(`Total lines: ${lines.length}`);

// Find language section start lines (e.g. `  "es": {`)
// Pattern: /^\s+"(es|fr|de|ja|ko|zh|hi|pt|ar|ru|it|te|ta|bn|mr|gu|ml|kn|pa)": \{/
const langCodes = Object.keys(langTranslations);
const langStartLines = {};  // langCode -> line index (0-based)
const langPattern = new RegExp(`^\\s+"(${langCodes.join('|')})": \\{`);

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(langPattern);
  if (m && !langStartLines[m[1]]) {
    langStartLines[m[1]] = i;
  }
}
console.log('Language start lines found:', Object.entries(langStartLines).map(([k,v]) => `${k}:${v+1}`).join(', '));

// For each language, locate the ending line (next top-level language block or EOF)
function findLangEnd(startIdx) {
  // The next language block or the closing of resources
  const topLangOrEnd = /^  "[a-z]{2}":/;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (topLangOrEnd.test(lines[i])) return i;
  }
  return lines.length;
}

// Apply replacements inside a slice of lines
for (const [lang, translations] of Object.entries(langTranslations)) {
  const startIdx = langStartLines[lang];
  if (startIdx === undefined) {
    console.warn(`⚠️  Could not find start of language section: ${lang}`);
    continue;
  }
  const endIdx = findLangEnd(startIdx);

  for (const [key, newValue] of Object.entries(translations)) {
    // Only update the 5 cat* keys here (app_* will be inserted below)
    if (!key.startsWith('cat')) continue;

    const oldEnglish = untranslatedEnglishValues[key];
    if (!oldEnglish) continue; // nothing to replace

    // Replace first occurrence of `"<key>": <oldEnglish>` in [startIdx, endIdx]
    const pattern = `"${key}": ${oldEnglish}`;
    let replaced = false;
    for (let i = startIdx; i < endIdx; i++) {
      if (lines[i].includes(pattern)) {
        lines[i] = lines[i].replace(pattern, `"${key}": "${newValue}"`);
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      console.warn(`  ⚠️  [${lang}] key "${key}" with English value not found.`);
    } else {
      console.log(`  ✓ [${lang}] ${key} → ${newValue}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 – Add English app_* keys right after existing app_upload or near catAll
// ─────────────────────────────────────────────────────────────────────────────

// First check if app_screenshare already exists in English section
const enStart = 5; // line index (English starts at line 6, index 5)
const enEnd = findLangEnd(enStart);

let hasAppScreenshare = false;
for (let i = enStart; i < enEnd; i++) {
  if (lines[i].includes('"app_screenshare"')) { hasAppScreenshare = true; break; }
}

if (!hasAppScreenshare) {
  // Insert after catQuickActions line in English section
  for (let i = enStart; i < enEnd; i++) {
    if (lines[i].includes('"catQuickActions"')) {
      // Get indentation
      const indent = lines[i].match(/^(\s*)/)[1];
      const newLines = [
        `${indent}"app_custom": "Paste URL",`,
        `${indent}"app_screenshare": "Screen Share",`,
        `${indent}"app_upload": "Upload File",`,
      ];
      lines.splice(i + 1, 0, ...newLines);
      console.log(`✓ [en] Added app_* keys after line ${i+1}`);
      // Recalculate indices since we inserted lines
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 – Add app_* keys in each non-English section
// ─────────────────────────────────────────────────────────────────────────────

// After inserting lines above, line indices have shifted - recalculate
// We need to re-find language start lines
const langStartLines2 = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(langPattern);
  if (m && !langStartLines2[m[1]]) {
    langStartLines2[m[1]] = i;
  }
}

for (const [lang, translations] of Object.entries(langTranslations)) {
  const startIdx = langStartLines2[lang];
  if (startIdx === undefined) continue;
  const endIdx = findLangEnd(startIdx);

  // Check if app_screenshare already in this section
  let alreadyHas = false;
  for (let i = startIdx; i < endIdx; i++) {
    if (lines[i].includes('"app_screenshare"')) { alreadyHas = true; break; }
  }
  if (alreadyHas) {
    console.log(`  [${lang}] app_* keys already exist, skipping`);
    continue;
  }

  // Find catQuickActions line in this section and insert after it
  for (let i = startIdx; i < endIdx; i++) {
    if (lines[i].includes('"catQuickActions"')) {
      const indent = lines[i].match(/^(\s*)/)[1];
      const newLines = [
        `${indent}"app_custom": "${translations.app_custom}",`,
        `${indent}"app_screenshare": "${translations.app_screenshare}",`,
        `${indent}"app_upload": "${translations.app_upload}",`,
      ];
      lines.splice(i + 1, 0, ...newLines);
      console.log(`  ✓ [${lang}] Inserted app_* keys`);
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Write back
// ─────────────────────────────────────────────────────────────────────────────
const newContent = lines.join('\n');
writeFileSync(filePath, newContent, 'utf8');
console.log(`\n✅ Done! Written ${newContent.length} bytes to ${filePath}`);
