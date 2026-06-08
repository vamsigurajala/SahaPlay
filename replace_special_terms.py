import json
import re

# High quality translations for specific terms and keys
TERM_TRANSLATIONS = {
  "es": {
    "SahaPlay": "SahaPlay",
    "Used for:": "Usado para:",
    "IndexedDB": "Base de datos indexada (IndexedDB)",
    "E2EE": "Material clave de cifrado de extremo a extremo (E2EE) (solo sesión)",
    "Google Chrome": "Google Chrome"
  },
  "fr": {
    "SahaPlay": "SahaPlay",
    "Used for:": "Utilisé pour :",
    "IndexedDB": "Base de données indexée (IndexedDB)",
    "E2EE": "Matériel clé de chiffrement de bout en bout (E2EE) (session uniquement)",
    "Google Chrome": "Google Chrome"
  },
  "de": {
    "SahaPlay": "SahaPlay",
    "Used for:": "Verwendet für:",
    "IndexedDB": "IndexedDB",
    "E2EE": "Ende-zu-Ende-Verschlüsselung (E2EE)-Schlüsselmaterial (nur Sitzung)",
    "Google Chrome": "Google Chrome"
  },
  "ja": {
    "SahaPlay": "サハプレイ",
    "Used for:": "用途:",
    "IndexedDB": "インデックス付きDB (IndexedDB)",
    "E2EE": "エンドツーエンド暗号化 (E2EE) キーマテリアル (セッションのみ)",
    "Google Chrome": "Google Chrome (グーグル・クローム)"
  },
  "ko": {
    "SahaPlay": "사하플레이",
    "Used for:": "용도:",
    "IndexedDB": "인덱스드DB (IndexedDB)",
    "E2EE": "종단간 암호화 (E2EE) 키 자료 (세션 전용)",
    "Google Chrome": "구글 크롬 (Google Chrome)"
  },
  "zh": {
    "SahaPlay": "萨哈普莱 (SahaPlay)",
    "Used for:": "用于：",
    "IndexedDB": "索引数据库 (IndexedDB)",
    "E2EE": "端到端加密 (E2EE) 密钥材料（仅限会话）",
    "Google Chrome": "谷歌浏览器 (Google Chrome)"
  },
  "hi": {
    "SahaPlay": "सहाप्ले",
    "Used for:": "उपयोग:",
    "IndexedDB": "इंडेक्स्डडीबी (IndexedDB)",
    "E2EE": "एंड-टू-एंड एन्क्रिप्शन (E2EE) मुख्य सामग्री (केवल सत्र)",
    "Google Chrome": "गूगल क्रोम (Google Chrome)"
  },
  "pt": {
    "SahaPlay": "SahaPlay",
    "Used for:": "Usado para:",
    "IndexedDB": "Banco de dados indexado (IndexedDB)",
    "E2EE": "Material de chave de criptografia de ponta a ponta (E2EE) (apenas sessão)",
    "Google Chrome": "Google Chrome"
  },
  "ar": {
    "SahaPlay": "ساهابلاي",
    "Used for:": "الاستخدام:",
    "IndexedDB": "قاعدة البيانات المفهرسة (IndexedDB)",
    "E2EE": "مادة مفتاح التشفير بين الطرفين (E2EE) (للجلسة فقط)",
    "Google Chrome": "جوجل كروم (Google Chrome)"
  },
  "ru": {
    "SahaPlay": "СахаПлей",
    "Used for:": "Используется для:",
    "IndexedDB": "Индексированная БД (IndexedDB)",
    "E2EE": "Ключевой материал сквозного шифрования (E2EE) (только для сессии)",
    "Google Chrome": "Google Chrome (Гугл Хром)"
  },
  "it": {
    "SahaPlay": "SahaPlay",
    "Used for:": "Utilizzato per:",
    "IndexedDB": "Database indicizzato (IndexedDB)",
    "E2EE": "Materiale chiave di crittografia end-to-end (E2EE) (solo sessione)",
    "Google Chrome": "Google Chrome"
  },
  "te": {
    "SahaPlay": "సహాప్లే",
    "Used for:": "ఉపయోగం:",
    "IndexedDB": "ఇండెక్స్‌డ్ డిబి (IndexedDB)",
    "E2EE": "ఎండ్-టు-ఎండ్ ఎన్‌క్రిప్షన్ (E2EE) కీ మెటీరియల్ (సెషన్ మాత్రమే)",
    "Google Chrome": "గూగుల్ క్రోమ్ (Google Chrome)"
  },
  "ta": {
    "SahaPlay": "சஹாப்ளே",
    "Used for:": "பயன்பாடு:",
    "IndexedDB": "இண்டெக்ஸ்டு டிபி (IndexedDB)",
    "E2EE": "முனையிலிருந்து முனை வரையிலான குறியாக்கம் (E2EE) முக்கியப் பொருள் (அமர்வு மட்டும்)",
    "Google Chrome": "கூகிள் குரோம் (Google Chrome)"
  },
  "bn": {
    "SahaPlay": "সাহাপ্লে",
    "Used for:": "ব্যবহার:",
    "IndexedDB": "ইনডেক্সড ডিবি (IndexedDB)",
    "E2EE": "এন্ড-টু-এন্ড এনক্রিপশন (E2EE) মূল উপাদান (শুধুমাত্র সেশন)",
    "Google Chrome": "গুগল ক্রোম (Google Chrome)"
  },
  "mr": {
    "SahaPlay": "सहाप्ले",
    "Used for:": "वापर:",
    "IndexedDB": "इंडेक्सड डीबी (IndexedDB)",
    "E2EE": "एंड-टू-एंड एन्क्रिप्शन (E2EE) की सामग्री (केवळ सत्र)",
    "Google Chrome": "गूगल क्रोम (Google Chrome)"
  },
  "gu": {
    "SahaPlay": "સહાપ્લે",
    "Used for:": "ઉપયોગ:",
    "IndexedDB": "ઇન્ડેક્સ્ડ ડીબી (IndexedDB)",
    "E2EE": "એન્ડ-ટુ-એન્ડ એન્ક્રિપ્શન (E2EE) કી સામગ્રી (ફક્ત સત્ર)",
    "Google Chrome": "ગૂગલ ક્રોમ (Google Chrome)"
  },
  "ml": {
    "SahaPlay": "സഹാപ്ലേ",
    "Used for:": "ഉപയോഗം:",
    "IndexedDB": "ഇൻഡെക്സ്ഡ് ഡിബി (IndexedDB)",
    "E2EE": "എൻഡ്-ടു-എൻഡ് എൻക്രിപ്ഷൻ (E2EE) കീ മെറ്റീരിയൽ (സെഷൻ മാത്രം)",
    "Google Chrome": "ഗൂഗിൾ ക്രോം (Google Chrome)"
  },
  "kn": {
    "SahaPlay": "ಸಹಾಪ್ಲೇ",
    "Used for:": "ಉಪಯೋಗ:",
    "IndexedDB": "ಇಂಡೆಕ್ಸ್‌ಡ್ ಡಿಬಿ (IndexedDB)",
    "E2EE": "ಎಂಡ್-ಟು-ಎಂಡ್ ಎನ್‌ಕ್ರಿಪ್ಷನ್ (E2EE) ಪ್ರಮುಖ ವಸ್ತು (ಸೆಶൻ ಮಾತ್ರ)",
    "Google Chrome": "ಗೂಗಲ್ ಕ್ರೋಮ್ (Google Chrome)"
  },
  "pa": {
    "SahaPlay": "ਸਹਾਪਲੇ",
    "Used for:": "ਵਰਤੋਂ:",
    "IndexedDB": "ਇੰਡੈਕਸਡ ਡੀਬੀ (IndexedDB)",
    "E2EE": "ਐਂਡ-ਟੂ-ਐਂਡ ਐਨਕ੍ਰਿਪਸ਼ਨ (E2EE) ਮੁੱਖ ਸਮੱਗਰੀ (ਸਿਰਫ਼ ਸੈਸ਼ਨ)",
    "Google Chrome": "ਗੂਗਲ ਕਰੋਮ (Google Chrome)"
  }
}

def clean_and_replace():
    with open('cookie_translations.json', 'r', encoding='utf-8') as f:
        translations = json.load(f)
        
    for lang, trans_dict in translations.items():
        if lang == 'en':
            continue
            
        term_map = TERM_TRANSLATIONS.get(lang)
        if not term_map:
            continue
            
        # 1. Direct assignments for the specific keys to ensure 100% precision
        trans_dict['cookieUsedFor'] = term_map["Used for:"]
        trans_dict['cookieIndexedTitle'] = term_map["IndexedDB"]
        trans_dict['cookieChromeTitle'] = term_map["Google Chrome"]
        trans_dict['cookieE2eeSession'] = term_map["E2EE"]
        
        # 2. General regex cleanup for any occurrences in description/other paragraphs
        for key, val in trans_dict.items():
            # Skip keys that we already direct-assigned to avoid double-modifications
            if key in ['cookieUsedFor', 'cookieIndexedTitle', 'cookieChromeTitle', 'cookieE2eeSession']:
                continue
                
            # Replace SahaPlay (and case variants, e.g. Saha play, sahaplay)
            val = re.sub(r'Saha\s*Play', term_map["SahaPlay"], val, flags=re.IGNORECASE)
            
            # Replace Used for: or Used for
            val = re.sub(r'Used\s+for\s*:', term_map["Used for:"], val, flags=re.IGNORECASE)
            val = re.sub(r'Used\s+for', term_map["Used for:"].rstrip(':'), val, flags=re.IGNORECASE)
            
            # Replace IndexedDB
            val = re.sub(r'IndexedDB', term_map["IndexedDB"], val, flags=re.IGNORECASE)
            
            # Replace E2EE (but do not mess up already translated structures)
            # We only replace if E2EE stands alone as a word
            val = re.sub(r'\bE2EE\b', 'E2EE', val) # Ensure capitalization
            
            # Replace Google Chrome
            val = re.sub(r'Google\s+Chrome', term_map["Google Chrome"], val, flags=re.IGNORECASE)
            
            # Specific cleanups (e.g. Italian bad Google Chrome translation)
            if lang == 'it':
                val = re.sub(r'Google\s+Cromo', term_map["Google Chrome"], val, flags=re.IGNORECASE)
                
            trans_dict[key] = val
            
    with open('cookie_translations.json', 'w', encoding='utf-8') as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)
    print("Successfully replaced terms in cookie_translations.json!")

if __name__ == "__main__":
    clean_and_replace()
