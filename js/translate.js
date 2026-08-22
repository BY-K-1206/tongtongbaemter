/* ==========================================================================
   AppTranslate — multi-provider translation (MyMemory / OpenAI / Claude / compatible)
   + Korean→English document build
   LLM providers: batch translate in one request (order-aligned, no numbering).
   MyMemory: one sentence at a time.
   ========================================================================== */

window.AppTranslate = (function () {
  'use strict';

  const LLM_PROVIDERS = ['openai', 'openai-compatible', 'anthropic', 'gemini'];

  let lastError = '';

  function getTranslateLimits() {
    return (window.AppDomain && window.AppDomain.TRANSLATE_LIMITS) || {
      topicMaxChars: 40,
      passageMaxChars: 6000,
      batchMaxChars: 2500,
      batchMaxSentences: 20,
    };
  }

  function splitBatchChunks(list) {
    const limits = getTranslateLimits();
    const maxSentences = Math.max(1, limits.batchMaxSentences || 20);
    const maxChars = Math.max(400, limits.batchMaxChars || 2500);
    const chunks = [];
    let current = [];
    let currentChars = 0;

    list.forEach((text) => {
      const len = String(text || '').length;
      const wouldExceed = current.length > 0
        && (current.length >= maxSentences || currentChars + len > maxChars);
      if (wouldExceed) {
        chunks.push(current);
        current = [];
        currentChars = 0;
      }
      current.push(text);
      currentChars += len;
    });
    if (current.length) chunks.push(current);
    return chunks;
  }

  function setLastError(message) {
    lastError = String(message || '').trim();
  }

  function getLastError() {
    return lastError;
  }

  function langLabel(code) {
    if (code === 'ko') return 'Korean';
    if (code === 'en') return 'English';
    return code;
  }

  function isLlmProvider(provider) {
    return LLM_PROVIDERS.includes(provider);
  }

  function resolveBaseUrl(providerId, settings) {
    const defaults = (window.AppDomain && window.AppDomain.TRANSLATE_PROVIDER_DEFAULTS
      && window.AppDomain.TRANSLATE_PROVIDER_DEFAULTS[providerId]) || {};
    // Custom endpoint only for openai-compatible; others use built-in defaults.
    if (providerId === 'openai-compatible') {
      return String((settings && settings.baseUrl) || '').trim().replace(/\/+$/, '');
    }
    return String(defaults.baseUrl || '').trim().replace(/\/+$/, '');
  }

  function buildTranslatePrompt(text, fromLang, toLang) {
    return [
      `Translate the following text from ${langLabel(fromLang)} to ${langLabel(toLang)}.`,
      'Return only the translation text. No quotes, no explanation, no markdown.',
      '',
      text,
    ].join('\n');
  }

  function batchSystemInstruction(count, fromLang, toLang, guidance) {
    const parts = [
      `You are a precise bilingual translator (${langLabel(fromLang)} → ${langLabel(toLang)}).`,
      `You will receive exactly ${count} source sentences, one per line.`,
      `Return exactly ${count} translated sentences, one per line, in the same order.`,
      'Line i of your reply must be the translation of line i of the input.',
      'Do not number lines. Do not merge, split, add, or omit sentences.',
      'No quotes, no bullets, no explanation, no markdown fences.',
    ];
    const hint = window.AppDomain && window.AppDomain.translateGuidancePromptText
      ? window.AppDomain.translateGuidancePromptText(guidance)
      : '';
    if (hint) parts.push(hint);
    return parts.join(' ');
  }

  function singleSystemInstruction(fromLang, toLang, guidance) {
    const parts = [
      `You are a precise bilingual translator (${langLabel(fromLang)} → ${langLabel(toLang)}).`,
      'Return only the translation text. No quotes, no explanation, no markdown.',
    ];
    const hint = window.AppDomain && window.AppDomain.translateGuidancePromptText
      ? window.AppDomain.translateGuidancePromptText(guidance)
      : '';
    if (hint) parts.push(hint);
    return parts.join(' ');
  }

  function buildBatchTranslatePrompt(texts) {
    const body = texts.map((t) => String(t || '').trim().replace(/\s*\n+\s*/g, ' ')).join('\n');
    return `Source sentences:\n${body}`;
  }

  function extractTranslatedText(raw) {
    let text = String(raw || '').trim();
    if (!text) return '';
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    return window.AppUtils.decodeHtmlEntities(text);
  }

  /** Parse batch LLM reply by line order so index i maps to source sentence i. */
  function parseBatchTranslations(raw, expectedCount) {
    const text = extractTranslatedText(raw);
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim().replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean);

    const out = new Array(expectedCount).fill(null);
    const take = Math.min(lines.length, expectedCount);
    for (let i = 0; i < take; i++) {
      out[i] = lines[i] || null;
    }
    return out;
  }

  async function getSettings() {
    return window.AppStorage.getTranslateSettings();
  }

  async function translateMyMemory(text, fromLang, toLang) {
    const pair = `${fromLang}|${toLang}`;
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`
    );
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = await res.json();
    const translated = data && data.responseData && data.responseData.translatedText;
    if (!translated) throw new Error('empty translation');
    return window.AppUtils.decodeHtmlEntities(translated);
  }

  async function callOpenAICompatible(prompt, settings, options) {
    const baseUrl = resolveBaseUrl(
      settings.provider === 'openai-compatible' ? 'openai-compatible' : 'openai',
      settings
    );
    const apiKey = settings.apiKey || '';
    const model = settings.model || '';
    if (!baseUrl) throw new Error('API 주소가 필요해요');
    if (!apiKey) throw new Error('API 키가 필요해요');
    if (!model) throw new Error('모델명이 필요해요');

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: (options && options.system)
              || 'You are a precise bilingual translator. Follow the output format exactly.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI 호환 API HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }

    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      && data.choices[0].message.content;
    const translated = extractTranslatedText(content);
    if (!translated) throw new Error('empty translation');
    return translated;
  }

  async function callAnthropic(prompt, settings, options) {
    const baseUrl = resolveBaseUrl('anthropic', settings) || 'https://api.anthropic.com';
    const apiKey = settings.apiKey || '';
    const model = settings.model || 'claude-haiku-4-5';
    const maxTokens = (options && options.maxTokens) || 1024;
    if (!apiKey) throw new Error('API 키가 필요해요');

    const payload = {
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    };
    if (options && options.system) {
      payload.system = options.system;
    }

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Claude API HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }

    const data = await res.json();
    const blocks = (data && data.content) || [];
    const textBlock = blocks.find((b) => b && b.type === 'text');
    const translated = extractTranslatedText(textBlock && textBlock.text);
    if (!translated) throw new Error('empty translation');
    return translated;
  }

  async function callGemini(prompt, settings, options) {
    const baseUrl = resolveBaseUrl('gemini', settings) || 'https://generativelanguage.googleapis.com';
    const apiKey = settings.apiKey || '';
    const model = settings.model || 'gemini-2.0-flash';
    if (!apiKey) throw new Error('API 키가 필요해요');
    if (!model) throw new Error('모델명이 필요해요');

    const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    };
    if (options && options.system) {
      payload.systemInstruction = { parts: [{ text: options.system }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }

    const data = await res.json();
    const parts = data
      && data.candidates
      && data.candidates[0]
      && data.candidates[0].content
      && data.candidates[0].content.parts;
    const textPart = Array.isArray(parts)
      ? parts.map((p) => (p && p.text) || '').join('')
      : '';
    const translated = extractTranslatedText(textPart);
    if (!translated) throw new Error('empty translation');
    return translated;
  }

  async function callLlmProvider(prompt, settings, options) {
    const provider = settings.provider || 'mymemory';
    if (provider === 'openai' || provider === 'openai-compatible') {
      return callOpenAICompatible(prompt, settings, options);
    }
    if (provider === 'anthropic') {
      return callAnthropic(prompt, settings, options);
    }
    if (provider === 'gemini') {
      return callGemini(prompt, settings, options);
    }
    throw new Error(`알 수 없는 번역 제공자: ${provider}`);
  }

  async function translateText(text, fromLang, toLang, guidance) {
    const clean = String(text || '').trim();
    if (!clean) {
      setLastError('번역할 텍스트가 비어 있어요');
      return null;
    }

    try {
      const settings = await getSettings();
      const provider = settings.provider || 'mymemory';
      let result = null;

      if (provider === 'mymemory') {
        result = await translateMyMemory(clean, fromLang, toLang);
      } else if (isLlmProvider(provider)) {
        const system = singleSystemInstruction(fromLang, toLang, guidance);
        result = await callLlmProvider(
          buildTranslatePrompt(clean, fromLang, toLang),
          settings,
          { system }
        );
      } else {
        throw new Error(`알 수 없는 번역 제공자: ${provider}`);
      }

      setLastError('');
      return result;
    } catch (err) {
      const message = (err && err.message) || '번역에 실패했어요';
      if (/Failed to fetch|NetworkError|CORS/i.test(message)) {
        setLastError(
          '브라우저에서 API 호출이 막혔어요. Claude·Gemini는 브라우저 직접 호출이 되는 편이고, '
          + 'OpenAI는 CORS 때문에 「OpenAI 호환」+ 프록시 주소가 필요할 수 있어요.'
        );
      } else {
        setLastError(message);
      }
      return null;
    }
  }

  async function translateTextsBatch(texts, fromLang, toLang, guidance) {
    const list = (texts || []).map((t) => String(t || '').trim());
    if (!list.length) return [];

    const settings = await getSettings();
    const provider = settings.provider || 'mymemory';

    if (!isLlmProvider(provider)) {
      const out = [];
      const delay = provider === 'mymemory' ? 400 : 120;
      for (let i = 0; i < list.length; i++) {
        out.push(await translateText(list[i], fromLang, toLang, guidance));
        if (i < list.length - 1) await window.AppUtils.sleep(delay);
      }
      return out;
    }

    try {
      const results = new Array(list.length).fill(null);
      const chunks = splitBatchChunks(list);
      let offset = 0;
      for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];
        const system = batchSystemInstruction(chunk.length, fromLang, toLang, guidance);
        const prompt = buildBatchTranslatePrompt(chunk);
        const maxTokens = Math.min(8192, Math.max(1024, chunk.length * 180));
        const raw = await callLlmProvider(prompt, settings, { maxTokens, system });
        const parsed = parseBatchTranslations(raw, chunk.length);
        parsed.forEach((value, i) => {
          results[offset + i] = value || null;
        });
        offset += chunk.length;
      }
      setLastError('');
      return results;
    } catch (err) {
      const message = (err && err.message) || '번역에 실패했어요';
      if (/Failed to fetch|NetworkError|CORS/i.test(message)) {
        setLastError(
          '브라우저에서 API 호출이 막혔어요. Claude·Gemini는 브라우저 직접 호출이 되는 편이고, '
          + 'OpenAI는 CORS 때문에 「OpenAI 호환」+ 프록시 주소가 필요할 수 있어요.'
        );
      } else {
        setLastError(message);
      }
      return list.map(() => null);
    }
  }

  async function translateSentence(sentence, onUpdated, guidance) {
    sentence.translationStatus = 'loading';
    const translated = await translateText(sentence.originalText, 'en', 'ko', guidance);
    if (translated) {
      sentence.koTranslation = translated;
      sentence.translationStatus = 'done';
    } else {
      sentence.translationStatus = 'error';
    }
    if (typeof onUpdated === 'function') onUpdated(sentence);
  }

  async function queueDelayMs() {
    const settings = await getSettings();
    return settings.provider === 'mymemory' ? 400 : 120;
  }

  async function translateAllSentencesQueued(sentences, onUpdated, guidance) {
    if (!sentences || !sentences.length) return;

    const settings = await getSettings();
    if (isLlmProvider(settings.provider)) {
      sentences.forEach((s) => {
        s.translationStatus = 'loading';
        if (typeof onUpdated === 'function') onUpdated(s);
      });
      const texts = sentences.map((s) => s.originalText || '');
      const translated = await translateTextsBatch(texts, 'en', 'ko', guidance);
      sentences.forEach((sentence, i) => {
        const value = translated[i];
        if (value) {
          sentence.koTranslation = value;
          sentence.translationStatus = 'done';
        } else {
          sentence.translationStatus = 'error';
        }
        if (typeof onUpdated === 'function') onUpdated(sentence);
      });
      return;
    }

    const delay = await queueDelayMs();
    for (const sentence of sentences) {
      await translateSentence(sentence, onUpdated, guidance);
      await window.AppUtils.sleep(delay);
    }
  }

  async function translateKoToEn(text, guidance) {
    return translateText(text, 'ko', 'en', guidance);
  }

  // Registering a Korean passage: split Korean first, then translate.
  // LLM = one order-aligned batch request; MyMemory = per-sentence.
  async function buildEnglishSentencesFromKorean(rawText, onProgress, guidance) {
    const koList = window.AppParse.parseKoreanSentenceList(rawText);
    const settings = await getSettings();

    if (isLlmProvider(settings.provider) && window.AppDomain.isPassageOverTranslateLimit(rawText)) {
      const max = window.AppDomain.TRANSLATE_LIMITS.passageMaxChars;
      const used = window.AppDomain.countPassageChars(rawText);
      setLastError(`LLM 번역은 지문 ${max.toLocaleString('ko-KR')}자까지예요. 지금 ${used.toLocaleString('ko-KR')}자라서 조금 줄여 주세요.`);
      return [];
    }

    if (isLlmProvider(settings.provider) && koList.length) {
      if (onProgress) onProgress(0, koList.length);
      const koTexts = koList.map((item) => item.koText);
      const enList = await translateTextsBatch(koTexts, 'ko', 'en', guidance);
      const sentences = koList.map((item, i) => {
        const en = enList[i];
        const originalText = en || item.koText;
        return {
          id: i,
          paragraphIndex: item.paragraphIndex,
          originalText,
          firstLetterText: window.AppParse.generateFirstLetterHint(originalText),
          wordCount: window.AppParse.countWords(originalText),
          koTranslation: item.koText,
          translationStatus: en ? 'done' : 'error',
        };
      });
      if (onProgress) onProgress(koList.length, koList.length);
      return sentences;
    }

    const sentences = [];
    let id = 0;
    const delay = await queueDelayMs();

    for (let i = 0; i < koList.length; i++) {
      const { paragraphIndex, koText } = koList[i];
      const en = await translateKoToEn(koText, guidance);
      const originalText = en || koText;

      sentences.push({
        id: id++,
        paragraphIndex,
        originalText,
        firstLetterText: window.AppParse.generateFirstLetterHint(originalText),
        wordCount: window.AppParse.countWords(originalText),
        koTranslation: koText,
        translationStatus: en ? 'done' : 'error',
      });

      if (onProgress) onProgress(i + 1, koList.length);
      await window.AppUtils.sleep(delay);
    }

    return sentences;
  }

  async function testTranslation() {
    const sample = 'Hello, how are you?';
    const translated = await translateText(sample, 'en', 'ko');
    if (!translated) {
      return { ok: false, sample, translated: null, error: getLastError() || '번역 실패' };
    }
    return { ok: true, sample, translated, error: '' };
  }

  return {
    translateSentence,
    translateAllSentencesQueued,
    translateTextsBatch,
    translateKoToEn,
    translateText,
    buildEnglishSentencesFromKorean,
    testTranslation,
    getLastError,
    isLlmProvider,
  };
})();
