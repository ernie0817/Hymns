import { cleanLyrics } from './lyricsHelper';

describe('cleanLyrics', () => {
  it('should remove music chords and empty lines', () => {
    const raw = `
A大調 4/4
這是第一句歌詞
    
２ ３ ４ ５ ︱ １ － － － ∥
    `;
    const result = cleanLyrics(raw);
    expect(result).toBe('這是第一句歌詞');
  });

  it('should format paragraphs correctly', () => {
    const raw = `
一、第一節歌詞
二、第二節歌詞
○副這是副歌
    `;
    const result = cleanLyrics(raw);
    expect(result).toBe('一、第一節歌詞\n\n二、第二節歌詞\n\n(副) 這是副歌');
  });

  it('should break lines at punctuation marks', () => {
    const raw = `我愛耶穌，祂也愛我。`;
    const result = cleanLyrics(raw);
    expect(result).toBe('我愛耶穌，\n祂也愛我。');
  });
});