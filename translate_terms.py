import urllib.request
import urllib.parse
import json
import time
import os

TERMS_KEYS = {
  "termsLegalDocs": "Legal Documents",
  "termsTitle": "Terms & Conditions",
  "termsTitlePart1": "Terms &",
  "termsTitlePart2": "Conditions",
  "termsIntroDesc": "Please read these Terms and Conditions carefully before using SahaPlay. By using our service, you agree to be bound by these terms.",
  "termsLastUpdated": "Last Updated: June 04, 2026",
  "termsTableOfContents": "Table of Contents",
  "termsSectionLabel": "Section",
  "termsSec1Title": "Introduction",
  "termsSec2Title": "Account Registration",
  "termsSec3Title": "Account Termination",
  "termsSec4Title": "User Generated Content",
  "termsSec5Title": "Acceptable Use",
  "termsSec6Title": "Copyright & Intellectual Property",
  "termsSec7Title": "Privacy",
  "termsSec8Title": "Third Party Services",
  "termsSec8bTitle": "Chat Messages & User Communications",
  "termsSec9Title": "Disclaimers & Limitation of Liability",
  "termsSec10Title": "Service Interruptions",
  "termsSec11Title": "Changes to These Terms",
  "termsSec12Title": "Age Restrictions",
  "termsSec13Title": "Governing Law",
  "termsSec14Title": "Severability",
  "termsSec15Title": "Contact Us",
  "termsIntroPara1": "These Terms and Conditions govern your use of SahaPlay (www.sahaplay.com) and any related services provided by SahaPlay.",
  "termsIntroPara2": "By accessing or using SahaPlay, you confirm that you are at least 13 years of age and agree to be bound by these Terms. If you do not agree, please do not use our service.",
  "termsIntroContact": "Contact:",
  "termsRegBullet1": "Users may register an account or use the service as a guest without registering.",
  "termsRegBullet2": "You are responsible for keeping your login credentials confidential.",
  "termsRegBullet3": "You must provide accurate and truthful information.",
  "termsRegBullet4": "Each user may only register one account.",
  "termsRegBullet5": "Accounts may not be registered by bots or automated methods.",
  "termsRegBullet6": "You must be at least 13 years old to register.",
  "termsRegBullet7": "Users aged 13–17 may only use the service under parental or adult supervision.",
  "termsTermBullet1": "You may terminate your account at any time by contacting us at",
  "termsTermBullet2": "We reserve the right to suspend or delete accounts that violate these Terms, applicable law, or that we deem inappropriate, without prior notice.",
  "termsTermBullet3": "Suspension or deletion does not entitle users to any compensation or reimbursement.",
  "termsContentBullet1": "Users may upload, share, and stream content through SahaPlay rooms and chat features.",
  "termsContentBullet2": "By providing content, you confirm you have the legal right to do so and are not infringing any third-party rights.",
  "termsContentBullet3": "You retain ownership of your content. However, by using SahaPlay you grant us a non-exclusive, royalty-free license to process your content solely for operating and maintaining the service.",
  "termsContentBullet4": "We do not actively monitor user content but reserve the right to remove content that violates these Terms.",
  "termsContentRemoveIntro": "We may remove content and restrict access if:",
  "termsContentSub1": "A complaint based on such content is received.",
  "termsContentSub2": "A copyright infringement notice is received.",
  "termsContentSub3": "Ordered by a public authority.",
  "termsContentSub4": "The content poses a risk to users or the service.",
  "termsUseIntro": "You agree NOT to use SahaPlay to:",
  "termsUseBullet1": "Violate any applicable laws or regulations.",
  "termsUseBullet2": "Stream, share, or distribute illegal or pirated content.",
  "termsUseBullet3": "Harass, bully, or abuse other users.",
  "termsUseBullet4": "Share adult, explicit, or pornographic content.",
  "termsUseBullet5": "Post hate speech or discriminatory content.",
  "termsUseBullet6": "Spam or send unsolicited messages.",
  "termsUseBullet7": "Impersonate other users or entities.",
  "termsUseBullet8": "Attempt to hack, exploit, or disrupt the service.",
  "termsUseBullet9": "Share private information about other users.",
  "termsUseBullet10": "Exploit or abuse minors in any way.",
  "termsUseBullet11": "Use the service for any commercial purpose without our written permission.",
  "termsUseSafetyGuidelines": "We have a detailed Safety and Community Guidelines page at",
  "termsIpBullet1": "All content, logos, design, trademarks, and visual elements of SahaPlay are the exclusive property of SahaPlay.",
  "termsIpBullet2": "Users may not copy, reproduce, distribute, or create derivative works from SahaPlay content.",
  "termsIpBullet3": "If you believe your copyright has been infringed, please send a DMCA notice to:",
  "termsIpIncludeNotice": "Include in your notice:",
  "termsIpSub1": "Description of the copyrighted work.",
  "termsIpSub2": "Location of the infringing content on our service.",
  "termsIpSub3": "Your contact details.",
  "termsIpSub4": "A statement of good faith belief.",
  "termsPrivacyPara1": "Your use of SahaPlay is also governed by our Privacy Policy, available at:",
  "termsPrivacyLinkText": "Privacy Policy — iubenda.com",
  "termsPrivacyPara2": "By using SahaPlay you agree to our Privacy Policy.",
  "termsThirdPara1": "SahaPlay integrates with third party services including Supabase for database and authentication. These services have their own terms and privacy policies. We are not responsible for third party services or content accessed through our platform.",
  "termsThirdPara2": "Users may access external content (YouTube, Netflix, Twitch etc.) through SahaPlay. We have no control over such content and are not responsible for it.",
  "termsChatPara1": "SahaPlay provides end-to-end encrypted private messaging features. Due to the nature of end-to-end encryption:",
  "termsChatBullet1": "Private messages between users are encrypted on the sender's device and can only be decrypted by the intended recipient. SahaPlay cannot access, read, monitor, or moderate the content of private encrypted messages.",
  "termsChatBullet2": "Users are solely responsible for all content they send through private chats, group room chats, and any other communication features.",
  "termsChatBullet3": "SahaPlay is not liable for any content exchanged between users in private or group communications.",
  "termsChatBullet4": "Users must not use chat features to share illegal content, threaten others, share non-consensual intimate images, or engage in any activity that violates these Terms or applicable law.",
  "termsChatBullet5": "Room chat messages and content shared within public or private rooms are the sole responsibility of the users who created them.",
  "termsChatBullet6Part1": "If you receive harmful, illegal, or abusive messages through SahaPlay, please report them immediately at",
  "termsChatBullet6Part2": "or through our",
  "termsChatBullet6Part3": "Safety Center at www.sahaplay.com/safety",
  "termsDiscPara1": "SahaPlay is provided \"as is\" and \"as available\" without warranties of any kind.",
  "termsDiscPara2": "To the maximum extent permitted by law, SahaPlay shall not be liable for:",
  "termsDiscBullet1": "Any indirect, incidental, or consequential damages.",
  "termsDiscBullet2": "Loss of data, profits, or business opportunities.",
  "termsDiscBullet3": "Service interruptions or malfunctions.",
  "termsDiscBullet4": "Content uploaded or shared by users.",
  "termsDiscBullet5": "Actions of third party services.",
  "termsDiscBullet6": "Any damages exceeding the amount paid by you to SahaPlay in the past 12 months (if any).",
  "termsDiscExcludes": "Nothing in these Terms excludes liability for fraud, death, or personal injury caused by our negligence.",
  "termsDiscEuUkUsers": "EU/UK Users:",
  "termsDiscConsumerRights": "Nothing in these Terms affects your statutory rights as a consumer.",
  "termsIntPara1": "We reserve the right to interrupt, modify, or discontinue the service at any time for maintenance, updates, or any other reason.",
  "termsIntPara2": "We will endeavor to provide 30 days notice before any significant changes or discontinuation where reasonably possible.",
  "termsChangePara1": "We reserve the right to modify these Terms at any time. We will notify users of changes by updating the \"Last Updated\" date at the top of this page.",
  "termsChangePara2": "Continued use of SahaPlay after changes constitutes acceptance of the new Terms.",
  "termsAgePara1": "SahaPlay is intended for users aged 13 and above. Users under 18 must have parental or guardian supervision. We do not knowingly collect data from children under 13.",
  "termsAgePara2Part1": "If you believe a child under 13 has registered, please contact us at",
  "termsGovPara1": "These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of the courts of Andhra Pradesh, India.",
  "termsGovEuUkConsumers": "For EU/UK consumers: This does not affect your rights under the laws of your country of residence.",
  "termsSevPara1": "If any provision of these Terms is found invalid or unenforceable, the remaining provisions will continue in full force and effect.",
  "termsContactPara1": "For any questions about these Terms:",
  "termsCtaTitle": "Questions About Our Terms?",
  "termsCtaDesc": "If you have any questions or need clarification about these Terms and Conditions, our team is here to help.",
  "termsCtaBtn": "Contact Us",
  "termsBackToTop": "Back to Top"
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
            
            raw_parts = translated_combined.split("###")
            raw_parts = [p.strip() for p in raw_parts]
            
            # Sometimes google translates separator as different spaces/casing, let's also try splitting by common alternatives
            if len(raw_parts) != len(texts):
                raw_parts = [p.strip() for p in translated_combined.split("＃＃＃")]
                
            if len(raw_parts) == len(texts):
                return raw_parts
            else:
                raise ValueError(f"Length mismatch: got {len(raw_parts)}, expected {len(texts)}")
        except Exception as e:
            print(f"Attempt {attempt+1} failed to translate batch to {target_lang}: {e}")
            time.sleep(attempt + 1)
            
    # Fallback to individual translation
    print(f"Falling back to translating items individually for {target_lang}...")
    individual_results = []
    for text in texts:
        individual_results.append(translate_single(text, target_lang))
        time.sleep(0.1)
    return individual_results

def translate_single(text, target_lang):
    if target_lang == 'zh':
        target_lang = 'zh-CN'
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
    return text

def main():
    translated_res = {}
    
    # English stays English
    translated_res["en"] = TERMS_KEYS
    
    # Divide keys into batches of 15
    items = list(TERMS_KEYS.items())
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
        
    with open("terms_translations.json", "w", encoding="utf-8") as f:
        json.dump(translated_res, f, ensure_ascii=False, indent=2)
    print("Done! Saved to terms_translations.json")

if __name__ == "__main__":
    main()
