/* ==========================================================================
   AppStorage — facade over AppDataStore + AppDomain
   ==========================================================================
   UI modules call AppStorage only. Persistence is whatever adapter
   AppDataStore.create() returns (local today; Firebase/Supabase later via
   window.__APP_STORE__). Do not call adapters from screens/js UI modules.
   ========================================================================== */

window.AppStorage = (function () {
  'use strict';

  const store = window.AppDataStore.create();
  const Domain = window.AppDomain;

  async function getDocuments() {
    return store.listDocuments();
  }

  async function getDocument(id) {
    return store.getDocument(id);
  }

  async function saveDocument(doc) {
    return store.saveDocument(doc);
  }

  async function updateDocument(id, updates) {
    return store.updateDocument(id, updates);
  }

  async function deleteDocument(id) {
    return store.deleteDocument(id);
  }

  async function filterSortDocuments(options) {
    const docs = await getDocuments();
    return Domain.filterSortDocuments(docs, options);
  }

  async function getAttempts(documentId) {
    return store.listAttempts(documentId);
  }

  async function saveAttempt(attempt) {
    return store.saveAttempt(attempt);
  }

  async function getTopAttempts(n) {
    const attempts = await getAttempts();
    return Domain.getTopAttempts(attempts, n);
  }

  async function getDocumentBestAttempt(documentId) {
    const attempts = await getAttempts(documentId);
    return Domain.getDocumentBestAttempt(attempts);
  }

  async function getDocumentRank(documentId, attemptId) {
    const attempts = await getAttempts(documentId);
    return Domain.getDocumentRank(attempts, attemptId);
  }

  async function getDailyActivity() {
    return store.getDailyActivity();
  }

  async function recordActivity(count, durationMs) {
    return store.recordActivity(count, durationMs);
  }

  async function getTodayDurationMs() {
    return store.getTodayDurationMs();
  }

  async function recordRetry(count) {
    return store.recordRetry(count);
  }

  async function getDailyRetries() {
    return store.getDailyRetries();
  }

  async function getTodayRetryCount() {
    return store.getTodayRetryCount();
  }

  async function recordMemorizedRetries(count) {
    return store.recordMemorizedRetries(count);
  }

  async function getDailyMemorizedRetries() {
    return store.getDailyMemorizedRetries();
  }

  async function getTodayMemorizedRetryCount() {
    return store.getTodayMemorizedRetryCount();
  }

  async function recordWrite(count) {
    return store.recordWrite(count);
  }

  async function getDailyWrites() {
    return store.getDailyWrites();
  }

  async function getTodayWriteCount() {
    return store.getTodayWriteCount();
  }

  async function getTodaySentenceCount() {
    return store.getTodaySentenceCount();
  }

  async function recordWordMistake(word) {
    return store.recordWordMistake(word);
  }

  async function getTodayWordMistakes(limit) {
    return store.getTodayWordMistakes(limit);
  }

  async function getStreak() {
    const activity = await store.getDailyActivity();
    return Domain.computeStreak(activity);
  }

  async function getRoadmapProgress(documentId) {
    return store.getRoadmapProgress(documentId);
  }

  async function completeRoadmapMark(documentId, markIndex, durationMs) {
    return store.completeRoadmapMark(documentId, markIndex, durationMs);
  }

  async function getVaultSentences() {
    return store.listVaultSentences();
  }

  async function getVaultSentence(id) {
    return store.getVaultSentence(id);
  }

  async function saveVaultSentence(item) {
    return store.saveVaultSentence(item);
  }

  async function updateVaultSentence(id, patch) {
    return store.updateVaultSentence(id, patch);
  }

  async function deleteVaultSentence(id) {
    return store.deleteVaultSentence(id);
  }

  async function getSingleTranslateGuidance() {
    return store.getSingleTranslateGuidance();
  }

  async function saveSingleTranslateGuidance(guidance) {
    return store.saveSingleTranslateGuidance(guidance);
  }

  async function getTranslateSettings() {
    return store.getTranslateSettings();
  }

  async function saveTranslateSettings(settings) {
    return store.saveTranslateSettings(settings);
  }

  async function getBoaStates() {
    return store.getBoaStates();
  }

  async function saveBoaStates(states) {
    return store.saveBoaStates(states);
  }

  // Auth session bind — cloud adapters implement store.onAuthSessionChange(session)
  // to re-scope by userId and optionally merge local → cloud once (server wins).
  // LocalStore has no per-user scope; default is no-op / pass-through.
  async function onAuthSessionChange(session) {
    if (typeof store.onAuthSessionChange === 'function') {
      return store.onAuthSessionChange(session);
    }
    return null;
  }

  function getAuthUserId() {
    const s = window.AppAuth && window.AppAuth.getCachedSession
      ? window.AppAuth.getCachedSession()
      : null;
    return s && s.userId ? s.userId : null;
  }

  return {
    getDocuments,
    saveDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    filterSortDocuments,
    getAttempts,
    saveAttempt,
    getTopAttempts,
    getDocumentBestAttempt,
    getDocumentRank,
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
    getStreak,
    getRoadmapProgress,
    completeRoadmapMark,
    getVaultSentences,
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
    getAuthUserId,
    // Sync pure helpers (re-exported for convenience)
    normalizeDocument: Domain.normalizeDocument,
    computeDifficultyFromEnglishText: Domain.computeDifficultyFromEnglishText,
    difficultyLabel: Domain.difficultyLabel,
    difficultyStarsLabel: Domain.difficultyStarsLabel,
    clampDifficultyStars: Domain.clampDifficultyStars,
    starsToDifficultyLevel: Domain.starsToDifficultyLevel,
    levelToDifficultyStars: Domain.levelToDifficultyStars,
    dateKey: Domain.dateKey,
    buildMarks: Domain.buildMarks,
    getMarkSentenceIndices: Domain.getMarkSentenceIndices,
    getMarkStatus: Domain.getMarkStatus,
    normalizeVaultSentence: Domain.normalizeVaultSentence,
    normalizeTranslateSettings: Domain.normalizeTranslateSettings,
    normalizeBoaStates: Domain.normalizeBoaStates,
  };
})();

window.AppTiers = (function () {
  'use strict';

  const TIERS = [];

  function seedFrom(states) {
    const rows = window.AppDomain.normalizeBoaStates(states);
    TIERS.length = 0;
    rows.forEach((row) => {
      TIERS.push({
        min: row.min,
        max: row.max,
        label: row.label,
        name: row.name,
        imageDataUrl: row.imageDataUrl || '',
      });
    });
    return TIERS;
  }

  seedFrom(null);

  async function refresh() {
    if (!window.AppStorage || typeof window.AppStorage.getBoaStates !== 'function') {
      return TIERS;
    }
    const states = await window.AppStorage.getBoaStates();
    return seedFrom(states);
  }

  function getTierIndex(wpm) {
    const safeWpm = Number.isFinite(wpm) ? wpm : 0;
    const idx = TIERS.findIndex((t) => safeWpm >= t.min && safeWpm <= t.max);
    return idx === -1 ? Math.max(0, TIERS.length - 1) : idx;
  }

  function getTier(wpm) {
    return TIERS[getTierIndex(wpm)] || TIERS[0];
  }

  // Score blends accuracy (60%) and speed (40%) into a single 0-1000 figure,
  // so a slow-but-perfect run and a fast-but-sloppy run both land somewhere
  // reasonable instead of only rewarding raw WPM.
  function calculateScore(wpm, accuracy) {
    const safeWpm = Number.isFinite(wpm) ? wpm : 0;
    const safeAccuracy = Number.isFinite(accuracy) ? accuracy : 0;
    const raw = safeAccuracy * 6 + Math.min(safeWpm, 150) * (400 / 150);
    return Math.max(0, Math.min(1000, Math.round(raw)));
  }

  return { TIERS, refresh, getTier, getTierIndex, calculateScore };
})();
