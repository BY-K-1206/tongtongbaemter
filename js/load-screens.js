/* ==========================================================================
   AppLoadScreens — fetch screen HTML partials into #app-root, then boot app.js
   Requires a local HTTP server (file:// cannot fetch screens/).
   ========================================================================== */

(function () {
  'use strict';

  const SCREEN_ORDER = [
    'home',
    'settings',
    'login',
    'admin',
    'register',
    'register-form',
    'library',
    'roadmap',
    'single',
    'vault',
    'study',
    'result',
  ];

  /**
   * Live Server injects before the first </body> or </svg> in HTML responses.
   * Screen partials are fragments; without </body>, inject lands inside SVG
   * icons and truncates/breaks the DOM ("화면 조각이 불완전해요").
   * Partials include a trailing hidden </body> anchor; strip inject + body here.
   */
  function stripLiveServerInject(html) {
    let out = String(html || '');
    out = out.replace(/<!--\s*Code injected by live-server\s*-->\s*<script\b[\s\S]*?<\/script>/gi, '');
    out = out.replace(/<!--\s*live-server-inject-anchor[\s\S]*?-->/gi, '');
    out = out.replace(/<body\b[^>]*>/gi, '');
    out = out.replace(/<\/body>/gi, '');
    return out.trim();
  }

  async function fetchScreenHtml(name) {
    const url = new URL(`screens/${name}.html`, window.location.href);
    url.searchParams.set('t', String(Date.now()));
    const res = await fetch(url.href, { cache: 'no-store' });
    if (!res.ok) throw new Error(`screens/${name}.html (${res.status})`);
    return stripLiveServerInject(await res.text());
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  function showBootError(message) {
    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = `
      <section class="screen screen-active" id="screen-boot-error">
        <div class="clay-panel" style="max-width:520px;margin:48px auto;">
          <p class="panel-eyebrow">BOOT</p>
          <h1 style="margin:0 0 12px;font-family:Gaegu,cursive;font-size:28px;">화면을 불러오지 못했어요</h1>
          <p style="margin:0 0 16px;line-height:1.6;color:var(--clay-text-secondary);">${message}</p>
          <p style="margin:0;font-size:13px;line-height:1.55;color:var(--clay-text-muted);">
            프로젝트 폴더에서 로컬 서버를 켠 뒤 접속해 주세요.<br>
            예: <code>npx serve .</code> 또는 <code>python3 -m http.server 8080</code>
          </p>
        </div>
      </section>
    `;
  }

  async function loadScreens() {
    const root = document.getElementById('app-root');
    if (!root) throw new Error('#app-root 없음');

    if (window.location.protocol === 'file:') {
      throw new Error(
        'HTML 파일을 직접 열면(file://) 화면 조각을 불러올 수 없어요.'
      );
    }

    const parts = await Promise.all(
      SCREEN_ORDER.map(async (name) => fetchScreenHtml(name))
    );

    root.innerHTML = parts.join('\n\n');

    const requiredIds = [
      'screen-home',
      'screen-single',
      'screen-vault',
      'btn-open-vault',
      'screen-study',
      'study-word-boxes',
      'study-sentence-text',
      'study-sentence-display',
    ];
    const missing = requiredIds.filter((id) => !document.getElementById(id));
    if (missing.length) {
      throw new Error(
        `화면 조각이 불완전해요: ${missing.join(', ')}. `
        + 'Live Server(5500)가 HTML 조각에 스크립트를 섞어 넣을 수 있어요. '
        + '강력 새로고침하거나, 프로젝트 폴더에서 python3 -m http.server 8765 로 열어 보세요.'
      );
    }
  }

  /** Re-fetch a single screen partial if its root #screen-* node is missing. */
  async function ensureScreen(name) {
    if (!SCREEN_ORDER.includes(name)) return null;
    const id = `screen-${name}`;
    let node = document.getElementById(id);
    if (node && node.isConnected) return node;

    const root = document.getElementById('app-root');
    if (!root) return null;

    try {
      const html = await fetchScreenHtml(name);
      if (!html) return null;
      if (node) node.remove();
      root.insertAdjacentHTML('beforeend', html);
      node = document.getElementById(id);
      return node;
    } catch (err) {
      console.error('[ensureScreen]', name, err);
      return null;
    }
  }

  const APP_JS_VERSION = '20260814t';

  async function boot() {
    try {
      await loadScreens();
      await loadScript(`js/app.js?v=${APP_JS_VERSION}`);
    } catch (err) {
      console.error(err);
      showBootError((err && err.message) || '알 수 없는 오류');
    }
  }

  window.AppLoadScreens = { SCREEN_ORDER, loadScreens, ensureScreen, boot };
  boot();
})();
