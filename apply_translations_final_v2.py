import json
import os
import re

LANGUAGES = ['es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'pt', 'ar', 'ru', 'it', 'te', 'ta', 'bn', 'mr', 'gu', 'ml', 'kn', 'pa']

TERM_MAPS = {
  "en": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube": "YouTube",
    "Netflix": "Netflix",
    "Twitch": "Twitch",
    "sectionFormat": "Section {{num}}"
  },
  "es": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube": "YouTube",
    "Netflix": "Netflix",
    "Twitch": "Twitch",
    "sectionFormat": "Sección {{num}}"
  },
  "fr": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube": "YouTube",
    "Netflix": "Netflix",
    "Twitch": "Twitch",
    "sectionFormat": "Section {{num}}"
  },
  "de": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube": "YouTube",
    "Netflix": "Netflix",
    "Twitch": "Twitch",
    "sectionFormat": "Abschnitt {{num}}"
  },
  "ja": {
    "SahaPlay": "サハプレイ",
    "Supabase": "スーパベース",
    "YouTube": "ユーチューブ",
    "Netflix": "ネットフリックス",
    "Twitch": "ツイッチ",
    "sectionFormat": "第{{num}}条"
  },
  "ko": {
    "SahaPlay": "사하플레이",
    "Supabase": "수파베이스",
    "YouTube": "유튜브",
    "Netflix": "넷플릭스",
    "Twitch": "트위치",
    "sectionFormat": "제{{num}}조"
  },
  "zh": {
    "SahaPlay": "萨哈普莱",
    "Supabase": "苏帕贝斯",
    "YouTube": "YouTube",
    "Netflix": "网飞",
    "Twitch": "Twitch",
    "sectionFormat": "第 {{num}} 条"
  },
  "hi": {
    "SahaPlay": "सहाप्ले",
    "Supabase": "सुपाबेस",
    "YouTube": "यूट्यूब",
    "Netflix": "नेटफ्लिक्स",
    "Twitch": "ट्विच",
    "sectionFormat": "धारा {{num}}"
  },
  "pt": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube": "YouTube",
    "Netflix": "Netflix",
    "Twitch": "Twitch",
    "sectionFormat": "Seção {{num}}"
  },
  "ar": {
    "SahaPlay": "ساهابلاي",
    "Supabase": "سوبابيس",
    "YouTube": "يوتيوب",
    "Netflix": "نتفليكس",
    "Twitch": "تويتش",
    "sectionFormat": "القسم {{num}}"
  },
  "ru": {
    "SahaPlay": "СахаПлей",
    "Supabase": "Супабейс",
    "YouTube": "Ютуб",
    "Netflix": "Нетфликс",
    "Twitch": "Твич",
    "sectionFormat": "Раздел {{num}}"
  },
  "it": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube": "YouTube",
    "Netflix": "Netflix",
    "Twitch": "Twitch",
    "sectionFormat": "Sezione {{num}}"
  },
  "te": {
    "SahaPlay": "సహాప్లే",
    "Supabase": "సుపాబేస్",
    "YouTube": "యూట్యూబ్",
    "Netflix": "నెట్‌ఫ్లిక్స్",
    "Twitch": "ట్విచ్",
    "sectionFormat": "విభాగం {{num}}"
  },
  "ta": {
    "SahaPlay": "சஹாப்ளே",
    "Supabase": "சூபாபேஸ்",
    "YouTube": "யூடியூப்",
    "Netflix": "நெட்ஃபிக்ஸ்",
    "Twitch": "ட்விட்ச்",
    "sectionFormat": "பிரிவு {{num}}"
  },
  "bn": {
    "SahaPlay": "সাহাপ্লে",
    "Supabase": "সুপাবেস",
    "YouTube": "ইউটিউব",
    "Netflix": "নেটফ্লিক্স",
    "Twitch": "টুইচ",
    "sectionFormat": "ধারা {{num}}"
  },
  "mr": {
    "SahaPlay": "सहाप्ले",
    "Supabase": "सुपाबेस",
    "YouTube": "यूट्यूब",
    "Netflix": "नेटफ्लिक्स",
    "Twitch": "ट्विच",
    "sectionFormat": "विभाग {{num}}"
  },
  "gu": {
    "SahaPlay": "સહાપ્લે",
    "Supabase": "સૂપાબેસ",
    "YouTube": "યુટ્યુબ",
    "Netflix": "નેટફ્લિક્સ",
    "Twitch": "ટ્વિચ",
    "sectionFormat": "વિભાગ {{num}}"
  },
  "ml": {
    "SahaPlay": "സഹാപ്ലേ",
    "Supabase": "സൂപ്പർബേസ്",
    "YouTube": "യൂട്യൂബ്",
    "Netflix": "നെറ്റ്ഫ്ലിക്സ്",
    "Twitch": "ട്വിച്ച്",
    "sectionFormat": "വിഭാഗം {{num}}"
  },
  "kn": {
    "SahaPlay": "ಸಹಾಪ್ಲೇ",
    "Supabase": "ಸೂಪರ್ಬೇಸ್",
    "YouTube": "ಯೂಟ್ಯೂಬ್",
    "Netflix": "ನೆಟ್‌ಫ್ಲಿಕ್ಸ್",
    "Twitch": "ಟ್ವಿಚ್",
    "sectionFormat": "ವಿಭಾಗ {{num}}"
  },
  "pa": {
    "SahaPlay": "ਸਹਾਪਲੇ",
    "Supabase": "ਸੁਪਾਬੇਸ",
    "YouTube": "ਯੂਟਿਊਬ",
    "Netflix": "ਨੈੱਟਫਲਿਕਸ",
    "Twitch": "ਟਵਿੱਚ",
    "sectionFormat": "ਸੈਕਸ਼ਨ {{num}}"
  }
}

def clean_and_localize(text, term_map):
    if not isinstance(text, str):
        return text

    # Remove iubenda mention from link text or any text
    text = re.sub(r'\s*[\-–—]\s*iubenda(?:\.com)?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(?:iubenda\.com|iubenda)\b', '', text, flags=re.IGNORECASE)
    text = text.strip(' -–—')

    # Replace "SahaPlay" / "Sahaplay" / "Saha Play" with localized name
    # We use a case-insensitive regex swap or simple replace
    text = re.sub(r'Saha\s*Play', term_map["SahaPlay"], text, flags=re.IGNORECASE)
    text = re.sub(r'Sahaplay', term_map["SahaPlay"], text, flags=re.IGNORECASE)

    # Replace "Supabase" with localized name
    text = text.replace("Supabase", term_map["Supabase"])

    # Replace platforms
    text = text.replace("YouTube", term_map["YouTube"])
    text = text.replace("Netflix", term_map["Netflix"])
    text = text.replace("Twitch", term_map["Twitch"])
    
    return text

def main():
    # 1. Load and process terms_translations.json
    with open("terms_translations.json", "r", encoding="utf-8") as f:
        terms = json.load(f)

    for lang in terms:
        term_map = TERM_MAPS.get(lang, TERM_MAPS["en"])
        
        # Inject termsSectionFormat key
        terms[lang]["termsSectionFormat"] = term_map["sectionFormat"]
        
        for key in list(terms[lang].keys()):
            terms[lang][key] = clean_and_localize(terms[lang][key], term_map)

    with open("terms_translations.json", "w", encoding="utf-8") as f:
        json.dump(terms, f, ensure_ascii=False, indent=2)
    print("Processed terms_translations.json successfully")

    # 2. Load and process cookie_translations.json
    with open("cookie_translations.json", "r", encoding="utf-8") as f:
        cookies = json.load(f)

    for lang in cookies:
        term_map = TERM_MAPS.get(lang, TERM_MAPS["en"])
        for key in list(cookies[lang].keys()):
            cookies[lang][key] = clean_and_localize(cookies[lang][key], term_map)

    with open("cookie_translations.json", "w", encoding="utf-8") as f:
        json.dump(cookies, f, ensure_ascii=False, indent=2)
    print("Processed cookie_translations.json successfully")

if __name__ == "__main__":
    main()
