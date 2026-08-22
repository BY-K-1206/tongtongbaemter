/* ==========================================================================
   LocalStore — AppDataStore adapter (localStorage)
   ==========================================================================
   Implements every method in AppDataStore.METHODS (all async / Promise).
   Firebase / Supabase: copy this surface in store-firebase.js /
   store-supabase.js, then set window.__APP_STORE__ = createXStore(...) before
   storage.js. UI stays on AppStorage; no screen changes.
   ========================================================================== */

window.createLocalStore = function createLocalStore() {
  'use strict';

  const KEYS = {
    documents: 'earthsentence_documents_v1',
    attempts: 'earthsentence_attempts_v1',
    activity: 'earthsentence_activity_v1',
    duration: 'earthsentence_daily_duration_v1',
    wordMistakes: 'earthsentence_word_mistakes_v1',
    roadmapProgress: 'earthsentence_roadmap_progress_v1',
    sentenceVault: 'earthsentence_sentence_vault_v1',
    singleTranslateGuidance: 'earthsentence_single_translate_guidance_v1',
    dailyRetries: 'earthsentence_daily_retries_v1',
    dailyMemorizedRetries: 'earthsentence_daily_memorized_retries_v1',
    dailyWrites: 'earthsentence_daily_writes_v1',
    translateSettings: 'earthsentence_translate_settings_v1',
    boaStates: 'earthsentence_boa_states_v1',
  };

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Storage unavailable/full - fail silently, the session still works in memory.
    }
  }

  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function dateKey(date) {
    return window.AppDomain.dateKey(date);
  }

  async function listDocuments() {
    return readJSON(KEYS.documents, []).map(window.AppDomain.normalizeDocument);
  }

  async function getDocument(id) {
    const raw = readJSON(KEYS.documents, []).find((d) => d.id === id);
    return raw ? window.AppDomain.normalizeDocument(raw) : null;
  }

  async function saveDocument(doc) {
    const documents = readJSON(KEYS.documents, []);
    const Domain = window.AppDomain;
    let difficultyStars;
    let difficultyLevel;
    let difficultyScore;
    if (doc.difficultyStars != null) {
      difficultyStars = Domain.clampDifficultyStars(doc.difficultyStars);
      difficultyLevel = Domain.starsToDifficultyLevel(difficultyStars);
      difficultyScore = difficultyStars;
    } else if (doc.difficultyScore != null) {
      difficultyScore = doc.difficultyScore;
      difficultyLevel = doc.difficultyLevel || 2;
      difficultyStars = Domain.levelToDifficultyStars(difficultyLevel);
    } else {
      const computed = Domain.computeDifficultyFromEnglishText(doc.rawText, doc.sentenceCount);
      difficultyScore = computed.difficultyScore;
      difficultyLevel = computed.difficultyLevel;
      difficultyStars = Domain.levelToDifficultyStars(difficultyLevel);
    }
    const record = {
      id: generateId(),
      title: doc.title,
      rawText: doc.rawText,
      lang: doc.lang,
      rate: doc.rate,
      createdAt: Date.now(),
      sentenceCount: doc.sentenceCount,
      // 'en' (default) = raw text is already English, translated to Korean
      // lazily during study. 'ko' = raw text is Korean; cachedSentences holds
      // the sentences already translated to English at registration time so
      // studying never needs to re-translate.
      sourceLang: doc.sourceLang || 'en',
      cachedSentences: doc.sourceLang === 'ko' ? (doc.cachedSentences || []) : null,
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      difficultyScore,
      difficultyLevel,
      difficultyStars,
      sentencesPerDay: Math.max(1, Math.floor(Number(doc.sentencesPerDay) || 3)),
      translateGuidance: window.AppDomain.normalizeTranslateGuidance(doc.translateGuidance),
    };
    documents.unshift(record);
    writeJSON(KEYS.documents, documents);
    return window.AppDomain.normalizeDocument(record);
  }

  // Overwrites an existing document in place (same id/createdAt), so edits to
  // fix typos keep the document's study history and library position intact
  // instead of creating a duplicate entry.
  async function updateDocument(id, updates) {
    const documents = readJSON(KEYS.documents, []);
    const index = documents.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const existing = documents[index];
    const Domain = window.AppDomain;
    let difficultyStars;
    let difficultyLevel;
    let difficultyScore;
    if (updates.difficultyStars != null) {
      difficultyStars = Domain.clampDifficultyStars(updates.difficultyStars);
      difficultyLevel = Domain.starsToDifficultyLevel(difficultyStars);
      difficultyScore = difficultyStars;
    } else if (updates.difficultyScore != null) {
      difficultyScore = updates.difficultyScore;
      difficultyLevel = updates.difficultyLevel || 2;
      difficultyStars = Domain.levelToDifficultyStars(difficultyLevel);
    } else {
      const computed = Domain.computeDifficultyFromEnglishText(updates.rawText, updates.sentenceCount);
      difficultyScore = computed.difficultyScore;
      difficultyLevel = computed.difficultyLevel;
      difficultyStars = Domain.levelToDifficultyStars(difficultyLevel);
    }
    const record = {
      ...existing,
      title: updates.title,
      rawText: updates.rawText,
      lang: updates.lang,
      rate: updates.rate,
      sentenceCount: updates.sentenceCount,
      sourceLang: updates.sourceLang || 'en',
      cachedSentences: updates.sourceLang === 'ko' ? (updates.cachedSentences || []) : null,
      tags: Array.isArray(updates.tags) ? updates.tags : (existing.tags || []),
      difficultyScore,
      difficultyLevel,
      difficultyStars,
      sentencesPerDay: updates.sentencesPerDay != null
        ? Math.max(1, Math.floor(Number(updates.sentencesPerDay) || 3))
        : (existing.sentencesPerDay || 3),
      translateGuidance: updates.translateGuidance != null
        ? Domain.normalizeTranslateGuidance(updates.translateGuidance)
        : Domain.normalizeTranslateGuidance(existing.translateGuidance),
      updatedAt: Date.now(),
    };
    documents[index] = record;
    writeJSON(KEYS.documents, documents);
    return window.AppDomain.normalizeDocument(record);
  }

  async function deleteDocument(id) {
    writeJSON(KEYS.documents, readJSON(KEYS.documents, []).filter((d) => d.id !== id));
    // Attempts tied to a deleted document would otherwise show up as orphaned
    // ranking entries, so they're removed together.
    const attempts = readJSON(KEYS.attempts, []).filter((a) => a.documentId !== id);
    writeJSON(KEYS.attempts, attempts);
    const progressMap = readJSON(KEYS.roadmapProgress, {});
    if (progressMap[id]) {
      delete progressMap[id];
      writeJSON(KEYS.roadmapProgress, progressMap);
    }
  }

  async function getRoadmapProgress(documentId) {
    const all = readJSON(KEYS.roadmapProgress, {});
    return window.AppDomain.normalizeRoadmapProgress(all[documentId]);
  }

  async function completeRoadmapMark(documentId, markIndex, durationMs) {
    const all = readJSON(KEYS.roadmapProgress, {});
    const current = window.AppDomain.normalizeRoadmapProgress(all[documentId]);
    const idx = Number(markIndex);
    if (!Number.isFinite(idx) || idx < 0) return current;
    if (!current.completedMarkIndices.includes(idx)) {
      current.completedMarkIndices.push(idx);
      current.completedMarkIndices.sort((a, b) => a - b);
    }
    const ms = Number(durationMs);
    if (Number.isFinite(ms) && ms >= 0) {
      if (!current.markDurations) current.markDurations = {};
      // Keep best (fastest) clear time for the part circle.
      const prev = current.markDurations[String(idx)];
      if (prev == null || ms < prev) current.markDurations[String(idx)] = ms;
    }
    current.updatedAt = Date.now();
    all[documentId] = current;
    writeJSON(KEYS.roadmapProgress, all);
    return current;
  }

  async function listAttempts(documentId) {
    const attempts = readJSON(KEYS.attempts, []);
    return documentId ? attempts.filter((a) => a.documentId === documentId) : attempts;
  }

  async function saveAttempt(attempt) {
    const attempts = readJSON(KEYS.attempts, []);
    const sentenceId = (attempt && attempt.sentenceId)
      || (window.AppDomain && window.AppDomain.buildAttemptSentenceId
        ? window.AppDomain.buildAttemptSentenceId(attempt)
        : null);

    let existingIndex = -1;
    if (sentenceId) {
      existingIndex = attempts.findIndex((a) => a && a.sentenceId === sentenceId);
      if (existingIndex < 0 && attempt && attempt.kind === 'single' && attempt.documentId) {
        // Legacy single attempts used documentId = vault id without sentenceId.
        existingIndex = attempts.findIndex((a) => (
          a
          && a.kind === 'single'
          && !a.sentenceId
          && a.documentId === attempt.documentId
        ));
      }
      if (existingIndex < 0 && attempt && (attempt.kind === 'mark' || attempt.kind === 'boss')
        && attempt.documentId != null && attempt.markIndex != null) {
        existingIndex = attempts.findIndex((a) => (
          a
          && a.kind === attempt.kind
          && !a.sentenceId
          && a.documentId === attempt.documentId
          && Number(a.markIndex) === Number(attempt.markIndex)
        ));
      }
      if (existingIndex < 0 && attempt && attempt.kind === 'full' && attempt.documentId) {
        existingIndex = attempts.findIndex((a) => (
          a
          && a.kind === 'full'
          && !a.sentenceId
          && a.documentId === attempt.documentId
        ));
      }
    }

    if (existingIndex >= 0) {
      const prev = attempts[existingIndex];
      const record = Object.assign({}, attempt, {
        id: prev.id,
        sentenceId: sentenceId || prev.sentenceId || null,
        replayCount: (Number(prev.replayCount) || 0) + 1,
        // Keep first "until learned" submit count; replays bump replayCount only.
        writeCount: prev.writeCount != null
          ? (Number(prev.writeCount) || 0)
          : (Number(attempt && attempt.writeCount) || 0),
      });
      attempts[existingIndex] = record;
      writeJSON(KEYS.attempts, attempts);
      return record;
    }

    const record = Object.assign({}, attempt, {
      id: generateId(),
      sentenceId: sentenceId || null,
      replayCount: Number(attempt && attempt.replayCount) || 0,
    });
    attempts.push(record);
    writeJSON(KEYS.attempts, attempts);
    return record;
  }

  async function getDailyActivity() {
    return readJSON(KEYS.activity, {});
  }

  async function recordActivity(count, durationMs) {
    if (!count) return;
    const activity = readJSON(KEYS.activity, {});
    const key = dateKey();
    activity[key] = (activity[key] || 0) + count;
    writeJSON(KEYS.activity, activity);

    if (durationMs) {
      const durations = readJSON(KEYS.duration, {});
      durations[key] = (durations[key] || 0) + durationMs;
      writeJSON(KEYS.duration, durations);
    }
  }

  async function getTodayDurationMs() {
    const durations = readJSON(KEYS.duration, {});
    return durations[dateKey()] || 0;
  }

  // Every wrong submit — used by the daily learning report ("시도").
  async function recordRetry(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!n) return;
    const retries = readJSON(KEYS.dailyRetries, {});
    const key = dateKey();
    retries[key] = (retries[key] || 0) + n;
    writeJSON(KEYS.dailyRetries, retries);
  }

  async function getDailyRetries() {
    return readJSON(KEYS.dailyRetries, {});
  }

  async function getTodayRetryCount() {
    const retries = readJSON(KEYS.dailyRetries, {});
    return retries[dateKey()] || 0;
  }

  // Sum of retries on sentences that were fully memorized — home banner "N회 만에".
  async function recordMemorizedRetries(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!n) return;
    const retries = readJSON(KEYS.dailyMemorizedRetries, {});
    const key = dateKey();
    retries[key] = (retries[key] || 0) + n;
    writeJSON(KEYS.dailyMemorizedRetries, retries);
  }

  async function getDailyMemorizedRetries() {
    return readJSON(KEYS.dailyMemorizedRetries, {});
  }

  async function getTodayMemorizedRetryCount() {
    const retries = readJSON(KEYS.dailyMemorizedRetries, {});
    return retries[dateKey()] || 0;
  }

  // Every typing submit (Step 1–3, correct or wrong) — home banner "N회 써봤어요".
  async function recordWrite(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!n) return;
    const writes = readJSON(KEYS.dailyWrites, {});
    const key = dateKey();
    writes[key] = (writes[key] || 0) + n;
    writeJSON(KEYS.dailyWrites, writes);
  }

  async function getDailyWrites() {
    return readJSON(KEYS.dailyWrites, {});
  }

  async function getTodayWriteCount() {
    const writes = readJSON(KEYS.dailyWrites, {});
    return writes[dateKey()] || 0;
  }

  async function getTodaySentenceCount() {
    const activity = readJSON(KEYS.activity, {});
    return activity[dateKey()] || 0;
  }

  async function recordWordMistake(word) {
    const clean = window.AppUtils.normalizeWord(word);
    if (!clean || window.AppUtils.isMistakeStopword(clean)) return;
    const all = readJSON(KEYS.wordMistakes, {});
    const key = dateKey();
    if (!all[key]) all[key] = {};
    all[key][clean] = (all[key][clean] || 0) + 1;
    writeJSON(KEYS.wordMistakes, all);
  }

  async function getTodayWordMistakes(limit) {
    const all = readJSON(KEYS.wordMistakes, {});
    const todayMap = all[dateKey()] || {};
    return Object.keys(todayMap)
      .filter((word) => !window.AppUtils.isMistakeStopword(word))
      .map((word) => ({ word, count: todayMap[word] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit || 5);
  }

  async function listVaultSentences() {
    return readJSON(KEYS.sentenceVault, [])
      .map(window.AppDomain.normalizeVaultSentence)
      .filter(Boolean);
  }

  async function getVaultSentence(id) {
    const raw = readJSON(KEYS.sentenceVault, []).find((s) => s.id === id);
    return raw ? window.AppDomain.normalizeVaultSentence(raw) : null;
  }

  async function saveVaultSentence(item) {
    const list = readJSON(KEYS.sentenceVault, []);
    const record = window.AppDomain.normalizeVaultSentence({
      id: generateId(),
      enText: item.enText,
      koText: item.koText,
      sourceLang: item.sourceLang,
      status: item.status || 'pending',
      translateGuidance: item.translateGuidance,
      createdAt: Date.now(),
      memorizedAt: item.status === 'memorized' ? Date.now() : null,
      updatedAt: null,
    });
    list.unshift(record);
    writeJSON(KEYS.sentenceVault, list);
    return record;
  }

  async function updateVaultSentence(id, patch) {
    const list = readJSON(KEYS.sentenceVault, []);
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const existing = list[index];
    const nextStatus = patch.status != null
      ? (patch.status === 'memorized' ? 'memorized' : 'pending')
      : existing.status;
    const record = window.AppDomain.normalizeVaultSentence({
      ...existing,
      enText: patch.enText != null ? patch.enText : existing.enText,
      koText: patch.koText != null ? patch.koText : existing.koText,
      sourceLang: patch.sourceLang != null ? patch.sourceLang : existing.sourceLang,
      status: nextStatus,
      translateGuidance: patch.translateGuidance != null
        ? patch.translateGuidance
        : existing.translateGuidance,
      memorizedAt: nextStatus === 'memorized'
        ? (patch.memorizedAt != null ? patch.memorizedAt : (existing.memorizedAt || Date.now()))
        : null,
      updatedAt: Date.now(),
    });
    list[index] = record;
    writeJSON(KEYS.sentenceVault, list);
    return record;
  }

  async function getSingleTranslateGuidance() {
    return window.AppDomain.normalizeTranslateGuidance(
      readJSON(KEYS.singleTranslateGuidance, { tone: '', topic: '' })
    );
  }

  async function saveSingleTranslateGuidance(guidance) {
    const normalized = window.AppDomain.normalizeTranslateGuidance(guidance);
    writeJSON(KEYS.singleTranslateGuidance, normalized);
    return normalized;
  }

  async function deleteVaultSentence(id) {
    writeJSON(
      KEYS.sentenceVault,
      readJSON(KEYS.sentenceVault, []).filter((s) => s.id !== id)
    );
  }

  async function getTranslateSettings() {
    return window.AppDomain.normalizeTranslateSettings(readJSON(KEYS.translateSettings, null));
  }

  async function saveTranslateSettings(settings) {
    const normalized = window.AppDomain.normalizeTranslateSettings(settings);
    writeJSON(KEYS.translateSettings, normalized);
    return normalized;
  }

  async function getBoaStates() {
    return window.AppDomain.normalizeBoaStates(readJSON(KEYS.boaStates, null));
  }

  async function saveBoaStates(states) {
    const normalized = window.AppDomain.normalizeBoaStates(states);
    const payload = normalized.map((row) => ({
      name: row.name,
      min: row.min,
      imageDataUrl: row.imageDataUrl || '',
    }));
    try {
      window.localStorage.setItem(KEYS.boaStates, JSON.stringify(payload));
    } catch (err) {
      throw new Error('이미지가 너무 커서 저장하지 못했어요. 더 작은 파일로 올려 주세요.');
    }
    return window.AppDomain.normalizeBoaStates(payload);
  }

  // Hook for cloud adapters. LocalStore ignores session (single-device guest+stub).
  // Cloud impl: scope queries by session.userId; if cloud empty && local has data,
  // upload once (last-write / updatedAt wins thereafter).
  async function onAuthSessionChange(/* session */) {
    return null;
  }

  return {
    listDocuments,
    getDocument,
    saveDocument,
    updateDocument,
    deleteDocument,
    listAttempts,
    saveAttempt,
    getDailyActivity,
    recordActivity,
    getTodayDurationMs,
    recordRetry,
    getDailyRetries,
    getTodayRetryCount,
    recordMemorizedRetries,
    getDailyMemorizedRetries,
    getTodayMemorizedRetryCount,
    recordWrite,
    getDailyWrites,
    getTodayWriteCount,
    getTodaySentenceCount,
    recordWordMistake,
    getTodayWordMistakes,
    getRoadmapProgress,
    completeRoadmapMark,
    listVaultSentences,
    getVaultSentence,
    saveVaultSentence,
    updateVaultSentence,
    deleteVaultSentence,
    getSingleTranslateGuidance,
    saveSingleTranslateGuidance,
    getTranslateSettings,
    saveTranslateSettings,
    getBoaStates,
    saveBoaStates,
    onAuthSessionChange,
  };
};
