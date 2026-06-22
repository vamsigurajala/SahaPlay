import fs from 'fs';

const filePath = 'src/i18n.js';
let content = fs.readFileSync(filePath, 'utf8');

const translations = {
  en: {
    "recoveryPhraseTitle": "Your Recovery Phrase",
    "recoveryPhraseDesc": "This 24-word phrase is the only way to recover your encrypted messages if you forget your password. Store it somewhere safe — it will never be shown again.",
    "recoveryWarningText": "Write these words down or store them in a password manager. Screenshots can be accessed by others. Never share this phrase.",
    "clickToRevealPhrase": "Click to reveal phrase",
    "copyAll24Words": "Copy all 24 words",
    "makeSureNoOneWatching": "Make sure no one is watching your screen",
    "recoveryAcknowledgeCheckbox": "I have written down or securely stored my 24-word recovery phrase. I understand this is the only way to recover my encrypted messages.",
    "revealPhraseFirst": "Reveal phrase first",
    "pleaseAcknowledge": "Please acknowledge above",
    "savedContinue": "I've saved it — Continue →"
  },
  es: {
    "recoveryPhraseTitle": "Tu frase de recuperación",
    "recoveryPhraseDesc": "Esta frase de 24 palabras es la única forma de recuperar tus mensajes cifrados si olvidas tu contraseña. Guárdala en un lugar seguro; no se volverá a mostrar.",
    "recoveryWarningText": "Escribe estas palabras o guárdalas en un gestor de contraseñas. Otras personas pueden acceder a las capturas de pantalla. No compartas nunca esta frase.",
    "clickToRevealPhrase": "Haz clic para revelar la frase",
    "copyAll24Words": "Copiar las 24 palabras",
    "makeSureNoOneWatching": "Asegúrate de que nadie esté mirando tu pantalla",
    "recoveryAcknowledgeCheckbox": "He anotado o guardado de forma segura mi frase de recuperación de 24 palabras. Entiendo que es la única forma de recuperar mis mensajes cifrados.",
    "revealPhraseFirst": "Revelar la frase primero",
    "pleaseAcknowledge": "Por favor, acepta la confirmación de arriba",
    "savedContinue": "La he guardado - Continuar →"
  },
  fr: {
    "recoveryPhraseTitle": "Votre phrase de récupération",
    "recoveryPhraseDesc": "Cette phrase de 24 mots est le seul moyen de récupérer vos messages cryptés si vous oubliez votre mot de passe. Conservez-la dans un endroit sûr — elle ne sera plus jamais affichée.",
    "recoveryWarningText": "Écrivez ces mots ou stockez-les dans un gestionnaire de mots de passe. Les captures d'écran peuvent être consultées par d'autres. Ne partagez jamais cette phrase.",
    "clickToRevealPhrase": "Cliquez pour révéler la phrase",
    "copyAll24Words": "Copier les 24 mots",
    "makeSureNoOneWatching": "Assurez-vous que personne ne regarde votre écran",
    "recoveryAcknowledgeCheckbox": "J'ai écrit ou stocké en toute sécurité ma phrase de récupération de 24 mots. Je comprends que c'est le seul moyen de récupérer mes messages cryptés.",
    "revealPhraseFirst": "Révéler la phrase d'abord",
    "pleaseAcknowledge": "Veuillez accepter la confirmation ci-dessus",
    "savedContinue": "Je l'ai enregistrée — Continuer →"
  },
  de: {
    "recoveryPhraseTitle": "Ihre Wiederherstellungsphrase",
    "recoveryPhraseDesc": "Diese Wiederherstellungsphrase aus 24 Wörtern ist die einzige Möglichkeit, Ihre verschlüsselten Nachrichten wiederherzustellen, wenn Sie Ihr Passwort vergessen. Bewahren Sie sie an einem sicheren Ort auf – sie wird nie wieder angezeigt.",
    "recoveryWarningText": "Schreiben Sie diese Wörter auf oder speichern Sie sie in einem Passwort-Manager. Screenshots können von anderen eingesehen werden. Teilen Sie diese Phrase niemals.",
    "clickToRevealPhrase": "Klicken, um die Phrase anzuzeigen",
    "copyAll24Words": "Alle 24 Wörter kopieren",
    "makeSureNoOneWatching": "Stellen Sie sicher, dass niemand auf Ihren Bildschirm schaut",
    "recoveryAcknowledgeCheckbox": "Ich habe meine 24-Wort-Wiederherstellungsphrase aufgeschrieben oder sicher aufbewahrt. Ich verstehe, dass dies die einzige Möglichkeit ist, meine verschlüsselten Nachrichten wiederherzustellen.",
    "revealPhraseFirst": "Zuerst Phrase anzeigen",
    "pleaseAcknowledge": "Bitte bestätigen Sie oben",
    "savedContinue": "Ich habe sie gespeichert – Weiter →"
  },
  ja: {
    "recoveryPhraseTitle": "リカバリーフレーズ",
    "recoveryPhraseDesc": "この24語のフレーズは、パスワードを忘れた場合に暗号化されたメッセージを復元する唯一の方法です。安全な場所に保管してください。二度と表示されません。",
    "recoveryWarningText": "これらの単語を書き留めるか、パスワードマネージャーに保存してください。スクリーンショットは他の人にアクセスされる可能性があります。このフレーズは絶対に共有しないでください。",
    "clickToRevealPhrase": "クリックしてフレーズを表示",
    "copyAll24Words": "24語すべてをコピー",
    "makeSureNoOneWatching": "画面を誰にも見られていないことを確認してください",
    "recoveryAcknowledgeCheckbox": "24語のリカバリーフレーズを書き留めるか、安全に保管しました。暗号化されたメッセージを復元する唯一の方法であることを理解しています。",
    "revealPhraseFirst": "最初にフレーズを表示",
    "pleaseAcknowledge": "上の確認項目にチェックを入れてください",
    "savedContinue": "保存しました - 続ける →"
  },
  ko: {
    "recoveryPhraseTitle": "복구 프레이즈",
    "recoveryPhraseDesc": "이 24개 단어 프레이즈는 비밀번호를 잊어버렸을 때 암호화된 메시지를 복구할 수 있는 유일한 방법입니다. 안전한 곳에 보관하십시오. 다시는 표시되지 않습니다.",
    "recoveryWarningText": "이 단어들을 적어두거나 비밀번호 관리자에 저장하십시오. 스크린샷은 다른 사람이 액세스할 수 있습니다. 이 프레이즈를 절대 공유하지 마십시오.",
    "clickToRevealPhrase": "클릭하여 프레이즈 표시",
    "copyAll24Words": "24개 단어 모두 복사",
    "makeSureNoOneWatching": "아무도 화면을 보고 있지 않은지 확인하십시오",
    "recoveryAcknowledgeCheckbox": "본인은 24개 단어 복구 프레이즈를 받아 적었거나 안전하게 보관했습니다. 이것이 암호화된 메시지를 복구할 수 있는 유일한 방법임을 이해합니다.",
    "revealPhraseFirst": "프레이즈 먼저 표시",
    "pleaseAcknowledge": "위의 확인 사항에 동의해 주십시오",
    "savedContinue": "저장했습니다 — 계속하기 →"
  },
  zh: {
    "recoveryPhraseTitle": "您的恢复密语",
    "recoveryPhraseDesc": "这组 24 个单词的密语是您忘记密码时恢复加密消息的唯一途径。请妥善保管在安全的地方——它将不再显示。",
    "recoveryWarningText": "请写下 these 单词或将其存储在密码管理器中。屏幕截图可能会被他人获取。切勿分享此密语。",
    "clickToRevealPhrase": "点击显示密语",
    "copyAll24Words": "复制全部 24 个单词",
    "makeSureNoOneWatching": "请确保周围无人注视您的屏幕",
    "recoveryAcknowledgeCheckbox": "我已写下或安全存储了我的 24 词恢复密语。我理解这是恢复我加密消息的唯一方法。",
    "revealPhraseFirst": "请先显示密语",
    "pleaseAcknowledge": "请勾选上方确认框",
    "savedContinue": "已保存 — 继续 →"
  },
  hi: {
    "recoveryPhraseTitle": "आपका रिकवरी फ़्रेज़",
    "recoveryPhraseDesc": "यदि आप अपना पासवर्ड भूल जाते हैं, तो यह 24-शब्दों का फ़्रेज़ आपके एन्क्रिप्टेड संदेशों को पुनर्प्राप्त करने का एकमात्र तरीका है। इसे कहीं सुरक्षित रखें — यह दोबारा कभी नहीं दिखाया जाएगा।"
    ,
    "recoveryWarningText": "इन शब्दों को लिख लें या पासवर्ड मैनेजर में सहेजें। स्क्रीनशॉट तक दूसरों की पहुँच हो सकती है। इस फ़्रेज़ को कभी किसी के साथ साझा न करें।",
    "clickToRevealPhrase": "फ़्रेज़ देखने के लिए क्लिक करें",
    "copyAll24Words": "सभी 24 शब्दों को कॉपी करें",
    "makeSureNoOneWatching": "सुनिश्चित करें कि कोई भी आपकी स्क्रीन को नहीं देख रहा है",
    "recoveryAcknowledgeCheckbox": "मैंने अपना 24-शब्दों का रिकवरी फ़्रेज़ लिख लिया है या सुरक्षित रूप से संग्रहीत कर लिया है। मैं समझता हूँ कि मेरे एन्क्रिप्टेड संदेशों को पुनर्प्राप्त करने का यही एकमात्र तरीका है।"
    ,
    "revealPhraseFirst": "पहले फ़्रेज़ दिखाएं",
    "pleaseAcknowledge": "कृपया ऊपर दिए गए कथन की पुष्टि करें",
    "savedContinue": "मैंने इसे सहेज लिया है — जारी रखें →"
  },
  pt: {
    "recoveryPhraseTitle": "Sua frase de recuperação",
    "recoveryPhraseDesc": "Esta frase de 24 palavras é a única maneira de recuperar suas mensagens criptografadas caso você esqueça sua senha. Guarde-a em um local seguro — ela nunca mais será exibida.",
    "recoveryWarningText": "Escreva estas palavras ou guarde-as em um gerenciador de senhas. Capturas de tela podem ser acessadas por outras pessoas. Nunca compartilhe esta frase.",
    "clickToRevealPhrase": "Clique para revelar a frase",
    "copyAll24Words": "Copiar todas as 24 palavras",
    "makeSureNoOneWatching": "Certifique-se de que ninguém está olhando para a sua tela",
    "recoveryAcknowledgeCheckbox": "Escrevi ou armazenei com segurança minha frase de recuperação de 24 palavras. Entendo que esta é a única maneira de recuperar minhas mensagens criptografadas.",
    "revealPhraseFirst": "Revelar frase primeiro",
    "pleaseAcknowledge": "Por favor, marque a confirmação acima",
    "savedContinue": "Eu salvei — Continuar →"
  },
  ar: {
    "recoveryPhraseTitle": "عبارة الاسترداد الخاصة بك",
    "recoveryPhraseDesc": "عبارة الاسترداد المكونة من 24 كلمة هي الطريقة الوحيدة لاستعادة رسائلك المشفرة إذا نسيت كلمة المرور الخاصة بك. احفظها في مكان آمن — لن يتم عرضها مرة أخرى أبدًا.",
    "recoveryWarningText": "اكتب هذه الكلمات أو احفظها في مدير كلمات المرور. يمكن للآخرين الوصول إلى لقطات الشاشة. لا تشارك هذه العبارة أبدًا.",
    "clickToRevealPhrase": "انقر لعرض العبارة",
    "copyAll24Words": "نسخ جميع الكلمات الـ 24",
    "makeSureNoOneWatching": "تأكد من عدم وجود أي شخص يراقب شاشتك",
    "recoveryAcknowledgeCheckbox": "لقد كتبت عبارة الاسترداد المكونة من 24 كلمة أو حفظتها بشكل آمن. وأنا أفهم أن هذه هي الطريقة الوحيدة لاستعادة رسائلي المشفرة.",
    "revealPhraseFirst": "كشف العبارة أولاً",
    "pleaseAcknowledge": "يرجى الإقرار أعلاه",
    "savedContinue": "لقد قمت بحفظها — متابعة ←"
  },
  ru: {
    "recoveryPhraseTitle": "Ваша фраза для восстановления",
    "recoveryPhraseDesc": "Эта фраза из 24 слов — единственный способ восстановить ваши зашифрованные сообщения, если вы забудете пароль. Сохраните ее в надежном месте — она больше никогда не будет показана.",
    "recoveryWarningText": "Запишите эти слова или сохраните их в менеджере паролей. Скриншоты могут быть доступны посторонним. Никогда не делитесь этой фразой.",
    "clickToRevealPhrase": "Нажмите, чтобы показать фразу",
    "copyAll24Words": "Скопировать все 24 слова",
    "makeSureNoOneWatching": "Убедитесь, что никто не смотрит на ваш экран",
    "recoveryAcknowledgeCheckbox": "Я записал(а) или надежно сохранил(а) свою фразу для восстановления из 24 слов. Я понимаю, что это единственный способ восстановить мои зашифрованные сообщения.",
    "revealPhraseFirst": "Сначала покажите фразу",
    "pleaseAcknowledge": "Пожалуйста, подтвердите согласие выше",
    "savedContinue": "Я сохранил(а) — Продолжить →"
  },
  it: {
    "recoveryPhraseTitle": "La tua frase di recupero",
    "recoveryPhraseDesc": "Questa frase di 24 parole è l'unico modo per recuperare i tuoi messaggi crittografati se dimentichi la password. Conservala in un luogo sicuro: non verrà mostrata mai più.",
    "recoveryWarningText": "Scrivi queste parole o memorizzale in un gestore di password. Gli screenshot possono essere visualizzati da terzi. Non condividere mai questa frase.",
    "clickToRevealPhrase": "Clicca per mostrare la frase",
    "copyAll24Words": "Copia tutte le 24 parole",
    "makeSureNoOneWatching": "Assicurati che nessuno stia guardando il tuo schermo",
    "recoveryAcknowledgeCheckbox": "Ho annotato o conservato in modo sicuro la mia frase di recupero di 24 parole. Comprendo che questo è l'unico modo per recuperare i miei messaggi crittografati.",
    "revealPhraseFirst": "Rivela prima la frase",
    "pleaseAcknowledge": "Si prega di confermare sopra",
    "savedContinue": "L'ho salvata — Continua →"
  },
  te: {
    "recoveryPhraseTitle": "మీ రికవరీ ఫ్రేజ్",
    "recoveryPhraseDesc": "మీరు పాస్‌వర్డ్ మరిచిపోతే మీ గుప్తీకరించిన (ఎన్‌క్రిప్ట్ చేసిన) సందేశాలను తిరిగి పొందడానికి ఈ 24-పదాల ఫ్రేజ్ మాత్రమే ఏకైక మార్గం. దీనిని ఎక్కడైనా సురક્ષితంగా ఉంచండి — ఇది మళ్లీ ఎప్పటికీ చూపబడదు.",
    "recoveryWarningText": "ఈ పదాలను రాసి పెట్టుకోండి లేదా పాస్‌వర్డ్ మేనేజర్‌లో నిల్వ చేయండి. స్క్రీన్‌షాట్‌లను ఇతరులు చూడవచ్చు. ఈ ఫ్రేజ్‌ని ఎవరితోనూ పంచుకోకండి.",
    "clickToRevealPhrase": "ఫ్రేజ్ చూడటానికి క్లిక్ చేయండి",
    "copyAll24Words": "అన్ని 24 పదాలను కాపీ చేయండి",
    "makeSureNoOneWatching": "మీ స్క్రీన్‌ను ఎవరూ చూడటం లేదని నిర్ధారించుకోండి",
    "recoveryAcknowledgeCheckbox": "నేను నా 24-పదాల రికవరీ ఫ్రేజ్‌ను రాసి పెట్టుకున్నాను లేదా సురક્ષితంగా నిల్వ చేసుకున్నాను. నా గుప్తీకరించిన సందేశాలను తిరిగి పొందడానికి ఇది మాత్రమే ఏకైక మార్గమని నేను అర్థం చేసుకున్నాను.",
    "revealPhraseFirst": "ముందుగా ఫ్రేజ్ చూపించు",
    "pleaseAcknowledge": "దయచేసి పైన అంగీకరించండి",
    "savedContinue": "నేను సేవ్ చేసాను — కొనసాగించు →"
  },
  ta: {
    "recoveryPhraseTitle": "உங்கள் மீட்பு சொற்றொடர்",
    "recoveryPhraseDesc": "உங்கள் கடவுச்சொல்லை மறந்துவிட்டால், மறைகுறியாக்கப்பட்ட செய்திகளை மீட்டெடுப்பதற்கான ஒரே வழி இந்த 24-வார்த்தை மீட்புச் சொற்றொடர் மட்டுமே. இதை எங்காவது பாதுகாப்பாகச் சேமிக்கவும் — இது மீண்டும் காட்டப்படாது.",
    "recoveryWarningText": "இந்த வார்த்தைகளை எழுதவும் அல்லது கடவுச்சொல் நிர்வாகியில் சேமிக்கவும். ஸ்கிரீன்ஷாட்டுகளை மற்றவர்கள் பார்க்கக்கூடும். இந்தச் சொற்றொடரை ஒருபோதும் யாருடனும் பகிர வேண்டாம்.",
    "clickToRevealPhrase": "சொற்றொடரைக் காட்ட கிளிக் செய்யவும்",
    "copyAll24Words": "அனைத்து 24 வார்த்தைகளையும் நகலெடு",
    "makeSureNoOneWatching": "உங்கள் திரையை யாரும் பார்க்கவில்லை என்பதை உறுதிப்படுத்தவும்",
    "recoveryAcknowledgeCheckbox": "எனது 24-வார்த்தை மீட்புச் சொற்றொடரை நான் எழுதியுள்ளேன் அல்லது பாதுகாப்பாகச் சேமித்துள்ளேன். எனது செய்திகளை மீட்டெடுக்க இதுவே ஒரே வழி என்பதை நான் புரிந்துகொள்கிறேன்.",
    "revealPhraseFirst": "சொற்றொடரை முதலில் காட்டு",
    "pleaseAcknowledge": "தயவுசெய்து மேலே ஒப்புக்கொள்ளவும்",
    "savedContinue": "நான் சேமித்துவிட்டேன் — தொடரவும் →"
  },
  bn: {
    "recoveryPhraseTitle": "আপনার রিকভারি ফ্রেজ",
    "recoveryPhraseDesc": "আপনি যদি আপনার পাসওয়ার্ড ভুলে যান তবে আপনার এনক্রিপ্ট করা বার্তাগুলি পুনরুদ্ধার করার একমাত্র উপায় হলো এই ২৪-শব্দের ফ্রেজ। এটি নিরাপদ কোনো স্থানে সংরক্ষণ করুন — এটি আর কখনো দেখানো হবে না।",
    "recoveryWarningText": "এই শব্দগুলো লিখে রাখুন বা পাসওয়ার্ড ম্যানেজারে সংরক্ষণ করুন। স্ক্রিনশট অন্যের হাতে যেতে পারে। এই ফ্রেজটি কারো সাথে শেয়ার করবেন না।",
    "clickToRevealPhrase": "ফ্রেজ দেখতে এখানে ক্লিক করুন",
    "copyAll24Words": "সব ২৪টি শব্দ কপি করুন",
    "makeSureNoOneWatching": "নিশ্চিত করুন আপনার স্ক্রিন কেউ দেখছে না",
    "recoveryAcknowledgeCheckbox": "আমি আমার ২৪-শব্দের রিকভারি ফ্রেজটি লিখে রেখেছি বা নিরাপদে সংরক্ষণ করেছি। আমি বুঝতে পারছি যে আমার এনক্রিপ্ট করা বার্তাগুলি পুনরুদ্ধার করার এটিই একমাত্র উপায়।",
    "revealPhraseFirst": "প্রথমে ফ্রেজটি দেখান",
    "pleaseAcknowledge": "দয়া করে উপরে সম্মতি দিন",
    "savedContinue": "আমি এটি সংরক্ষণ করেছি — চালিয়ে যান →"
  },
  mr: {
    "recoveryPhraseTitle": "तुमचा रिकव्हरी फ्रेज",
    "recoveryPhraseDesc": "तुम्ही तुमचा पासवर्ड विसरल्यास तुमचे एनक्रिप्टेड मेसेज रिकव्हर करण्याचा हा २४ शब्दांचा फ्रेज एकमेव मार्ग आहे. तो सुरक्षित ठिकाणी ठेवा — तो पुन्हा कधीही दाखवला जाणार नाही।",
    "recoveryWarningText": "हे शब्द लिहून ठेवा किंवा पासवर्ड मॅनेजरमध्ये सेव्ह करा। स्क्रीनशॉट इतरांद्वारे पाहिले जाऊ शकतात। हा फ्रेज कधीही शेअर करू नका।",
    "clickToRevealPhrase": "फ्रेज पाहण्यासाठी क्लिक करा",
    "copyAll24Words": "सर्व २४ शब्द कॉपी करा",
    "makeSureNoOneWatching": "तुमच्या स्क्रीनवर कोणीही पाहत नाही याची खात्री करा",
    "recoveryAcknowledgeCheckbox": "मी माझा २४ शब्दांचा रिकव्हरी फ्रेज लिहून घेतला आहे किंवा सुरक्षितपणे सेव्ह केला आहे। माझे एनक्रिप्टेड मेसेज रिकव्हर करण्याचा हा एकमेव मार्ग आहे हे मला समजले आहे।",
    "revealPhraseFirst": "प्रथम फ्रेज दाखवा",
    "pleaseAcknowledge": "कृपया वरील मान्य करा",
    "savedContinue": "मी सेव्ह केला आहे — पुढे जा →"
  },
  gu: {
    "recoveryPhraseTitle": "તમારો રિકવરી ફ્રેઝ",
    "recoveryPhraseDesc": "જો તમે તમારો પાસવર્ડ ભૂલી જાઓ તો તમારા એન્ક્રિપ્ટેડ સંદેશાઓને પુનઃપ્રાપ્ત કરવાનો આ ૨૪-શબ્દોનો ફ્રેઝ એકમાત્ર રસ્તો છે. તેને ક્યાંક સુરક્ષિત રાખો — તે ફરી ક્યારેય બતાવવામાં આવશે નહીં.",
    "recoveryWarningText": "આ શબ્દો લખી લો અથવા પાસવર્ડ મેનેજરમાં સેવ કરો. સ્ક્રીનશોટ અન્ય લોકો જોઈ શકે છે. આ ફ્રેઝ ક્યારેય શેર કરશો નહીં.",
    "clickToRevealPhrase": "ફ્રેઝ જોવા માટે ક્લિક કરો",
    "copyAll24Words": "બધા ૨૪ શબ્દો નકલ કરો",
    "makeSureNoOneWatching": "ખાતરી કરો કે કોઈ તમારી સ્ક્રીન જોઈ રહ્યું નથી",
    "recoveryAcknowledgeCheckbox": "મેં મારો ૨૪-શબ્દોનો રિકવરી ફ્રેઝ લખી લીધો છે અથવા સુરક્ષિત રીતે સાચવી લીધો છે. હું સમજું છું કે મારા એન્ક્રિપ્ટેડ સંદેશાઓને પુનઃપ્રાપ્ત કરવાનો આ એકમાત્ર રસ્તો છે.",
    "revealPhraseFirst": "પહેલા ફ્રેઝ બતાવો",
    "pleaseAcknowledge": "કૃપા કરીને ઉપર સ્વીકારો",
    "savedContinue": "મેં સેવ કરી લીધો છે — ચાલુ રાખો →"
  },
  ml: {
    "recoveryPhraseTitle": "നിങ്ങളുടെ റിക്കവറി ഫ്രെയ്സ്",
    "recoveryPhraseDesc": "നിങ്ങളുടെ പാസ്‌വേഡ് മറന്നുപോയാൽ എൻക്രിപ്റ്റ് ചെയ്ത സന്ദേശങ്ങൾ വീണ്ടെടുക്കാനുള്ള ഏക മാർഗ്ഗം ഈ 24-വാക്കുകളുടെ ഫ്രെയ്സ് ആണ്. ഇത് സുരക്ഷിതമായ ഒരിടത്ത് സൂക്ഷിക്കുക — ഇത് ഇനി ഒരിക്കലും കാണിക്കില്ല.",
    "recoveryWarningText": "ഈ വാക്കുകൾ എഴുതി സൂക്ഷിക്കുക അല്ലെങ്കിൽ ഒരു പാസ്‌വേഡ് മാനേജരിൽ സംരക്ഷിക്കുക. സ്ക്രീൻഷോട്ടുകൾ മറ്റുള്ളവർക്ക് കാണാൻ കഴിഞ്ഞേക്കും. ഈ ഫ്രെയ്സ് ഒരിക്കലും പങ്കിടരുത്.",
    "clickToRevealPhrase": "ഫ്രെയ്സ് കാണാൻ ക്ലിക്ക് ചെയ്യുക",
    "copyAll24Words": "എല്ലാ 24 വാക്കുകളും പകർപ്പുക (കോപ്പി)",
    "makeSureNoOneWatching": "ആരും നിങ്ങളുടെ സ്ക്രീൻ കാണുന്നില്ലെന്ന് ഉറപ്പാക്കുക",
    "recoveryAcknowledgeCheckbox": "ഞാൻ എന്റെ 24 വാക്കുകളുടെ റിക്കവറി ഫ്രെയ്സ് എഴുതിയെടുക്കുകയോ സുരക്ഷിതമായി സൂക്ഷിക്കുകയോ ചെയ്തിട്ടുണ്ട്. എന്റെ എൻക്രിപ്റ്റ് ചെയ്ത സന്ദേശങ്ങൾ വീണ്ടെടുക്കാനുള്ള ഏക മാർഗ്ഗം ഇതാണെന്ന് ഞാൻ മനസ്സിലാക്കുന്നു.",
    "revealPhraseFirst": "ആദ്യം ഫ്രെയ്സ് കാണിക്കുക",
    "pleaseAcknowledge": "ദയവായി മുകളിൽ സമ്മതിക്കുക",
    "savedContinue": "ഞാൻ ഇത് സംരക്ഷിച്ചു — തുടരുക →"
  },
  kn: {
    "recoveryPhraseTitle": "ನಿಮ್ಮ ರಿಕವರಿ ಫ್ರೇಸ್",
    "recoveryPhraseDesc": "ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಮರೆತರೆ ನಿಮ್ಮ ಎನ್‌ಕ್ರಿಪ್ಟ್ ಮಾಡಿದ ಸಂದೇಶಗಳನ್ನು ಮರುಪಡೆಯಲು ಈ 24-ಪದಗಳ ಫ್ರೇಸ್ ಒಂದೇ मार्गವಾಗಿದೆ. ಇದನ್ನು ಎಲ್ಲಾದರೂ ಸುರಕ್ಷಿತವಾಗಿರಿಸಿ — ಇದನ್ನು ಮತ್ತೆ ಎಂದಿಗೂ ತೋರಿಸಲಾಗುವುದಿಲ್ಲ.",
    "recoveryWarningText": "ಈ ಪದಗಳನ್ನು ಬರೆದಿಟ್ಟುಕೊಳ್ಳಿ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಮ್ಯಾನೇಜರ್‌ನಲ್ಲಿ ಉಳಿಸಿ. ಸ್ಕ್ರೀನ್‌ಶಾಟ್‌ಗಳನ್ನು ಇತರರು ನೋಡಬಹುದು. ಈ ಫ್ರೇಸ್ ಅನ್ನು ಎಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.",
    "clickToRevealPhrase": "ಫ್ರೇಸ್ ತೋರಿಸಲು ಕ್ಲಿಕ್ ಮಾಡಿ",
    "copyAll24Words": "ಎಲ್ಲಾ 24 ಪದಗಳನ್ನು ನಕಲಿಸಿ",
    "makeSureNoOneWatching": "ನಿಮ್ಮ ಸ್ಕ್ರೀನ್ ಅನ್ನು ಯಾರೂ ನೋಡುತ್ತಿಲ್ಲವೆಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ",
    "recoveryAcknowledgeCheckbox": "ನನ್ನ 24-ಪದಗಳ ರಿಕವರಿ ಫ్రೇಸ್ ಅನ್ನು ನಾನು ಬರೆದಿಟ್ಟುಕೊಂಡಿದ್ದೇನೆ ಅಥವಾ ಸುರಕ್ಷಿತವಾಗಿ ಸಂಗ್ರಹಿಸಿದ್ದೇನೆ. ನನ್ನ ಎನ್‌ಕ್ರಿਪ್ಟ್ ಮಾಡಿದ ಸಂದೇಶಗಳನ್ನು ಮರುಪಡೆಯಲು ಇದು ಒಂದೇ ಮಾರ್ಗವೆಂದು ನಾನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ.",
    "revealPhraseFirst": "ಮೊದಲು ಫ್ರೇಸ್ ತೋರಿಸು",
    "pleaseAcknowledge": "ದಯವಿಟ್ಟು ಮೇಲೆ ಒಪ್ಪಿಕೊಳ್ಳಿ",
    "savedContinue": "ನಾನು ಉಳಿಸಿಕೊಂಡಿದ್ದೇನೆ — ಮುಂದುವರಿಯಿರಿ →"
  },
  pa: {
    "recoveryPhraseTitle": "ਤੁਹਾਡਾ ਰਿਕਵਰੀ ਫ੍ਰੇਜ਼",
    "recoveryPhraseDesc": "ਜੇਕਰ ਤੁਸੀਂ ਆਪਣਾ ਪਾਸਵਰਡ ਭੁੱਲ ਜਾਂਦੇ ਹੋ, ਤਾਂ ਤੁਹਾਡੇ ਐਨਕ੍ਰਿਪਟਡ ਸੁਨੇਹਿਆਂ ਨੂੰ ਮੁੜ ਪ੍ਰਾਪਤ ਕਰਨ ਦਾ ਇਹ 24-ਸ਼ਬਦਾਂ ਦਾ ਫ੍ਰੇਜ਼ ਹੀ ਇੱਕੋ-ਇੱਕ ਤਰੀਕਾ ਹੈ। ਇਸਨੂੰ ਕਿਤੇ ਸੁਰੱਖਿਅਤ ਰੱਖੋ — ਇਹ ਦੁਬਾਰਾ ਕਦੇ ਨਹੀਂ ਦਿਖਾਇਆ ਜਾਵੇਗਾ।",
    "recoveryWarningText": "ਇਹਨਾਂ ਸ਼ਬਦਾਂ ਨੂੰ ਲਿਖੋ ਜਾਂ ਇੱਕ ਪਾਸਵਰਡ ਮੈਨੇਜਰ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਕਰੋ। ਸਕ੍ਰੀਨਸ਼ੌਟਸ ਦੂਜਿਆਂ ਦੁਆਰਾ ਦੇਖੇ ਜਾ ਸਕਦੇ ਹਨ। ਇਸ ਫ੍ਰੇਜ਼ ਨੂੰ ਕਦੇ ਵੀ ਸਾਂਝਾ ਨਾ ਕਰੋ।",
    "clickToRevealPhrase": "ਫ੍ਰੇਜ਼ ਦੇਖਣ ਲਈ ਕਲਿੱਕ ਕਰੋ",
    "copyAll24Words": "ਸਾਰੇ 24 ਸ਼ਬਦਾਂ ਨੂੰ ਕਾਪੀ ਕਰੋ",
    "makeSureNoOneWatching": "ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਕੋਈ ਤੁਹਾਡੀ ਸਕ੍ਰੀਨ ਨੂੰ ਨਹੀਂ ਦੇਖ ਰਿਹਾ ਹੈ",
    "recoveryAcknowledgeCheckbox": "ਮੈਂ ਆਪਣਾ 24-ਸ਼ਬਦਾਂ ਦਾ ਰਿਕਵਰੀ ਫ੍ਰੇਜ਼ ਲਿਖ ਲਿਆ ਹੈ ਜਾਂ ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਸਟੋਰ ਕਰ ਲਿਆ ਹੈ। ਮੈਂ ਸਮਝਦਾ ਹਾਂ ਕਿ ਮੇਰੇ ਐਨਕ੍ਰਿਪਟਡ ਸੁਨੇਹਿਆਂ ਨੂੰ ਮੁੜ ਪ੍ਰਾਪਤ ਕਰਨ ਦਾ ਇਹੀ ਇੱਕੋ-ਇੱਕ ਤਰੀਕਾ ਹੈ।",
    "revealPhraseFirst": "ਪਹਿਲਾਂ ਫ੍ਰੇਜ਼ ਦਿਖਾਓ",
    "pleaseAcknowledge": "ਕਿਰਪਾ ਕਰਕੇ ਉੱਪਰ ਸਵੀਕਾਰ ਕਰੋ",
    "savedContinue": "ਮੈਂ ਇਸਨੂੰ ਸੁਰੱਖਿਅਤ ਕਰ ਲਿਆ ਹੈ — ਜਾਰੀ ਰੱਖੋ →"
  }
};

let injected = 0;

for (const [lang, keys] of Object.entries(translations)) {
  let langIdx = content.indexOf(`"${lang}": {`);
  if (langIdx === -1) {
    langIdx = content.indexOf(`"${lang}":{`);
  }
  
  if (langIdx === -1) {
    console.warn(`[WARN] Could not find lang block for: ${lang}`);
    continue;
  }
  
  let transIdx = content.indexOf(`"translation": {`, langIdx);
  if (transIdx === -1) {
    transIdx = content.indexOf(`"translation":{`, langIdx);
  }
  
  if (transIdx === -1) {
    console.warn(`[WARN] Could not find translation block for: ${lang}`);
    continue;
  }
  
  const afterBrace = content.indexOf('\n', transIdx);
  if (afterBrace === -1) {
    console.warn(`[WARN] Could not find newline after translation brace for: ${lang}`);
    continue;
  }
  
  let insertion = '';
  for (const [key, value] of Object.entries(keys)) {
    const nextLangIdx = content.indexOf('}', afterBrace);
    const searchRange = content.slice(langIdx, nextLangIdx > 0 ? nextLangIdx + 5000 : langIdx + 10000);
    
    if (searchRange.includes(`"${key}":`)) {
      console.log(`[SKIP] ${lang}.${key} already exists`);
      continue;
    }
    
    const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    insertion += `      "${key}": "${escapedValue}",\n`;
    injected++;
  }
  
  if (insertion) {
    content = content.slice(0, afterBrace + 1) + insertion + content.slice(afterBrace + 1);
    console.log(`[OK] Injected recovery translations for: ${lang}`);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone! Injected ${injected} translation entries.`);
