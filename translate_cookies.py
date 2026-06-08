import urllib.request
import urllib.parse
import json
import time
import os

COOKIE_KEYS = {
  "cookiePageBadge": "Security & Storage",
  "cookiePolicyTitle": "Cookie Policy",
  "cookieHeroDesc": "Learn how SahaPlay uses cookies, browser storage, authentication technologies, and security mechanisms to provide a secure and personalized experience.",
  "cookieLastUpdated": "Last Updated: May 2026",
  "cookieWhatTitle": "What are Cookies?",
  "cookieWhatDesc": "Cookies are small pieces of data stored in your browser that help websites remember information between visits. SahaPlay uses cookies and similar browser technologies to support authentication, security, preferences, and application performance.",
  "cookieHowTitle": "How SahaPlay Uses Cookies",
  "cookieHowDesc": "We use cookies and browser storage technologies to enable essential core features.",
  "cookieAuthTitle": "Authentication",
  "cookieAuthItem1": "Keeps users signed in securely.",
  "cookieAuthItem2": "Maintains active sessions.",
  "cookieAuthItem3": "Reduces unnecessary logins.",
  "cookieSecurityTitle": "Security",
  "cookieSecurityItem1": "Protects accounts and sessions.",
  "cookieSecurityItem2": "Supports security verification.",
  "cookieSecurityItem3": "Helps prevent unauthorized access.",
  "cookiePrefsTitle": "Preferences",
  "cookiePrefsItem1": "Remembers theme settings (dark/light mode).",
  "cookiePrefsItem2": "Remembers interface preferences.",
  "cookiePrefsItem3": "Stores user customization choices.",
  "cookiePerfTitle": "Performance",
  "cookiePerfItem1": "Improves loading speed.",
  "cookiePerfItem2": "Supports reconnection features.",
  "cookiePerfItem3": "Optimizes application responsiveness.",
  "cookieStorageTitle": "Browser Storage Technologies",
  "cookieStorageDesc": "Apart from traditional cookies, we utilize modern browser storage mechanisms to save data locally.",
  "cookieLocalTitle": "localStorage",
  "cookieLocalDesc": "Persistent key-value database that remains after the browser window is closed.",
  "cookieLocalItem1": "Theme preferences",
  "cookieLocalItem2": "User interface settings",
  "cookieLocalItem3": "Room preferences",
  "cookieSessionTitle": "sessionStorage",
  "cookieSessionDesc": "Temporary key-value storage that is completely cleared when the browser tab is closed.",
  "cookieSessionItem1": "Temporary session info",
  "cookieSessionItem2": "Navigation state",
  "cookieSessionItem3": "Session-specific data",
  "cookieIndexedTitle": "IndexedDB",
  "cookieIndexedDesc": "A full client-side relational database designed for storing large amounts of structured data.",
  "cookieIndexedItem1": "Application caching",
  "cookieIndexedItem2": "Performance optimization",
  "cookieIndexedItem3": "Encrypted local application data",
  "cookieUsedFor": "Used for:",
  "cookieChatLockTitle": "Chat Lock & Security Storage",
  "cookieChatLockDesc": "SahaPlay includes a built-in Chat Lock feature designed to keep your personal chats private. To protect these conversations, the app stores cryptographically secure credentials locally on your browser.",
  "cookieChatLockE2ee": "End-to-end encryption key material is stored in session memory only and is never written to disk or sent to our servers.",
  "cookiePinMeta": "PIN verification metadata",
  "cookieMasterKey": "Master Key verification details",
  "cookieLockTimer": "Lockout timer state",
  "cookieE2eeSession": "E2EE Key Material (session only)",
  "cookieThirdTitle": "Third-Party Services",
  "cookieThirdDesc": "We work with premium service providers who also utilize cookies and local storage to run application layers.",
  "cookieSupabaseTitle": "Supabase",
  "cookieSupabaseDesc": "Supabase acts as our primary database and backend infrastructure provider. It stores tokens and session states locally in your browser.",
  "cookieSupabaseItem1": "Authentication",
  "cookieSupabaseItem2": "Realtime Sync",
  "cookieSupabaseItem3": "Database Storage",
  "cookieFutureTitle": "Future Integrations",
  "cookieFutureDesc": "We may introduce third-party tools to help analyze user feedback, monitor application health, and report crashes.",
  "cookieFutureItem1": "Analytics",
  "cookieFutureItem2": "Performance Logging",
  "cookieFutureItem3": "Error Reports",
  "cookieFutureNote": "Third-party services operate under their own privacy policies. You can choose to block third-party cookies directly in your browser.",
  "cookieManageTitle": "How to Manage Cookies",
  "cookieManageDesc": "You have full control over browser data. Here is how to modify settings in popular browsers.",
  "cookieChromeTitle": "Google Chrome",
  "cookieChromeDesc": "Settings → Privacy and Security → Cookies and Other Site Data",
  "cookieEdgeTitle": "Microsoft Edge",
  "cookieEdgeDesc": "Settings → Cookies and Site Permissions → Manage and Delete Cookies",
  "cookieFirefoxTitle": "Mozilla Firefox",
  "cookieFirefoxDesc": "Settings → Privacy & Security → Cookies and Site Data",
  "cookieSafariTitle": "Apple Safari",
  "cookieSafariDesc": "Settings → Privacy → Manage Website Data → Remove All",
  "cookieDisableTitle": "Disabling Browser Storage",
  "cookieDisableDesc": "Please note that if you block all cookies and local browser storage, certain parts of SahaPlay may cease to function correctly. This will specifically impact:",
  "cookieDisableItem1": "Active login sessions and auto-login workflows",
  "cookieDisableItem2": "Theme choices (defaults back to dark mode)",
  "cookieDisableItem3": "Active room states and synchronization parameters",
  "cookieDisableItem4": "Chat Lock protection vault and PIN recovery workflows",
  "cookieContactTitle": "Questions About Our Cookie Policy?",
  "cookieContactDesc": "Our security and support teams are here to help. Reach out if you want to know more about how we safeguard your data.",
  "cookieContactBtn": "Contact Us",
  "cookiePrivacyTitle": "Privacy & Cookie Policy",
  "cookiePrivacySubtitle": "Your data, your rights — full transparency on how we protect you.",
  "cookiePrivacyDesc": "This Cookie Policy is part of our broader Privacy Policy. Together, they explain what data we collect, why we collect it, how it is stored, and what rights you have. We encourage you to read the full Privacy Policy for a complete picture of our data practices.",
  "cookiePrivacyBtn": "Read Full Privacy Policy"
}

LANGUAGES = ['es', 'fr', 'de', 'ja', 'ko', 'zh', 'hi', 'pt', 'ar', 'ru', 'it', 'te', 'ta', 'bn', 'mr', 'gu', 'ml', 'kn', 'pa']

SEPARATOR = "\n###\n"

def translate_batch(texts, target_lang):
    if target_lang == 'zh':
        target_lang = 'zh-CN'
    
    combined_text = SEPARATOR.join(texts)
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" + target_lang + "&dt=t&q=" + urllib.parse.quote(combined_text)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    for attempt in range(5):
        try:
            res = urllib.request.urlopen(req).read().decode('utf-8')
            parsed = json.loads(res)
            parts = [seg[0] for seg in parsed[0] if seg[0]]
            translated_combined = "".join(parts)
            
            # Split by separator
            # Note: Google translate might add spaces around ### or translate the capitalization
            # Let's clean the separators
            lines = []
            current_line = []
            
            # Since separators should be ###, let's split by ### and clean whitespaces
            raw_parts = translated_combined.split("###")
            raw_parts = [p.strip() for p in raw_parts]
            
            if len(raw_parts) == len(texts):
                return raw_parts
            else:
                # If length mismatch, print error and raise so we try fallback
                raise ValueError(f"Length mismatch: got {len(raw_parts)}, expected {len(texts)}")
        except Exception as e:
            print(f"Attempt {attempt+1} failed to translate batch to {target_lang}: {e}")
            time.sleep(attempt + 1)
            
    # Fallback to translating individual texts
    print(f"Falling back to translating items individually for {target_lang}...")
    individual_results = []
    for text in texts:
        individual_results.append(translate_single(text, target_lang))
        time.sleep(0.1)
    return individual_results

def translate_single(text, target_lang):
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" + target_lang + "&dt=t&q=" + urllib.parse.quote(text)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(5):
        try:
            res = urllib.request.urlopen(req).read().decode('utf-8')
            parsed = json.loads(res)
            parts = [seg[0] for seg in parsed[0] if seg[0]]
            return "".join(parts).strip()
        except Exception as e:
            time.sleep(attempt + 1)
    return text  # Fallback to original text

def main():
    translated_res = {}
    
    # English stays English
    translated_res["en"] = COOKIE_KEYS
    
    # Divide keys into batches of 15
    items = list(COOKIE_KEYS.items())
    batch_size = 15
    batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
    
    for lang in LANGUAGES:
        print(f"Translating to {lang}...")
        translated_res[lang] = {}
        
        for batch in batches:
            keys = [b[0] for b in batch]
            texts = [b[1] for b in batch]
            
            translated_texts = translate_batch(texts, lang)
            for k, t in zip(keys, translated_texts):
                translated_res[lang][k] = t
                
            time.sleep(0.1)
            
        print(f"Finished {lang}")
        
    with open("cookie_translations.json", "w", encoding="utf-8") as f:
        json.dump(translated_res, f, ensure_ascii=False, indent=2)
    print("Done! Saved to cookie_translations.json")

if __name__ == "__main__":
    main()
