/* ==========================================================================
   AppSelect — enhance native <select> into styled custom dropdowns
   Keeps the original <select> (hidden) so .value / change listeners still work.
   ========================================================================== */

(function () {
  'use strict';

  function closeAll(except) {
    document.querySelectorAll('.app-dropdown.is-open').forEach((dropdown) => {
      if (except && dropdown === except) return;
      setOpen(dropdown, false);
    });
  }

  function setOpen(dropdown, open) {
    dropdown.classList.toggle('is-open', open);
    const trigger = dropdown.querySelector('.app-dropdown-trigger');
    const menu = dropdown.querySelector('.app-dropdown-menu');
    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (menu) menu.hidden = !open;
  }

  function syncFromSelect(dropdown) {
    const select = dropdown.querySelector('select');
    if (!select) return;
    const value = select.value;
    const label = dropdown.querySelector('.app-dropdown-label');
    const selected = Array.from(select.options).find((opt) => opt.value === value);
    if (label) label.textContent = selected ? selected.textContent.trim() : '';
    dropdown.querySelectorAll('.app-dropdown-option').forEach((btn) => {
      const on = btn.dataset.value === value;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function detectVariant(select) {
    if (select.id === 'library-sort' || select.id === 'register-sort') return 'pill';
    if (select.closest('.setting-item') || select.closest('.settings-field')) return 'field';
    return 'field';
  }

  function enhance(select, options) {
    if (!select || select.tagName !== 'SELECT' || select.dataset.appSelectEnhanced === '1') {
      return null;
    }
    select.dataset.appSelectEnhanced = '1';
    select.classList.add('app-select-native');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    const variant = (options && options.variant) || detectVariant(select);
    const dropdown = document.createElement('div');
    dropdown.className = `app-dropdown app-dropdown--${variant}`;
    if (select.id) dropdown.dataset.for = select.id;

    select.parentNode.insertBefore(dropdown, select);
    dropdown.appendChild(select);

    const triggerId = `${select.id || `app-select-${Math.random().toString(36).slice(2, 8)}`}-trigger`;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'app-dropdown-trigger';
    trigger.id = triggerId;
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const ariaLabel = select.getAttribute('aria-label');
    if (ariaLabel) trigger.setAttribute('aria-label', ariaLabel);

    const label = document.createElement('span');
    label.className = 'app-dropdown-label';
    const chevron = document.createElement('span');
    chevron.className = 'app-dropdown-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.append(label, chevron);

    const menu = document.createElement('div');
    menu.className = 'app-dropdown-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-labelledby', triggerId);
    menu.hidden = true;

    Array.from(select.options).forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-dropdown-option';
      btn.setAttribute('role', 'option');
      btn.dataset.value = opt.value;
      btn.textContent = opt.textContent.trim();
      if (opt.disabled) {
        btn.disabled = true;
        btn.classList.add('is-disabled');
      }
      menu.appendChild(btn);
    });

    dropdown.append(trigger, menu);
    syncFromSelect(dropdown);

    if (select.id) {
      const forLabel = document.querySelector(`label[for="${select.id}"]`);
      if (forLabel) forLabel.setAttribute('for', triggerId);
    }

    const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(select, 'value', {
      configurable: true,
      enumerable: true,
      get() {
        return valueDesc.get.call(this);
      },
      set(v) {
        valueDesc.set.call(this, v);
        syncFromSelect(dropdown);
      },
    });

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains('is-open');
      closeAll();
      if (willOpen) setOpen(dropdown, true);
    });

    menu.addEventListener('click', (e) => {
      const option = e.target.closest('.app-dropdown-option');
      if (!option || option.disabled || !menu.contains(option)) return;
      e.preventDefault();
      select.value = option.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncFromSelect(dropdown);
      setOpen(dropdown, false);
      trigger.focus();
    });

    return dropdown;
  }

  function enhanceAll(root) {
    const scope = root || document;
    scope.querySelectorAll('select').forEach((select) => enhance(select));
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.app-dropdown')) return;
    closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  window.AppSelect = { enhance, enhanceAll, closeAll };
})();
