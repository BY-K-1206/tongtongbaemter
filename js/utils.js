/* ==========================================================================
   AppUtils — format / escape / normalize helpers
   ========================================================================== */

window.AppUtils = (function () {
  'use strict';

  function decodeHtmlEntities(text) {
    const el = window.document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeWord(word) {
    return (word || '').toLowerCase().replace(/[.,!?;:"'\u201c\u201d\u2018\u2019]/g, '');
  }

  // Too common to be useful in "자주 틀린 단어" rankings ONLY.
  // Do NOT use this set when grading word boxes during study.
  const MISTAKE_STOPWORDS = new Set([
    'a', 'an', 'the',
    'what', 'who', 'whom', 'whose', 'which', 'where', 'when', 'why', 'how',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
    'do', 'does', 'did', 'have', 'has', 'had',
    'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as',
    'and', 'or', 'but', 'if', 'so', 'not', 'no', 'yes',
    'this', 'that', 'these', 'those', 'there', 'here',
  ]);

  function isMistakeStopword(word) {
    const n = normalizeWord(word);
    return !n || MISTAKE_STOPWORDS.has(n);
  }

  /** Exact token match for study grading. Articles/function words are NOT skipped. */
  function evaluateWordBoxes(tokens, boxes) {
    let correctCount = 0;
    const results = boxes.map((box, i) => {
      const isCorrect = normalizeWord(box.value) === normalizeWord(tokens[i]);
      if (isCorrect) correctCount++;
      return isCorrect;
    });
    return { results, correctCount, total: tokens.length };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}\ubd84 ${seconds}\ucd08` : `${seconds}\ucd08`;
  }

  /** Session elapsed: entry → finish (e.g. 1시간 2분 3초). */
  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
    if (minutes > 0) return `${minutes}분 ${seconds}초`;
    return `${seconds}초`;
  }

  /** Compact part-circle time (e.g. 2:35, 1시간 2분). */
  function formatCompactDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
    return `0:${String(seconds).padStart(2, '0')}`;
  }

  function formatStudyDuration(ms) {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    // Compact, single-line friendly (avoid "1시간 / 5분" wraps).
    if (hours > 0) return `${hours}시간${minutes ? ` ${minutes}분` : ''}`;
    if (minutes > 0) return `${minutes}분`;
    return '1분 미만';
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Kakao-style chat stamp: date on one line, 오전/오후 time on the next. */
  function formatChatStamp(ts) {
    const d = new Date(ts || Date.now());
    if (Number.isNaN(d.getTime())) {
      return { date: '', time: '' };
    }
    const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.`;
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours < 12 ? '오전' : '오후';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return { date, time: `${period} ${hours}:${minutes}` };
  }

  function generateAutoTitle(text) {
    const firstLine = text.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
    const snippet = firstLine.length > 30 ? `${firstLine.slice(0, 30)}...` : firstLine;
    return snippet || '\uc81c\ubaa9 \uc5c6\ub294 \uc9c0\ubb38';
  }

  function activityLevel(count) {
    if (count <= 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  }

  return {
    decodeHtmlEntities,
    sleep,
    normalizeWord,
    isMistakeStopword,
    evaluateWordBoxes,
    escapeHtml,
    formatDuration,
    formatElapsed,
    formatCompactDuration,
    formatStudyDuration,
    formatDate,
    formatChatStamp,
    generateAutoTitle,
    activityLevel,
  };
})();
