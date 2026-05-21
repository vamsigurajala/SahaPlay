const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const translateChatsScriptPath = path.join(__dirname, 'translate_chats_i18n.js');
let scriptCode = fs.readFileSync(translateChatsScriptPath, 'utf8');

const newKeys = {
  "en": {
    "audioDucking": "Audio Ducking",
    "audioDuckingDesc": "Lower media volume when others speak",
    "muteUser": "Mute User",
    "kickUser": "Kick User",
    "makeAdmin": "Make Admin",
    "removeAdmin": "Remove Admin",
    "banUser": "Ban User",
    "muteAll": "Mute All"
  },
  "te": {
    "audioDucking": "ఆడియో డక్కింగ్",
    "audioDuckingDesc": "ఇతరులు మాట్లాడేటప్పుడు మీడియా వాల్యూమ్ తగ్గించండి",
    "muteUser": "యూజర్‌ను మ్యూట్ చేయండి",
    "kickUser": "యూజర్‌ను కిక్ చేయండి",
    "makeAdmin": "అడ్మిన్‌ను చేయండి",
    "removeAdmin": "అడ్మిన్‌ను తొలగించండి",
    "banUser": "యూజర్‌ను బ్యాన్ చేయండి",
    "muteAll": "అందరినీ మ్యూట్ చేయండి"
  },
  "hi": {
    "audioDucking": "ऑडियो डकिंग",
    "audioDuckingDesc": "दूसरों के बोलते समय मीडिया वॉल्यूम कम करें",
    "muteUser": "उपयोगकर्ता को म्यूट करें",
    "kickUser": "उपयोगकर्ता को बाहर निकालें",
    "makeAdmin": "व्यवस्थापक बनाएँ",
    "removeAdmin": "व्यवस्थापक निकालें",
    "banUser": "उपयोगकर्ता को बैन करें",
    "muteAll": "सभी को म्यूट करें"
  },
  "es": {
    "audioDucking": "Atenuación de audio",
    "audioDuckingDesc": "Bajar el volumen multimedia cuando otros hablan",
    "muteUser": "Silenciar usuario",
    "kickUser": "Expulsar usuario",
    "makeAdmin": "Hacer administrador",
    "removeAdmin": "Quitar administrador",
    "banUser": "Prohibir usuario",
    "muteAll": "Silenciar a todos"
  },
  "fr": {
    "audioDucking": "Atténuation audio",
    "audioDuckingDesc": "Baisser le volume multimédia quand d'autres parlent",
    "muteUser": "Rendre muet",
    "kickUser": "Expulser l'utilisateur",
    "makeAdmin": "Nommer administrateur",
    "removeAdmin": "Retirer l'administrateur",
    "banUser": "Bannir l'utilisateur",
    "muteAll": "Rendre tout le monde muet"
  },
  "de": {
    "audioDucking": "Audio-Ducking",
    "audioDuckingDesc": "Medienlautstärke verringern, wenn andere sprechen",
    "muteUser": "Benutzer stummschalten",
    "kickUser": "Benutzer rauswerfen",
    "makeAdmin": "Zum Admin machen",
    "removeAdmin": "Admin entfernen",
    "banUser": "Benutzer sperren",
    "muteAll": "Alle stummschalten"
  },
  "ja": {
    "audioDucking": "オーディオダッキング",
    "audioDuckingDesc": "他の人が話しているときにメディアの音量を下げる",
    "muteUser": "ユーザーをミュート",
    "kickUser": "ユーザーをキック",
    "makeAdmin": "管理者にする",
    "removeAdmin": "管理者を削除",
    "banUser": "ユーザーをBAN",
    "muteAll": "全員をミュート"
  },
  "ko": {
    "audioDucking": "오디오 더킹",
    "audioDuckingDesc": "다른 사람이 말할 때 미디어 볼륨 낮추기",
    "muteUser": "사용자 음소거",
    "kickUser": "사용자 추방",
    "makeAdmin": "관리자로 지정",
    "removeAdmin": "관리자 해제",
    "banUser": "사용자 차단",
    "muteAll": "모두 음소거"
  },
  "zh": {
    "audioDucking": "音频闪避",
    "audioDuckingDesc": "当其他人说话时降低媒体音量",
    "muteUser": "静音用户",
    "kickUser": "踢出用户",
    "makeAdmin": "设为管理员",
    "removeAdmin": "取消管理员",
    "banUser": "封禁用户",
    "muteAll": "全部静音"
  },
  "pt": {
    "audioDucking": "Ducking de Áudio",
    "audioDuckingDesc": "Abaixar o volume da mídia quando outros falam",
    "muteUser": "Silenciar usuário",
    "kickUser": "Expulsar usuário",
    "makeAdmin": "Tornar administrador",
    "removeAdmin": "Remover administrador",
    "banUser": "Banir usuário",
    "muteAll": "Silenciar todos"
  },
  "ar": {
    "audioDucking": "خفض الصوت التلقائي",
    "audioDuckingDesc": "خفض مستوى صوت الوسائط عندما يتحدث الآخرون",
    "muteUser": "كتم صوت المستخدم",
    "kickUser": "طرد المستخدم",
    "makeAdmin": "تعيين كمسؤول",
    "removeAdmin": "إزالة المسؤول",
    "banUser": "حظر المستخدم",
    "muteAll": "كتم صوت الجميع"
  },
  "ru": {
    "audioDucking": "Приглушение звука",
    "audioDuckingDesc": "Уменьшать громкость медиа, когда говорят другие",
    "muteUser": "Заглушить пользователя",
    "kickUser": "Выгнать пользователя",
    "makeAdmin": "Назначить админом",
    "removeAdmin": "Удалить админа",
    "banUser": "Забанить пользователя",
    "muteAll": "Заглушить всех"
  },
  "it": {
    "audioDucking": "Attenuazione audio",
    "audioDuckingDesc": "Abbassa il volume dei media quando altri parlano",
    "muteUser": "Muta utente",
    "kickUser": "Espelli utente",
    "makeAdmin": "Rendi amministratore",
    "removeAdmin": "Rimuovi amministratore",
    "banUser": "Banna utente",
    "muteAll": "Muta tutti"
  },
  "ta": {
    "audioDucking": "ஆடியோ டக்கிங்",
    "audioDuckingDesc": "மற்றவர்கள் பேசும்போது மீடியா ஒலியளவைக் குறைக்கவும்",
    "muteUser": "பயனரை முடக்கு",
    "kickUser": "பயனரை வெளியேற்று",
    "makeAdmin": "நிர்வாகியாக்கு",
    "removeAdmin": "நிர்வாகியை அகற்று",
    "banUser": "பயனரைத் தடை செய்",
    "muteAll": "அனைவரையும் முடக்கு"
  },
  "bn": {
    "audioDucking": "অডিও ডাকিং",
    "audioDuckingDesc": "অন্যরা কথা বললে মিডিয়ার ভলিউম কমান",
    "muteUser": "ব্যবহারকারীকে মিউট করুন",
    "kickUser": "ব্যবহারকারীকে কিক করুন",
    "makeAdmin": "অ্যাডমিন করুন",
    "removeAdmin": "অ্যাডমিন সরান",
    "banUser": "ব্যবহারকারীকে ব্যান করুন",
    "muteAll": "সবাইকে মিউট করুন"
  },
  "mr": {
    "audioDucking": "ऑडिओ डकिंग",
    "audioDuckingDesc": "जेव्हा इतर बोलतात तेव्हा मीडिया आवाज कमी करा",
    "muteUser": "वापरकर्ता म्यूट करा",
    "kickUser": "वापरकर्त्याला बाहेर काढा",
    "makeAdmin": "प्रशासक बनवा",
    "removeAdmin": "प्रशासक काढा",
    "banUser": "वापरकर्त्याला बॅन करा",
    "muteAll": "सर्वांना म्यूट करा"
  },
  "gu": {
    "audioDucking": "ઑડિઓ ડકિંગ",
    "audioDuckingDesc": "જ્યારે અન્ય લોકો બોલે ત્યારે મીડિયા વૉલ્યૂમ ઓછું કરો",
    "muteUser": "વપરાશકર્તાને મ્યૂટ કરો",
    "kickUser": "વપરાશકર્તાને કિક કરો",
    "makeAdmin": "એડમિન બનાવો",
    "removeAdmin": "એડમિન દૂર કરો",
    "banUser": "વપરાશકર્તાને પ્રતિબંધિત કરો",
    "muteAll": "બધાને મ્યૂટ કરો"
  },
  "ml": {
    "audioDucking": "ഓഡിയോ ഡക്കിംഗ്",
    "audioDuckingDesc": "മറ്റുള്ളവർ സംസാരിക്കുമ്പോൾ മീഡിയ വോളിയം കുറയ്ക്കുക",
    "muteUser": "ഉപയോക്താവിനെ മ്യൂട്ട് ചെയ്യുക",
    "kickUser": "ഉപയോക്താവിനെ പുറത്താക്കുക",
    "makeAdmin": "അഡ്മിൻ ആക്കുക",
    "removeAdmin": "അഡ്മിനെ നീക്കുക",
    "banUser": "ഉപയോക്താവിനെ വിലക്കുക",
    "muteAll": "എല്ലാവരെയും മ്യൂട്ട് ചെയ്യുക"
  },
  "kn": {
    "audioDucking": "ಆಡಿಯೋ ಡಕ್ಕಿಂಗ್",
    "audioDuckingDesc": "ಇತರರು ಮಾತನಾಡುವಾಗ ಮೀಡಿಯಾ ವಾಲ್ಯೂಮ್ ಕಡಿಮೆ ಮಾಡಿ",
    "muteUser": "ಬಳಕೆದಾರರನ್ನು ಮ್ಯೂಟ್ ಮಾಡಿ",
    "kickUser": "ಬಳಕೆದಾರರನ್ನು ಕಿಕ್ ಮಾಡಿ",
    "makeAdmin": "ಅಡ್ಮಿನ್ ಮಾಡಿ",
    "removeAdmin": "ಅಡ್ಮಿನ್ ತೆಗೆದುಹಾಕಿ",
    "banUser": "ಬಳಕೆದಾರರನ್ನು ಬ್ಯಾನ್ ಮಾಡಿ",
    "muteAll": "ಎಲ್ಲರನ್ನೂ ಮ್ಯೂಟ್ ಮಾಡಿ"
  },
  "pa": {
    "audioDucking": "ਆਡੀਓ ਡਕਿੰਗ",
    "audioDuckingDesc": "ਜਦੋਂ ਦੂਜੇ ਬੋਲਦੇ ਹਨ ਤਾਂ ਮੀਡੀਆ ਵਾਲੀਅਮ ਘਟਾਓ",
    "muteUser": "ਉਪਭੋਗਤਾ ਨੂੰ ਮਿਊਟ ਕਰੋ",
    "kickUser": "ਉਪਭੋਗਤਾ ਨੂੰ ਬਾਹਰ ਕੱਢੋ",
    "makeAdmin": "ਐਡਮਿਨ ਬਣਾਓ",
    "removeAdmin": "ਐਡਮਿਨ ਹਟਾਓ",
    "banUser": "ਉਪਭੋਗਤਾ ਨੂੰ ਬੈਨ ਕਰੋ",
    "muteAll": "ਸਾਰਿਆਂ ਨੂੰ ਮਿਊਟ ਕਰੋ"
  }
};

const regex = /const\s+translations\s*=\s*(\{[\s\S]*?\});/;
const match = scriptCode.match(regex);

if (!match) {
  console.error("Could not parse translations object from translate_chats_i18n.js");
  process.exit(1);
}

const originalTranslationsStr = match[1];
let originalTranslations;
eval(`originalTranslations = ${originalTranslationsStr}`);

for (const lang in originalTranslations) {
  if (newKeys[lang]) {
    for (const key in newKeys[lang]) {
      originalTranslations[lang][key] = newKeys[lang][key];
    }
  } else {
      // Fallback to English if translation is missing
      for (const key in newKeys['en']) {
        originalTranslations[lang][key] = newKeys['en'][key];
      }
  }
}

const updatedTranslationsStr = JSON.stringify(originalTranslations, null, 2);
scriptCode = scriptCode.replace(originalTranslationsStr, updatedTranslationsStr);

fs.writeFileSync(translateChatsScriptPath, scriptCode, 'utf8');
console.log("Successfully updated translate_chats_i18n.js with user action translations!");

try {
  execSync('node translate_chats_i18n.js', { stdio: 'inherit', cwd: __dirname });
  console.log("i18n.js successfully compiled!");
} catch (e) {
  console.error("Failed to compile i18n.js", e);
}
