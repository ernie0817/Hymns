import json
import re

with open('data/processed/hymns.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def clean(text):
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 2
        if re.match(r'^[A-Ga-g](#|b|♭)?\s*(大調|小調)', line):
            continue
        # 3
        if re.match(r'^(大本詩|詩歌|補充本|新歌頌詠|新詩|兒童詩歌)\s*\d+', line):
            continue
        # 4: filter music notation
        chars = re.sub(r'\s+', '', line)
        if re.match(r'^[0-9\-•︱\|│║∥╭╮╰╯()（）#♭b:：]+$', chars):
            continue
        # Let's also check for specific music strings
        if chars in ['FINE', 'D.C.', 'D.S.', '○', '', 'I', 'II', 'III', 'IV']:
            continue
        # If line only contains structural drawing lines
        if re.match(r'^[─╭╮╰╯]+$', chars):
            continue
        # Also remove if it's just dots
        if re.match(r'^[•\.]+$', chars):
            continue
            
        # some other strange things?
        if re.match(r'^[0-9\-•︱\|│║∥╭╮╰╯─#♭b]+(FINE|D\.C\.|D\.S\.)?.*$', chars) and not re.search(r'[\u4e00-\u9fa5a-zA-Z]', chars.replace('FINE', '').replace('D.C.', '')):
            pass # this logic might be better

        # Let's write a generic rule: if a line doesn't have any Chinese characters or regular English words (len > 1, not FINE/DC), it's probably notation.
        has_chinese = bool(re.search(r'[\u4e00-\u9fa5]', line))
        
        # English words excluding FINE, D.C.
        words = re.findall(r'[a-zA-Z]+', line)
        has_real_english = False
        for w in words:
            if w.upper() not in ['FINE', 'D', 'C', 'S', 'I', 'II', 'III', 'IV']:
                has_real_english = True
                
        if not has_chinese and not has_real_english:
            continue
            
        cleaned.append(line)
        
    return '\n'.join(cleaned)

for item in data['items'][:10]:
    print("=== ORIGINAL ===")
    print(item['lyrics'])
    print("=== CLEANED ===")
    print(clean(item['lyrics']))
