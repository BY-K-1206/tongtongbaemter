/* ==========================================================================
   AppSettings — environment settings (translation provider toggles)
   ========================================================================== */

window.AppSettings = (function () {
  'use strict';

  function esc(text) {
    return window.AppUtils.escapeHtml(String(text == null ? '' : text));
  }

  function modelIsPreset(providerId, model) {
    const presets = window.AppDomain.TRANSLATE_PROVIDER_MODELS[providerId] || [];
    return presets.some((m) => m.id === model);
  }

  function renderModelOptions(providerId, selectedModel) {
    const presets = window.AppDomain.TRANSLATE_PROVIDER_MODELS[providerId] || [];
    const useCustom = selectedModel && !modelIsPreset(providerId, selectedModel);
    const effective = useCustom
      ? '__custom__'
      : (selectedModel || (presets[0] && presets[0].id) || '__custom__');
    const customValue = useCustom ? selectedModel : '';
    const customHidden = effective === '__custom__' ? '' : 'hidden';

    if (!presets.length) {
      return `
        <div class="settings-field">
          <label for="settings-custom-model-${esc(providerId)}">모델</label>
          <input type="text" id="settings-custom-model-${esc(providerId)}" data-custom-model="${esc(providerId)}"
            autocomplete="off" spellcheck="false" placeholder="모델 ID 입력"
            value="${esc(selectedModel || '')}">
        </div>
      `;
    }

    const options = presets.map((m) => `
      <option value="${esc(m.id)}"${effective === m.id ? ' selected' : ''}>${esc(m.label)}</option>
    `).join('');

    return `
      <div class="settings-field">
        <label for="settings-model-${esc(providerId)}">모델</label>
        <select id="settings-model-${esc(providerId)}" data-provider-model="${esc(providerId)}" aria-label="모델">
          ${options}
          <option value="__custom__"${effective === '__custom__' ? ' selected' : ''}>기타 (직접 입력)</option>
        </select>
      </div>
      <div class="settings-field settings-custom-model-row" data-custom-model-row="${esc(providerId)}" ${customHidden}>
        <label for="settings-custom-model-${esc(providerId)}">커스텀 모델명</label>
        <input type="text" id="settings-custom-model-${esc(providerId)}" data-custom-model="${esc(providerId)}"
          autocomplete="off" spellcheck="false" placeholder="모델 ID 입력"
          value="${esc(customValue)}">
      </div>
    `;
  }

  function renderProviderBody(providerId, slot, meta) {
    if (providerId === 'mymemory') {
      return `<p class="settings-hint">${esc(meta.hint)}</p>`;
    }

    // Only openai-compatible needs a user-facing API host; others are built-in.
    const baseField = providerId === 'openai-compatible' ? `
      <div class="settings-field">
        <label for="settings-base-${esc(providerId)}">API 주소</label>
        <input type="url" id="settings-base-${esc(providerId)}" data-provider-base="${esc(providerId)}"
          autocomplete="off" spellcheck="false"
          placeholder="https://openrouter.ai/api/v1"
          value="${esc(slot.baseUrl || '')}">
      </div>
    ` : '';

    const models = window.AppDomain.TRANSLATE_PROVIDER_MODELS[providerId] || [];
    const modelBlock = models.length || providerId === 'openai-compatible'
      ? renderModelOptions(providerId, slot.model || '')
      : '';

    return `
      <p class="settings-hint">${esc(meta.hint)}</p>
      <div class="settings-field">
        <label for="settings-key-${esc(providerId)}">API 키</label>
        <input type="password" id="settings-key-${esc(providerId)}" data-provider-key="${esc(providerId)}"
          autocomplete="off" spellcheck="false" placeholder="API 키 입력"
          value="${esc(slot.apiKey || '')}">
      </div>
      ${modelBlock}
      ${baseField}
    `;
  }

  function providerCardCopy(providerId) {
    const map = {
      mymemory: { name: 'MyMemory', note: '무료 · 키 없음', featured: true },
      anthropic: { name: 'Claude', note: 'API 키' },
      openai: { name: 'ChatGPT', note: 'API 키' },
      gemini: { name: 'Gemini', note: 'API 키' },
      'openai-compatible': { name: 'OpenAI 호환', note: '주소 · 키' },
    };
    return map[providerId] || { name: providerId, note: '' };
  }

  function renderToggles(ctx, settings) {
    const { el } = ctx;
    const toggles = el.settingsProviderToggles;
    const panels = el.settingsProviderPanels;
    if (!toggles || !panels) return;

    const active = settings.provider || 'mymemory';

    toggles.innerHTML = window.AppDomain.TRANSLATE_PROVIDERS.map((providerId) => {
      const copy = providerCardCopy(providerId);
      const selected = providerId === active;
      return `
        <button type="button"
          class="settings-provider-card${selected ? ' is-active' : ''}${copy.featured ? ' is-featured' : ''}"
          role="radio"
          aria-checked="${selected ? 'true' : 'false'}"
          data-provider="${esc(providerId)}">
          <span class="settings-provider-card-check" aria-hidden="true"></span>
          <span class="settings-provider-card-copy">
            <span class="settings-provider-card-name">${esc(copy.name)}</span>
            <span class="settings-provider-card-note">${esc(copy.note)}</span>
          </span>
        </button>
      `;
    }).join('');

    panels.innerHTML = window.AppDomain.TRANSLATE_PROVIDERS.map((providerId) => {
      const meta = window.AppDomain.TRANSLATE_PROVIDER_META[providerId] || { label: providerId, hint: '' };
      const slot = providerId === 'mymemory'
        ? { apiKey: '', model: '', baseUrl: '' }
        : (settings.providers && settings.providers[providerId]) || { apiKey: '', model: '', baseUrl: '' };
      const selected = providerId === active;
      return `
        <div class="settings-provider-panel${selected ? ' is-active' : ''}"
          data-provider="${esc(providerId)}"
          role="tabpanel"
          ${selected ? '' : 'hidden'}>
          ${renderProviderBody(providerId, slot, meta)}
        </div>
      `;
    }).join('');

    if (window.AppSelect) window.AppSelect.enhanceAll(panels);
  }

  function readProviderSlotFromDom(root, providerId) {
    if (providerId === 'mymemory') {
      return { apiKey: '', model: '', baseUrl: '' };
    }

    const keyInput = root.querySelector(`[data-provider-key="${providerId}"]`);
    const baseInput = root.querySelector(`[data-provider-base="${providerId}"]`);
    const select = root.querySelector(`[data-provider-model="${providerId}"]`);
    const customInput = root.querySelector(`[data-custom-model="${providerId}"]`);
    const defaults = window.AppDomain.TRANSLATE_PROVIDER_DEFAULTS[providerId] || {};
    const selected = select ? String(select.value || '') : '';

    let model = '';
    if (select && selected === '__custom__') {
      model = String((customInput && customInput.value) || '').trim();
    } else if (select && selected) {
      model = selected;
    } else if (customInput) {
      model = String(customInput.value || '').trim();
    } else {
      model = defaults.model || '';
    }

    let baseUrl = String(defaults.baseUrl || '').trim().replace(/\/+$/, '');
    if (providerId === 'openai-compatible') {
      baseUrl = String((baseInput && baseInput.value) || '').trim().replace(/\/+$/, '');
    }

    return {
      apiKey: String((keyInput && keyInput.value) || '').trim(),
      model: model || defaults.model || '',
      baseUrl,
    };
  }

  function getActiveProvider(ctx) {
    const toggle = ctx.el.settingsProviderToggles
      && ctx.el.settingsProviderToggles.querySelector('.settings-provider-card.is-active');
    return (toggle && toggle.dataset.provider) || 'mymemory';
  }

  function readForm(ctx) {
    const { el } = ctx;
    const root = el.settingsProviderPanels;
    const provider = getActiveProvider(ctx);

    const providers = {};
    window.AppDomain.KEYED_TRANSLATE_PROVIDERS.forEach((id) => {
      providers[id] = readProviderSlotFromDom(root, id);
    });

    return window.AppDomain.normalizeTranslateSettings({ provider, providers });
  }

  function showStatus(ctx, message, kind) {
    const { el } = ctx;
    if (!el.settingsTranslateStatus) return;
    el.settingsTranslateStatus.hidden = !message;
    el.settingsTranslateStatus.textContent = message || '';
    el.settingsTranslateStatus.className = kind === 'error'
      ? 'error-text'
      : kind === 'success'
        ? 'success-text'
        : 'info-text';
  }

  function setActiveProvider(ctx, providerId) {
    const { el } = ctx;
    if (el.settingsProviderToggles) {
      el.settingsProviderToggles.querySelectorAll('.settings-provider-card').forEach((btn) => {
        const selected = btn.dataset.provider === providerId;
        btn.classList.toggle('is-active', selected);
        btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      });
    }
    if (el.settingsProviderPanels) {
      el.settingsProviderPanels.querySelectorAll('.settings-provider-panel').forEach((panel) => {
        const selected = panel.dataset.provider === providerId;
        panel.classList.toggle('is-active', selected);
        panel.hidden = !selected;
      });
    }
  }

  function onToggleClick(ctx, e) {
    const btn = e.target.closest('.settings-provider-card');
    if (!btn) return;
    if (window.AppSelect) window.AppSelect.closeAll();
    setActiveProvider(ctx, btn.dataset.provider);
    showStatus(ctx, '', 'info');
  }

  function onPanelChange(ctx, e) {
    const select = e.target.closest && e.target.closest('select[data-provider-model]');
    if (!select) return;
    const providerId = select.dataset.providerModel;
    const panel = select.closest('.settings-provider-panel');
    const row = panel && panel.querySelector(`[data-custom-model-row="${providerId}"]`);
    if (row) row.hidden = select.value !== '__custom__';
  }

  async function render(ctx) {
    const settings = await window.AppStorage.getTranslateSettings();
    renderToggles(ctx, settings);
    showStatus(ctx, '', 'info');
  }

  async function save(ctx) {
    const settings = readForm(ctx);
    if (settings.provider !== 'mymemory' && !settings.apiKey) {
      showStatus(ctx, 'API 키를 입력해 주세요.', 'error');
      return;
    }
    if (settings.provider === 'openai-compatible' && !settings.baseUrl) {
      showStatus(ctx, 'OpenAI 호환 API 주소를 입력해 주세요.', 'error');
      return;
    }
    if (settings.provider !== 'mymemory' && !settings.model) {
      showStatus(ctx, '모델을 선택하거나 입력해 주세요.', 'error');
      return;
    }

    await window.AppStorage.saveTranslateSettings(settings);
    showStatus(ctx, '번역 설정을 저장했어요.', 'success');
    if (window.AppRegister && window.AppRegister.syncTranslateGuidanceUI) {
      window.AppRegister.syncTranslateGuidanceUI(ctx);
    }
    if (window.AppSingle && window.AppSingle.syncTranslateGuidanceUI) {
      window.AppSingle.syncTranslateGuidanceUI(ctx);
    }
  }

  async function test(ctx) {
    const settings = readForm(ctx);
    await window.AppStorage.saveTranslateSettings(settings);
    showStatus(ctx, '번역 테스트 중…', 'info');

    const result = await window.AppTranslate.testTranslation();
    if (!result.ok) {
      showStatus(ctx, result.error || '번역 테스트에 실패했어요.', 'error');
      return;
    }
    showStatus(ctx, `테스트 성공: “${result.sample}” → “${result.translated}”`, 'success');
  }

  return {
    render,
    save,
    test,
    onToggleClick,
    onPanelChange,
    readForm,
  };
})();
