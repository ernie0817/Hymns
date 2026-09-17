const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/processed/hymns.json', 'utf8'));

const cleanLyrics = (rawText) => {
    return rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !/^[A-Ga-g](#|b|♭)?\s*(大調|小調)/i.test(line))
      .filter(line => !/^(大本詩|詩歌|補充本|新歌頌詠|新詩|兒童詩歌)\s*\d+/i.test(line))
      .filter(line => {
        const hasChinese = /[\u4e00-\u9fa5]/.test(line);
        const lineWithoutMarks = line.replace(/(FINE|D\.C\.|D\.S\.|I|V|D.C)/gi, '');
        const hasEnglish = /[a-zA-Z]{2,}/.test(lineWithoutMarks);
        if (!hasChinese && !hasEnglish) {
          return false;
        }
        return true;
      })
      .map(line => line.replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1'))
      .map(line => {
        let cleaned = line.replace(/^[○◎●]\s*副?\s*/, '(副) ');
        cleaned = cleaned.replace(/^[○◎●]\s*(?=[^\s])/, '(副) ');
        cleaned = cleaned.replace(/^[∥|︱:：\s○◎●]+/, '');
        cleaned = cleaned.replace(/[∥|︱:：\s]+$/, '');
        cleaned = cleaned.replace(/\s*(FINE|D\.C\.|D\.S\.)\s*$/i, '');
        return cleaned;
      })
      .join('\n');
  };

console.log('=== TEST 1 ===');
console.log(cleanLyrics(data.items.find(h => h.id === '188').lyrics));
console.log('=== TEST 2 ===');
console.log(cleanLyrics(data.items.find(h => h.id === '117').lyrics));
console.log('=== TEST 3 ===');
console.log(cleanLyrics(data.items.find(h => h.id === '1').lyrics));
