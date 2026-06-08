import json
import re

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
        "サハプレイ", "사하플레이", "萨哈普莱", "सहाप्ले", "सहापले",
        "సహాప్లే", "சஹாப்ளே", "সাহাপ্লে", "સહાપ્લે", "സഹാപ്ലേ", "ಸಹಾಪ್ಲೇ", "ਸਹਾਪਲੇ"
    ]
    # Russian phonetic variants
    sahaplay_variants += ["СахаПлей", "Сахаплей", "сахаплей"]
    # Arabic
    sahaplay_variants += ["ساهابلاي", "ساهابلي", "ساهابلاى"]
    # Tamil/Malayalam/Kannada/Telugu
    sahaplay_variants += ["సహాప్లే", "சஹாப்ளே", "সাহাপ্লে", "સહાપ્લે", "സഹാപ്ലേ", "ಸಹಾಪ್ಲೇ", "സഹാಪ್ಲೇ", "సహాప్లే"]
    
    for variant in sahaplay_variants:
        text = text.replace(variant, "SahaPlay")
    
    # Generic regex to enforce SahaPlay capitalization
    text = re.sub(r'\bSaha\s*Play\b', 'SahaPlay', text, flags=re.IGNORECASE)
    text = re.sub(r'\bsahaplay\b', 'SahaPlay', text, flags=re.IGNORECASE)

    # Replace local/phonetic forms of Supabase back to English "Supabase"
    supabase_variants = [
        "수파베이스", "スーパベース", "슈파베이스", "सुपाबेस", "سوبابيس",
        "Супабейс", "సుపాబేస్", "సూపర్‌బేస్", "సూపర్బేస్", "சூபாபேస్", "সুপাবেস", "सुपाबेस",
        "સુપાબેઝ", "સૂપબેસ", "સૂપાબેસ", "സൂപ്പർబேസ്", "സൂപ്പർബേസ്", "సూపర్బేస్", "ಸೂಪರ್ಬೇಸ್", "ਸੁਪਾਬੇਸ"
    ]
    for variant in supabase_variants:
        text = text.replace(variant, "Supabase")
    text = re.sub(r'\bsupabase\b', 'Supabase', text, flags=re.IGNORECASE)

    # Replace local/phonetic forms of YouTube, Netflix, Twitch back to English
    youtube_variants = ["유튜브", "ユーチューブ", "优酷", "यूट्यूब", "يوتيوب", "Ютуб", "యూట్యూబ్", "யூடியூప్", "ইউটিউব", "यूट्यूब", "યુટ્યુબ", "યૂਟ્યૂબ", "യൂട്യൂബ്", "ಯೂಟ್ಯೂಬ್", "ಯೂಟ್ಯೂಬ್", "ಯೂಟ್ಯೂಬ್", "ਯੂਟਿਊਬ"]
    for variant in youtube_variants:
        text = text.replace(variant, "YouTube")
    text = re.sub(r'\byoutube\b', 'YouTube', text, flags=re.IGNORECASE)

    netflix_variants = ["넷플릭스", "ネットフリックス", "网飞", "नेटफ्लिक्स", "نتفليكس", "Нетфликс", "నెట్‌ఫ్లిక్స్", "நெட்ஃபிக்ஸ்", "நெட்ஃபிளிக்ஸ்", "নেটফ্লিক্স", "নেটফ্লিক্স", "નેટફ્લિક્સ", "네ਟફ්ଲਿਕ੍ਸ", "നെറ്റ്ഫ്ലിക്സ്", "ನೆಟ್‌ಫ್ಲಿಕ್ಸ್", "ਨੈੱטਫਲਿਕਸ"]
    for variant in netflix_variants:
        text = text.replace(variant, "Netflix")
    text = re.sub(r'\bnetflix\b', 'Netflix', text, flags=re.IGNORECASE)

    twitch_variants = ["트위치", "ツイッチ", "ट्विच", "تويتش", "Твич", "ట్విచ్", "ట్విచ్", "ட்விட்ச்", "টুইচ", "ट्विच", "ટ્વિચ", "ટ્વિચ", "ട്വിച്ച്", "ಟ್ವಿಚ್", "ਟਵਿੱਚ"]
    for variant in twitch_variants:
        text = text.replace(variant, "Twitch")
    text = re.sub(r'\btwitch\b', 'Twitch', text, flags=re.IGNORECASE)

    # Clean up punctuation formatting issues from translations
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
    print("Cleaned terms_translations.json successfully")

    # 2. Clean cookie translations
    with open("cookie_translations.json", "r", encoding="utf-8") as f:
        cookies = json.load(f)
        
    for lang in cookies:
        for key in cookies[lang]:
            cookies[lang][key] = clean_text(cookies[lang][key], lang)

    with open("cookie_translations.json", "w", encoding="utf-8") as f:
        json.dump(cookies, f, ensure_ascii=False, indent=2)
    print("Cleaned cookie_translations.json successfully")

if __name__ == "__main__":
    main()
