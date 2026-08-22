/* ==========================================================================
   App — orchestration: state, DOM, screen nav, events, init
   ========================================================================== */

(function () {
  'use strict';

  if (window.AppSelect) window.AppSelect.enhanceAll();

  // Clear any leftover inert flags from earlier builds.
  document.querySelectorAll('.screen[inert]').forEach((s) => {
    s.inert = false;
    s.removeAttribute('inert');
  });

  const state = {
    currentDocument: null,  // AppStorage document record currently being studied
    document: null,         // ParsedDocument (sentences derived from currentDocument.rawText)
    currentIndex: 0,
    currentStep: 1,          // 1 = Full+Korean, 2 = Hint, 3 = Blind
    listenAndType: false,
    isRevealing: false,      // true while showing the 3s answer reveal (blocks input)
    settings: { lang: 'en-US', rate: 1.0, autoPlay: true },
    typingStartTime: null,
    sessionStats: [],        // [{ wpm, accuracy, score }] - one entry per *step* completed, used for averaging
    sessionSentencesCompleted: 0,  // one increment per fully-completed sentence (all 3 steps), used for counts
    sessionStartedAt: null,
    sessionRetryCount: 0,
    sessionWriteCount: 0, // every typing submit today (hero / daily report)
    currentSentenceWriteCount: 0, // submits for the sentence currently being learned
    lastSentenceWriteCount: 0, // captured when a sentence is fully memorized
    markSentenceWriteCounts: [], // per-sentence submit counts during mark phase (excludes boss)
    currentSentenceRetries: 0, // per-sentence fails; added to memorized-retry total only on Step 3 clear
    currentScreen: null,
    editingDocumentId: null,  // set while the register-form screen is editing an existing document
    editingSourceLang: null,  // 'en' | 'ko' while editing
    editLangTab: 'ko',        // which field is shown while editing a ko-source doc
    registerQuery: '',
    registerSort: 'newest',
    libraryQuery: '',
    librarySort: 'newest',
    roadmapDocument: null,
    roadmapMarkIndex: null,
    studyMode: null,          // 'mark' | 'boss' | 'full' | 'single' | null
    markIndex: null,
    markInProgress: false,
    sentenceIndices: null,
    singleInProgress: false,
    singleVaultId: null,
    singleReturnScreen: 'single',
  };

  const el = {
    // Home screen
    homeLevelRing: document.getElementById('home-level-ring'),
    homeLevelRingNumber: document.getElementById('home-level-ring-number'),
    homeLevelLabel: document.getElementById('home-level-label'),
    homeTodaySwallowed: document.getElementById('home-today-swallowed'),
    homeTodayRetries: document.getElementById('home-today-retries'),
    homeLevelProgressFill: document.getElementById('home-level-progress-fill'),
    homeLevelProgressText: document.getElementById('home-level-progress-text'),
    heroStatSentences: document.getElementById('hero-stat-sentences'),
    heroStatStreak: document.getElementById('hero-stat-streak'),
    heroStatScore: document.getElementById('hero-stat-score'),
    homeRankingList: document.getElementById('home-ranking-list'),
    homeRankingEmpty: document.getElementById('home-ranking-empty'),
    homeRecentGrid: document.getElementById('home-recent-grid'),
    homeRecentEmpty: document.getElementById('home-recent-empty'),
    homeRecentCarousel: document.getElementById('home-recent-carousel'),
    homeRecentViewport: document.getElementById('home-recent-viewport'),
    btnRecentPrev: document.getElementById('btn-recent-prev'),
    btnRecentNext: document.getElementById('btn-recent-next'),
    homeHeatmapMonths: document.getElementById('home-heatmap-months'),
    homeHeatmapGrid: document.getElementById('home-heatmap-grid'),
    homeHeatmapScroll: document.getElementById('home-heatmap-scroll'),
    homeStreakBadge: document.getElementById('home-streak-badge'),
    homeBoa: document.getElementById('home-boa'),
    btnAppHome: document.getElementById('btn-app-home'),
    navToRegisterButtons: document.querySelectorAll('.nav-to-register'),
    navToLibraryButtons: document.querySelectorAll('.nav-to-library'),

    // Home screen - today's shareable recap card
    dailyReportEmpty: document.getElementById('home-daily-report-empty'),
    dailyReportCardStage: document.getElementById('daily-report-card-stage'),
    dailyReportCard: document.getElementById('home-daily-report-card'),
    dailyReportDate: document.getElementById('daily-report-card-date'),
    dailyReportTime: document.getElementById('daily-report-time'),
    dailyReportSentences: document.getElementById('daily-report-sentences'),
    dailyReportRetries: document.getElementById('daily-report-retries'),
    dailyReportStudySingle: document.getElementById('daily-report-study-single'),
    dailyReportStudySingleText: document.getElementById('daily-report-study-single-text'),
    dailyReportStudyPassage: document.getElementById('daily-report-study-passage'),
    dailyReportStudyPassageList: document.getElementById('daily-report-study-passage-list'),
    dailyReportStudyEmpty: document.getElementById('daily-report-study-empty'),
    dailyReportWordcloud: document.getElementById('daily-report-wordcloud'),
    dailyReportWordsEmpty: document.getElementById('daily-report-words-empty'),
    dailyReportRatio: document.getElementById('daily-report-ratio'),
    dailyReportSaveRow: document.getElementById('daily-report-save-row'),
    btnDownloadDailyReport: document.getElementById('btn-download-daily-report'),

    // Register list screen
    btnBackHomeFromRegister: document.getElementById('btn-back-home-from-register'),
    registerSearch: document.getElementById('register-search'),
    registerSort: document.getElementById('register-sort'),
    btnGotoAddPassage: document.getElementById('btn-goto-add-passage'),
    registerList: document.getElementById('register-list'),
    registerListEmpty: document.getElementById('register-list-empty'),

    // Register form screen (add / edit)
    btnBackToRegisterList: document.getElementById('btn-back-to-register-list'),
    inputTitle: document.getElementById('input-title'),
    inputSubtitle: document.getElementById('input-subtitle'),
    inputDocTitle: document.getElementById('input-doc-title'),
    inputDocTags: document.getElementById('input-doc-tags'),
    inputTranslateGuidance: document.getElementById('input-translate-guidance'),
    inputTranslateTone: document.getElementById('input-translate-tone'),
    inputTranslateTopic: document.getElementById('input-translate-topic'),
    inputSentencesPerDay: document.getElementById('input-sentences-per-day'),
    inputRoadmapPreview: document.getElementById('input-roadmap-preview'),
    inputLangMode: document.getElementById('input-lang-mode'),
    inputLangModeRadios: document.querySelectorAll('input[name="input-lang-mode"]'),
    inputPassageCharLimitNote: document.getElementById('input-passage-char-limit-note'),
    inputPassageCharCount: document.getElementById('input-passage-char-count'),
    inputPassageSection: document.getElementById('input-passage-section'),
    inputEntryTabs: document.getElementById('input-entry-tabs'),
    btnEntryTabType: document.getElementById('btn-entry-tab-type'),
    btnEntryTabUpload: document.getElementById('btn-entry-tab-upload'),
    inputEntryPaneType: document.getElementById('input-entry-pane-type'),
    inputEntryPaneUpload: document.getElementById('input-entry-pane-upload'),
    inputKoField: document.getElementById('input-ko-field'),
    inputEnField: document.getElementById('input-en-field'),
    inputModeHint: document.getElementById('input-mode-hint'),
    inputDifficultyPreview: document.getElementById('input-difficulty-preview'),
    inputDifficultyRow: document.getElementById('input-difficulty-row'),
    inputDifficultyStars: document.getElementById('input-difficulty-stars'),
    inputEnglishTextarea: document.getElementById('input-english-textarea'),
    inputEnglishTextareaLabel: document.getElementById('input-english-textarea-label'),
    btnRetranslateKo: document.getElementById('btn-retranslate-ko'),
    inputTextarea: document.getElementById('input-textarea'),
    inputTextareaLabel: document.getElementById('input-textarea-label'),
    inputFileUpload: document.getElementById('input-file-upload'),
    uploadFilename: document.getElementById('upload-filename'),
    inputUploadDropzone: document.getElementById('input-upload-dropzone'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    btnOpenLogin: document.getElementById('btn-open-login'),
    btnOpenAdmin: document.getElementById('btn-open-admin'),
    homeGuestBanner: document.getElementById('home-guest-banner'),
    homeGuestBannerText: document.getElementById('home-guest-banner-text'),
    btnHomeGuestLogin: document.getElementById('btn-home-guest-login'),
    btnBackHomeFromSettings: document.getElementById('btn-back-home-from-settings'),
    settingsProviderToggles: document.getElementById('settings-provider-toggles'),
    settingsProviderPanels: document.getElementById('settings-provider-panels'),
    settingsTranslateStatus: document.getElementById('settings-translate-status'),
    btnSaveTranslateSettings: document.getElementById('btn-save-translate-settings'),
    btnTestTranslateSettings: document.getElementById('btn-test-translate-settings'),
    settingsAccountStatus: document.getElementById('settings-account-status'),
    settingsSupabaseUrl: document.getElementById('settings-supabase-url'),
    settingsSupabaseAnon: document.getElementById('settings-supabase-anon'),
    settingsSupabaseStatus: document.getElementById('settings-supabase-status'),
    btnSaveSupabase: document.getElementById('btn-save-supabase'),
    btnTestSupabase: document.getElementById('btn-test-supabase'),
    btnClearSupabase: document.getElementById('btn-clear-supabase'),
    btnSettingsOpenLogin: document.getElementById('btn-settings-open-login'),
    btnSettingsOpenAdmin: document.getElementById('btn-settings-open-admin'),
    btnSettingsSignOut: document.getElementById('btn-settings-sign-out'),

    btnBackHomeFromLogin: document.getElementById('btn-back-home-from-login'),
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginSeedHint: document.getElementById('login-seed-hint'),
    loginStatus: document.getElementById('login-status'),
    loginHeading: document.getElementById('login-heading'),
    loginSubtitle: document.getElementById('login-subtitle'),
    btnLoginSignup: document.getElementById('btn-login-signup'),
    btnLoginSkip: document.getElementById('btn-login-skip'),

    btnBackHomeFromAdmin: document.getElementById('btn-back-home-from-admin'),
    adminStatus: document.getElementById('admin-status'),
    adminUserList: document.getElementById('admin-user-list'),
    adminEmpty: document.getElementById('admin-empty'),
    adminBoaStatus: document.getElementById('admin-boa-status'),
    adminBoaList: document.getElementById('admin-boa-list'),
    btnAdminBoaSave: document.getElementById('btn-admin-boa-save'),
    btnAdminBoaReset: document.getElementById('btn-admin-boa-reset'),

    settingLang: document.getElementById('setting-lang'),
    settingRate: document.getElementById('setting-rate'),
    settingRateValue: document.getElementById('setting-rate-value'),
    inputError: document.getElementById('input-error'),
    inputProgress: document.getElementById('input-progress'),
    inputSuccess: document.getElementById('input-success'),
    btnRegisterPassage: document.getElementById('btn-register-passage'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),

    // Library screen
    libraryList: document.getElementById('library-list'),
    libraryEmpty: document.getElementById('library-empty'),
    libraryEmptyText: document.getElementById('library-empty-text'),
    librarySearch: document.getElementById('library-search'),
    librarySort: document.getElementById('library-sort'),
    btnBackHomeFromLibrary: document.getElementById('btn-back-home-from-library'),

    // Roadmap
    btnBackLibraryFromRoadmap: document.getElementById('btn-back-library-from-roadmap'),
    roadmapDocTitle: document.getElementById('roadmap-doc-title'),
    roadmapMeta: document.getElementById('roadmap-meta'),
    roadmapPath: document.getElementById('roadmap-path'),
    btnRoadmapSentences: document.getElementById('btn-roadmap-sentences'),
    roadmapSentencesPanel: document.getElementById('roadmap-sentences-panel'),
    roadmapSentencesList: document.getElementById('roadmap-sentences-list'),

    // Study screen
    btnBackToLibrary: document.getElementById('btn-back-to-library'),
    studyModeBanner: document.getElementById('study-mode-banner'),
    studyParagraphIndicator: document.getElementById('study-paragraph-indicator'),
    studySentenceIndicator: document.getElementById('study-sentence-indicator'),

    studyTierBadge: document.getElementById('study-tier-badge'),
    studyTimerValue: document.getElementById('study-timer-value'),
    studyWpmValue: document.getElementById('study-wpm-value'),
    studyAccuracyValue: document.getElementById('study-accuracy-value'),
    studyScoreValue: document.getElementById('study-score-value'),
    studyGaugeFill: document.getElementById('study-gauge-fill'),

    stepChips: Array.from(document.querySelectorAll('#screen-study .step-chip')),
    toggleAutoPlay: document.getElementById('toggle-auto-play'),
    toggleListenAndType: document.getElementById('toggle-listen-and-type'),
    studySentenceTranslation: document.getElementById('study-sentence-translation'),
    studySentenceDisplay: document.getElementById('study-sentence-display'),
    studySentenceText: document.getElementById('study-sentence-text'),
    studyWordBoxesContainer: document.getElementById('study-word-boxes'),
    btnReplayAudio: document.getElementById('btn-replay-audio'),
    btnStudyMic: document.getElementById('btn-study-mic'),
    btnStudySubmit: document.getElementById('btn-study-submit'),
    studyFeedback: document.getElementById('study-feedback'),

    // Result screen
    resultScore: document.getElementById('result-score'),
    resultWpm: document.getElementById('result-wpm'),
    resultAccuracy: document.getElementById('result-accuracy'),
    resultSentenceCount: document.getElementById('result-sentence-count'),
    resultTier: document.getElementById('result-tier'),
    resultRankNote: document.getElementById('result-rank-note'),
    btnRestartSame: document.getElementById('btn-restart-same'),
    btnRestartNew: document.getElementById('btn-restart-new'),
    btnGotoHomeFromResult: document.getElementById('btn-goto-home-from-result'),

    // Single sentence chat
    btnHeroSingle: document.getElementById('btn-hero-single'),
    btnCtaSingle: document.getElementById('btn-cta-single'),
    btnBackHomeFromSingle: document.getElementById('btn-back-home-from-single'),
    btnOpenVault: document.getElementById('btn-open-vault'),
    singleChatLog: document.getElementById('single-chat-log'),
    singleChatInput: document.getElementById('single-chat-input'),
    singleChatField: document.getElementById('single-chat-field'),
    singleTranslateGuidance: document.getElementById('single-translate-guidance'),
    singleTranslateTone: document.getElementById('single-translate-tone'),
    singleTranslateTopic: document.getElementById('single-translate-topic'),
    singleChatHint: document.getElementById('single-chat-hint'),
    singleChatCount: document.getElementById('single-chat-count'),
    singleChatCountValue: document.getElementById('single-chat-count-value'),
    singleComposer: document.getElementById('single-composer'),
    btnSingleMic: document.getElementById('btn-single-mic'),
    btnSingleSend: document.getElementById('btn-single-send'),

    // Vault
    btnBackSingleFromVault: document.getElementById('btn-back-single-from-vault'),
    vaultEmpty: document.getElementById('vault-empty'),
    vaultList: document.getElementById('vault-list'),
  };

  const ctx = { state, el, showScreen };

  async function refreshAccountUi() {
    const session = window.AppAuth
      ? (window.AppAuth.getCachedSession() || await window.AppAuth.getSession())
      : null;
    const isAdmin = !!(window.AppAuth && window.AppAuth.isAdmin(session));
    const loggedIn = !!session;
    const cloud = !!(window.AppSupabase && window.AppSupabase.isConfigured && window.AppSupabase.isConfigured());

    if (el.btnOpenAdmin) el.btnOpenAdmin.hidden = !isAdmin;
    if (el.btnOpenLogin) {
      el.btnOpenLogin.textContent = loggedIn ? (session.email || '계정') : '계정';
      el.btnOpenLogin.title = loggedIn ? session.email : '로그인';
    }
    if (el.settingsAccountStatus) {
      el.settingsAccountStatus.textContent = loggedIn
        ? `${session.email} · ${session.role}${cloud ? ' · Supabase' : ''}`
        : (cloud ? '게스트 · 로그인하면 Supabase에 저장됩니다' : '게스트 · 이 기기만 사용 중');
    }
    if (el.homeGuestBanner) {
      el.homeGuestBanner.hidden = loggedIn;
      if (!loggedIn && el.homeGuestBannerText) {
        el.homeGuestBannerText.textContent = cloud
          ? '학습 기록은 이 브라우저에만 저장됩니다. 로그인하면 클라우드에 모아 둘 수 있어요.'
          : '학습 기록은 이 브라우저에만 저장됩니다.';
      }
    }
    if (el.btnSettingsOpenLogin) {
      el.btnSettingsOpenLogin.textContent = loggedIn ? '계정 화면' : '로그인 / 가입';
    }
    if (el.btnSettingsOpenAdmin) el.btnSettingsOpenAdmin.hidden = !isAdmin;
    if (el.btnSettingsSignOut) el.btnSettingsSignOut.hidden = !loggedIn;
  }

  ctx.refreshAccountUi = refreshAccountUi;

  const ROUTE_DOC_KEY = 'ttbt_roadmap_doc_v1';

  async function restoreRoadmapDoc() {
    try {
      const docId = sessionStorage.getItem(ROUTE_DOC_KEY);
      if (!docId) return null;
      return window.AppStorage.getDocument(docId);
    } catch (_) {
      return null;
    }
  }

  let navSeq = 0;

  async function showScreen(name, opts) {
    const options = opts || {};
    const fromUrl = !!options.fromUrl;
    const replace = !!options.replace;
    let target = name;
    const seq = ++navSeq;

    // Same-screen hash sync — skip only when that screen is already visible.
    // (Boot starts with currentScreen null so the first paint is never skipped.)
    if (fromUrl && target === state.currentScreen) {
      const activeEl = document.getElementById(`screen-${target}`);
      const alreadyVisible = !!(activeEl && activeEl.classList.contains('screen-active'));
      if (alreadyVisible) {
        if ((target === 'study' || target === 'result') && !state.document) {
          // Fall through so refresh without an in-memory session can redirect.
        } else {
          return;
        }
      }
    }

    if (fromUrl && target !== state.currentScreen) {
      if (window.AppStudy.isMarkSessionActive(ctx) || window.AppStudy.isSingleSessionActive(ctx)) {
        const ok = await window.AppStudy.confirmLeaveMark(ctx);
        if (seq !== navSeq) return;
        if (!ok) {
          if (window.AppRouter) window.AppRouter.sync(state.currentScreen, { replace: true });
          return;
        }
        window.AppStudy.leaveMarkSession(ctx);
      }
    }

    if (fromUrl && target === 'roadmap' && !state.roadmapDocument) {
      const doc = await restoreRoadmapDoc();
      if (seq !== navSeq) return;
      if (doc) state.roadmapDocument = doc;
    }

    if (fromUrl) {
      if (target === 'roadmap' && !state.roadmapDocument && !state.currentDocument) {
        target = 'library';
      }
      if ((target === 'study' || target === 'result') && !state.document) {
        // Study session lives in memory only; send refresh to a safe parent route.
        if (!state.roadmapDocument) {
          const doc = await restoreRoadmapDoc();
          if (seq !== navSeq) return;
          if (doc) state.roadmapDocument = doc;
        }
        if (state.roadmapDocument) target = 'roadmap';
        else target = 'single';
      }
    }

    if (target === 'admin' && window.AppAuth) {
      const session = window.AppAuth.getCachedSession() || await window.AppAuth.getSession();
      if (seq !== navSeq) return;
      if (!session) {
        target = 'login';
      } else if (!window.AppAuth.isAdmin(session)) {
        target = 'home';
      }
    }

    if (seq !== navSeq) return;

    let screenEl = document.getElementById(`screen-${target}`);
    if (!screenEl && window.AppLoadScreens && window.AppLoadScreens.ensureScreen) {
      screenEl = await window.AppLoadScreens.ensureScreen(target);
      if (seq !== navSeq) return;
    }
    if (!screenEl) {
      console.error('[showScreen] missing screen element:', target);
      // Prefer staying put over dumping the user on home for known routes.
      if (state.currentScreen) {
        target = state.currentScreen;
        screenEl = document.getElementById(`screen-${target}`);
      }
      if (!screenEl) {
        target = 'home';
        screenEl = document.getElementById('screen-home');
      }
    }

    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('screen-active'));
    if (screenEl) screenEl.classList.add('screen-active');
    state.currentScreen = target;
    if (el.btnAppHome) {
      el.btnAppHome.setAttribute('aria-current', target === 'home' ? 'page' : 'false');
    }

    if (window.AppRouter) {
      window.AppRouter.sync(target, { replace: fromUrl || replace });
    }

    if (target === 'home') {
      await window.AppHome.render(ctx);
      await refreshAccountUi();
    }
    if (target === 'library') {
      if (el.librarySearch) el.librarySearch.value = state.libraryQuery;
      if (el.librarySort) el.librarySort.value = state.librarySort;
      await window.AppLibrary.render(ctx);
    }
    if (target === 'register') {
      if (el.registerSearch) el.registerSearch.value = state.registerQuery;
      if (el.registerSort) el.registerSort.value = state.registerSort;
      await window.AppRegister.renderDocumentList(ctx);
    }
    if (target === 'register-form') {
      window.AppRegister.updateInputModeUI(ctx);
      window.AppRegister.updateRegisterScreenMode(ctx);
      window.AppRegister.syncTranslateGuidanceUI(ctx);
    }
    if (target === 'roadmap') {
      await window.AppRoadmap.render(ctx);
    }
    if (target === 'single') {
      window.AppSingle.setupSttUi(ctx);
      await window.AppSingle.renderChat(ctx);
      window.AppSingle.syncComposerInput(ctx);
      window.AppSingle.syncTranslateGuidanceUI(ctx);
    } else if (window.AppSingle && window.AppSingle.stopListening) {
      window.AppSingle.stopListening(ctx);
    }
    if (target === 'study') {
      window.AppStudy.setupStudyMicUi(ctx);
    } else if (window.AppStudy && window.AppStudy.stopStudyMic) {
      window.AppStudy.stopStudyMic(ctx);
    }
    if (target === 'vault') {
      await window.AppSingle.renderVault(ctx);
    }
    if (target === 'settings') {
      await window.AppSettings.render(ctx);
      await refreshAccountUi();
    }
    if (target === 'login' && window.AppLogin) {
      await window.AppLogin.render(ctx);
    }
    if (target === 'admin' && window.AppAdmin) {
      await window.AppAdmin.render(ctx);
    }
  }

  // Keep showScreen on ctx after definition (hoisted function, but assign for clarity).
  ctx.showScreen = showScreen;

  /* ------------------------------------------------------------------
     URL routing first — so refresh opens the hash screen even if a
     later listener binding throws.
     ------------------------------------------------------------------ */

  window.AppRegister.updateInputModeUI(ctx);
  window.AppRegister.updateRegisterScreenMode(ctx);

  const tiersReady = window.AppTiers && window.AppTiers.refresh
    ? window.AppTiers.refresh()
    : Promise.resolve();

  if (window.AppRouter) {
    window.AppRouter.bind((screen, routeOpts) => showScreen(screen, routeOpts));
    tiersReady.then(() => window.AppRouter.start()).then(() => refreshAccountUi());
  } else {
    document.getElementById('screen-home')?.classList.add('screen-active');
    tiersReady.then(() => window.AppHome.render(ctx));
    refreshAccountUi();
  }

  if (window.AppAuth && window.AppAuth.onAuthStateChange) {
    window.AppAuth.onAuthStateChange(() => {
      refreshAccountUi();
    });
  }

  /* ------------------------------------------------------------------
     Event Listeners
     ------------------------------------------------------------------ */

  async function goHomeFromLogo() {
    if (state.currentScreen === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (window.AppStudy && (window.AppStudy.isMarkSessionActive(ctx) || window.AppStudy.isSingleSessionActive(ctx))) {
      const ok = await window.AppStudy.confirmLeaveMark(ctx);
      if (!ok) return;
      window.AppStudy.leaveMarkSession(ctx);
    }
    if (window.AppSingle && window.AppSingle.stopListening) {
      window.AppSingle.stopListening(ctx);
    }
    await showScreen('home');
  }

  el.btnAppHome?.addEventListener('click', () => {
    goHomeFromLogo();
  });

  // Single / vault — bind early so a later missing-node throw can't skip these.
  if (el.btnHeroSingle) {
    el.btnHeroSingle.addEventListener('click', () => window.AppSingle.openChat(ctx));
  }
  if (el.btnCtaSingle) {
    el.btnCtaSingle.addEventListener('click', () => window.AppSingle.openChat(ctx));
  }
  el.btnBackHomeFromSingle?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AppSingle.stopListening(ctx);
    showScreen('home');
  });
  // Replay audio — capture so reinjected study DOM still works.
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#btn-replay-audio');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.AppStudy.replayCurrentSentence(ctx);
  }, true);
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#btn-open-vault');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.AppSingle.openVault(ctx);
  }, true);
  el.btnOpenVault?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AppSingle.openVault(ctx);
  });
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#btn-back-single-from-vault');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.AppSingle.openChat(ctx);
  }, true);
  el.btnBackSingleFromVault?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AppSingle.openChat(ctx);
  });
  el.singleChatInput?.addEventListener('input', () => window.AppSingle.syncComposerInput(ctx));
  el.singleChatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.AppSingle.sendMessage(ctx);
    }
  });
  el.btnSingleSend?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AppSingle.sendMessage(ctx);
  });
  el.btnSingleMic?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AppSingle.toggleMic(ctx);
  });
  el.singleChatLog?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.btn-single-delete');
    if (deleteBtn) {
      e.preventDefault();
      window.AppSingle.deleteSentence(ctx, deleteBtn.getAttribute('data-vault-id'));
      return;
    }
    const btn = e.target.closest('.btn-single-memorize');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    window.AppSingle.startMemorize(ctx, btn.getAttribute('data-vault-id'), 'single');
  });
  // Vault actions — document delegation so re-injected #vault-list still works.
  document.addEventListener('click', (e) => {
    const deleteBtn = e.target && e.target.closest && e.target.closest('#vault-list .btn-vault-delete');
    if (deleteBtn) {
      e.preventDefault();
      window.AppSingle.deleteSentence(ctx, deleteBtn.getAttribute('data-vault-id'));
      return;
    }
    const btn = e.target && e.target.closest && e.target.closest('#vault-list .btn-vault-memorize');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    window.AppSingle.startMemorize(ctx, btn.getAttribute('data-vault-id'), 'vault');
  });

  // Home → register list only (form opens via 「추가하기」)
  el.navToRegisterButtons.forEach((btn) => btn.addEventListener('click', () => {
    showScreen('register');
  }));
  el.navToLibraryButtons.forEach((btn) => btn.addEventListener('click', () => showScreen('library')));

  el.btnDownloadDailyReport?.addEventListener('click', () => {
    window.AppHome.downloadDailyReport(ctx);
  });
  if (el.dailyReportRatio) {
    el.dailyReportRatio.addEventListener('click', (e) => {
      const btn = e.target.closest('.daily-report-ratio-btn');
      if (!btn) return;
      window.AppHome.setDailyReportRatio(ctx, btn.dataset.ratio);
    });
  }
  el.homeRecentGrid?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-recent-replay');
    if (!btn) return;
    e.preventDefault();
    window.AppHome.replayRecentAttempt(ctx, btn);
  });
  el.btnRecentPrev?.addEventListener('click', () => window.AppHome.slideRecent(ctx, -1));
  el.btnRecentNext?.addEventListener('click', () => window.AppHome.slideRecent(ctx, 1));

  // Register list
  el.btnBackHomeFromRegister?.addEventListener('click', () => {
    state.editingDocumentId = null;
    showScreen('home');
  });
  el.btnGotoAddPassage?.addEventListener('click', () => window.AppRegister.openAddPassage(ctx));
  el.registerSearch?.addEventListener('input', (e) => {
    state.registerQuery = e.target.value;
    window.AppRegister.renderDocumentList(ctx);
  });
  el.registerSort?.addEventListener('change', (e) => {
    state.registerSort = e.target.value;
    window.AppRegister.renderDocumentList(ctx);
  });

  // Register form
  el.btnRegisterPassage.addEventListener('click', () => window.AppRegister.registerPassage(ctx));
  el.btnBackToRegisterList.addEventListener('click', () => {
    window.AppRegister.resetRegisterForm(ctx);
    showScreen('register');
  });
  el.btnCancelEdit.addEventListener('click', () => {
    window.AppRegister.resetRegisterForm(ctx);
    showScreen('register');
  });

  el.inputLangModeRadios.forEach((radio) => {
    radio.addEventListener('change', () => window.AppRegister.updateInputModeUI(ctx));
  });

  if (el.btnEntryTabType) {
    el.btnEntryTabType.addEventListener('click', () => window.AppRegister.setEntryTab(ctx, 'type'));
  }
  if (el.btnEntryTabUpload) {
    el.btnEntryTabUpload.addEventListener('click', () => window.AppRegister.setEntryTab(ctx, 'upload'));
  }

  el.inputTextarea.addEventListener('input', () => window.AppRegister.updateDifficultyPreview(ctx));
  el.inputEnglishTextarea.addEventListener('input', () => window.AppRegister.updateDifficultyPreview(ctx));
  el.inputSentencesPerDay.addEventListener('input', () => window.AppRegister.updateRoadmapPreview(ctx));
  el.inputSentencesPerDay.addEventListener('change', () => window.AppRegister.updateRoadmapPreview(ctx));
  el.btnRetranslateKo.addEventListener('click', () => window.AppRegister.retranslateKoreanSource(ctx));
  if (el.inputDifficultyStars) {
    el.inputDifficultyStars.addEventListener('click', (e) => {
      const btn = e.target.closest('.difficulty-star-btn');
      if (!btn) return;
      window.AppRegister.setDifficultyStars(ctx, btn.dataset.stars);
    });
  }
  el.btnOpenSettings.addEventListener('click', () => showScreen('settings'));
  el.btnOpenLogin?.addEventListener('click', () => showScreen('login'));
  el.btnHomeGuestLogin?.addEventListener('click', () => showScreen('login'));
  el.btnOpenAdmin?.addEventListener('click', () => showScreen('admin'));
  el.btnBackHomeFromSettings.addEventListener('click', () => showScreen('home'));
  el.btnSettingsOpenLogin?.addEventListener('click', () => showScreen('login'));
  el.btnSettingsOpenAdmin?.addEventListener('click', () => showScreen('admin'));
  el.btnSettingsSignOut?.addEventListener('click', async () => {
    await window.AppAuth.signOut();
    await refreshAccountUi();
    await showScreen('home');
  });

  el.btnBackHomeFromLogin?.addEventListener('click', () => showScreen('home'));
  el.btnLoginSkip?.addEventListener('click', () => showScreen('home'));
  el.loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    window.AppLogin.submitLogin(ctx);
  });
  el.btnLoginSignup?.addEventListener('click', () => window.AppLogin.submitSignup(ctx));

  el.btnBackHomeFromAdmin?.addEventListener('click', () => showScreen('home'));
  el.adminUserList?.addEventListener('change', (e) => {
    const select = e.target && e.target.closest && e.target.closest('.admin-role-select');
    if (!select) return;
    window.AppAdmin.onRoleChange(ctx, select.dataset.userId, select.value);
  });
  el.adminBoaList?.addEventListener('click', (e) => window.AppAdmin.onBoaListClick(ctx, e));
  el.adminBoaList?.addEventListener('change', (e) => window.AppAdmin.onBoaListChange(ctx, e));
  el.btnAdminBoaSave?.addEventListener('click', () => window.AppAdmin.saveBoa(ctx));
  el.btnAdminBoaReset?.addEventListener('click', () => window.AppAdmin.resetBoa(ctx));

  if (el.settingsProviderToggles) {
    el.settingsProviderToggles.addEventListener('click', (e) => window.AppSettings.onToggleClick(ctx, e));
  }
  if (el.settingsProviderPanels) {
    el.settingsProviderPanels.addEventListener('change', (e) => window.AppSettings.onPanelChange(ctx, e));
  }
  el.btnSaveTranslateSettings.addEventListener('click', () => window.AppSettings.save(ctx));
  el.btnSaveSupabase?.addEventListener('click', () => window.AppSettings.saveSupabase(ctx));
  el.btnTestSupabase?.addEventListener('click', () => window.AppSettings.testSupabase(ctx));
  el.btnClearSupabase?.addEventListener('click', () => window.AppSettings.clearSupabase(ctx));
  el.btnTestTranslateSettings.addEventListener('click', () => window.AppSettings.test(ctx));

  el.inputFileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      el.inputTextarea.value = evt.target.result;
      if (el.uploadFilename) el.uploadFilename.textContent = file.name;
      el.inputError.hidden = true;
      window.AppRegister.setEntryTab(ctx, 'type');
      window.AppRegister.updateDifficultyPreview(ctx);
    };
    reader.onerror = () => {
      el.inputError.hidden = false;
      el.inputError.textContent = '\ud30c\uc77c\uc744 \uc77d\ub294 \ub370 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.';
    };
    reader.readAsText(file, 'UTF-8');
  });

  el.settingRate.addEventListener('input', (e) => {
    el.settingRateValue.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
  });

  // Library
  el.btnBackHomeFromLibrary.addEventListener('click', () => showScreen('home'));
  el.librarySearch.addEventListener('input', (e) => {
    state.libraryQuery = e.target.value;
    window.AppLibrary.render(ctx);
  });
  el.librarySort.addEventListener('change', (e) => {
    state.librarySort = e.target.value;
    window.AppLibrary.render(ctx);
  });
  el.libraryList.addEventListener('click', async (e) => {
    const startBtn = e.target.closest('.btn-start-document');
    if (startBtn) {
      const doc = await window.AppStorage.getDocument(startBtn.dataset.id);
      if (doc) await window.AppRoadmap.openDocument(ctx, doc);
    }
  });

  el.btnBackLibraryFromRoadmap.addEventListener('click', () => showScreen('library'));
  el.btnRoadmapSentences?.addEventListener('click', () => window.AppRoadmap.toggleSentences(ctx));

  el.roadmapPath?.addEventListener('click', (e) => {
    const markBtn = e.target.closest('.roadmap-mark');
    if (!markBtn || markBtn.disabled) return;
    const markIndex = Number(markBtn.dataset.markIndex);
    if (!Number.isFinite(markIndex)) return;
    // Prefer the per-node listener; keep this as a fallback.
    if (e.defaultPrevented) return;
    window.AppRoadmap.startMark(ctx, markIndex);
  });

  // Register list actions: edit / delete / study
  el.registerList?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-document');
    if (editBtn) {
      const doc = await window.AppStorage.getDocument(editBtn.dataset.id);
      if (doc) window.AppRegister.startEditDocument(ctx, doc);
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-document');
    if (deleteBtn) {
      const ok = await window.AppDialog.confirm('이 지문과 관련 학습 기록을 삭제할까요?', {
        title: '지문 삭제',
        okLabel: '삭제',
        cancelLabel: '취소',
        danger: true,
      });
      if (ok) {
        await window.AppStorage.deleteDocument(deleteBtn.dataset.id);
        await window.AppRegister.renderDocumentList(ctx);
      }
      return;
    }

    const studyBtn = e.target.closest('.btn-study-document');
    if (studyBtn) {
      const doc = await window.AppStorage.getDocument(studyBtn.dataset.id);
      if (doc) await window.AppRoadmap.openDocument(ctx, doc);
    }
  });

  // Study — bind (and re-bind after ensureStudyDom reinjects #screen-study)
  let studyControlsBoundEl = null;
  function bindStudyControls() {
    if (window.AppStudy.refreshStudyEls) window.AppStudy.refreshStudyEls(el);
    const screen = document.getElementById('screen-study');
    if (!screen) {
      console.error('[app] #screen-study missing after screen load');
      return false;
    }
    if (studyControlsBoundEl === screen) return true;

    el.toggleAutoPlay?.addEventListener('change', (e) => {
      state.settings.autoPlay = e.target.checked;
    });

    el.toggleListenAndType?.addEventListener('change', (e) => {
      state.listenAndType = e.target.checked;
      window.AppStudy.renderSentenceDisplay(ctx);
      window.AppStudy.renderKoreanPanel(ctx);
    });

    el.btnReplayAudio?.addEventListener('click', (e) => {
      // Capture handler on document already covers reinjected DOM; keep as fallback.
      if (e.defaultPrevented) return;
      window.AppStudy.replayCurrentSentence(ctx);
    });
    el.btnStudyMic?.addEventListener('click', () => window.AppStudy.toggleStudyMic(ctx));
    el.btnStudySubmit?.addEventListener('click', () => window.AppStudy.submitCurrentSentence(ctx));

    const container = el.studyWordBoxesContainer;
    if (!container) {
      console.error('[app] #study-word-boxes missing after screen load');
      return false;
    }

    container.addEventListener('input', (e) => {
      if (!e.target.classList.contains('word-box')) return;
      if (!state.typingStartTime) {
        state.typingStartTime = Date.now();
      }
      window.AppStudy.updateLiveGauge(ctx);
    });

    container.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('word-box')) return;

      if (state.isRevealing) {
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        window.AppStudy.submitCurrentSentence(ctx);
        return;
      }

      const boxes = window.AppStudy.getWordBoxes(ctx);
      const currentIndex = Number(e.target.dataset.index);

      if (e.code === 'Space') {
        e.preventDefault();
        const next = boxes[currentIndex + 1];
        if (next) next.focus();
        return;
      }

      if (e.key === 'Backspace' && e.target.value === '') {
        const prev = boxes[currentIndex - 1];
        if (prev) {
          e.preventDefault();
          prev.focus();
        }
      }
    });

    el.btnBackToLibrary?.addEventListener('click', async () => {
      if (!(await window.AppStudy.confirmLeaveMark(ctx))) return;
      const returnScreen = state.studyMode === 'single'
        ? (state.singleReturnScreen || 'single')
        : (state.roadmapDocument ? 'roadmap' : 'library');
      window.AppStudy.leaveMarkSession(ctx);
      await showScreen(returnScreen);
    });

    studyControlsBoundEl = screen;
    return true;
  }
  window.__ttbtBindStudyInputs = bindStudyControls;
  bindStudyControls();

  // Result
  el.btnRestartNew?.addEventListener('click', () => {
    showScreen('library');
  });

  el.btnGotoHomeFromResult?.addEventListener('click', async () => {
    if (!(await window.AppStudy.confirmLeaveMark(ctx))) return;
    window.AppStudy.leaveMarkSession(ctx);
    showScreen('home');
  });

  el.btnRestartSame?.addEventListener('click', () => {
    window.AppStudy.restartSameSession(ctx);
  });
})();
