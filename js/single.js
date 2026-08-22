/* ==========================================================================
   AppSingle — one-sentence chat mode + sentence vault
   ========================================================================== */

window.AppSingle = (function () {
  'use strict';

  let isSending = false;
  let sttLang = 'ko-KR';
  let sttBaseText = '';
  let defaultHint = '';
  let defaultPlaceholder = '';
  const SINGLE_MAX_CHARS = 500;
  const COMPOSER_BASE_HEIGHT = 44;

  function getTranslateGuidance(ctx) {
    const { el } = ctx;
    return window.AppDomain.normalizeTranslateGuidance({
      tone: el.singleTranslateTone ? el.singleTranslateTone.value : '',
      topic: el.singleTranslateTopic ? el.singleTranslateTopic.value : '',
    });
  }

  function setTranslateGuidance(ctx, guidance) {
    const { el } = ctx;
    const g = window.AppDomain.normalizeTranslateGuidance(guidance);
    if (el.singleTranslateTone) el.singleTranslateTone.value = g.tone || '';
    if (el.singleTranslateTopic) el.singleTranslateTopic.value = g.topic || '';
  }

  async function syncTranslateGuidanceUI(ctx) {
    const { el } = ctx;
    if (!el.singleTranslateGuidance) return;
    let show = false;
    try {
      const settings = await window.AppStorage.getTranslateSettings();
      show = window.AppTranslate.isLlmProvider(settings.provider || 'mymemory');
    } catch (err) {
      show = false;
    }
    el.singleTranslateGuidance.hidden = !show;
    if (!show) return;
    try {
      const saved = await window.AppStorage.getSingleTranslateGuidance();
      setTranslateGuidance(ctx, saved);
    } catch (err) {
      /* keep current DOM values */
    }
  }

  function formatGuidanceMeta(guidance) {
    const g = window.AppDomain.normalizeTranslateGuidance(guidance);
    const tones = window.AppDomain.TRANSLATE_TONE_OPTIONS || {};
    const parts = [];
    if (g.tone && tones[g.tone]) {
      parts.push(`톤 · ${tones[g.tone]}`);
    }
    if (g.topic) {
      const topic = g.topic.length > 20 ? `${g.topic.slice(0, 20)}…` : g.topic;
      parts.push(topic);
    }
    return parts.join(' · ');
  }

  function syncComposerInput(ctx) {
    const { el } = ctx;
    const input = el.singleChatInput;
    if (!input) return;

    const len = String(input.value || '').length;
    if (el.singleChatCountValue) {
      el.singleChatCountValue.textContent = String(len);
    }
    if (el.singleChatCount) {
      el.singleChatCount.classList.toggle('is-near-limit', len >= 450);
    }

    // Grow with typed content only — ignore placeholder wrap height.
    if (!String(input.value || '').trim()) {
      input.style.height = `${COMPOSER_BASE_HEIGHT}px`;
      input.classList.remove('is-scrollable');
      return;
    }
    input.style.height = '0px';
    const next = Math.min(Math.max(input.scrollHeight, COMPOSER_BASE_HEIGHT), 160);
    input.style.height = `${next}px`;
    // Show custom scrollbar only when content exceeds one line.
    input.classList.toggle('is-scrollable', next > COMPOSER_BASE_HEIGHT + 2);
  }

  function detectSourceLang(text) {
    const raw = String(text || '');
    const letters = raw.replace(/\s/g, '');
    if (!letters) return 'en';
    const hangul = (letters.match(/[가-힣]/g) || []).length;
    return hangul / letters.length >= 0.3 ? 'ko' : 'en';
  }

  function takeFirstSentence(text, sourceLang) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return { text: '', truncated: false };

    if (sourceLang === 'ko') {
      const list = window.AppParse.parseKoreanSentenceList(trimmed);
      if (list.length > 1) {
        return { text: list[0].koText, truncated: true };
      }
      if (list.length === 1) return { text: list[0].koText, truncated: false };
      return { text: trimmed, truncated: false };
    }

    const parsed = window.AppParse.parseDocument(trimmed);
    if (parsed.sentences.length > 1) {
      return { text: parsed.sentences[0].originalText, truncated: true };
    }
    if (parsed.sentences.length === 1) {
      return { text: parsed.sentences[0].originalText, truncated: false };
    }
    return { text: trimmed, truncated: false };
  }

  async function openChat(ctx) {
    isSending = false;
    setupSttUi(ctx);
    if (ctx.el.btnSingleSend) ctx.el.btnSingleSend.disabled = false;
    if (ctx.el.singleChatInput) ctx.el.singleChatInput.disabled = false;
    syncComposerInput(ctx);
    await syncTranslateGuidanceUI(ctx);
    await ctx.showScreen('single');
  }

  function refreshVaultEls(el) {
    if (!el) return false;
    el.btnOpenVault = document.getElementById('btn-open-vault') || el.btnOpenVault;
    el.btnBackSingleFromVault = document.getElementById('btn-back-single-from-vault') || el.btnBackSingleFromVault;
    el.vaultEmpty = document.getElementById('vault-empty');
    el.vaultList = document.getElementById('vault-list');
    return !!(document.getElementById('screen-vault') && el.vaultList);
  }

  async function openVault(ctx) {
    stopListening(ctx);
    if (window.AppLoadScreens && window.AppLoadScreens.ensureScreen) {
      await window.AppLoadScreens.ensureScreen('vault');
    }
    refreshVaultEls(ctx.el);
    if (!document.getElementById('screen-vault')) {
      await window.AppDialog.alert('문장함 화면을 불러오지 못했어요. 페이지를 강력 새로고침(Cmd+Shift+R)해 주세요.');
      return;
    }
    await ctx.showScreen('vault');
  }

  function setupSttUi(ctx) {
    const { el } = ctx;
    if (!defaultHint && el.singleChatHint) {
      defaultHint = el.singleChatHint.textContent || '';
    }
    if (!defaultPlaceholder && el.singleChatInput) {
      defaultPlaceholder = el.singleChatInput.placeholder || '';
    }

    const supported = window.AppStt && window.AppStt.isSupported();
    if (el.singleSttLang) el.singleSttLang.hidden = !supported;
    if (el.singleSttControls) el.singleSttControls.hidden = !supported;
    if (el.btnSingleMic) {
      el.btnSingleMic.hidden = !supported;
      el.btnSingleMic.disabled = !supported;
      if (!supported) {
        el.btnSingleMic.title = '이 브라우저에서는 음성 입력을 지원하지 않아요';
      }
    }
    if (el.singleChatField) {
      el.singleChatField.classList.toggle('no-stt', !supported);
    }
    if (!supported && el.singleChatHint && !defaultHint.includes('음성')) {
      // Keep default hint; unsupported browsers just hide mic.
    }
    updateListeningUi(ctx, false);
  }

  function resolveSttLang(text) {
    // Match text auto-detect: Hangul-heavy → Korean STT, otherwise English.
    // Empty field defaults to Korean (app locale).
    const raw = String(text || '').trim();
    if (!raw) return 'ko-KR';
    return detectSourceLang(raw) === 'ko' ? 'ko-KR' : 'en-US';
  }

  function updateListeningUi(ctx, listening) {
    const { el } = ctx;
    if (el.btnSingleMic) {
      el.btnSingleMic.classList.toggle('is-listening', listening);
      el.btnSingleMic.setAttribute('aria-pressed', listening ? 'true' : 'false');
      el.btnSingleMic.title = listening ? '듣기 중지' : '음성 입력';
      el.btnSingleMic.setAttribute('aria-label', listening ? '듣기 중지' : '음성 입력');
    }
    if (el.singleComposer) {
      el.singleComposer.classList.toggle('is-listening', listening);
    }
    if (el.singleChatHint) {
      el.singleChatHint.textContent = listening
        ? '듣고 있어요… 다시 누르거나 말을 마치면 멈춰요. 보낸 뒤 번역됩니다.'
        : (defaultHint || el.singleChatHint.textContent);
    }
    if (el.singleChatInput) {
      el.singleChatInput.placeholder = listening
        ? '듣고 있어요…'
        : (defaultPlaceholder || el.singleChatInput.placeholder);
    }
  }

  function stopListening(ctx) {
    if (window.AppStt && window.AppStt.isListening()) {
      window.AppStt.stop();
    }
    if (ctx) updateListeningUi(ctx, false);
  }

  function sttErrorMessage(code) {
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      return '마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.';
    }
    if (code === 'no-speech') {
      return '음성이 감지되지 않았어요. 다시 눌러 말해 보세요.';
    }
    if (code === 'audio-capture') {
      return '마이크를 찾을 수 없어요.';
    }
    if (code === 'unsupported') {
      return '이 브라우저에서는 음성 입력을 지원하지 않아요.';
    }
    return '음성 인식에 실패했어요. 다시 시도해 주세요.';
  }

  function toggleMic(ctx) {
    const { el } = ctx;
    if (!window.AppStt || !window.AppStt.isSupported()) {
      window.AppDialog.alert(sttErrorMessage('unsupported'));
      return;
    }
    if (isSending) return;

    if (window.AppStt.isListening()) {
      stopListening(ctx);
      return;
    }

    sttBaseText = (el.singleChatInput.value || '').trim();
    sttLang = resolveSttLang(sttBaseText);
    updateListeningUi(ctx, true);

    const started = window.AppStt.start({
      lang: sttLang,
      onResult(transcript, isFinal) {
        if (!el.singleChatInput) return;
        const base = sttBaseText;
        const next = base
          ? (base + (base.endsWith(' ') || !transcript ? '' : ' ') + transcript)
          : transcript;
        el.singleChatInput.value = next;
        syncComposerInput(ctx);
        if (isFinal) {
          sttBaseText = next.trim();
        }
      },
      onError(code) {
        updateListeningUi(ctx, false);
        if (code === 'aborted') return;
        if (code === 'no-speech') {
          if (el.singleChatHint) {
            el.singleChatHint.textContent = sttErrorMessage(code);
          }
          return;
        }
        window.AppDialog.alert(sttErrorMessage(code));
      },
      onEnd() {
        updateListeningUi(ctx, false);
      },
    });

    if (!started) {
      updateListeningUi(ctx, false);
    }
  }

  async function renderChat(ctx) {
    const { el } = ctx;
    const log = el.singleChatLog;
    if (!log) return;

    const items = await window.AppStorage.getVaultSentences();
    // Chronological for chat (oldest first)
    const chronological = items.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    if (!chronological.length) {
      log.innerHTML = '<p class="single-chat-empty">문장 한 줄을 보내면 번역이 오고,<br>「지금 외우기」로 학습을 시작할 수 있어요.</p>';
      log.scrollTop = log.scrollHeight;
      return;
    }

    const esc = window.AppUtils.escapeHtml;
    const stamp = window.AppUtils.formatChatStamp;
    log.innerHTML = chronological.map((item) => {
      const userText = item.sourceLang === 'ko' ? item.koText : item.enText;
      const replyPrimary = item.sourceLang === 'ko' ? item.enText : item.koText;
      const replySecondary = item.sourceLang === 'ko' ? item.koText : item.enText;
      const memorized = item.status === 'memorized';
      const badgeClass = memorized ? 'single-status-memorized' : 'single-status-pending';
      const badgeLabel = memorized ? '완료! 😋' : '아직 안 외움';
      const badgeTitle = memorized ? '완료! 맛있게 쩝쩝' : '아직 안 외움';
      const btnLabel = memorized ? '다시 외우기' : '지금 외우기';
      const { date, time } = stamp(item.createdAt);
      const timeHtml = date || time
        ? `<time class="single-bubble-time" datetime="${esc(new Date(item.createdAt || Date.now()).toISOString())}">
            <span class="single-bubble-date">${esc(date)}</span>
            <span class="single-bubble-clock">${esc(time)}</span>
          </time>`
        : '';
      const styleMeta = formatGuidanceMeta(item.translateGuidance);
      const styleHtml = styleMeta
        ? `<p class="single-bubble-style">${esc(styleMeta)}</p>`
        : '';

      return `
        <div class="single-bubble-row single-bubble-row-user" data-vault-id="${esc(item.id)}">
          ${timeHtml}
          <div class="single-bubble single-bubble-user">
            <p class="single-bubble-meta">${item.sourceLang === 'ko' ? '나 · 한글' : '나 · 영어'}</p>
            <p class="single-bubble-text">${esc(userText)}</p>
          </div>
        </div>
        <div class="single-bubble-row single-bubble-row-boa" data-vault-id="${esc(item.id)}">
          <div class="single-bubble single-bubble-boa">
            <div class="single-bubble-ribbon-clip" aria-hidden="true">
              <span class="single-status-ribbon ${badgeClass}" title="${esc(badgeTitle)}" aria-label="${esc(badgeTitle)}">${badgeLabel}</span>
            </div>
            <p class="single-bubble-meta">보아 · 번역</p>
            <p class="single-bubble-text">${esc(replyPrimary)}</p>
            <p class="single-bubble-translation">${esc(replySecondary)}</p>
            ${styleHtml}
            <div class="single-bubble-actions">
              <button type="button" class="btn btn-primary btn-small btn-single-memorize" data-vault-id="${esc(item.id)}">${btnLabel}</button>
              <button type="button" class="btn btn-ghost btn-small btn-single-delete" data-vault-id="${esc(item.id)}">삭제</button>
            </div>
          </div>
          ${timeHtml}
        </div>
      `;
    }).join('');

    log.scrollTop = log.scrollHeight;
  }

  async function renderVault(ctx) {
    const { el } = ctx;
    refreshVaultEls(el);
    const items = await window.AppStorage.getVaultSentences();
    const empty = el.vaultEmpty;
    const list = el.vaultList;
    if (!list) {
      console.error('[renderVault] #vault-list missing');
      return;
    }

    if (!items.length) {
      if (empty) empty.hidden = false;
      list.innerHTML = '';
      return;
    }

    if (empty) empty.hidden = true;
    const esc = window.AppUtils.escapeHtml;
    list.innerHTML = items.map((item) => {
      const memorized = item.status === 'memorized';
      const badgeClass = memorized ? 'single-status-memorized' : 'single-status-pending';
      const badgeLabel = memorized ? '완료! 😋' : '아직 안 외움';
      const badgeTitle = memorized ? '완료! 맛있게 쩝쩝' : '아직 안 외움';
      const btnLabel = memorized ? '다시 외우기' : '외우기';
      return `
        <article class="vault-item" data-vault-id="${esc(item.id)}">
          <div class="vault-item-ribbon-clip" aria-hidden="true">
            <span class="single-status-ribbon ${badgeClass}" title="${esc(badgeTitle)}" aria-label="${esc(badgeTitle)}">${badgeLabel}</span>
          </div>
          <p class="vault-en">${esc(item.enText)}</p>
          <p class="vault-ko">${esc(item.koText)}</p>
          <div class="vault-item-actions">
            <button type="button" class="btn btn-primary btn-small btn-vault-memorize" data-vault-id="${esc(item.id)}">${btnLabel}</button>
            <button type="button" class="btn btn-ghost btn-small btn-vault-delete" data-vault-id="${esc(item.id)}">삭제</button>
          </div>
        </article>
      `;
    }).join('');
  }

  async function sendMessage(ctx) {
    const { el } = ctx;
    if (isSending) return;
    stopListening(ctx);

    const raw = (el.singleChatInput.value || '').trim();
    if (!raw) return;

    if (raw.length >= SINGLE_MAX_CHARS) {
      const goRegister = await window.AppDialog.confirm(
        '500자 이상은 한문장 모드에서 처리할 수 없어요.\n지문 등록하기로 가서 긴 본문을 등록할까요?',
        {
          title: '지문 등록으로 이동',
          okLabel: '등록하러 가기',
          cancelLabel: '취소',
        }
      );
      if (goRegister && window.AppRegister && window.AppRegister.openAddPassageWithText) {
        window.AppRegister.openAddPassageWithText(ctx, raw);
      }
      return;
    }

    isSending = true;
    el.singleChatInput.value = '';
    syncComposerInput(ctx);
    if (el.btnSingleSend) el.btnSingleSend.disabled = true;
    if (el.singleChatInput) el.singleChatInput.disabled = true;

    try {
      const sourceLang = detectSourceLang(raw);
      const { text: first, truncated } = takeFirstSentence(raw, sourceLang);
      if (!first) {
        el.singleChatInput.value = raw;
        syncComposerInput(ctx);
        window.AppDialog.alert('문장을 입력해 주세요.');
        return;
      }

      let enText = '';
      let koText = '';
      const guidance = getTranslateGuidance(ctx);

      if (sourceLang === 'ko') {
        koText = first;
        const en = await window.AppTranslate.translateKoToEn(first, guidance);
        if (!en) {
          el.singleChatInput.value = raw;
          syncComposerInput(ctx);
          const detail = window.AppTranslate.getLastError && window.AppTranslate.getLastError();
          window.AppDialog.alert(detail || '번역에 실패했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        enText = en;
      } else {
        enText = first;
        const sentence = {
          originalText: first,
          koTranslation: null,
          translationStatus: 'idle',
        };
        await window.AppTranslate.translateSentence(sentence, null, guidance);
        if (sentence.translationStatus !== 'done' || !sentence.koTranslation) {
          el.singleChatInput.value = raw;
          syncComposerInput(ctx);
          const detail = window.AppTranslate.getLastError && window.AppTranslate.getLastError();
          window.AppDialog.alert(detail || '번역에 실패했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        koText = sentence.koTranslation;
      }

      await window.AppStorage.saveVaultSentence({
        enText,
        koText,
        sourceLang,
        status: 'pending',
        translateGuidance: guidance,
      });
      await window.AppStorage.saveSingleTranslateGuidance(guidance);

      await renderChat(ctx);

      if (truncated && el.singleChatLog) {
        const note = document.createElement('p');
        note.className = 'single-system-note';
        note.textContent = '한문장 모드라서 첫 문장만 저장했어요.';
        el.singleChatLog.appendChild(note);
        el.singleChatLog.scrollTop = el.singleChatLog.scrollHeight;
      }
    } finally {
      isSending = false;
      if (el.btnSingleSend) el.btnSingleSend.disabled = false;
      if (el.singleChatInput) {
        el.singleChatInput.disabled = false;
        el.singleChatInput.focus();
      }
    }
  }

  async function startMemorize(ctx, vaultId, returnScreen) {
    if (!vaultId) {
      await window.AppDialog.alert('문장을 찾을 수 없어요.');
      return;
    }
    // Unlock speech in this click turn so auto-play still works after awaits.
    if (window.AppTts && window.AppTts.prime) window.AppTts.prime();
    const backScreen = returnScreen || 'single';
    try {
      const item = await window.AppStorage.getVaultSentence(vaultId);
      if (!item || !item.enText) {
        await window.AppDialog.alert('문장을 찾을 수 없어요.');
        return;
      }
      await window.AppStudy.startSingleSession(ctx, item, {
        returnScreen: backScreen,
      });
    } catch (err) {
      console.error('[startMemorize]', err);
      if (window.AppStudy && window.AppStudy.leaveMarkSession) {
        window.AppStudy.leaveMarkSession(ctx);
      }
      if (ctx.state) {
        ctx.state.singleInProgress = false;
        ctx.state.studyMode = null;
        ctx.state.document = null;
      }
      if (ctx.showScreen && ctx.state && ctx.state.currentScreen === 'study') {
        try { await ctx.showScreen(backScreen); } catch (_) { /* ignore */ }
      }
      const detail = (err && err.message) ? String(err.message) : '';
      await window.AppDialog.alert(
        detail && detail.length < 120
          ? `학습을 시작하지 못했어요.\n${detail}`
          : '학습을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'
      );
    }
  }

  async function deleteSentence(ctx, vaultId) {
    if (!vaultId) return;
    const ok = await window.AppDialog.confirm('이 문장을 문장함에서 삭제할까요?', {
      title: '문장 삭제',
      okLabel: '삭제',
      cancelLabel: '취소',
      danger: true,
    });
    if (!ok) return;
    await window.AppStorage.deleteVaultSentence(vaultId);
    if (ctx.state.currentScreen === 'vault') {
      await renderVault(ctx);
    } else {
      await renderChat(ctx);
    }
  }

  return {
    detectSourceLang,
    openChat,
    openVault,
    renderChat,
    renderVault,
    sendMessage,
    syncComposerInput,
    syncTranslateGuidanceUI,
    startMemorize,
    deleteSentence,
    setupSttUi,
    toggleMic,
    stopListening,
  };
})();
