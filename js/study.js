/* ==========================================================================
   AppStudy — 3-step study engine + result session finish
   ========================================================================== */

window.AppStudy = (function () {
  'use strict';

  const STUDY_EL_IDS = {
    btnBackToLibrary: 'btn-back-to-library',
    studyModeBanner: 'study-mode-banner',
    studyParagraphIndicator: 'study-paragraph-indicator',
    studySentenceIndicator: 'study-sentence-indicator',
    studyTierBadge: 'study-tier-badge',
    studyTimerValue: 'study-timer-value',
    studyWpmValue: 'study-wpm-value',
    studyAccuracyValue: 'study-accuracy-value',
    studyScoreValue: 'study-score-value',
    studyGaugeFill: 'study-gauge-fill',
    toggleAutoPlay: 'toggle-auto-play',
    toggleListenAndType: 'toggle-listen-and-type',
    studySentenceTranslation: 'study-sentence-translation',
    studyStepTabs: 'study-step-tabs',
    studyBossIntro: 'study-boss-intro',
    studyBossIntroStart: 'study-boss-intro-start',
    studySentenceDisplay: 'study-sentence-display',
    studySentenceText: 'study-sentence-text',
    studyWordBoxesContainer: 'study-word-boxes',
    btnReplayAudio: 'btn-replay-audio',
    btnStudyMic: 'btn-study-mic',
    btnStudySubmit: 'btn-study-submit',
    studyFeedback: 'study-feedback',
  };

  function missingStudyIds() {
    const required = [
      'screen-study',
      'study-word-boxes',
      'study-sentence-text',
      'study-sentence-display',
    ];
    return required.filter((id) => !document.getElementById(id));
  }

  /** Always re-query study DOM into ctx.el (never trust boot-time cache). */
  function refreshStudyEls(el) {
    Object.keys(STUDY_EL_IDS).forEach((key) => {
      const node = document.getElementById(STUDY_EL_IDS[key]);
      if (el) el[key] = node;
    });
    if (el) {
      el.stepChips = Array.from(document.querySelectorAll('#screen-study .step-chip'));
    }
    return missingStudyIds().length === 0;
  }

  let bossIntroResolve = null;

  function hideBossIntro(ctx) {
    const overlay = ctx && ctx.el && ctx.el.studyBossIntro;
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-open');
    }
    if (bossIntroResolve) {
      const resolve = bossIntroResolve;
      bossIntroResolve = null;
      resolve();
    }
  }

  function showBossIntro(ctx) {
    const { el } = ctx;
    return new Promise((resolve) => {
      if (!el.studyBossIntro || !el.studyBossIntroStart) {
        resolve();
        return;
      }
      bossIntroResolve = resolve;
      el.studyBossIntroStart.onclick = () => hideBossIntro(ctx);
      el.studyBossIntro.hidden = false;
      void el.studyBossIntro.offsetWidth;
      el.studyBossIntro.classList.add('is-open');
      const panel = document.getElementById('study-boss-intro-panel');
      if (window.AppFx) window.AppFx.celebrate(panel || el.studyBossIntro);
      el.studyBossIntroStart.focus();
    });
  }

  /** If study partial is missing from #app-root, re-fetch and inject it. */
  async function ensureStudyDom(el) {
    if (refreshStudyEls(el)) return true;

    const root = document.getElementById('app-root');
    if (!root) return false;

    try {
      const res = await fetch(`screens/study.html?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        console.error('[ensureStudyDom] fetch failed', res.status);
        return false;
      }
      const html = (await res.text()).trim();
      if (!html) return false;

      const existing = document.getElementById('screen-study');
      if (existing) existing.remove();
      root.insertAdjacentHTML('beforeend', html);
    } catch (err) {
      console.error('[ensureStudyDom]', err);
      return false;
    }

    const ok = refreshStudyEls(el);
    if (ok && el && el.studyWordBoxesContainer && !el.studyWordBoxesContainer.dataset.studyBound) {
      // Word-box listeners are bound in app.js at boot; mark for rebind hook.
      el.studyWordBoxesContainer.dataset.needsStudyBind = '1';
    }
    return ok;
  }

  function studyDomErrorMessage() {
    const missing = missingStudyIds();
    if (!missing.length) {
      return '학습 화면 요소를 찾을 수 없어요. 페이지를 새로고침해 주세요.';
    }
    return `학습 화면 요소를 찾을 수 없어요 (${missing.join(', ')}). 페이지를 강력 새로고침(Cmd+Shift+R)해 주세요.`;
  }

  let clockRaf = 0;

  function formatStopwatch(ms) {
    const t = Math.max(0, Math.floor(Number(ms) || 0));
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const milli = t % 1000;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
  }

  function paintSessionClock(ctx, frozenAt) {
    const el = ctx && ctx.el && ctx.el.studyTimerValue;
    if (!el) return;
    const started = ctx.state && ctx.state.sessionStartedAt;
    const end = frozenAt != null ? frozenAt : Date.now();
    el.textContent = formatStopwatch(started ? end - started : 0);
  }

  function stopSessionClock(ctx, freeze) {
    if (clockRaf) {
      cancelAnimationFrame(clockRaf);
      clockRaf = 0;
    }
    if (freeze && ctx) paintSessionClock(ctx, Date.now());
  }

  function startSessionClock(ctx) {
    stopSessionClock();
    const tick = () => {
      paintSessionClock(ctx);
      clockRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function getCurrentSentence(ctx) {
    const { state } = ctx;
    return state.document ? state.document.sentences[state.currentIndex] : null;
  }

  function getWordBoxes(ctx) {
    return Array.from(ctx.el.studyWordBoxesContainer.querySelectorAll('.word-box'));
  }

  function replayCurrentSentence(ctx) {
    const sentence = getCurrentSentence(ctx);
    if (!sentence || !sentence.originalText) return;
    if (window.AppTts && window.AppTts.prime) window.AppTts.prime();
    if (window.AppTts && window.AppTts.speakSentence) {
      window.AppTts.speakSentence(sentence.originalText, ctx.state.settings);
    }
  }

  // Plays the current sentence automatically on session start / sentence
  // advance / step advance, but only while the auto-play toggle is on.
  // Manual replay (badge button) always works regardless of this flag.
  function autoSpeakCurrentSentence(ctx) {
    if (!ctx.state.settings.autoPlay) return;
    // Defer so screen paint / toggle sync finish; keep a bit longer than cancel gap.
    setTimeout(() => {
      if (window.AppTts && window.AppTts.prime) window.AppTts.prime();
      replayCurrentSentence(ctx);
    }, 80);
  }

  function renderProgress(ctx) {
    const { state, el } = ctx;
    const sentence = getCurrentSentence(ctx);
    if (!sentence || !state.document) return;
    const total = state.document.sentences.length;
    const mode = state.studyMode || 'full';

    if (el.studyModeBanner) {
      if (mode === 'mark' || mode === 'boss' || mode === 'single') {
        el.studyModeBanner.hidden = false;
        el.studyModeBanner.dataset.mode = mode;
        if (mode === 'boss') {
          el.studyModeBanner.textContent = `보스전 · 파트 ${(state.markIndex || 0) + 1} 문장 전부 통과`;
        } else if (mode === 'single') {
          el.studyModeBanner.textContent = '한문장 모드';
        } else {
          el.studyModeBanner.textContent = `파트 ${(state.markIndex || 0) + 1} · 문장 학습`;
        }
      } else {
        el.studyModeBanner.hidden = true;
      }
    }

    if (el.btnBackToLibrary) {
      if (mode === 'single') {
        el.btnBackToLibrary.textContent = state.singleReturnScreen === 'vault'
          ? '\u2190 문장함'
          : '\u2190 나가기';
      } else {
        el.btnBackToLibrary.textContent = '\u2190 로드맵';
      }
    }

    if (!el.studyParagraphIndicator || !el.studySentenceIndicator) return;

    if (mode === 'boss') {
      el.studyParagraphIndicator.textContent = '보스전';
      el.studySentenceIndicator.textContent = `\ubb38\uc7a5 ${state.currentIndex + 1} / ${total}`;
      return;
    }

    if (mode === 'mark') {
      el.studyParagraphIndicator.textContent = `파트 ${(state.markIndex || 0) + 1}`;
      el.studySentenceIndicator.textContent = `\ubb38\uc7a5 ${state.currentIndex + 1} / ${total}`;
      return;
    }

    if (mode === 'single') {
      el.studyParagraphIndicator.textContent = '한문장';
      el.studySentenceIndicator.textContent = `\ubb38\uc7a5 ${state.currentIndex + 1} / ${total}`;
      return;
    }

    el.studyParagraphIndicator.textContent = `\ubb38\ub2e8 ${sentence.paragraphIndex + 1}`;
    el.studySentenceIndicator.textContent = `\ubb38\uc7a5 ${state.currentIndex + 1} / ${total}`;
  }

  function renderSentenceDisplay(ctx) {
    const { state, el } = ctx;
    const sentence = getCurrentSentence(ctx);

    if (state.isRevealing) {
      return; // revealAnswerAndRetry() controls the display directly while revealing
    }

    if (state.listenAndType) {
      el.studySentenceDisplay.classList.add('hidden-mode');
      el.studySentenceText.textContent = '오디오를 듣고 입력하세요. 문장 옆 「다시 듣기」로 재생할 수 있어요.';
      return;
    }

    el.studySentenceDisplay.classList.remove('hidden-mode');

    if (state.currentStep === 1) {
      el.studySentenceText.textContent = sentence.originalText;
    } else if (state.currentStep === 2) {
      el.studySentenceText.textContent = '첫 글자를 참고해 빈칸을 채워보세요.';
    } else {
      el.studySentenceText.textContent = '이제 아무것도 보지 않고 기억나는 대로 입력해보세요.';
    }
  }

  function resolveKoTranslation(sentence) {
    if (!sentence) return '';
    const raw = sentence.koTranslation;
    if (raw == null || raw === '') return '';
    if (typeof raw === 'object') {
      return String(raw.koText || raw.text || '').trim();
    }
    return String(raw).trim();
  }

  function renderKoreanPanel(ctx) {
    const { state, el } = ctx;
    const sentence = getCurrentSentence(ctx);
    const translationEl = el.studySentenceTranslation;
    if (!translationEl) return;

    // 듣기만 쓰기는 소리만 듣고 쓰므로 해석을 숨긴다.
    // 스텝 3·보스전은 영어 원문은 가리되, 한글 해석은 작은 글씨로 남겨 둔다.
    if (!sentence || state.listenAndType) {
      translationEl.hidden = true;
      translationEl.textContent = '';
      return;
    }

    const ko = resolveKoTranslation(sentence);
    const status = sentence.translationStatus;

    // Prefer already-known Korean (Korean-source cache, or finished EN→KO).
    if (ko) {
      translationEl.hidden = false;
      translationEl.textContent = ko;
      return;
    }

    translationEl.hidden = false;
    if (status === 'error') {
      translationEl.textContent = '번역 불러오기 실패 (잠시 후 다시 시도해주세요)';
    } else {
      translationEl.textContent = '번역을 불러오는 중...';
    }
  }

  function renderStepIndicator(ctx) {
    const { state, el } = ctx;
    const mode = state.studyMode || 'full';
    if (el.studyStepTabs) {
      el.studyStepTabs.hidden = mode === 'boss';
    }
    const chips = el.stepChips
      ? (typeof el.stepChips.forEach === 'function' ? el.stepChips : Array.from(el.stepChips))
      : [];
    chips.forEach((chip) => {
      const step = Number(chip.dataset.step);
      chip.classList.toggle('active', step === state.currentStep);
      chip.classList.toggle('done', step < state.currentStep);
    });
  }

  function renderWordBoxes(ctx) {
    const { state, el } = ctx;
    stopStudyMic(ctx);
    const sentence = getCurrentSentence(ctx);
    if (!sentence || !el.studyWordBoxesContainer) return;
    const tokens = window.AppParse.getWordTokens(sentence.originalText);
    el.studyWordBoxesContainer.innerHTML = '';

    tokens.forEach((token, index) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'word-box';
      input.autocomplete = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;
      input.dataset.index = String(index);
      // Extra ch + rem padding so glyphs aren't clipped (inputs use border-box).
      input.style.width = `calc(${Math.max(token.length, 1) + 1}ch + 1.5rem)`;
      input.style.minWidth = '3.25rem';

      if (state.currentStep === 2) {
        input.placeholder = window.AppParse.hintForToken(token);
      }

      el.studyWordBoxesContainer.appendChild(input);
      input.addEventListener('input', () => {
        if (!window.AppFx || window.AppFx.prefersReducedMotion()) return;
        if (Math.random() > 0.62) window.AppFx.sparkFromElement(input);
      });
    });

    const firstBox = el.studyWordBoxesContainer.querySelector('.word-box');
    if (firstBox) {
      try {
        firstBox.focus({ preventScroll: true });
      } catch (_) {
        try { firstBox.focus(); } catch (__) { /* ignore focus failures after await */ }
      }
    }
    setupStudyMicUi(ctx);
  }

  function setupStudyMicUi(ctx) {
    const { el } = ctx;
    if (!el.btnStudyMic) return;
    const supported = window.AppStt && window.AppStt.isSupported();
    el.btnStudyMic.hidden = !supported;
    el.btnStudyMic.disabled = !supported || !!ctx.state.isRevealing;
    if (!supported) {
      el.btnStudyMic.title = '이 브라우저에서는 음성 입력을 지원하지 않아요';
    }
    updateStudyMicUi(ctx, false);
  }

  function updateStudyMicUi(ctx, listening) {
    const { el } = ctx;
    if (!el.btnStudyMic) return;
    el.btnStudyMic.classList.toggle('is-listening', listening);
    el.btnStudyMic.setAttribute('aria-pressed', listening ? 'true' : 'false');
    el.btnStudyMic.title = listening ? '듣기 중지' : '영어로 말해 입력';
    el.btnStudyMic.setAttribute('aria-label', listening ? '듣기 중지' : '영어로 말해 입력');
  }

  function stopStudyMic(ctx) {
    if (window.AppStt && window.AppStt.isListening()) {
      window.AppStt.stop();
    }
    if (ctx) updateStudyMicUi(ctx, false);
  }

  function cleanSpokenWord(word) {
    return String(word || '')
      .replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '')
      .trim();
  }

  function fillWordBoxesFromSpeech(ctx, transcript) {
    const { state } = ctx;
    if (state.isRevealing) return;
    const spoken = String(transcript || '')
      .trim()
      .split(/\s+/)
      .map(cleanSpokenWord)
      .filter(Boolean);
    if (!spoken.length) return;

    const boxes = getWordBoxes(ctx);
    spoken.forEach((word, i) => {
      if (!boxes[i] || boxes[i].disabled) return;
      boxes[i].value = word;
    });
    if (!state.typingStartTime) state.typingStartTime = Date.now();
    updateLiveGauge(ctx);
  }

  function toggleStudyMic(ctx) {
    const { state, el } = ctx;
    if (!window.AppStt || !window.AppStt.isSupported()) {
      window.AppDialog.alert('이 브라우저에서는 음성 입력을 지원하지 않아요.');
      return;
    }
    if (state.isRevealing) return;

    if (window.AppStt.isListening()) {
      stopStudyMic(ctx);
      return;
    }

    // Prefer English for typing practice; keep document lang if already en-*.
    const lang = (state.settings && String(state.settings.lang || '').startsWith('en'))
      ? state.settings.lang
      : 'en-US';

    updateStudyMicUi(ctx, true);
    const started = window.AppStt.start({
      lang,
      onResult(transcript) {
        fillWordBoxesFromSpeech(ctx, transcript);
      },
      onError(code) {
        updateStudyMicUi(ctx, false);
        if (code === 'aborted' || code === 'no-speech') return;
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          window.AppDialog.alert('마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.');
          return;
        }
        window.AppDialog.alert('음성 인식에 실패했어요. 다시 시도해 주세요.');
      },
      onEnd() {
        updateStudyMicUi(ctx, false);
      },
    });
    if (!started) updateStudyMicUi(ctx, false);
  }

  function renderGauge(ctx, wpm, accuracy) {
    const { el } = ctx;
    if (!el.studyTierBadge || !el.studyWpmValue || !el.studyAccuracyValue || !el.studyScoreValue || !el.studyGaugeFill) {
      return;
    }
    const tierIndex = window.AppTiers.getTierIndex(wpm);
    const tier = window.AppTiers.TIERS[tierIndex] || window.AppTiers.TIERS[0];
    const score = window.AppTiers.calculateScore(wpm, accuracy);

    el.studyTierBadge.textContent = tier.label;
    el.studyTierBadge.dataset.tier = String(tierIndex + 1);
    el.studyWpmValue.textContent = `${Math.round(wpm)} WPM`;
    el.studyAccuracyValue.textContent = `\uc815\ud655\ub3c4 ${Math.round(accuracy)}%`;
    el.studyScoreValue.textContent = `\uc810\uc218 ${score}`;
    const pct = Math.min(100, (wpm / 150) * 100);
    el.studyGaugeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, pct / 100))})`;
  }

  function updateLiveGauge(ctx) {
    const { state } = ctx;
    const sentence = getCurrentSentence(ctx);
    if (!sentence) return;
    const tokens = window.AppParse.getWordTokens(sentence.originalText);
    const boxes = getWordBoxes(ctx);
    const elapsedMinutes = state.typingStartTime ? (Date.now() - state.typingStartTime) / 60000 : 0;
    const filledCount = boxes.filter((b) => b.value.trim() !== '').length;
    const wpm = elapsedMinutes > 0 ? filledCount / elapsedMinutes : 0;
    const { correctCount } = window.AppUtils.evaluateWordBoxes(tokens, boxes);
    const accuracy = tokens.length ? (correctCount / tokens.length) * 100 : 0;
    renderGauge(ctx, wpm, accuracy);
  }

  function renderStudyScreen(ctx) {
    renderProgress(ctx);
    renderStepIndicator(ctx);
    renderSentenceDisplay(ctx);
    renderKoreanPanel(ctx);
    renderWordBoxes(ctx);
    renderGauge(ctx, 0, 0);
    if (ctx.el.studyFeedback) ctx.el.studyFeedback.textContent = '';
  }

  function revealAnswerAndRetry(ctx, sentence) {
    const { state, el } = ctx;
    state.isRevealing = true;
    el.studySentenceDisplay.classList.remove('hidden-mode');
    el.studySentenceDisplay.classList.add('revealing');
    el.studySentenceText.textContent = sentence.originalText;

    setTimeout(() => {
      state.isRevealing = false;
      state.typingStartTime = null;
      el.studySentenceDisplay.classList.remove('revealing');
      renderSentenceDisplay(ctx);
      renderKoreanPanel(ctx);
      renderWordBoxes(ctx);
      renderGauge(ctx, 0, 0);
      el.studyFeedback.textContent = '다시 입력해보세요.';
    }, 3000);
  }

  function advanceToStep(ctx, step) {
    const { state } = ctx;
    state.currentStep = step;
    state.typingStartTime = null;
    state.isRevealing = false;
    renderStepIndicator(ctx);
    renderSentenceDisplay(ctx);
    renderKoreanPanel(ctx);
    renderWordBoxes(ctx);
    renderGauge(ctx, 0, 0);
    autoSpeakCurrentSentence(ctx);
  }

  function advanceToNextSentenceOrFinish(ctx) {
    const { state } = ctx;
    if (state.currentIndex < state.document.sentences.length - 1) {
      state.currentIndex++;
      state.currentStep = state.studyMode === 'boss' ? 3 : 1;
      state.typingStartTime = null;
      state.isRevealing = false;
      renderStudyScreen(ctx);
      autoSpeakCurrentSentence(ctx);
    } else if (state.studyMode === 'mark') {
      beginBossPhase(ctx);
    } else if (state.studyMode === 'boss') {
      completeMarkSession(ctx);
    } else if (state.studyMode === 'single') {
      completeSingleSession(ctx);
    } else {
      state.isRevealing = false;
      finishSession(ctx);
    }
  }

  function beginBossPhase(ctx) {
    const { state, el } = ctx;
    return showBossIntro(ctx).then(() => {
      if (!state.markInProgress) return;
      state.studyMode = 'boss';
      state.currentIndex = 0;
      state.currentStep = 3;
      state.typingStartTime = null;
      state.isRevealing = false;
      state.listenAndType = false;
      if (el.toggleListenAndType) el.toggleListenAndType.checked = false;
      if (el.studyFeedback) {
        el.studyFeedback.textContent = '보스전! 오늘 외운 문장을 힌트 없이 모두 통과하세요.';
      }
      renderStudyScreen(ctx);
      autoSpeakCurrentSentence(ctx);
    });
  }

  async function completeMarkSession(ctx) {
    const { state, showScreen } = ctx;
    state.markInProgress = false;
    state.isRevealing = false;

    if (state.currentDocument && state.markIndex != null) {
      const finishedAt = Date.now();
      const durationMs = state.sessionStartedAt ? finishedAt - state.sessionStartedAt : 0;
      await window.AppStorage.completeRoadmapMark(
        state.currentDocument.id,
        state.markIndex,
        durationMs
      );

      const stats = state.sessionStats;
      const sentenceCount = (state.sentenceIndices && state.sentenceIndices.length)
        || (state.document && state.document.sentences.length)
        || state.sessionSentencesCompleted
        || 0;
      const avgWpm = stats.length ? stats.reduce((s, x) => s + x.wpm, 0) / stats.length : 0;
      const avgAccuracy = stats.length ? stats.reduce((s, x) => s + x.accuracy, 0) / stats.length : 0;
      const avgScore = stats.length ? Math.round(stats.reduce((s, x) => s + x.score, 0) / stats.length) : 0;
      const tier = window.AppTiers.getTier(avgWpm);
      // Sum of per-sentence submits while learning the part (boss phase excluded).
      const learnedWrites = Array.isArray(state.markSentenceWriteCounts)
        ? state.markSentenceWriteCounts.reduce((sum, n) => sum + (Number(n) || 0), 0)
        : 0;

      await window.AppStorage.saveAttempt({
        kind: 'mark',
        markIndex: state.markIndex,
        documentId: state.currentDocument.id,
        sentenceId: `mark:${state.currentDocument.id}:${state.markIndex}`,
        documentTitle: state.currentDocument.title,
        startedAt: state.sessionStartedAt,
        finishedAt,
        durationMs,
        sentenceCount,
        retryCount: state.sessionRetryCount,
        writeCount: learnedWrites,
        avgWpm,
        avgAccuracy,
        score: avgScore,
        tierLabel: tier.label,
      });
      if (sentenceCount) {
        await window.AppStorage.recordActivity(sentenceCount, durationMs);
      }
      if (window.AppFx) window.AppFx.celebrate(document.getElementById('roadmap-path'));
    }

    stopSessionClock(ctx, true);
    window.AppTts.cancel();
    await showScreen('roadmap');
  }

  function isMarkSessionActive(ctx) {
    return !!(ctx.state.markInProgress && (ctx.state.studyMode === 'mark' || ctx.state.studyMode === 'boss'));
  }

  function isSingleSessionActive(ctx) {
    return !!(ctx.state.singleInProgress && ctx.state.studyMode === 'single');
  }

  async function confirmLeaveMark(ctx) {
    if (isSingleSessionActive(ctx)) {
      return window.AppDialog.confirm('진행 중인 문장 학습은 저장되지 않습니다. 나갈까요?', {
        title: '학습 나가기',
        okLabel: '나가기',
        cancelLabel: '계속하기',
      });
    }
    if (!isMarkSessionActive(ctx)) return true;
    return window.AppDialog.confirm('진행 중인 파트는 저장되지 않습니다. 나갈까요?', {
      title: '학습 나가기',
      okLabel: '나가기',
      cancelLabel: '계속하기',
    });
  }

  function leaveMarkSession(ctx) {
    const { state } = ctx;
    hideBossIntro(ctx);
    stopSessionClock(ctx, true);
    stopStudyMic(ctx);
    state.markInProgress = false;
    state.singleInProgress = false;
    state.singleVaultId = null;
    state.studyMode = null;
    state.isRevealing = false;
    window.AppTts.cancel();
  }

  async function completeSingleSession(ctx) {
    const { state, showScreen } = ctx;
    state.singleInProgress = false;
    state.isRevealing = false;

    const enText = (state.document
      && state.document.sentences
      && state.document.sentences[0]
      && state.document.sentences[0].originalText) || '';
    const stats = state.sessionStats;
    const avgWpm = stats.length ? stats.reduce((s, x) => s + x.wpm, 0) / stats.length : 0;
    const avgAccuracy = stats.length ? stats.reduce((s, x) => s + x.accuracy, 0) / stats.length : 0;
    const avgScore = stats.length ? Math.round(stats.reduce((s, x) => s + x.score, 0) / stats.length) : 0;
    const tier = window.AppTiers.getTier(avgWpm);
    const finishedAt = Date.now();
    const durationMs = state.sessionStartedAt ? finishedAt - state.sessionStartedAt : 0;
    const title = window.AppDomain.truncateLabel(enText || '한문장 모드', 40);

    if (state.singleVaultId) {
      await window.AppStorage.updateVaultSentence(state.singleVaultId, {
        status: 'memorized',
        memorizedAt: Date.now(),
      });
    }

    const vaultId = state.singleVaultId || (state.currentDocument && state.currentDocument.id) || null;
    await window.AppStorage.saveAttempt({
      kind: 'single',
      documentId: vaultId,
      sentenceId: vaultId ? `single:${vaultId}` : null,
      documentTitle: title,
      startedAt: state.sessionStartedAt,
      finishedAt,
      durationMs,
      sentenceCount: 1,
      retryCount: state.sessionRetryCount,
      writeCount: state.lastSentenceWriteCount || state.currentSentenceWriteCount || state.sessionWriteCount || 0,
      avgWpm,
      avgAccuracy,
      score: avgScore,
      tierLabel: tier.label,
    });
    await window.AppStorage.recordActivity(1, durationMs);

    window.AppTts.cancel();
    stopSessionClock(ctx, true);
    const returnScreen = state.singleReturnScreen || 'single';
    state.singleVaultId = null;
    state.studyMode = null;
    await showScreen(returnScreen);
  }

  async function startSingleSession(ctx, vaultItem, options) {
    if (!ctx.el) ctx.el = {};
    const { state, showScreen } = ctx;
    const el = ctx.el;
    const enText = (vaultItem && vaultItem.enText || '').trim();
    const koText = (vaultItem && vaultItem.koText || '').trim();
    if (!enText) {
      await window.AppDialog.alert('외울 영어 문장이 없어요.');
      return;
    }
    if (typeof showScreen !== 'function') {
      throw new Error('화면 전환 함수를 찾을 수 없어요.');
    }
    if (!(await ensureStudyDom(el))) {
      throw new Error(studyDomErrorMessage());
    }
    if (typeof window.__ttbtBindStudyInputs === 'function') {
      window.__ttbtBindStudyInputs();
    }

    const sentence = {
      id: 0,
      paragraphIndex: 0,
      originalText: enText,
      firstLetterText: window.AppParse.generateFirstLetterHint(enText),
      wordCount: window.AppParse.countWords(enText),
      koTranslation: koText || null,
      translationStatus: koText ? 'done' : 'idle',
    };

    state.currentDocument = {
      id: vaultItem.id,
      title: '한문장',
      lang: 'en-US',
      rate: 1.0,
      sourceLang: 'ko',
      sentenceCount: 1,
    };
    state.settings.lang = 'en-US';
    state.settings.rate = 1.0;
    state.document = {
      rawText: enText,
      sentences: [sentence],
      totalWordCount: sentence.wordCount,
      paragraphCount: 1,
    };
    state.currentIndex = 0;
    state.currentStep = 1;
    state.listenAndType = false;
    state.isRevealing = false;
    state.sessionStats = [];
    state.sessionSentencesCompleted = 0;
    state.sessionStartedAt = Date.now();
    state.sessionRetryCount = 0;
    state.sessionWriteCount = 0;
    state.currentSentenceWriteCount = 0;
    state.lastSentenceWriteCount = 0;
    state.markSentenceWriteCounts = [];
    state.currentSentenceRetries = 0;
    state.typingStartTime = null;
    state.studyMode = 'single';
    state.markInProgress = false;
    state.markIndex = null;
    state.sentenceIndices = [0];
    state.singleVaultId = vaultItem.id;
    state.singleReturnScreen = (options && options.returnScreen) || 'single';
    state.roadmapDocument = null;
    // Keep inactive until study screen is actually shown — avoids leave-guard races.
    state.singleInProgress = false;

    if (el.toggleListenAndType) el.toggleListenAndType.checked = false;
    syncAutoPlayFromUi(ctx);
    await showScreen('study');
    if (state.currentScreen !== 'study') {
      throw new Error('학습 화면으로 이동하지 못했어요.');
    }
    state.singleInProgress = true;
    renderStudyScreen(ctx);
    startSessionClock(ctx);
    autoSpeakCurrentSentence(ctx);
  }

  function submitCurrentSentence(ctx) {
    const { state, el } = ctx;
    if (state.isRevealing) return;
    stopStudyMic(ctx);

    const sentence = getCurrentSentence(ctx);
    if (!sentence || !state.document) {
      console.warn('submitCurrentSentence: no active sentence');
      return;
    }

    try {
      const tokens = window.AppParse.getWordTokens(sentence.originalText);
      const boxes = getWordBoxes(ctx);
      const { results, correctCount, total } = window.AppUtils.evaluateWordBoxes(tokens, boxes);
      const accuracy = total ? (correctCount / total) * 100 : 0;

      const elapsedMinutes = state.typingStartTime ? (Date.now() - state.typingStartTime) / 60000 : 0;
      const wpm = elapsedMinutes > 0 ? total / elapsedMinutes : 0;
      const score = window.AppTiers.calculateScore(wpm, accuracy);
      const allCorrect = correctCount === total;

      // Lock the guard immediately so a stray Enter during the transition delay
      // (or the 3s reveal) can't trigger a double-submit.
      state.isRevealing = true;

      const mistakeWrites = [];
      boxes.forEach((box, i) => {
        box.classList.remove('correct', 'incorrect');
        box.classList.add(results[i] ? 'correct' : 'incorrect');
        box.disabled = true;
        if (!results[i]) {
          const missedWord = window.AppUtils.normalizeWord(tokens[i]);
          if (missedWord) mistakeWrites.push(window.AppStorage.recordWordMistake(missedWord));
        }
      });
      if (mistakeWrites.length) {
        Promise.all(mistakeWrites).catch(() => {});
      }

      // Daily/hero: every submit. Recent-activity "시도": per-sentence until memorized.
      state.sessionWriteCount = (state.sessionWriteCount || 0) + 1;
      state.currentSentenceWriteCount = (state.currentSentenceWriteCount || 0) + 1;
      window.AppStorage.recordWrite(1).catch(() => {});

      // Every step (including Step 1 copy) requires an exact match — articles
      // like a/the count. Report stopwords only affect "자주 틀린 단어", not grading.
      if (allCorrect) {
        state.sessionStats.push({ wpm, accuracy, score });
        if (window.AppFx) {
          window.AppFx.celebrate(el.studyWordBoxesContainer);
          getWordBoxes(ctx).forEach((box) => window.AppFx.sparkFromElement(box));
        }
        if (state.currentStep === 1) {
          if (el.studyFeedback) el.studyFeedback.textContent = '좋아요! 이번엔 첫 글자만 보고 채워볼게요.';
          setTimeout(() => advanceToStep(ctx, 2), 500);
        } else if (state.currentStep === 2) {
          if (el.studyFeedback) el.studyFeedback.textContent = '정확해요! 이제 아무것도 안 보고 써볼까요?';
          setTimeout(() => advanceToStep(ctx, 3), 500);
        } else {
          state.sessionSentencesCompleted++;
          const memorizedRetries = state.currentSentenceRetries || 0;
          const sentenceWrites = state.currentSentenceWriteCount || 0;
          state.currentSentenceRetries = 0;
          state.currentSentenceWriteCount = 0;
          state.lastSentenceWriteCount = sentenceWrites;
          // Mark-phase only: boss revisits are not "learning until memorized" for that pass.
          if (state.studyMode === 'mark') {
            if (!Array.isArray(state.markSentenceWriteCounts)) state.markSentenceWriteCounts = [];
            state.markSentenceWriteCounts.push(sentenceWrites);
          }
          if (memorizedRetries > 0) {
            window.AppStorage.recordMemorizedRetries(memorizedRetries).catch(() => {});
          }
          if (el.studyFeedback) {
            el.studyFeedback.textContent = state.studyMode === 'boss' && state.currentIndex >= state.document.sentences.length - 1
              ? '보스전 통과! 파트를 완료했어요.'
              : state.studyMode === 'boss'
                ? '좋아요! 다음 보스 문장으로 갑니다.'
                : '완벽해요! 다음 문장으로 이동합니다.';
          }
          setTimeout(() => advanceToNextSentenceOrFinish(ctx), 500);
        }
        return;
      }

      state.sessionRetryCount++;
      state.currentSentenceRetries = (state.currentSentenceRetries || 0) + 1;
      window.AppStorage.recordRetry(1).catch(() => {});
      if (window.AppFx) window.AppFx.miss();
      if (el.studyFeedback) {
        el.studyFeedback.textContent = `정확도 ${Math.round(accuracy)}% - 정답을 확인하고 다시 써보세요.`;
      }
      revealAnswerAndRetry(ctx, sentence);
    } catch (err) {
      console.error(err);
      state.isRevealing = false;
      if (el.studyFeedback) el.studyFeedback.textContent = '제출 중 문제가 생겼어요. 다시 시도해 주세요.';
    }
  }

  async function finishSession(ctx) {
    const { state, el, showScreen } = ctx;
    const stats = state.sessionStats;
    const sentenceCount = state.sessionSentencesCompleted;
    const avgWpm = stats.length ? stats.reduce((s, x) => s + x.wpm, 0) / stats.length : 0;
    const avgAccuracy = stats.length ? stats.reduce((s, x) => s + x.accuracy, 0) / stats.length : 0;
    const avgScore = stats.length ? Math.round(stats.reduce((s, x) => s + x.score, 0) / stats.length) : 0;
    const tierIndex = window.AppTiers.getTierIndex(avgWpm);
    const tier = window.AppTiers.TIERS[tierIndex];

    const finishedAt = Date.now();
    const durationMs = state.sessionStartedAt ? finishedAt - state.sessionStartedAt : 0;

    let rank = null;
    if (state.currentDocument) {
      const attemptRecord = await window.AppStorage.saveAttempt({
        kind: 'full',
        documentId: state.currentDocument.id,
        sentenceId: `full:${state.currentDocument.id}`,
        documentTitle: state.currentDocument.title,
        startedAt: state.sessionStartedAt,
        finishedAt,
        durationMs,
        sentenceCount,
        retryCount: state.sessionRetryCount,
        writeCount: state.sessionWriteCount || 0,
        avgWpm,
        avgAccuracy,
        score: avgScore,
        tierLabel: tier.label,
      });
      await window.AppStorage.recordActivity(sentenceCount, durationMs);
      rank = await window.AppStorage.getDocumentRank(state.currentDocument.id, attemptRecord.id);
    }

    el.resultScore.textContent = avgScore;
    el.resultWpm.textContent = Math.round(avgWpm);
    el.resultAccuracy.textContent = `${Math.round(avgAccuracy)}%`;
    el.resultSentenceCount.textContent = sentenceCount;
    el.resultTier.textContent = tier.label;
    el.resultTier.dataset.tier = String(tierIndex + 1);

    if (rank) {
      el.resultRankNote.hidden = false;
      el.resultRankNote.textContent = rank === 1
        ? '\uc774 \uc9c0\ubb38 \uc5ed\ub300 1\uc704 \uae30\ub85d\uc785\ub2c8\ub2e4!'
        : `\uc774 \uc9c0\ubb38\uc5d0\uc11c \uc5ed\ub300 ${rank}\uc704 \uae30\ub85d\uc774\uc5d0\uc694.`;
    } else {
      el.resultRankNote.hidden = true;
    }

    window.AppTts.cancel();
    stopSessionClock(ctx, true);
    showScreen('result');
  }

  function buildParsedDocumentFromCache(doc) {
    // Korean-source documents already have English sentences + their Korean
    // originals translated once at registration time, so studying them never
    // needs to hit the translation API again. Clone so in-session mutation
    // never touches saved data.
    const sentences = JSON.parse(JSON.stringify(doc.cachedSentences || [])).map((s, index) => {
      const sentence = Object.assign({}, s);
      // Older/edited records sometimes stored the whole Korean unit object
      // instead of the string, or omitted translationStatus.
      if (sentence.koTranslation && typeof sentence.koTranslation === 'object') {
        sentence.koTranslation = sentence.koTranslation.koText || sentence.koTranslation.text || '';
      }
      if (sentence.koTranslation && sentence.translationStatus !== 'error') {
        sentence.translationStatus = 'done';
      }
      if (sentence.id == null) sentence.id = index;
      if (sentence.wordCount == null) {
        sentence.wordCount = window.AppParse.countWords(sentence.originalText || '');
      }
      if (!sentence.firstLetterText && sentence.originalText) {
        sentence.firstLetterText = window.AppParse.generateFirstLetterHint(sentence.originalText);
      }
      return sentence;
    });
    const totalWordCount = sentences.reduce((sum, s) => sum + (s.wordCount || 0), 0);
    const paragraphCount = new Set(sentences.map((s) => s.paragraphIndex)).size || 1;
    return { rawText: doc.rawText, sentences, totalWordCount, paragraphCount };
  }

  function sliceParsedDocument(parsed, indices) {
    const sentences = indices.map((globalIdx, i) => {
      const src = parsed.sentences[globalIdx];
      return Object.assign({}, src, { id: i, _globalIndex: globalIdx });
    });
    const totalWordCount = sentences.reduce((sum, s) => sum + (s.wordCount || 0), 0);
    const paragraphCount = new Set(sentences.map((s) => s.paragraphIndex)).size;
    return {
      rawText: parsed.rawText,
      sentences,
      totalWordCount,
      paragraphCount,
    };
  }

  function syncAutoPlayFromUi(ctx) {
    const { state, el } = ctx;
    if (el.toggleAutoPlay) {
      state.settings.autoPlay = !!el.toggleAutoPlay.checked;
    } else {
      // Toggle missing after DOM refresh — keep audio on by default.
      state.settings.autoPlay = true;
    }
  }

  async function startMarkSession(ctx, doc, options) {
    if (!ctx.el) ctx.el = {};
    const { state, showScreen } = ctx;
    const el = ctx.el;
    if (!(await ensureStudyDom(el))) {
      window.AppDialog.alert(studyDomErrorMessage());
      return;
    }
    if (typeof window.__ttbtBindStudyInputs === 'function') {
      window.__ttbtBindStudyInputs();
    }
    const markIndex = options.markIndex;
    const sentenceIndices = options.sentenceIndices || [];
    const isKoreanSource = doc.sourceLang === 'ko' && Array.isArray(doc.cachedSentences) && doc.cachedSentences.length > 0;
    const fullParsed = isKoreanSource ? buildParsedDocumentFromCache(doc) : window.AppParse.parseDocument(doc.rawText);

    if (!sentenceIndices.length || !fullParsed.sentences.length) {
      window.AppDialog.alert('이 스텝에서 문장을 인식하지 못했습니다.');
      return;
    }

    const parsed = sliceParsedDocument(fullParsed, sentenceIndices);

    state.currentDocument = doc;
    state.settings.lang = doc.lang || 'en-US';
    state.settings.rate = doc.rate || 1.0;
    state.document = parsed;
    state.currentIndex = 0;
    state.currentStep = 1;
    state.listenAndType = false;
    state.isRevealing = false;
    state.sessionStats = [];
    state.sessionSentencesCompleted = 0;
    state.sessionStartedAt = Date.now();
    state.sessionRetryCount = 0;
    state.sessionWriteCount = 0;
    state.currentSentenceWriteCount = 0;
    state.lastSentenceWriteCount = 0;
    state.markSentenceWriteCounts = [];
    state.currentSentenceRetries = 0;
    state.typingStartTime = null;
    state.studyMode = 'mark';
    state.markIndex = markIndex;
    state.markInProgress = true;
    state.sentenceIndices = sentenceIndices;
    state.singleInProgress = false;

    if (el.toggleListenAndType) el.toggleListenAndType.checked = false;
    syncAutoPlayFromUi(ctx);
    hideBossIntro(ctx);

    // Prefill translations for English-source mark sentences only.
    if (!isKoreanSource) {
      const guidance = doc.translateGuidance;
      window.AppTranslate.translateAllSentencesQueued(parsed.sentences, (sentence) => {
        if (state.document && getCurrentSentence(ctx) === sentence) {
          renderKoreanPanel(ctx);
        }
      }, guidance);
    }

    await showScreen('study');
    renderStudyScreen(ctx);
    startSessionClock(ctx);
    autoSpeakCurrentSentence(ctx);
  }

  function startStudySession(ctx, doc) {
    // Legacy full-passage entry — route to roadmap instead when possible.
    if (window.AppRoadmap && window.AppRoadmap.openDocument) {
      window.AppRoadmap.openDocument(ctx, doc);
      return;
    }
    const { state, el, showScreen } = ctx;
    const isKoreanSource = doc.sourceLang === 'ko' && Array.isArray(doc.cachedSentences) && doc.cachedSentences.length > 0;
    const parsed = isKoreanSource ? buildParsedDocumentFromCache(doc) : window.AppParse.parseDocument(doc.rawText);

    if (parsed.sentences.length === 0) {
      window.AppDialog.alert('이 지문에서 문장을 인식하지 못했습니다.');
      return;
    }

    state.currentDocument = doc;
    state.settings.lang = doc.lang || 'en-US';
    state.settings.rate = doc.rate || 1.0;
    state.document = parsed;
    state.currentIndex = 0;
    state.currentStep = 1;
    state.listenAndType = false;
    state.isRevealing = false;
    state.sessionStats = [];
    state.sessionSentencesCompleted = 0;
    state.sessionStartedAt = Date.now();
    state.sessionRetryCount = 0;
    state.sessionWriteCount = 0;
    state.currentSentenceWriteCount = 0;
    state.lastSentenceWriteCount = 0;
    state.markSentenceWriteCounts = [];
    state.currentSentenceRetries = 0;
    state.typingStartTime = null;
    state.studyMode = 'full';
    state.markInProgress = false;

    el.toggleListenAndType.checked = false;

    if (!isKoreanSource) {
      const guidance = doc.translateGuidance;
      window.AppTranslate.translateAllSentencesQueued(parsed.sentences, (sentence) => {
        if (state.document && getCurrentSentence(ctx) === sentence) {
          renderKoreanPanel(ctx);
        }
      }, guidance);
    }

    showScreen('study');
    renderStudyScreen(ctx);
    startSessionClock(ctx);
    autoSpeakCurrentSentence(ctx);
  }

  function restartSameSession(ctx) {
    const { state, showScreen } = ctx;
    if (state.studyMode === 'single' && state.singleVaultId) {
      window.AppStorage.getVaultSentence(state.singleVaultId).then((item) => {
        if (item) {
          startSingleSession(ctx, item, { returnScreen: state.singleReturnScreen || 'single' });
        } else {
          showScreen('single');
        }
      });
      return;
    }
    if (!state.document || !state.currentDocument) {
      showScreen('library');
      return;
    }
    if (state.studyMode === 'mark' || state.studyMode === 'boss') {
      startMarkSession(ctx, state.currentDocument, {
        markIndex: state.markIndex,
        sentenceIndices: state.sentenceIndices,
      });
      return;
    }
    state.currentIndex = 0;
    state.currentStep = 1;
    state.isRevealing = false;
    state.sessionStats = [];
    state.sessionSentencesCompleted = 0;
    state.sessionStartedAt = Date.now();
    state.sessionRetryCount = 0;
    state.sessionWriteCount = 0;
    state.currentSentenceWriteCount = 0;
    state.lastSentenceWriteCount = 0;
    state.markSentenceWriteCounts = [];
    state.currentSentenceRetries = 0;
    state.typingStartTime = null;
    showScreen('study');
    renderStudyScreen(ctx);
    startSessionClock(ctx);
    autoSpeakCurrentSentence(ctx);
  }

  return {
    getCurrentSentence,
    getWordBoxes,
    replayCurrentSentence,
    autoSpeakCurrentSentence,
    renderSentenceDisplay,
    renderKoreanPanel,
    renderStudyScreen,
    updateLiveGauge,
    submitCurrentSentence,
    startStudySession,
    startMarkSession,
    startSingleSession,
    restartSameSession,
    isMarkSessionActive,
    isSingleSessionActive,
    confirmLeaveMark,
    leaveMarkSession,
    setupStudyMicUi,
    toggleStudyMic,
    stopStudyMic,
    refreshStudyEls,
    ensureStudyDom,
  };
})();
