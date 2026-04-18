import os
import re

def check_jsx_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple tag balance check (count < and > but ignore escapes and strings)
    # This is a very rough check
    text_no_strings = re.sub(r'\'[^\']*\'|"[^"]*"|`[^`]*`', '', content)
    opens = text_no_strings.count('<') - text_no_strings.count('</') - text_no_strings.count('/>')
    closing = text_no_strings.count('</')
    
    # Better: check braces balance
    braces = text_no_strings.count('{') - text_no_strings.count('}')
    parens = text_no_strings.count('(') - text_no_strings.count(')')
    
    return braces, parens

files = [
    r'c:\Users\KrishnavamsiGurajala\.gemini\antigravity\scratch\watch-together\frontend\src\Home.jsx',
    r'c:\Users\KrishnavamsiGurajala\.gemini\antigravity\scratch\watch-together\frontend\src\Profile.jsx',
    r'c:\Users\KrishnavamsiGurajala\.gemini\antigravity\scratch\watch-together\frontend\src\PublicRooms.jsx',
    r'c:\Users\KrishnavamsiGurajala\.gemini\antigravity\scratch\watch-together\frontend\src\AppSettings.jsx'
]

for f in files:
    try:
        b, p = check_jsx_balance(f)
        print(f"{os.path.basename(f)}: Braces={b}, Parens={p}")
    except Exception as e:
        print(f"Error checking {f}: {e}")
