import json
import os
import re

LANGUAGES = ['es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'pt', 'ar', 'ru', 'it', 'te', 'ta', 'bn', 'mr', 'gu', 'ml', 'kn', 'pa']

TERM_MAPS = {
  "en": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "Section {{num}}"
  },
  "es": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "Sección {{num}}"
  },
  "fr": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "Section {{num}}"
  },
  "de": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "Abschnitt {{num}}"
  },
  "ja": {
    "SahaPlay": "サハプレイ",
    "Supabase": "スーパベース",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "第{{num}}条"
  },
  "ko": {
    "SahaPlay": "사하플레이",
    "Supabase": "수파베이스",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "제{{num}}조"
  },
  "zh": {
    "SahaPlay": "萨哈普莱",
    "Supabase": "苏帕贝斯",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "第 {{num}} 条"
  },
  "hi": {
    "SahaPlay": "सहाप्ले",
    "Supabase": "सुपाबेस",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "धारा {{num}}"
  },
  "pt": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "Seção {{num}}"
  },
  "ar": {
    "SahaPlay": "ساهابلاي",
    "Supabase": "سوبابيس",
    "YouTube_Netflix_Twitch": "(YouTube، Netflix، Twitch)",
    "sectionFormat": "القسم {{num}}"
  },
  "ru": {
    "SahaPlay": "СахаПлей",
    "Supabase": "Супабейс",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "Раздел {{num}}"
  },
  "it": {
    "SahaPlay": "SahaPlay",
    "Supabase": "Supabase",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "Sezione {{num}}"
  },
  "te": {
    "SahaPlay": "సహాప్లే",
    "Supabase": "సుపాబేస్",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "విభాగం {{num}}"
  },
  "ta": {
    "SahaPlay": "சஹாப்ளே",
    "Supabase": "சூபாபேஸ்",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "பிரிவு {{num}}"
  },
  "bn": {
    "SahaPlay": "সাহাপ্লে",
    "Supabase": "সুপাবেস",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "ধারা {{num}}"
  },
  "mr": {
    "SahaPlay": "सहाप्ले",
    "Supabase": "सुपाबेस",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "विभाग {{num}}"
  },
  "gu": {
    "SahaPlay": "સહાપ્લે",
    "Supabase": "સૂપાબેસ",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "વિભાગ {{num}}"
  },
  "ml": {
    "SahaPlay": "സഹാപ്ലേ",
    "Supabase": "സൂപ്പർബേസ്",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "വിഭാഗം {{num}}"
  },
  "kn": {
    "SahaPlay": "ಸಹಾಪ್ಲೇ",
    "Supabase": "ಸೂಪರ್ಬೇಸ್",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
    "sectionFormat": "ವಿಭಾಗ {{num}}"
  },
  "pa": {
    "SahaPlay": "ਸਹਾਪਲੇ",
    "Supabase": "ਸੁਪਾਬੇਸ",
    "YouTube_Netflix_Twitch": "(YouTube, Netflix, Twitch)",
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

    # Replace "SahaPlay" (English characters) with localized name
    text = text.replace("SahaPlay", term_map["SahaPlay"])
    text = text.replace("Sahaplay", term_map["SahaPlay"])

    # Replace "Supabase" (English characters) with localized name
    text = text.replace("Supabase", term_map["Supabase"])

    # Replace (YouTube, Netflix, Twitch etc.) or (YouTube, Netflix, Twitch) with localized version
    text = re.sub(r'\(\s*YouTube\s*,\s*Netflix\s*,\s*Twitch\s*etc\.\s*\)', term_map["YouTube_Netflix_Twitch"], text, flags=re.IGNORECASE)
    text = re.sub(r'\(\s*YouTube\s*,\s*Netflix\s*,\s*Twitch\s*\)', term_map["YouTube_Netflix_Twitch"], text, flags=re.IGNORECASE)
    
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
            # We don't want to translate the url link itself, but we do clean the description/titles
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
