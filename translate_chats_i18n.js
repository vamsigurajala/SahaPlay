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

// Complete localizations for 20 languages for all dropdown/chat keys
const translations = {
  "en": {
    "allow": "Allow",
    "noNewNotifications": "No new notifications",
    "follow": "Follow",
    "sendMessageToUser": "Send a message to {{username}}",
    "mutualFollowOnlyMsg": "You can only message users you mutually follow",
    "noFollowersYet": "No followers yet",
    "notFollowingAnyoneYet": "Not following anyone yet",
    "message": "Message",
    "followNotifications": "Follow Notifications",
    "audioDucking": "Audio Ducking",
    "audioDuckingDesc": "Lower media volume when others speak",
    "muteUser": "Mute User",
    "kickUser": "Kick User",
    "makeAdmin": "Make Admin",
    "removeAdmin": "Remove Admin",
    "banUser": "Ban User",
    "muteAll": "Mute All"
  },
  "es": {
    "allow": "Permitir",
    "noNewNotifications": "No hay nuevas notificaciones",
    "follow": "Seguir",
    "sendMessageToUser": "Enviar un message a {{username}}",
    "mutualFollowOnlyMsg": "Solo puedes enviar mensajes a usuarios que se siguen mutuamente",
    "noFollowersYet": "Aún no hay seguidores",
    "notFollowingAnyoneYet": "Aún no sigues a nadie",
    "message": "Mensaje",
    "followNotifications": "Notificaciones de seguimiento",
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
    "allow": "Autoriser",
    "noNewNotifications": "Aucune nouvelle notification",
    "follow": "Suivre",
    "sendMessageToUser": "Envoyer un message à {{username}}",
    "mutualFollowOnlyMsg": "Vous ne pouvez envoyer des messages qu'aux utilisateurs que vous suivez mutuellement",
    "noFollowersYet": "Aucun abonné pour l'instant",
    "notFollowingAnyoneYet": "Ne suit personne pour l'instant",
    "message": "Message",
    "followNotifications": "Notifications de suivi",
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
    "allow": "Zulassen",
    "noNewNotifications": "Keine neuen Benachrichtigungen",
    "follow": "Folgen",
    "sendMessageToUser": "Nachricht an {{username}} senden",
    "mutualFollowOnlyMsg": "Du kannst nur Benutzern Nachrichten senden, denen du gegenseitig folgst",
    "noFollowersYet": "Noch keine Follower",
    "notFollowingAnyoneYet": "Folgt noch niemandem",
    "message": "Nachricht",
    "followNotifications": "Follow-Benachrichtigungen",
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
    "allow": "許可する",
    "noNewNotifications": "新しい通知はありません",
    "follow": "フォロー",
    "sendMessageToUser": "{{username}}にメッセージを送信",
    "mutualFollowOnlyMsg": "相互フォローしているユーザーにのみメッセージを送信できます",
    "noFollowersYet": "フォロワーはまだいません",
    "notFollowingAnyoneYet": "まだ誰もフォローしていません",
    "message": "メッセージ",
    "followNotifications": "フォロー通知",
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
    "allow": "허용",
    "noNewNotifications": "새로운 알림이 없습니다",
    "follow": "팔로우",
    "sendMessageToUser": "{{username}}님에게 메시지 보내기",
    "mutualFollowOnlyMsg": "맞팔로우하는 사용자에게만 메시지를 보낼 수 있습니다",
    "noFollowersYet": "아직 팔로워가 없습니다",
    "notFollowingAnyoneYet": "아직 아무도 팔로우하지 않았습니다",
    "message": "메시지",
    "followNotifications": "팔로우 알림",
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
    "allow": "允许",
    "noNewNotifications": "暂无新通知",
    "follow": "关注",
    "sendMessageToUser": "给 {{username}} 发送消息",
    "mutualFollowOnlyMsg": "您只能给相互关注的用户发送消息",
    "noFollowersYet": "暂无粉丝",
    "notFollowingAnyoneYet": "暂未关注任何人",
    "message": "消息",
    "followNotifications": "关注通知",
    "audioDucking": "音频闪避",
    "audioDuckingDesc": "当其他人说话时降低媒体音量",
    "muteUser": "静音用户",
    "kickUser": "踢出用户",
    "makeAdmin": "设为管理员",
    "removeAdmin": "取消管理员",
    "banUser": "封禁用户",
    "muteAll": "全部静音"
  },
  "hi": {
    "allow": "अनुमति दें",
    "noNewNotifications": "कोई नई सूचना नहीं",
    "follow": "फ़ॉलो करें",
    "sendMessageToUser": "{{username}} को संदेश भेजें",
    "mutualFollowOnlyMsg": "आप केवल उन्हीं उपयोगकर्ताओं को संदेश भेज सकते हैं जिन्हें आप पारस्परिक रूप से फ़ॉलो करते हैं",
    "noFollowersYet": "अभी तक कोई फ़ॉलोअर नहीं है",
    "notFollowingAnyoneYet": "अभी तक किसी को फ़ॉलो नहीं कर रहे हैं",
    "message": "संदेश",
    "followNotifications": "फ़ॉलो सूचनाएं",
    "audioDucking": "ऑडियो डकिंग",
    "audioDuckingDesc": "दूसरों के बोलते समय मीडिया वॉल्यूम कम करें",
    "muteUser": "उपयोगकर्ता को म्यूट करें",
    "kickUser": "उपयोगकर्ता को बाहर निकालें",
    "makeAdmin": "व्यवस्थापक बनाएँ",
    "removeAdmin": "व्यवस्थापक निकालें",
    "banUser": "उपयोगकर्ता को बैन करें",
    "muteAll": "सभी को म्यूट करें"
  },
  "pt": {
    "allow": "Permitir",
    "noNewNotifications": "Nenhuma nova notificação",
    "follow": "Seguir",
    "sendMessageToUser": "Enviar uma mensagem para {{username}}",
    "mutualFollowOnlyMsg": "Você só pode enviar mensagens para usuários que seguem mutuamente",
    "noFollowersYet": "Ainda não há seguidores",
    "notFollowingAnyoneYet": "Ainda não segue ninguém",
    "message": "Mensagem",
    "followNotifications": "Notificações de seguimento",
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
    "allow": "السماح",
    "noNewNotifications": "لا توجد إشعارات جديدة",
    "follow": "متابعة",
    "sendMessageToUser": "إرسال رسالة إلى {{username}}",
    "mutualFollowOnlyMsg": "يمكنك فقط إرسال رسائل للمستخدمين الذين تتابعهم بشكل متبادل",
    "noFollowersYet": "لا يوجد متابعون بعد",
    "notFollowingAnyoneYet": "لا تتابع أحداً بعد",
    "message": "رسالة",
    "followNotifications": "إشعارات المتابعة",
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
    "allow": "Разрешить",
    "noNewNotifications": "Нет новых уведомлений",
    "follow": "Подписаться",
    "sendMessageToUser": "Отправить сообщение {{username}}",
    "mutualFollowOnlyMsg": "Вы можете отправлять сообщения только тем пользователям, на которых вы взаимно подписаны",
    "noFollowersYet": "Пока нет подписчиков",
    "notFollowingAnyoneYet": "Пока никого не читает",
    "message": "Сообщение",
    "followNotifications": "Уведомления о подписках",
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
    "allow": "Consenti",
    "noNewNotifications": "Nessuna nuova notifica",
    "follow": "Segui",
    "sendMessageToUser": "Invia un messaggio a {{username}}",
    "mutualFollowOnlyMsg": "Puoi inviare messaggi solo agli utenti che segui reciprocamente",
    "noFollowersYet": "Nessun follower ancora",
    "notFollowingAnyoneYet": "Non segue ancora nessuno",
    "message": "Messaggio",
    "followNotifications": "Notifiche di follow",
    "audioDucking": "Attenuazione audio",
    "audioDuckingDesc": "Abbassa il volume dei media quando altri parlano",
    "muteUser": "Muta utente",
    "kickUser": "Espelli utente",
    "makeAdmin": "Rendi amministratore",
    "removeAdmin": "Rimuovi amministratore",
    "banUser": "Banna utente",
    "muteAll": "Muta tutti"
  },
  "te": {
    "allow": "అనుమతించు",
    "noNewNotifications": "కొత్త నోటిఫికేషన్‌లు లేవు",
    "follow": "ఫాలో",
    "sendMessageToUser": "{{username}} కి సందేశం పంపండి",
    "mutualFollowOnlyMsg": "మీరు పరస్పరం ఫాలో అయ్యే వినియోగదారులకు మాత్రమే సందేశం పంపగలరు",
    "noFollowersYet": "ఇంకా ఫాలోవర్లు లేరు",
    "notFollowingAnyoneYet": "ఇంకా ఎవరినీ ఫాలో అవ్వడం లేదు",
    "message": "సందేశం",
    "followNotifications": "ఫాలో నోటిఫికేషన్లు",
    "whenSomeoneAsksJoin": "చేరడానికి అభ్యర్థనను ఆమోదించిన లేదా తిరస్కరించిన తర్వాత టోస్ట్ చూపించు",
    "friendRequestNotifications": "ఫ్రెండ్ రిక్వెస్ట్ నోటిఫికేషన్లు",
    "leaveNotifications": "రూమ్ నుండి వెళ్ళిపోయే నోటిఫికేషన్లు",
    "audioDucking": "ఆడియో డక్కింగ్",
    "audioDuckingDesc": "ఇతరులు మాట్లాడేటప్పుడు మీడియా వాల్యూమ్ తగ్గించండి",
    "muteUser": "యూజర్‌ను మ్యూట్ చేయండి",
    "kickUser": "యూజర్‌ను కిక్ చేయండి",
    "makeAdmin": "అడ్మిన్‌ను చేయండి",
    "removeAdmin": "అడ్మిన్‌ను తొలగించండి",
    "banUser": "యూజర్‌ను బ్యాన్ చేయండి",
    "muteAll": "అందరినీ మ్యూట్ చేయండి"
  },
  "ta": {
    "allow": "அனுமதி",
    "noNewNotifications": "புதிய அறிவிப்புகள் இல்லை",
    "follow": "பின்தொடர்",
    "sendMessageToUser": "{{username}} க்கு செய்தி அனுப்பவும்",
    "mutualFollowOnlyMsg": "நீங்கள் பரஸ்பரம் பின்தொடரும் பயனர்களுக்கு மட்டுமே செய்தி அனுப்ப முடியும்",
    "noFollowersYet": "இன்னும் பின்தொடர்பவர்கள் இல்லை",
    "notFollowingAnyoneYet": "யாரையும் இன்னும் பின்தொடரவில்லை",
    "message": "செய்தி",
    "followNotifications": "பின்தொடர்தல் அறிவிப்புகள்",
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
    "allow": "অনুমতি দিন",
    "noNewNotifications": "কোন নতুন বিজ্ঞপ্তি নেই",
    "follow": "ফলো করুন",
    "sendMessageToUser": "{{username}} কে একটি বার্তা পাঠান",
    "mutualFollowOnlyMsg": "আপনি শুধুমাত্র পারস্পরিক অনুসরণকারী ব্যবহারকারীদের বার্তা পাঠাতে পারেন",
    "noFollowersYet": "এখনো কোনো ফলোয়ার নেই",
    "notFollowingAnyoneYet": "এখনো কাউকে ফলো করছেন না",
    "message": "বার্তা",
    "followNotifications": "ফলো বিজ্ঞপ্তি",
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
    "allow": "परवानगी द्या",
    "noNewNotifications": "कोणतीही नवीन अधिसूचना नाही",
    "follow": "फॉलो करा",
    "sendMessageToUser": "{{username}} ला संदेश पाठवा",
    "mutualFollowOnlyMsg": "तुम्ही फक्त एकमेकांना फॉलो करणाऱ्या वापरकर्त्यांना संदेश पाठवू शकता",
    "noFollowersYet": "अद्याप कोणीही फॉलोअर्स नाही",
    "notFollowingAnyoneYet": "अद्याप कोणालाही फॉलो करत नाही आहे",
    "message": "संदेश",
    "followNotifications": "फॉलो अधिसूचना",
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
    "allow": "પરવાનગી આપો",
    "noNewNotifications": "કોઈ નવી સૂચનાઓ નથી",
    "follow": "ફોલો કરો",
    "sendMessageToUser": "{{username}} ને संदेश મોકલો",
    "mutualFollowOnlyMsg": "તમે ફક્ત એવા વપરાશકર્તાઓને જ સંદેશ મોકલી શકો છો જેમને તમે પરસ્પર ફોલો કરો છો",
    "noFollowersYet": "હજી કોઈ ફોલોઅર્સ નથી",
    "notFollowingAnyoneYet": "હજી સુધી કોઈને ફોલો કરતા નથી",
    "message": "સંદેશ",
    "followNotifications": "ફોલો સૂચનાઓ",
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
    "allow": "അനുവദിക്കുക",
    "noNewNotifications": "പുതിയ അറിയിപ്പുകൾ ഒന്നുമില്ല",
    "follow": "ഫോളോ ചെയ്യുക",
    "sendMessageToUser": "{{username}} നു ഒരു സന്ദേശം അയക്കുക",
    "mutualFollowOnlyMsg": "നിങ്ങൾ പരസ്പരം ഫോളോ ചെയ്യുന്ന ഉപയോക്താക്കൾക്ക് മാത്രമേ സന്ദേശം അയക്കാൻ കഴിയൂ",
    "noFollowersYet": "ഫോളോവേഴ്‌സ് ആരുമില്ല",
    "notFollowingAnyoneYet": "ആരെയും ഫോളോ ചെയ്യുന്നില്ല",
    "message": "സന്ദേശം",
    "followNotifications": "ഫോളോ അറിയിപ്പുകൾ",
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
    "allow": "ಅನುಮತಿಸಿ",
    "noNewNotifications": "ಯಾವುದೇ ಹೊಸ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ",
    "follow": "ಫಾಲೋ ಮಾಡಿ",
    "sendMessageToUser": "{{username}} ಗೆ ಸಂದೇಶ ಕಳುಹಿಸಿ",
    "mutualFollowOnlyMsg": "ನೀವು ಪರಸ್ಪರ ಫಾಲೋ ಮಾಡುವ ಬಳಕೆದಾರರಿಗೆ ಮಾತ್ರ ಸಂದೇಶ ಕಳುಹಿಸಬಹುದು",
    "noFollowersYet": "ಇನ್ನೂ ಯಾವುದೇ ಫಾಲೋವರ್ಸ್ ಇಲ್ಲ",
    "notFollowingAnyoneYet": "ಇನ್ನೂ ಯಾರನ್ನೂ ಫಾಲೋ ಮಾಡುತ್ತಿಲ್ಲ",
    "message": "ಸಂದೇಶ",
    "followNotifications": "ಫಾಲೋ ಅಧಿಸೂಚನೆಗಳು",
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
    "allow": "ਮਨਜ਼ੂਰ ਕਰੋ",
    "noNewNotifications": "ਕੋਈ ਨਵਾਂ ਨੋਟੀਫਿਕੇਸ਼ਨ ਨਹੀਂ",
    "follow": "ਫਾਲੋ ਕਰੋ",
    "sendMessageToUser": "{{username}} ਨੂੰ ਸੁਨੇਹਾ ਭੇਜੋ",
    "mutualFollowOnlyMsg": "ਤੁਸੀਂ ਸਿਰਫ਼ ਉਹਨਾਂ ਉਪਭੋਗਤਾਵਾਂ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜ ਸਕਦੇ ਹੋ ਜਿਨ੍ਹਾਂ ਨੂੰ ਤੁਸੀਂ ਆਪਸੀ ਫਾਲੋ ਕਰਦੇ ਹੋ",
    "noFollowersYet": "ਅਜੇ ਕੋਈ ਫਾਲੋਅਰ ਨਹੀਂ ਹੈ",
    "notFollowingAnyoneYet": "ਅਜੇ ਕਿਸੇ ਨੂੰ ਫਾਲੋ ਨਹੀਂ ਕਰ ਰਹੇ",
    "message": "ਸੁਨੇਹਾ",
    "followNotifications": "ਫਾਲੋ ਨੋਟੀਫਿਕੇਸ਼ਨ",
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



// Update/inject translations in resources Obj
for (const lang in translations) {
  if (!resources[lang]) {
    resources[lang] = { translation: {} };
  }
  if (!resources[lang].translation) {
    resources[lang].translation = {};
  }
  
  // Inject and override the translations
  for (const key in translations[lang]) {
    resources[lang].translation[key] = translations[lang][key];
  }
  
  // Strictly sort keys alphabetically
  const sortedTrans = {};
  Object.keys(resources[lang].translation).sort().forEach(key => {
    sortedTrans[key] = resources[lang].translation[key];
  });
  resources[lang].translation = sortedTrans;
}

// Generate the new resources block string
// E.g. const resources = { ... };
const newResourcesBlock = "const resources = " + JSON.stringify(resources, null, 2) + ";";

// Replace the original const resources block in code
const startMarker = "const resources =";
const startIndex = code.indexOf(startMarker);
if (startIndex === -1) {
  console.error("Could not find start of resources declaration in i18n.js");
  process.exit(1);
}

// Find the matching closing curly bracket for the declaration
// To be safe, find "i18n.use" which starts right after resources
const endMatch = code.match(/i18n\s*\.use/);
if (!endMatch) {
  console.error("Could not find end of resources declaration in i18n.js");
  process.exit(1);
}
const endIndex = endMatch.index;

const originalDeclaration = code.substring(startIndex, endIndex);
const updatedCode = code.replace(originalDeclaration, newResourcesBlock + "\n\n");

fs.writeFileSync(i18nPath, updatedCode, 'utf8');
console.log("Successfully updated and sorted i18n.js!");
