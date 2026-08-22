/* ==========================================================================
   AppDataStore — adapter contract + factory
   ==========================================================================
   UI never talks to Firebase/Supabase/localStorage. It calls AppStorage, which
   talks to whatever adapter createAppStore() returns.

   Swap backends later (one of):
     1. window.__APP_STORE__ = createSupabaseStore({...});  // before storage.js
     2. or replace createLocalStore with your adapter factory in createAppStore

   New adapter = one file that returns an object with every method in METHODS.
   Keep domain rules in AppDomain; adapters only persist/load plain data.
   ========================================================================== */

window.AppDataStore = (function () {
  'use strict';

  const METHODS = [
    'listDocuments', 'getDocument', 'saveDocument', 'updateDocument', 'deleteDocument',
    'listAttempts', 'saveAttempt',
    'getDailyActivity', 'recordActivity', 'getTodayDurationMs',
    'recordRetry', 'getDailyRetries', 'getTodayRetryCount',
    'recordMemorizedRetries', 'getDailyMemorizedRetries', 'getTodayMemorizedRetryCount',
    'recordWrite', 'getDailyWrites', 'getTodayWriteCount',
    'getTodaySentenceCount',
    'recordWordMistake', 'getTodayWordMistakes',
    'getRoadmapProgress', 'completeRoadmapMark',
    'listVaultSentences', 'getVaultSentence', 'saveVaultSentence',
    'updateVaultSentence', 'deleteVaultSentence',
    'getSingleTranslateGuidance', 'saveSingleTranslateGuidance',
    'getTranslateSettings', 'saveTranslateSettings',
    'getBoaStates', 'saveBoaStates',
    'onAuthSessionChange',
  ];

  function assertAdapter(store, label) {
    if (!store || typeof store !== 'object') {
      throw new Error(`[AppDataStore] ${label || 'adapter'} is missing`);
    }
    const missing = METHODS.filter((name) => typeof store[name] !== 'function');
    if (missing.length) {
      console.warn(`[AppDataStore] ${label || 'adapter'} missing methods:`, missing.join(', '));
    }
    return store;
  }

  // Default: localStorage. Inject window.__APP_STORE__ before storage.js loads
  // once Firebase / Supabase / IndexedDB adapter exists.
  function create() {
    if (window.__APP_STORE__) {
      return assertAdapter(window.__APP_STORE__, '__APP_STORE__');
    }
    if (typeof window.createLocalStore !== 'function') {
      throw new Error('[AppDataStore] load store-local.js or set window.__APP_STORE__');
    }
    return assertAdapter(window.createLocalStore(), 'local');
  }

  return { METHODS, assertAdapter, create };
})();
