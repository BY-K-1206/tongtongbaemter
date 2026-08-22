/* ==========================================================================
   AppDomain — pure domain logic (no I/O)
   Difficulty, normalize, filter/sort, streak, attempt ranking helpers.
   ========================================================================== */

window.AppDomain = (function () {
  'use strict';

  function dateKey(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // score = wordCount * 0.5 + avgWordLen * 12 + sentenceCount * 3
  // level: <45 → 1(쉬움), <90 → 2(보통), else 3(어려움)
  function computeDifficultyFromEnglishText(englishText, sentenceCountHint) {
    const text = (englishText || '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    let letterSum = 0;
    words.forEach((w) => {
      letterSum += (w.match(/[A-Za-z]/g) || []).length;
    });
    const avgWordLen = wordCount ? letterSum / wordCount : 0;
    const sentenceCount = sentenceCountHint != null
      ? sentenceCountHint
      : (text.match(/[.?!]+/g) || []).length || (wordCount ? 1 : 0);
    const score = wordCount * 0.5 + avgWordLen * 12 + sentenceCount * 3;
    let level = 3;
    if (score < 45) level = 1;
    else if (score < 90) level = 2;
    return {
      difficultyScore: Math.round(score * 10) / 10,
      difficultyLevel: level,
    };
  }

  function difficultyLabel(level) {
    if (level === 1) return '쉬움';
    if (level === 2) return '보통';
    return '어려움';
  }

  function clampDifficultyStars(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return 3;
    return Math.max(1, Math.min(5, n));
  }

  // Keep legacy 1–3 level for badge colors / older data.
  function starsToDifficultyLevel(stars) {
    const s = clampDifficultyStars(stars);
    if (s <= 2) return 1;
    if (s === 3) return 2;
    return 3;
  }

  function levelToDifficultyStars(level) {
    const lv = Math.floor(Number(level));
    if (lv === 1) return 2;
    if (lv === 3) return 5;
    return 3;
  }

  function difficultyStarsLabel(stars) {
    const s = clampDifficultyStars(stars);
    return `${'★'.repeat(s)}${'☆'.repeat(5 - s)}`;
  }

  // Backfill tags/difficulty/sentencesPerDay for older documents.
  function normalizeDocument(doc) {
    if (!doc) return null;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    let difficultyScore = doc.difficultyScore;
    let difficultyLevel = doc.difficultyLevel;
    let difficultyStars = doc.difficultyStars;

    if (difficultyStars != null) {
      difficultyStars = clampDifficultyStars(difficultyStars);
      difficultyLevel = starsToDifficultyLevel(difficultyStars);
      difficultyScore = difficultyStars;
    } else if (difficultyScore == null || difficultyLevel == null) {
      let englishText = doc.rawText || '';
      if (doc.sourceLang === 'ko' && Array.isArray(doc.cachedSentences)) {
        englishText = doc.cachedSentences.map((s) => s.originalText || s).join(' ');
      }
      const computed = computeDifficultyFromEnglishText(englishText, doc.sentenceCount);
      difficultyScore = computed.difficultyScore;
      difficultyLevel = computed.difficultyLevel;
      difficultyStars = levelToDifficultyStars(difficultyLevel);
    } else {
      difficultyStars = levelToDifficultyStars(difficultyLevel);
    }

    const perDay = Number(doc.sentencesPerDay);
    const sentencesPerDay = Number.isFinite(perDay) && perDay >= 1 ? Math.floor(perDay) : 3;
    return Object.assign({}, doc, {
      tags,
      difficultyScore,
      difficultyLevel,
      difficultyStars,
      sentencesPerDay,
      translateGuidance: normalizeTranslateGuidance(doc.translateGuidance),
    });
  }

  // Short UI labels (dropdown / bubble meta).
  const TRANSLATE_TONE_OPTIONS = {
    natural: '자연스러운 구어체',
    formal: '격식 있는 문어체',
    news: '뉴스·시사 톤',
    simple: '쉽고 친절한 학습용',
    literary: '문학·서정적',
    business: '비즈니스·공식',
    genz: 'Gen-Z Chat',
    rap: 'Rap/Hype',
    royal: 'Royal/Shakespeare',
    victorian: 'Victorian scholar',
    tsundere: 'Anime Tsundere',
  };

  // Compact but strong voice briefs for the LLM (must stay distinguishable).
  const TRANSLATE_TONE_PROMPTS = {
    natural: 'Warm everyday spoken Korean/English; contractions OK; no slang overload.',
    formal: 'Stiff written prose; full forms; no slang; polished and distant.',
    news: 'Neutral news-anchor diction; factual, clipped, third-person feel.',
    simple: 'Very plain beginner-friendly wording; short words; gentle tutor voice.',
    literary: 'Poetic, sensory, slightly elevated diction; soft imagery.',
    business: 'Corporate email voice; crisp, professional, no fluff.',
    genz: 'HARD Gen-Z chat voice: lowercase, abbreviations (idk/tbh/fr/ngl/lowkey), meme cadence. Example vibe: "idk tbh fr ngl lowkey tired rn".',
    rap: 'HARD hip-hop hype: slang, swagger, interjections (yo/no cap/flex). Example vibe: "Yo check the vibe we flexin tonight no cap".',
    royal: 'HARD archaic court speech: thee/thou/shall/pray tell; regal and ornate. Example vibe: "Pray tell, my lord, shall we part with these coins?"',
    victorian: 'HARD old-fashioned scholar: Alas/indeed/dreadful; formal literary English. Example vibe: "Alas! What a dreadful state of affairs this is."',
    tsundere: 'HARD classic tsundere ONLY: NEVER sound sweet, soft, or openly affectionate. Do NOT say "I like you" / "I love you" / "let\'s date" plainly. Hide feelings behind denial, scoffing (hmph/tch), insults like baka, and reluctant maybe-concessions. Pattern: reject first → grudging offer → call them idiot. Example vibe: "H-hmph! It\'s not like I like you or anything… but I guess I could date you. Don\'t get the wrong idea, baka!" Bad (forbidden): "I really like you, so let\'s date… if you want, I guess."',
  };

  /** Soft caps so LLM prompts stay token-light. */
  const TRANSLATE_LIMITS = {
    topicMaxChars: 40,
    passageMaxChars: 6000,
    batchMaxChars: 2500,
    batchMaxSentences: 20,
  };

  function normalizeTranslateGuidance(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const tone = TRANSLATE_TONE_OPTIONS[src.tone] ? src.tone : '';
    const maxTopic = TRANSLATE_LIMITS.topicMaxChars;
    let topic = String(src.topic || '').trim().replace(/\s+/g, ' ');
    if (topic.length > maxTopic) topic = topic.slice(0, maxTopic).trim();
    return { tone, topic };
  }

  function translateGuidancePromptText(guidance) {
    const g = normalizeTranslateGuidance(guidance);
    if (!g.tone && !g.topic) return '';

    const parts = [];
    if (g.tone && TRANSLATE_TONE_PROMPTS[g.tone]) {
      parts.push(
        `VOICE="${TRANSLATE_TONE_OPTIONS[g.tone]}": ${TRANSLATE_TONE_PROMPTS[g.tone]} `
        + 'Apply this persona to EVERY target-language line. '
        + 'Commit hard; exaggerate the register so tones are obviously different from each other. '
        + 'If target is Korean, use Korean equivalents of the same persona (attitude/register), not a flat textbook tone.'
      );
    }
    if (g.topic) {
      parts.push(`Context topic (style only): ${g.topic}.`);
    }
    parts.push('Never invent facts missing from the source; only restyle wording.');
    return parts.join(' ');
  }

  function countPassageChars(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().length;
  }

  function isPassageOverTranslateLimit(text) {
    return countPassageChars(text) > TRANSLATE_LIMITS.passageMaxChars;
  }

  /** Split a passage into day-steps. Each step: sentences [start, end) + boss of those sentences. */
  function buildMarks(sentenceCount, sentencesPerDay) {
    const total = Math.max(0, Number(sentenceCount) || 0);
    const perDay = Math.max(1, Math.floor(Number(sentencesPerDay) || 3));
    if (!total) return [];
    const marks = [];
    for (let start = 0; start < total; start += perDay) {
      const end = Math.min(start + perDay, total);
      marks.push({
        index: marks.length,
        start,
        end,
        sentenceCount: end - start,
      });
    }
    return marks;
  }

  function getMarkSentenceIndices(mark) {
    if (!mark) return [];
    const indices = [];
    for (let i = mark.start; i < mark.end; i++) indices.push(i);
    return indices;
  }

  function normalizeRoadmapProgress(progress) {
    const completed = progress && Array.isArray(progress.completedMarkIndices)
      ? progress.completedMarkIndices.map(Number).filter((n) => Number.isFinite(n) && n >= 0)
      : [];
    const rawDurations = progress && progress.markDurations && typeof progress.markDurations === 'object'
      ? progress.markDurations
      : {};
    const markDurations = {};
    Object.keys(rawDurations).forEach((key) => {
      const ms = Number(rawDurations[key]);
      if (Number.isFinite(ms) && ms >= 0) markDurations[String(key)] = ms;
    });
    return {
      completedMarkIndices: Array.from(new Set(completed)).sort((a, b) => a - b),
      markDurations,
      updatedAt: (progress && progress.updatedAt) || null,
    };
  }

  /** @returns {'locked'|'current'|'completed'} */
  function getMarkStatus(markIndex, completedMarkIndices) {
    const done = new Set(
      (completedMarkIndices || [])
        .map(Number)
        .filter((n) => Number.isFinite(n) && n >= 0)
    );
    const idx = Number(markIndex);
    if (!Number.isFinite(idx) || idx < 0) return 'locked';
    if (done.has(idx)) return 'completed';
    let current = 0;
    while (done.has(current)) current++;
    if (idx === current) return 'current';
    return 'locked';
  }

  function filterSortDocuments(docs, options) {
    const query = ((options && options.query) || '').trim().toLowerCase();
    const sort = (options && options.sort) || 'newest';
    let list = (docs || []).slice();

    if (query) {
      list = list.filter((doc) => {
        const titleHit = (doc.title || '').toLowerCase().includes(query);
        const tagHit = (doc.tags || []).some((t) => String(t).toLowerCase().includes(query));
        return titleHit || tagHit;
      });
    }

    list.sort((a, b) => {
      if (sort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sort === 'hardest') return (b.difficultyScore || 0) - (a.difficultyScore || 0);
      if (sort === 'easiest') return (a.difficultyScore || 0) - (b.difficultyScore || 0);
      return (b.createdAt || 0) - (a.createdAt || 0); // newest
    });
    return list;
  }

  function computeStreak(activityMap) {
    const activity = activityMap || {};
    const cursor = new Date();
    // If nothing logged yet today, don't break a streak that's still alive
    // from yesterday - start counting from yesterday instead.
    if (!activity[dateKey(cursor)]) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let streak = 0;
    while (activity[dateKey(cursor)] > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function attemptKind(attempt) {
    if (!attempt) return 'full';
    if (attempt.kind === 'mark' || attempt.kind === 'boss' || attempt.kind === 'single' || attempt.kind === 'full') {
      return attempt.kind;
    }
    return 'full';
  }

  function isRankableAttempt(attempt) {
    return attemptKind(attempt) === 'full';
  }

  function getTopAttempts(attempts, n) {
    return (attempts || [])
      .filter(isRankableAttempt)
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, n || 5);
  }

  function getDocumentBestAttempt(attempts) {
    const list = (attempts || []).filter(isRankableAttempt);
    if (!list.length) return null;
    return list.slice().sort((a, b) => a.durationMs - b.durationMs)[0];
  }

  function getDocumentRank(attempts, attemptId) {
    const ranked = (attempts || [])
      .filter(isRankableAttempt)
      .slice()
      .sort((a, b) => a.durationMs - b.durationMs);
    const index = ranked.findIndex((a) => a.id === attemptId);
    return index === -1 ? null : index + 1;
  }

  function attemptKindLabel(attempt) {
    const kind = attemptKind(attempt);
    if (kind === 'single') return '한문장 모드';
    return '지문 모드';
  }

  /** Stable learning-unit id for recent-activity upsert (sentence / part / full). */
  function buildAttemptSentenceId(attempt) {
    if (!attempt) return null;
    if (attempt.sentenceId) return String(attempt.sentenceId);
    const kind = attemptKind(attempt);
    if (kind === 'single') {
      const vaultId = attempt.documentId;
      return vaultId ? `single:${vaultId}` : null;
    }
    if (kind === 'mark' || kind === 'boss') {
      if (!attempt.documentId || attempt.markIndex == null || !Number.isFinite(Number(attempt.markIndex))) {
        return null;
      }
      return `${kind}:${attempt.documentId}:${Number(attempt.markIndex)}`;
    }
    if (kind === 'full' && attempt.documentId) {
      return `full:${attempt.documentId}`;
    }
    return null;
  }

  function truncateLabel(text, maxLen) {
    const raw = String(text || '').trim().replace(/\s+/g, ' ');
    const limit = maxLen || 36;
    if (raw.length <= limit) return raw;
    return `${raw.slice(0, limit)}…`;
  }

  function normalizeVaultSentence(item) {
    if (!item) return null;
    const status = item.status === 'memorized' ? 'memorized' : 'pending';
    const sourceLang = item.sourceLang === 'ko' ? 'ko' : 'en';
    return {
      id: item.id,
      enText: String(item.enText || '').trim(),
      koText: String(item.koText || '').trim(),
      sourceLang,
      status,
      translateGuidance: normalizeTranslateGuidance(item.translateGuidance),
      createdAt: item.createdAt || Date.now(),
      memorizedAt: status === 'memorized' ? (item.memorizedAt || null) : null,
      updatedAt: item.updatedAt || null,
    };
  }

  const TRANSLATE_PROVIDERS = ['mymemory', 'anthropic', 'openai', 'gemini', 'openai-compatible'];

  const TRANSLATE_PROVIDER_META = {
    mymemory: {
      label: 'MyMemory (무료)',
      hint: '무료 MyMemory API를 사용합니다. 별도 키가 필요 없어요.',
    },
    anthropic: {
      label: 'Claude',
      hint: 'Anthropic Messages API를 사용합니다. API 키만 넣으면 돼요. 키는 이 기기 localStorage에만 저장됩니다.',
    },
    openai: {
      label: 'ChatGPT (OpenAI)',
      hint: 'OpenAI Chat Completions를 사용합니다. API 키와 모델만 선택하세요. 브라우저 CORS로 막히면 「OpenAI 호환」을 쓰세요.',
    },
    gemini: {
      label: 'Gemini',
      hint: 'Google Gemini를 사용합니다. API 키만 넣으면 돼요. 키는 Google AI Studio에서 발급합니다.',
    },
    'openai-compatible': {
      label: 'OpenAI 호환',
      hint: 'OpenRouter, Groq, 로컬 프록시 등 OpenAI 호환 서비스용입니다. API 주소·모델·키를 입력하세요.',
    },
  };

  const TRANSLATE_PROVIDER_DEFAULTS = {
    mymemory: { model: '', baseUrl: '' },
    openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
    anthropic: { model: 'claude-haiku-4-5', baseUrl: 'https://api.anthropic.com' },
    gemini: { model: 'gemini-2.0-flash', baseUrl: 'https://generativelanguage.googleapis.com' },
    'openai-compatible': { model: '', baseUrl: '' },
  };

  const TRANSLATE_PROVIDER_MODELS = {
    mymemory: [],
    anthropic: [
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5 (빠름·저렴)' },
      { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5 (균형)' },
      { id: 'claude-opus-4-5', label: 'Opus 4.5 (고품질)' },
    ],
    openai: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (빠름·저렴)' },
      { id: 'gpt-4o', label: 'GPT-4o (균형)' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
    ],
    gemini: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (빠름)' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
    'openai-compatible': [],
  };

  const KEYED_TRANSLATE_PROVIDERS = TRANSLATE_PROVIDERS.filter((p) => p !== 'mymemory');

  function emptyProviderSlot(providerId) {
    const defaults = TRANSLATE_PROVIDER_DEFAULTS[providerId] || { model: '', baseUrl: '' };
    return {
      apiKey: '',
      model: defaults.model || '',
      baseUrl: defaults.baseUrl || '',
    };
  }

  function normalizeProviderSlot(providerId, rawSlot, legacy) {
    const defaults = TRANSLATE_PROVIDER_DEFAULTS[providerId] || { model: '', baseUrl: '' };
    const slot = rawSlot && typeof rawSlot === 'object' ? rawSlot : {};
    const legacyMatch = legacy && legacy.provider === providerId ? legacy : null;
    const apiKey = String(slot.apiKey != null ? slot.apiKey : (legacyMatch ? legacyMatch.apiKey : '') || '').trim();
    const modelRaw = slot.model != null
      ? slot.model
      : (legacyMatch && legacyMatch.model != null ? legacyMatch.model : defaults.model);
    const model = String(modelRaw || '').trim() || defaults.model || '';
    // Built-in providers always use the default API host; only openai-compatible is custom.
    let baseUrl = defaults.baseUrl || '';
    if (providerId === 'openai-compatible') {
      const baseRaw = slot.baseUrl != null
        ? slot.baseUrl
        : (legacyMatch && legacyMatch.baseUrl != null ? legacyMatch.baseUrl : '');
      baseUrl = String(baseRaw || '').trim().replace(/\/+$/, '');
    } else {
      baseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
    }
    return { apiKey, model, baseUrl };
  }

  function normalizeTranslateSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const provider = TRANSLATE_PROVIDERS.includes(src.provider) ? src.provider : 'mymemory';
    const legacy = {
      provider: TRANSLATE_PROVIDERS.includes(src.provider) ? src.provider : null,
      apiKey: String(src.apiKey || '').trim(),
      model: src.model,
      baseUrl: src.baseUrl,
    };

    const providers = {};
    KEYED_TRANSLATE_PROVIDERS.forEach((id) => {
      const fromMap = src.providers && typeof src.providers === 'object' ? src.providers[id] : null;
      providers[id] = normalizeProviderSlot(id, fromMap, legacy);
    });

    const active = provider === 'mymemory'
      ? emptyProviderSlot('mymemory')
      : (providers[provider] || emptyProviderSlot(provider));

    return {
      provider,
      apiKey: active.apiKey || '',
      model: active.model || '',
      baseUrl: active.baseUrl || '',
      providers,
    };
  }

  const DEFAULT_BOA_STATES = [
    { min: 0, name: '응애 보아' },
    { min: 31, name: '아기 보아' },
    { min: 61, name: '성장 보아' },
    { min: 91, name: '든든 보아' },
    { min: 121, name: '거대 보아' },
    { min: 151, name: '전설의 보아뱀' },
  ];

  function boaStateLabel(index, name) {
    return `티어 ${index + 1} · ${name}`;
  }

  function isBoaImageDataUrl(value) {
    return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
  }

  function normalizeBoaStates(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const count = DEFAULT_BOA_STATES.length;
    const rows = [];
    for (let i = 0; i < count; i++) {
      const def = DEFAULT_BOA_STATES[i];
      const src = list[i] && typeof list[i] === 'object' ? list[i] : {};
      const name = String(src.name != null ? src.name : def.name).trim() || def.name;
      let min = i === 0 ? 0 : Math.floor(Number(src.min));
      if (!Number.isFinite(min) || min < 0) min = def.min;
      rows.push({
        name,
        min,
        imageDataUrl: isBoaImageDataUrl(src.imageDataUrl) ? src.imageDataUrl : '',
      });
    }
    for (let i = 1; i < count; i++) {
      rows[i].min = Math.max(rows[i].min, rows[i - 1].min + 1);
    }
    return rows.map((row, i) => ({
      name: row.name,
      min: row.min,
      max: i === count - 1 ? Infinity : rows[i + 1].min - 1,
      label: boaStateLabel(i, row.name),
      imageDataUrl: row.imageDataUrl,
    }));
  }

  return {
    dateKey,
    computeDifficultyFromEnglishText,
    difficultyLabel,
    clampDifficultyStars,
    starsToDifficultyLevel,
    levelToDifficultyStars,
    difficultyStarsLabel,
    normalizeDocument,
    filterSortDocuments,
    computeStreak,
    attemptKind,
    isRankableAttempt,
    attemptKindLabel,
    buildAttemptSentenceId,
    truncateLabel,
    getTopAttempts,
    getDocumentBestAttempt,
    getDocumentRank,
    buildMarks,
    getMarkSentenceIndices,
    normalizeRoadmapProgress,
    getMarkStatus,
    normalizeVaultSentence,
    TRANSLATE_PROVIDERS,
    TRANSLATE_PROVIDER_META,
    TRANSLATE_PROVIDER_DEFAULTS,
    TRANSLATE_PROVIDER_MODELS,
    KEYED_TRANSLATE_PROVIDERS,
    TRANSLATE_TONE_OPTIONS,
    TRANSLATE_TONE_PROMPTS,
    TRANSLATE_LIMITS,
    normalizeTranslateSettings,
    normalizeTranslateGuidance,
    translateGuidancePromptText,
    countPassageChars,
    isPassageOverTranslateLimit,
    DEFAULT_BOA_STATES,
    normalizeBoaStates,
  };
})();
