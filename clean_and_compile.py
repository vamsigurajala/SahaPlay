import json
import re
import os

LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'pt', 'ar', 'ru', 'it', 'te', 'ta', 'bn', 'mr', 'gu', 'ml', 'kn', 'pa']

def clean_text(text, lang):
    if not isinstance(text, str):
        return text

    # Remove iubenda mention from link text or any text
    text = re.sub(r'\s*[\-–—]\s*iubenda(?:\.com)?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(?:iubenda\.com|iubenda)\b', '', text, flags=re.IGNORECASE)
    text = text.strip(' -–—')

    # Replace phonetic/local forms of SahaPlay back to English "SahaPlay"
    sahaplay_variants = [
        "サハプレイ", "사하플레이", "萨哈普莱", "सहाप्ले", "सहाप्ले", "सहाप्ले",
        "सहापले", "సహాప్లే", "சஹாப்ளே", "সাহাপ্লে", "સહાપ્લે", "സഹാപ്ലേ", "സഹാപ്ലേ",
        "സഹാപ്ലേ", "സഹാപ്ലേ", "സഹാപ്ലേ", "ಸഹാപ്ലേ", "సహాప్లే"
    ]
    # Russian phonetic variants
    sahaplay_variants += ["СахаПлей", "Сахаплей", "сахаплей"]
    # Arabic
    sahaplay_variants += ["ساهابلاي", "ساهابلي", "ساهابلاي", "ساهابلاى"]
    # Tamil/Malayalam/Kannada/Telugu
    sahaplay_variants += ["సహాప్లే", "సహాప్లే", "சஹாப்ளே", "சஹாப்ளே", "সাহাপ্লে", "সहाप्ले", "સહાપ્લે", "സഹാപ്ലേ", "സഹാപ്ലേ"]
    
    for variant in sahaplay_variants:
        text = text.replace(variant, "SahaPlay")
    
    # Generic regex to enforce SahaPlay capitalization
    text = re.sub(r'\bSaha\s*Play\b', 'SahaPlay', text, flags=re.IGNORECASE)
    text = re.sub(r'\bsahaplay\b', 'SahaPlay', text, flags=re.IGNORECASE)

    # Replace local/phonetic forms of Supabase back to English "Supabase"
    supabase_variants = [
        "수파베이스", "スーパベース", "슈파베이스", "सुपाबेस", "سوبابيس", "سوبابيس",
        "Супабейс", "సుపాబేస్", "సూపర్‌బేస్", "సూపర్బేస్", "சூபாபேஸ்", "সুপাবেস", "सुपाबेस",
        "સુપાબેઝ", "સૂપબેસ", "સૂપાબેસ", "സൂപ്പർബേസ്", "സൂപ്പർബേസ്", "సూపర్బేస్", "ಸೂಪರ್ಬೇಸ್", "ਸੁਪਾਬੇਸ"
    ]
    for variant in supabase_variants:
        text = text.replace(variant, "Supabase")
    text = re.sub(r'\bsupabase\b', 'Supabase', text, flags=re.IGNORECASE)

    # Replace local/phonetic forms of YouTube, Netflix, Twitch back to English
    youtube_variants = ["유튜브", "ユーチューブ", "优酷", "यूट्यूब", "يوتيوب", "Ютуб", "యూట్యూబ్", "யூடியூப்", "ইউটিউব", "यूट्यूब", "યુટ્યુબ", "યૂટ્યૂબ", "യൂട്യൂബ്", "ಯೂಟ್ಯೂಬ್", "ಯೂಟ್ಯೂಬ್", "ಯೂಟ್ಯೂಬ್", "ਯੂਟਿਊਬ"]
    for variant in youtube_variants:
        text = text.replace(variant, "YouTube")
    text = re.sub(r'\byoutube\b', 'YouTube', text, flags=re.IGNORECASE)

    netflix_variants = ["넷플릭스", "ネットフリックス", "网飞", "नेटफ्लिक्स", "نتفليكس", "Нетфликс", "నెట్‌ఫ్లిక్స్", "நெட்ஃபிக்ஸ்", "நெட்ஃபிளிக்ஸ்", "নেটফ্লিক্স", "नेटफ्लिक्स", "નેટફ્લિક્સ", "નેટફ્લિક્સ", "നെറ്റ്ഫ്ലിക്സ്", "ನೆಟ್‌ಫ್ಲಿಕ್ಸ್", "ਨੈੱਟਫਲਿਕਸ"]
    for variant in netflix_variants:
        text = text.replace(variant, "Netflix")
    text = re.sub(r'\bnetflix\b', 'Netflix', text, flags=re.IGNORECASE)

    twitch_variants = ["트위치", "ツイッチ", "ट्विच", "تويتش", "Твич", "ట్విచ్", "ట్విచ్", "ட்விட்ச்", "টুইচ", "ट्विच", "ટ્વિચ", "ટ્વિચ", "ട്വിച്ച്", "ಟ್ವಿಚ್", "ਟਵਿੱਚ"]
    for variant in twitch_variants:
        text = text.replace(variant, "Twitch")
    text = re.sub(r'\btwitch\b', 'Twitch', text, flags=re.IGNORECASE)

    # General punctuation cleanups
    text = text.replace("（YouTube、Netflix、Twitch等）", " (YouTube, Netflix, Twitch) ")
    text = text.replace("(YouTube、Netflix、Twitchなど)", " (YouTube, Netflix, Twitch) ")
    text = text.replace(" (YouTube, Netflix, Twitch etc.) ", " (YouTube, Netflix, Twitch) ")
    text = text.replace("(YouTube, Netflix, Twitch etc.)", " (YouTube, Netflix, Twitch) ")
    
    return text

def main():
    # 1. Clean terms translations
    with open("terms_translations.json", "r", encoding="utf-8") as f:
        terms = json.load(f)
        
    for lang in terms:
        for key in terms[lang]:
            terms[lang][key] = clean_text(terms[lang][key], lang)
            
        # Refine termsSectionLabel translations
        if lang == 'zh':
            terms[lang]['termsSectionLabel'] = "条款"
        elif lang == 'ja':
            terms[lang]['termsSectionLabel'] = "条"
        elif lang == 'ko':
            terms[lang]['termsSectionLabel'] = "조"

    with open("terms_translations.json", "w", encoding="utf-8") as f:
        json.dump(terms, f, ensure_ascii=False, indent=2)
    print("Cleaned terms_translations.json")

    # 2. Clean cookie translations
    with open("cookie_translations.json", "r", encoding="utf-8") as f:
        cookies = json.load(f)
        
    for lang in cookies:
        for key in cookies[lang]:
            cookies[lang][key] = clean_text(cookies[lang][key], lang)

    with open("cookie_translations.json", "w", encoding="utf-8") as f:
        json.dump(cookies, f, ensure_ascii=False, indent=2)
    print("Cleaned cookie_translations.json")

    # 3. Read i18n.js
    i18n_path = os.path.join("frontend", "src", "i18n.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Strip ESM syntax to evaluate in Python-like logic via Node
    clean_code = code \
      .replace("import i18n from 'i18next';", '//') \
      .replace("import { initReactI18next } from 'react-i18next';", '//') \
      .replace("export default i18n;", '//')

    # We will write a temp Node script to eval and merge, to keep parsing exact
    with open("temp_merge.js", "w", encoding="utf-8") as f:
        f.write(f"""
const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'frontend', 'src', 'i18n.js');
let code = fs.readFileSync(i18nPath, 'utf8');

let cleanCode = code
  .replace(/import\\s+i18n\\s+from\\s+'i18next';/, '//')
  .replace(/import\\s+\\{\\s*initReactI18next\\s*\\}\\s+from\\s+'react-i18next';/, '//')
  .replace(/export\\s+default\\s+i18n;/, '//');

global.resourcesObj = null;

const i18n = {{
  use: function() {{ return this; }},
  init: function(options) {{
    global.resourcesObj = options.resources;
  }}
}};
const initReactI18next = {{}};
const localStorage = {{
  getItem: () => 'en'
}};

eval(cleanCode);

const resources = global.resourcesObj;
if (!resources) {{
  console.error("Failed to parse resources");
  process.exit(1);
}}

const termsTrans = JSON.parse(fs.readFileSync('terms_translations.json', 'utf8'));
const cookieTrans = JSON.parse(fs.readFileSync('cookie_translations.json', 'utf8'));

for (const lang in resources) {{
  if (!resources[lang].translation) {{
    resources[lang].translation = {{}};
  }}
  
  // Merge terms
  if (termsTrans[lang]) {{
    for (const key in termsTrans[lang]) {{
      resources[lang].translation[key] = termsTrans[lang][key];
    }}
  }}
  
  // Merge cookies
  if (cookieTrans[lang]) {{
    for (const key in cookieTrans[lang]) {{
      resources[lang].translation[key] = cookieTrans[lang][key];
    }}
  }}
  
  // Sort alphabetically
  const sorted = {{}};
  Object.keys(resources[lang].translation).sort().forEach(k => {{
    sorted[k] = resources[lang].translation[k];
  }});
  resources[lang].translation = sorted;
}}

const newResourcesBlock = "const resources = " + JSON.stringify(resources, null, 2) + ";";
const startMarker = "const resources =";
const startIndex = code.indexOf(startMarker);
if (startIndex === -1) {{
  console.error("No start marker");
  process.exit(1);
}}

const endMatch = code.match(/i18n\\s*\\.use/);
if (!endMatch) {{
  console.error("No end marker");
  process.exit(1);
}}
const endIndex = endMatch.index;

const originalDeclaration = code.substring(startIndex, endIndex);
const updatedCode = code.replace(originalDeclaration, newResourcesBlock + "\\n\\n");

fs.writeFileSync(i18nPath, updatedCode, 'utf8');
console.log("Merged and compiled clean translations successfully in i18n.js!");
""")

if __name__ == "__main__":
    main()
