/* ==========================================================================
   AppDialog — custom alert / confirm (replaces window.alert & window.confirm)
   ========================================================================== */

window.AppDialog = (function () {
  'use strict';

  let root = null;
  let titleEl = null;
  let messageEl = null;
  let actionsEl = null;
  let resolveFn = null;
  let previousFocus = null;

  function ensureDom() {
    if (root) return;

    root = document.createElement('div');
    root.id = 'app-dialog-root';
    root.className = 'app-dialog-root';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="app-dialog-backdrop" data-dialog-dismiss="true"></div>
      <div class="app-dialog-panel" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message">
        <p class="app-dialog-eyebrow" id="app-dialog-eyebrow">통통뱀터</p>
        <h2 class="app-dialog-title" id="app-dialog-title">알림</h2>
        <p class="app-dialog-message" id="app-dialog-message"></p>
        <div class="app-dialog-actions" id="app-dialog-actions"></div>
      </div>
    `;
    document.body.appendChild(root);

    titleEl = root.querySelector('#app-dialog-title');
    messageEl = root.querySelector('#app-dialog-message');
    actionsEl = root.querySelector('#app-dialog-actions');

    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-dialog-dismiss="true"]')) {
        close(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!root || root.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    });
  }

  function close(result) {
    if (!root || root.hidden) return;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-open');
    const resolve = resolveFn;
    resolveFn = null;
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try { previousFocus.focus(); } catch (_) { /* ignore */ }
    }
    previousFocus = null;
    if (resolve) resolve(result);
  }

  function open({ title, message, buttons }) {
    ensureDom();
    if (resolveFn) close(false);

    previousFocus = document.activeElement;
    titleEl.textContent = title || '알림';
    messageEl.textContent = message || '';
    actionsEl.innerHTML = '';

    buttons.forEach((btn, index) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `btn ${btn.className || 'btn-ghost'} app-dialog-btn`;
      el.textContent = btn.label;
      el.addEventListener('click', () => close(btn.value));
      actionsEl.appendChild(el);
      if (index === buttons.length - 1 || btn.primary) {
        setTimeout(() => el.focus(), 0);
      }
    });

    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    // Force reflow so CSS transition runs
    void root.offsetWidth;
    root.classList.add('is-open');

    return new Promise((resolve) => {
      resolveFn = resolve;
    });
  }

  function alert(message, options) {
    const opts = options || {};
    return open({
      title: opts.title || '알림',
      message: String(message == null ? '' : message),
      buttons: [
        {
          label: opts.okLabel || '확인',
          className: 'btn-primary',
          value: true,
          primary: true,
        },
      ],
    }).then(() => undefined);
  }

  function confirm(message, options) {
    const opts = options || {};
    return open({
      title: opts.title || '확인',
      message: String(message == null ? '' : message),
      buttons: [
        {
          label: opts.cancelLabel || '취소',
          className: 'btn-ghost',
          value: false,
        },
        {
          label: opts.okLabel || '확인',
          className: opts.danger ? 'btn-primary app-dialog-btn-danger' : 'btn-primary',
          value: true,
          primary: true,
        },
      ],
    }).then((value) => !!value);
  }

  return {
    alert,
    confirm,
  };
})();
