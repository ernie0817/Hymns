export const cleanLyrics = (rawText: string) => {
  const parsedLines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !/^[A-Ga-g](#|b|♭)?\s*(大調|小調)/i.test(line))
    .filter(line => !/^(大本詩|詩歌|補充本|新歌頌詠|新詩|兒童詩歌)\s*\d+/i.test(line))
    .filter(line => {
      const hasChinese = /[\u4e00-\u9fa5]/.test(line);
      const lineWithoutMarks = line.replace(/(FINE|D\.C\.|D\.S\.|I|V)/gi, '');
      const hasEnglish = /[a-zA-Z]{2,}/.test(lineWithoutMarks);
      if (!hasChinese && !hasEnglish) return false;
      const chars = line.replace(/\s+/g, '');
      const pureMusicRegex = /^[0-9\-•︱∥╭╮()（）#♭b:：]+$/;
      if (pureMusicRegex.test(chars)) return false;
      return true;
    })
    .map(line => {
      let cleaned = line.replace(/[╭╮╰╯─_•︱∥│║#♭]/g, '');
      cleaned = cleaned.replace(/^[○◎●]\s*副?\s*/, '(副) ');
      cleaned = cleaned.replace(/^[○◎●]\s*(?=[^\s])/, '(副) ');
      cleaned = cleaned.replace(/^[∥|︱:：\s○◎●]+/, '');
      cleaned = cleaned.replace(/[∥|︱:：\s]+$/, '');
      cleaned = cleaned.replace(/\s*(FINE|D\.C\.|D\.S\.)\s*$/i, '');
      cleaned = cleaned.replace(/([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, '$1@@SPACE@@$2');
      cleaned = cleaned.replace(/\(副\)\s+/g, '(副)@@SPACE@@');
      cleaned = cleaned.replace(/\s+/g, '');
      cleaned = cleaned.replace(/@@SPACE@@/g, ' ');
      cleaned = cleaned.replace(/([，。；？！,;?!])/g, '$1\n');
      return cleaned;
    });

  const allLines = parsedLines
    .join('\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const resultLines: string[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const isNewStanza = /^(一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十)、/.test(line) || line.startsWith('(副)');
    if (isNewStanza && i > 0 && resultLines[resultLines.length - 1] !== '') {
      resultLines.push('');
    }
    resultLines.push(line);
  }
  return resultLines.join('\n');
};