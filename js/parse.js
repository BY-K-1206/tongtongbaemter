/* ==========================================================================
   AppParse — English / Korean sentence parsing + hints
   ========================================================================== */

window.AppParse = (function () {
  'use strict';

  /** Soft cap for a single study unit (word-boxes stay readable). */
  const STUDY_CHUNK_MAX_CHARS = 120;

  const ABBREVIATIONS = [
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.', 'St.',
    'vs.', 'etc.', 'e.g.', 'i.e.', 'U.S.', 'U.K.', 'U.N.',
    'Inc.', 'Ltd.', 'Co.', 'Gen.', 'Rep.', 'Sen.', 'No.', 'Fig.', 'approx.',
  ];

  function splitIntoSentences(paragraph) {
    const placeholders = [];
    const abbrPattern = new RegExp(
      ABBREVIATIONS.map((a) => a.replace(/\./g, '\\.')).join('|'),
      'g'
    );
    const protectedText = paragraph.replace(abbrPattern, (match) => {
      placeholders.push(match);
      // Placeholder must start with an uppercase letter (no punctuation/underscore)
      // so it doesn't break the sentence-boundary lookbehind/lookahead below.
      return `ZZZABBR${placeholders.length - 1}ZZZ`;
    });

    // Split on sentence-ending punctuation, tolerating an optional trailing
    // quote mark, and requiring the next sentence to start with a capital
    // letter, digit, or quote character.
    const rawSentences = protectedText.split(
      /(?<=[.?!]["'\u201d\u2019]?)\s+(?=[A-Z0-9"'\u201c\u2018])/
    );

    return rawSentences
      .map((s) => s.replace(/ZZZABBR(\d+)ZZZ/g, (_, idx) => placeholders[Number(idx)]))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function getWordTokens(text) {
    return text.split(/\s+/).filter(Boolean);
  }

  function countWords(sentence) {
    return getWordTokens(sentence).length;
  }

  /**
   * Step-2 placeholder: keep the first letter of each alphanumeric segment,
   * mask the rest with "_", and leave internal punctuation (- / .) visible.
   * e.g. three-year-old → t____-y___-o__  |  he/she → h_/s__  |  "Hello," → "H____,"
   */
  function hintForToken(token) {
    const raw = String(token || '');
    if (!raw) return raw;

    let out = '';
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (/[A-Za-z0-9']/.test(ch)) {
        out += ch;
        i += 1;
        while (i < raw.length && /[A-Za-z0-9']/.test(raw[i])) {
          out += '_';
          i += 1;
        }
      } else {
        out += ch;
        i += 1;
      }
    }
    return out;
  }

  function generateFirstLetterHint(sentence) {
    return getWordTokens(sentence).map(hintForToken).join(' ');
  }

  /**
   * Split an oversized sentence at a natural pause (semicolon, colon, comma,
   * dash, or space) so study UI word-boxes stay manageable.
   */
  function chunkLongText(text, maxChars) {
    const max = Math.max(40, Number(maxChars) || STUDY_CHUNK_MAX_CHARS);
    let remaining = String(text || '').replace(/\s+/g, ' ').trim();
    if (!remaining) return [];
    if (remaining.length <= max) return [remaining];

    const chunks = [];
    const separators = ['; ', ': ', ', ', '、', '，', ' - ', ' – ', ' — ', ' '];

    while (remaining.length > max) {
      const window = remaining.slice(0, max);
      let breakAt = -1;
      for (let i = 0; i < separators.length; i++) {
        const sep = separators[i];
        const idx = window.lastIndexOf(sep);
        if (idx >= Math.floor(max * 0.35)) {
          breakAt = idx + sep.length;
          break;
        }
      }
      if (breakAt <= 0) breakAt = max;
      const piece = remaining.slice(0, breakAt).trim();
      if (piece) chunks.push(piece);
      remaining = remaining.slice(breakAt).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  function parseDocument(rawText) {
    // Blank lines = paragraph breaks. Single newlines also keep line units so
    // one-sentence-per-line pastes count correctly (not merged into one blob).
    const paragraphs = String(rawText || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const sentences = [];
    let id = 0;

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = paragraph.split(/\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
      lines.forEach((line) => {
        splitIntoSentences(line).forEach((text) => {
          chunkLongText(text, STUDY_CHUNK_MAX_CHARS).forEach((chunk) => {
            sentences.push({
              id: id++,
              paragraphIndex,
              originalText: chunk,
              firstLetterText: generateFirstLetterHint(chunk),
              wordCount: countWords(chunk),
              koTranslation: null,
              translationStatus: 'idle',
            });
          });
        });
      });
    });

    const totalWordCount = sentences.reduce((sum, s) => sum + s.wordCount, 0);

    return {
      rawText,
      sentences,
      totalWordCount,
      paragraphCount: paragraphs.length,
    };
  }

  // Korean source text doesn't need the English abbreviation/uppercase
  // lookahead protections above, so it gets its own lightweight splitter.
  function splitKoreanIntoSentences(paragraph) {
    return paragraph
      .split(/(?<=[.!?\u3002\uff01\uff1f])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function parseKoreanSentenceList(rawText) {
    const paragraphs = String(rawText || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const list = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = paragraph.split(/\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
      lines.forEach((line) => {
        const parts = splitKoreanIntoSentences(line);
        const units = parts.length ? parts : [line];
        units.forEach((koText) => {
          chunkLongText(koText, STUDY_CHUNK_MAX_CHARS).forEach((chunk) => {
            list.push({ paragraphIndex, koText: chunk });
          });
        });
      });
    });
    return list;
  }

  return {
    STUDY_CHUNK_MAX_CHARS,
    splitIntoSentences,
    getWordTokens,
    countWords,
    hintForToken,
    generateFirstLetterHint,
    chunkLongText,
    parseDocument,
    splitKoreanIntoSentences,
    parseKoreanSentenceList,
  };
})();
