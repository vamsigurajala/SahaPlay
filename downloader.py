import os
import urllib.request
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

dir_path = 'frontend/public/media'
os.makedirs(dir_path, exist_ok=True)

images = [
    ('youtube.svg', 'https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg'),
    ('twitch.svg', 'https://upload.wikimedia.org/wikipedia/commons/2/26/Twitch_logo.svg'),
    ('vimeo.svg', 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vimeo_Logo.svg'),
    ('netflix.svg', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg'),
    ('prime.svg', 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg'),
    ('hulu.svg', 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Hulu_Logo.svg'),
    ('crunchyroll.svg', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_Logo.svg'),
    ('tubi.svg', 'https://upload.wikimedia.org/wikipedia/en/9/90/Tubi_logo.svg'),

    ('minigolf.png', 'https://play-lh.googleusercontent.com/9nF-u5l2P8185I2A-JmX4s1gKovIqWbLHT9x6vH2P8E0kIfE5_H0Oq_wzYkU7Zc3c2g=w400'),
    ('8ball.png', 'https://play-lh.googleusercontent.com/bPz1guJ6FHF3EBdXvcVWJm3L_0u2_T3t2w5Hk5X2Fh2V-O1p-0kC3U0Z6OQ2e6yRqw=w400'),
    ('slither.png', 'https://play-lh.googleusercontent.com/psT-veXvT1bDEB_X3m1kQhZfQ3UqR1T_8A4C4R0XwX6qZJ4H9d8a5V2U_T_g_bF=w400'),
    ('smashkarts.png', 'https://play-lh.googleusercontent.com/A6VPE4Xz1r0_hQ5K7z9aZqX2rT_rY0yF0cOQ_xW0eQ_x0Z_uU2M2h4c4H_u0v0xV=w400'),
    ('krunker.png', 'https://play-lh.googleusercontent.com/_X-VlH8O2zD0B-_D_k0d-_M_zT_G_L_1-YV_g8oW6U-S_N-i_P6h0S-fK_r_a_i_=w400'),

    ('soundcloud.svg', 'https://upload.wikimedia.org/wikipedia/commons/a/a2/SoundCloud_logo.svg'),
    ('spotify.svg', 'https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg'),
    ('apple.svg', 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Apple_Music_logo.svg'),

    ('tiktok.svg', 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg'),
    ('instagram.png', 'https://upload.wikimedia.org/wikipedia/commons/2/28/Instagram_logo.png')
]

req_headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

for name, url in images:
    if os.path.exists(os.path.join(dir_path, name)):
        continue
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req) as response, open(os.path.join(dir_path, name), 'wb') as out_file:
            out_file.write(response.read())
        print(f"Success: {name}")
    except Exception as e:
        print(f"Failed {name}: {e}")
