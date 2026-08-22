/* ==========================================================================
   AppRegister — document list management + add/edit form
   ========================================================================== */

window.AppRegister = (function () {
  'use strict';

  function getTranslateGuidance(ctx) {
    const { el } = ctx;
    return window.AppDomain.normalizeTranslateGuidance({
      tone: el.inputTranslateTone ? el.inputTranslateTone.value : '',
      topic: el.inputTranslateTopic ? el.inputTranslateTopic.value : '',
    });
  }

  function setTranslateGuidance(ctx, guidance) {
    const { el } = ctx;
    const g = window.AppDomain.normalizeTranslateGuidance(guidance);
    if (el.inputTranslateTone) el.inputTranslateTone.value = g.tone || '';
    if (el.inputTranslateTopic) el.inputTranslateTopic.value = g.topic || '';
  }

  async function syncTranslateGuidanceUI(ctx) {
    const { state, el } = ctx;
    let showLlm = false;
    try {
      const settings = await window.AppStorage.getTranslateSettings();
      showLlm = window.AppTranslate.isLlmProvider(settings.provider || 'mymemory');
    } catch (err) {
      showLlm = false;
    }

    const sourceLang = state.editingDocumentId
      ? (state.editingSourceLang || 'en')
      : getSelectedLangMode(ctx);
    const showGuidance = showLlm && sourceLang === 'ko';
    // Char cap only matters when this form will call LLM translate (Korean → English).
    const showCharLimit = showGuidance;

    if (el.inputTranslateGuidance) el.inputTranslateGuidance.hidden = !showGuidance;
    if (el.inputPassageCharLimitNote) {
      const max = window.AppDomain.TRANSLATE_LIMITS.passageMaxChars;
      el.inputPassageCharLimitNote.textContent = `LLM 번역 ${max.toLocaleString('ko-KR')}자 상한`;
      el.inputPassageCharLimitNote.hidden = !showCharLimit;
    }
    if (el.inputPassageCharCount) el.inputPassageCharCount.hidden = !showCharLimit;
    updatePassageCharCount(ctx);
  }

  function updatePassageCharCount(ctx) {
    const { el } = ctx;
    if (!el.inputPassageCharCount || el.inputPassageCharCount.hidden) return;
    const max = window.AppDomain.TRANSLATE_LIMITS.passageMaxChars;
    const used = window.AppDomain.countPassageChars(el.inputTextarea ? el.inputTextarea.value : '');
    el.inputPassageCharCount.textContent = `${used.toLocaleString('ko-KR')} / ${max.toLocaleString('ko-KR')}`;
    el.inputPassageCharCount.classList.toggle('is-over', used > max);
  }

  function getSelectedLangMode(ctx) {
    const radios = ctx.el.inputLangModeRadios;
    if (radios && radios.length) {
      const checked = Array.from(radios).find((r) => r.checked);
      if (checked) return checked.value === 'ko' ? 'ko' : 'en';
    }
    return 'en';
  }

  function setSelectedLangMode(ctx, mode) {
    const value = mode === 'ko' ? 'ko' : 'en';
    const radios = ctx.el.inputLangModeRadios;
    if (!radios || !radios.length) return;
    Array.from(radios).forEach((radio) => {
      radio.checked = radio.value === value;
      radio.disabled = false;
    });
  }

  function setEntryTab(ctx, tab) {
    const { el } = ctx;
    const next = tab === 'upload' ? 'upload' : 'type';
    const showUpload = next === 'upload';

    if (el.btnEntryTabType) {
      el.btnEntryTabType.classList.toggle('is-active', !showUpload);
      el.btnEntryTabType.setAttribute('aria-selected', showUpload ? 'false' : 'true');
    }
    if (el.btnEntryTabUpload) {
      el.btnEntryTabUpload.classList.toggle('is-active', showUpload);
      el.btnEntryTabUpload.setAttribute('aria-selected', showUpload ? 'true' : 'false');
    }
    if (el.inputEntryPaneType) el.inputEntryPaneType.hidden = showUpload;
    if (el.inputEntryPaneUpload) el.inputEntryPaneUpload.hidden = !showUpload;
  }

  function parseTags(raw) {
    const seen = new Set();
    const tags = [];
    String(raw || '')
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((tag) => {
        const key = tag.toLowerCase();
        if (seen.has(key) || tags.length >= 8) return;
        seen.add(key);
        tags.push(tag);
      });
    return tags;
  }

  function updateInputModeUI(ctx) {
    const { el } = ctx;
    const mode = getSelectedLangMode(ctx);
    if (mode === 'ko') {
      el.inputTextarea.placeholder = '\uc5ec\uae30\uc5d0 \ud55c\uad6d\uc5b4 \uc9c0\ubb38\uc744 \ubd99\uc5ec\ub123\uc73c\uc138\uc694. (\ubb38\ub2e8\uc740 \ube48 \uc904\ub85c \uad6c\ubd84\ub429\ub2c8\ub2e4)';
      el.inputModeHint.textContent = '\ub4f1\ub85d \uc2dc \uac01 \ubb38\uc7a5\uc774 \uc790\ub3d9\uc73c\ub85c \uc601\uc5b4\ub85c \ubc88\uc5ed\ub418\uace0, \ubc88\uc5ed\ub41c \uc601\uc5b4 \ubb38\uc7a5\uc744 \uc554\uae30\ud558\uac8c \ub429\ub2c8\ub2e4. \uc6d0\ubb38 \ud55c\uad6d\uc5b4\ub294 1\ub2e8\uacc4 \ubc88\uc5ed \ud328\ub110\uc5d0 \ud45c\uc2dc\ub429\ub2c8\ub2e4.';
    } else {
      el.inputTextarea.placeholder = '\uc5ec\uae30\uc5d0 \uc601\uc5b4 \uc9c0\ubb38\uc744 \ubd99\uc5ec\ub123\uc73c\uc138\uc694. (\ubb38\ub2e8\uc740 \ube48 \uc904\ub85c \uad6c\ubd84\ub429\ub2c8\ub2e4)';
      el.inputModeHint.textContent = '\uc601\uc5b4 \uc9c0\ubb38\uc740 \uadf8\ub300\ub85c \uc554\uae30\ud558\uace0, \ubb38\uc7a5 \uc544\ub798\uc5d0 \ud55c\uad6d\uc5b4 \ubc88\uc5ed\uc774 \ud568\uaed8 \ud45c\uc2dc\ub429\ub2c8\ub2e4.';
    }
    updateDifficultyPreview(ctx);
    syncTranslateGuidanceUI(ctx);
  }

  function updateRegisterScreenMode(ctx) {
    const { state, el } = ctx;
    const isEditing = !!state.editingDocumentId;
    el.inputTitle.textContent = isEditing
      ? '지문을 수정해보세요'
      : '삼키고 싶은 지문을 등록해 주세요';
    el.inputSubtitle.textContent = isEditing
      ? '오타나 어색한 부분을 고치고 다시 저장하세요. 학습 기록과 랭킹은 그대로 유지돼요.'
      : '긴 연설문이나 사설을 붙여넣으면 문장 단위로 자동 분석해서 보아뱀 먹이 창고에 저장합니다.';
    el.btnRegisterPassage.textContent = isEditing ? '수정 완료' : '지문 등록하기';
    syncRegisterFormChrome(ctx);
  }

  // Create mode: language radios + entry tabs (type/upload) + textarea.
  // Edit ko: both Korean + English fields visible (no tab switch).
  // Edit en: English-only textarea.
  function syncRegisterFormChrome(ctx) {
    const { state, el } = ctx;
    const isEditing = !!state.editingDocumentId;
    const sourceLang = isEditing ? (state.editingSourceLang || 'en') : getSelectedLangMode(ctx);

    if (el.inputLangMode) {
      el.inputLangMode.hidden = isEditing;
    }
    if (el.inputLangModeRadios) {
      Array.from(el.inputLangModeRadios).forEach((radio) => {
        radio.disabled = isEditing;
      });
    }
    if (el.inputEntryTabs) el.inputEntryTabs.hidden = isEditing;
    if (isEditing) {
      setEntryTab(ctx, 'type');
    }

    if (!isEditing) {
      el.inputKoField.hidden = false;
      el.inputEnField.hidden = true;
      el.inputTextareaLabel.textContent = '학습할 지문';
      updateInputModeUI(ctx);
      return;
    }

    if (sourceLang === 'ko') {
      el.inputKoField.hidden = false;
      el.inputEnField.hidden = false;
      el.inputTextareaLabel.textContent = '한글 지문';
      el.inputModeHint.textContent = '한글을 고친 뒤 「다시 번역」하거나, 아래 영어를 직접 수정하세요.';
      el.inputTextarea.placeholder = '한글 지문을 수정하세요.';
      el.inputEnglishTextareaLabel.textContent = '학습용 영어';
    } else {
      el.inputKoField.hidden = false;
      el.inputEnField.hidden = true;
      el.inputTextareaLabel.textContent = '영어 지문';
      el.inputModeHint.textContent = '영어 원문을 수정할 수 있어요. 한국어 해석은 학습 시 자동으로 불러옵니다.';
      el.inputTextarea.placeholder = '영어 지문을 수정하세요.';
    }
    updateDifficultyPreview(ctx);
  }
  // Rebuild cached English sentences from the editable English box, aligning
  // Korean translations by sentence index when possible.
  function buildCachedSentencesFromEnglishEdit(koRaw, enRaw) {
    const koList = window.AppParse.parseKoreanSentenceList(koRaw);
    const enParsed = window.AppParse.parseDocument(enRaw);
    return enParsed.sentences.map((s, i) => Object.assign({}, s, {
      koTranslation: (koList[i] && koList[i].koText) || '',
      translationStatus: (koList[i] && koList[i].koText) ? 'done' : 'error',
    }));
  }

  function cachedSentencesToEnglishText(cached) {
    if (!Array.isArray(cached)) return '';
    return cached.map((s) => s.originalText || '').filter(Boolean).join('\n\n');
  }

  function updateRoadmapPreview(ctx) {
    const { el } = ctx;
    if (!el.inputRoadmapPreview) return;
    const perDay = Math.max(1, Math.floor(Number(el.inputSentencesPerDay.value) || 3));
    el.inputSentencesPerDay.value = String(perDay);

    let sentenceCount = 0;
    const isEditing = !!ctx.state.editingDocumentId;
    const mode = isEditing ? (ctx.state.editingSourceLang || 'en') : getSelectedLangMode(ctx);
    if (mode === 'ko') {
      const enRaw = el.inputEnglishTextarea.value.trim();
      if (enRaw) sentenceCount = window.AppParse.parseDocument(enRaw).sentences.length;
      else {
        const koRaw = el.inputTextarea.value.trim();
        if (koRaw) sentenceCount = window.AppParse.parseKoreanSentenceList(koRaw).length;
      }
    } else {
      const raw = el.inputTextarea.value.trim();
      if (raw) sentenceCount = window.AppParse.parseDocument(raw).sentences.length;
    }

    if (!sentenceCount) {
      el.inputRoadmapPreview.textContent = `하루 ${perDay}문장씩 · 본문을 입력하면 학습 일정이 표시됩니다.`;
      return;
    }
    const marks = window.AppDomain.buildMarks(sentenceCount, perDay);
    el.inputRoadmapPreview.textContent =
      `현재 지문에 ${sentenceCount}개의 문장이 있습니다. 하루 ${perDay}문장씩 ${marks.length}파트에 걸쳐 외우게 됩니다.`;
  }

  function getDifficultyStars(ctx) {
    const root = ctx.el.inputDifficultyStars;
    if (!root) return 3;
    // Prefer the selected star (.is-active). Never use the first .is-on —
    // stars 1..N are all .is-on, so querySelector would always return 1.
    const active = root.querySelector('.difficulty-star-btn.is-active');
    if (active) {
      return window.AppDomain.clampDifficultyStars(active.dataset.stars);
    }
    const lit = Array.from(root.querySelectorAll('.difficulty-star-btn.is-on'))
      .map((btn) => Number(btn.dataset.stars) || 0)
      .filter((n) => n > 0);
    if (lit.length) {
      return window.AppDomain.clampDifficultyStars(Math.max(...lit));
    }
    return 3;
  }

  function setDifficultyStars(ctx, stars) {
    const { el } = ctx;
    const value = window.AppDomain.clampDifficultyStars(stars);
    if (!el.inputDifficultyStars) return;
    el.inputDifficultyStars.querySelectorAll('.difficulty-star-btn').forEach((btn) => {
      const n = Number(btn.dataset.stars);
      const on = n <= value;
      btn.classList.toggle('is-on', on);
      btn.classList.toggle('is-active', n === value);
      btn.setAttribute('aria-checked', n === value ? 'true' : 'false');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function updateDifficultyPreview(ctx) {
    // Stars are user-set; keep this hook for roadmap/sentence-count side effects.
    updateRoadmapPreview(ctx);
    updatePassageCharCount(ctx);
  }

  function resetRegisterForm(ctx) {
    const { state, el } = ctx;
    state.editingDocumentId = null;
    state.editingSourceLang = null;
    state.editLangTab = 'ko';
    el.inputDocTitle.value = '';
    el.inputDocTags.value = '';
    el.inputSentencesPerDay.value = '3';
    el.inputTextarea.value = '';
    el.inputEnglishTextarea.value = '';
    if (el.uploadFilename) el.uploadFilename.textContent = '';
    if (el.inputFileUpload) el.inputFileUpload.value = '';
    el.inputError.hidden = true;
    el.inputProgress.hidden = true;
    el.inputSuccess.hidden = true;
    if (el.btnRegisterPassage) el.btnRegisterPassage.disabled = false;
    if (el.btnRetranslateKo) el.btnRetranslateKo.disabled = false;
    setDifficultyStars(ctx, 3);
    setTranslateGuidance(ctx, { tone: '', topic: '' });
    if (el.inputLangMode) el.inputLangMode.hidden = false;
    setSelectedLangMode(ctx, 'en');
    setEntryTab(ctx, 'type');
    el.settingLang.value = 'en-US';
    el.settingRate.value = '1.0';
    el.settingRateValue.textContent = '1.0x';
    updateRegisterScreenMode(ctx);
    updateRoadmapPreview(ctx);
    syncTranslateGuidanceUI(ctx);
  }

  function openAddPassage(ctx) {
    resetRegisterForm(ctx);
    ctx.showScreen('register-form');
  }

  function openAddPassageWithText(ctx, text) {
    const { el } = ctx;
    resetRegisterForm(ctx);
    const raw = String(text || '').trim();
    if (raw) {
      el.inputTextarea.value = raw;
      const sourceLang = /[가-힣]/.test(raw.replace(/\s/g, ''))
        && ((raw.match(/[가-힣]/g) || []).length / Math.max(1, raw.replace(/\s/g, '').length) >= 0.3)
        ? 'ko'
        : 'en';
      if (el.inputLangMode) el.inputLangMode.hidden = false;
      setSelectedLangMode(ctx, sourceLang);
      setEntryTab(ctx, 'type');
      updateInputModeUI(ctx);
      updateDifficultyPreview(ctx);
      updateRoadmapPreview(ctx);
    }
    ctx.showScreen('register-form');
  }

  async function renderDocumentList(ctx) {
    const { state, el } = ctx;
    const allDocs = await window.AppStorage.getDocuments();
    const allCount = allDocs.length;
    const documents = await window.AppStorage.filterSortDocuments({
      query: state.registerQuery,
      sort: state.registerSort,
    });
    el.registerList.innerHTML = '';

    if (!allCount) {
      el.registerListEmpty.hidden = false;
      el.registerListEmpty.innerHTML = '「+」 버튼으로 새 지문을 등록해보세요.';
      return;
    }
    if (!documents.length) {
      el.registerListEmpty.hidden = false;
      el.registerListEmpty.textContent = '검색 결과가 없어요. 다른 제목이나 태그를 입력해보세요.';
      return;
    }

    el.registerListEmpty.hidden = true;
    for (const doc of documents) {
      const card = document.createElement('div');
      card.className = 'document-card';
      card.dataset.id = doc.id;
      const infoHtml = await window.AppLibrary.buildDocumentCardInfoHtml(doc);
      card.innerHTML = `
        ${infoHtml}
        <div class="document-card-actions document-card-actions--register">
          <button class="btn btn-ghost btn-small btn-edit-document" type="button" data-id="${doc.id}">\uc218\uc815</button>
          <button class="btn btn-ghost btn-small btn-delete-document" type="button" data-id="${doc.id}">\uc0ad\uc81c</button>
          <button class="btn btn-primary btn-small btn-study-document" type="button" data-id="${doc.id}">\ud559\uc2b5\ud558\uae30</button>
        </div>
      `;
      el.registerList.appendChild(card);
    }
  }

  function startEditDocument(ctx, doc) {
    const { state, el } = ctx;
    state.editingDocumentId = doc.id;
    state.editingSourceLang = doc.sourceLang || 'en';
    state.editLangTab = 'ko';
    el.inputDocTitle.value = doc.title || '';
    el.inputDocTags.value = Array.isArray(doc.tags) ? doc.tags.join(', ') : '';
    el.inputSentencesPerDay.value = String(doc.sentencesPerDay || 3);
    el.inputTextarea.value = doc.rawText || '';
    el.uploadFilename.textContent = '';
    el.inputError.hidden = true;
    el.inputProgress.hidden = true;
    el.inputSuccess.hidden = true;
    const stars = doc.difficultyStars != null
      ? doc.difficultyStars
      : window.AppDomain.levelToDifficultyStars(doc.difficultyLevel || 2);
    setDifficultyStars(ctx, stars);
    if (el.inputLangMode) el.inputLangMode.hidden = true;
    setSelectedLangMode(ctx, doc.sourceLang || 'en');
    if (el.inputLangModeRadios) {
      Array.from(el.inputLangModeRadios).forEach((radio) => {
        radio.disabled = true;
      });
    }
    el.settingLang.value = doc.lang || 'en-US';
    el.settingRate.value = String(doc.rate || 1.0);
    el.settingRateValue.textContent = `${parseFloat(doc.rate || 1.0).toFixed(1)}x`;

    if (doc.sourceLang === 'ko') {
      el.inputEnglishTextarea.value = cachedSentencesToEnglishText(doc.cachedSentences);
    } else {
      el.inputEnglishTextarea.value = '';
    }

    setTranslateGuidance(ctx, doc.translateGuidance);
    updateRegisterScreenMode(ctx);
    syncTranslateGuidanceUI(ctx);
    ctx.showScreen('register-form');
  }

  function showInputError(ctx, msg) {
    const { el } = ctx;
    el.inputProgress.hidden = true;
    el.inputSuccess.hidden = true;
    el.inputError.hidden = false;
    el.inputError.textContent = msg;
  }

  function showInputProgress(ctx, msg) {
    const { el } = ctx;
    el.inputError.hidden = true;
    el.inputSuccess.hidden = true;
    el.inputProgress.hidden = false;
    el.inputProgress.textContent = msg;
  }

  async function finalizeRegistration(ctx, rawText, sentences, sourceLang) {
    const { state, el } = ctx;
    const title = el.inputDocTitle.value.trim() || window.AppUtils.generateAutoTitle(rawText);
    const isEditing = !!state.editingDocumentId;
    const tags = parseTags(el.inputDocTags.value);
    const difficultyStars = getDifficultyStars(ctx);
    const difficultyLevel = window.AppDomain.starsToDifficultyLevel(difficultyStars);
    const sentencesPerDay = Math.max(1, Math.floor(Number(el.inputSentencesPerDay.value) || 3));

    const payload = {
      title,
      rawText,
      lang: el.settingLang.value,
      rate: parseFloat(el.settingRate.value),
      sentenceCount: sentences.length,
      sourceLang,
      cachedSentences: sourceLang === 'ko' ? sentences : null,
      tags,
      difficultyStars,
      difficultyScore: difficultyStars,
      difficultyLevel,
      sentencesPerDay,
      translateGuidance: getTranslateGuidance(ctx),
    };

    if (isEditing) {
      await window.AppStorage.updateDocument(state.editingDocumentId, payload);
    } else {
      await window.AppStorage.saveDocument(payload);
    }

    el.inputError.hidden = true;
    el.inputProgress.hidden = true;
    el.inputSuccess.hidden = false;
    el.inputSuccess.textContent = isEditing
      ? `"${title}" \uc9c0\ubb38\uc774 \uc218\uc815\ub418\uc5c8\uc5b4\uc694!`
      : `"${title}" \uc9c0\ubb38\uc774 \ub4f1\ub85d\ub418\uc5c8\uc5b4\uc694!`;
    el.btnRegisterPassage.disabled = false;

    setTimeout(() => {
      el.inputSuccess.hidden = true;
      resetRegisterForm(ctx);
      ctx.showScreen('register');
    }, 900);
  }

  function llmPassageLimitError(rawText) {
    const max = window.AppDomain.TRANSLATE_LIMITS.passageMaxChars;
    const used = window.AppDomain.countPassageChars(rawText);
    return `LLM 번역은 지문 ${max.toLocaleString('ko-KR')}자까지예요. 지금 ${used.toLocaleString('ko-KR')}자라서 조금 줄여 주세요.`;
  }

  async function ensureLlmPassageWithinLimit(rawText) {
    const settings = await window.AppStorage.getTranslateSettings();
    if (!window.AppTranslate.isLlmProvider(settings.provider || 'mymemory')) return null;
    if (!window.AppDomain.isPassageOverTranslateLimit(rawText)) return null;
    return llmPassageLimitError(rawText);
  }

  async function registerPassage(ctx) {
    const { state, el } = ctx;
    const rawText = el.inputTextarea.value.trim();
    const mode = state.editingDocumentId
      ? (state.editingSourceLang || 'en')
      : getSelectedLangMode(ctx);

    if (mode === 'ko') {
      // Korean body lives in input-textarea; English in input-english-textarea.
      if (!rawText) {
        showInputError(ctx, '한글 지문을 입력해 주세요.');
        return;
      }

      const koList = window.AppParse.parseKoreanSentenceList(rawText);
      if (koList.length === 0) {
        showInputError(ctx, '한글 문장을 인식하지 못했습니다. 지문을 확인해 주세요.');
        return;
      }

      if (state.editingDocumentId) {
        const enRaw = el.inputEnglishTextarea.value.trim();
        if (!enRaw) {
          showInputError(ctx, '영어 지문이 비어 있어요. 직접 수정하거나 「다시 번역」을 눌러주세요.');
          return;
        }
        const sentences = buildCachedSentencesFromEnglishEdit(rawText, enRaw);
        if (!sentences.length) {
          showInputError(ctx, '영어 문장을 인식하지 못했습니다. 영어 본문을 확인해 주세요.');
          return;
        }
        try {
          await finalizeRegistration(ctx, rawText, sentences, 'ko');
        } catch (err) {
          console.error(err);
          showInputError(ctx, '지문 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
          el.btnRegisterPassage.disabled = false;
        }
        return;
      }

      const limitError = await ensureLlmPassageWithinLimit(rawText);
      if (limitError) {
        showInputError(ctx, limitError);
        return;
      }

      el.btnRegisterPassage.disabled = true;
      showInputProgress(ctx, `번역하는 중...`);

      try {
        const guidance = getTranslateGuidance(ctx);
        const sentences = await window.AppTranslate.buildEnglishSentencesFromKorean(rawText, (done, total) => {
          if (!done) {
            showInputProgress(ctx, `문장 ${total}개를 한 번에 번역하는 중...`);
          } else {
            showInputProgress(ctx, `번역하는 중... (${done}/${total})`);
          }
        }, guidance);
        if (!sentences.length) {
          showInputError(ctx, window.AppTranslate.getLastError() || '번역에 실패했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        await finalizeRegistration(ctx, rawText, sentences, 'ko');
      } catch (err) {
        console.error(err);
        const detail = window.AppTranslate.getLastError && window.AppTranslate.getLastError();
        showInputError(ctx, detail || '번역에 실패했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        el.btnRegisterPassage.disabled = false;
      }
      return;
    }

    if (!rawText) {
      showInputError(ctx, '학습할 지문을 입력하거나 파일을 업로드해 주세요.');
      return;
    }

    const parsed = window.AppParse.parseDocument(rawText);
    if (parsed.sentences.length === 0) {
      showInputError(ctx, '문장을 인식하지 못했습니다. 지문을 확인해 주세요.');
      return;
    }

    try {
      await finalizeRegistration(ctx, rawText, parsed.sentences, 'en');
    } catch (err) {
      console.error(err);
      showInputError(ctx, '지문 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
      el.btnRegisterPassage.disabled = false;
    }
  }

  async function retranslateKoreanSource(ctx) {
    const { el } = ctx;
    const rawText = el.inputTextarea.value.trim();
    if (!rawText) {
      showInputError(ctx, '한글 지문을 먼저 입력해 주세요.');
      return;
    }
    const koList = window.AppParse.parseKoreanSentenceList(rawText);
    if (!koList.length) {
      showInputError(ctx, '한글 문장을 인식하지 못했습니다.');
      return;
    }

    const limitError = await ensureLlmPassageWithinLimit(rawText);
    if (limitError) {
      showInputError(ctx, limitError);
      return;
    }

    el.btnRetranslateKo.disabled = true;
    el.btnRegisterPassage.disabled = true;
    showInputProgress(ctx, `다시 번역하는 중...`);

    try {
      const guidance = getTranslateGuidance(ctx);
      const sentences = await window.AppTranslate.buildEnglishSentencesFromKorean(rawText, (done, total) => {
        if (!done) {
          showInputProgress(ctx, `문장 ${total}개를 한 번에 다시 번역하는 중...`);
        } else {
          showInputProgress(ctx, `다시 번역하는 중... (${done}/${total})`);
        }
      }, guidance);
      if (!sentences.length) {
        showInputError(ctx, window.AppTranslate.getLastError() || '다시 번역에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      el.inputEnglishTextarea.value = cachedSentencesToEnglishText(sentences);
      el.inputProgress.hidden = true;
      el.inputSuccess.hidden = false;
      el.inputSuccess.textContent = '다시 번역됐어요. 필요하면 영어를 다듬어 수정 완료해 주세요.';
      updateDifficultyPreview(ctx);
    } catch (err) {
      showInputError(ctx, '다시 번역에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      el.btnRetranslateKo.disabled = false;
      el.btnRegisterPassage.disabled = false;
    }
  }

  return {
    getSelectedLangMode,
    setSelectedLangMode,
    setEntryTab,
    parseTags,
    updateInputModeUI,
    updateRegisterScreenMode,
    syncRegisterFormChrome,
    updateDifficultyPreview,
    updateRoadmapPreview,
    getDifficultyStars,
    setDifficultyStars,
    getTranslateGuidance,
    setTranslateGuidance,
    syncTranslateGuidanceUI,
    updatePassageCharCount,
    resetRegisterForm,
    openAddPassage,
    openAddPassageWithText,
    renderDocumentList,
    startEditDocument,
    registerPassage,
    retranslateKoreanSource,
  };
})();
