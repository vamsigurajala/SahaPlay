import os
import urllib.request
import urllib.parse
import re

# Comprehensive dictionary of all app keys and their associated Google Share URLs
urls = {
    # Video & Streaming
    "prime": "https://share.google/WPjlzt9XkPE2TWt8e",
    "minigolf": "https://share.google/KYhi6Ye7p2irlZfrL",
    "slither": "https://share.google/rIaqLEFV9KlJ7TRV4",
    "8ball": "https://share.google/Sl1QzsDDXrxZkfnLG",
    "smashkarts": "https://share.google/kHplAhIQMRWiZ5MCU",
    "krunker": "https://share.google/ow6w7FUs4pOr4T1Sl",
    "youtube": "https://share.google/1eavxHP0NjPcy6XQ6",
    "twitch": "https://share.google/3TQx3xtSeWWfGGBHw",
    "vimeo": "https://share.google/TCIcbhPsfzsr2WJFq",
    "hbomax": "https://share.google/KhcikZ0mjdpvCQq8W",
    "hotstar": "https://share.google/5UwU1qzB8CtjKPygz",
    "crunchyroll": "https://share.google/3wnqQW6OlJvmaxTZR", # New updated crunchyroll link
    "netflix": "https://share.google/pICXospq63a5kGIj3",
    "hulu": "https://share.google/VbjR4e5gdqowzyVVX",
    
    # Music & Podcasts
    "soundcloud": "https://share.google/DgcfyLLDQeZshaofP",
    "spotify": "https://share.google/1SvUOZpOXjyVQfmp0",
    "apple": "https://share.google/2YsbQUuoML0eBddz7",
    
    # Social Media
    "tiktok": "https://share.google/tjaNB181Gp8702W3i",
    "instagram": "https://share.google/Owo8llOSaw3DxXiap"
}

output_dir = 'public/images/apps'
os.makedirs(output_dir, exist_ok=True)

print(f"Checking and downloading {len(urls)} app assets...")

for name, url in urls.items():
    path = os.path.join(output_dir, f"{name}.jpg")
    
    # Optimization: Skip if already downloaded
    if os.path.exists(path) and os.path.getsize(path) > 0:
        print(f"[SKIP] {name}.jpg already exists.")
        continue
        
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        html = urllib.request.urlopen(req).read().decode('utf-8')
        
        match = re.search(r'url=(/imgres\?[^"]+)', html)
        if match:
            imgres_url = "https://www.google.com" + match.group(1).replace('&amp;', '&')
            parsed = urllib.parse.urlparse(imgres_url)
            params = urllib.parse.parse_qs(parsed.query)
            if 'imgurl' in params:
                direct_url = params['imgurl'][0]
                print(f"[DOWNLOAD] Fetching {name}...")
                
                img_req = urllib.request.Request(
                    direct_url, 
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                        'Referer': 'https://www.google.com/'
                    }
                )
                with urllib.request.urlopen(img_req) as response, open(path, 'wb') as out_file:
                    out_file.write(response.read())
                print(f"[SUCCESS] Saved {name}.jpg")
            else:
                print(f"[ERROR] {name}: No imgurl parameter found in redirect.")
        else:
            print(f"[ERROR] {name}: No meta refresh found. URL might be dead.")
    except Exception as e:
        print(f"[FAIL] {name}: Request error -> {e}")
