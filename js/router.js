/* ==========================================================================
   AppRouter — per-screen hash URLs (#/home, #/library, …)
   Works with static servers without rewrite rules.
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'ttbt_last_route_v1';

  const SCREEN_PATH = {
    home: '/home',
    settings: '/settings',
    login: '/login',
    admin: '/admin',
    register: '/register',
    'register-form': '/register/new',
    library: '/library',
    roadmap: '/roadmap',
    single: '/single',
    vault: '/vault',
    study: '/study',
    result: '/result',
  };

  const PATH_SCREEN = Object.create(null);
  Object.keys(SCREEN_PATH).forEach((screen) => {
    PATH_SCREEN[SCREEN_PATH[screen]] = screen;
  });

  const TITLES = {
    home: '홈',
    settings: '환경설정',
    login: '로그인',
    admin: '관리자',
    register: '지문 목록',
    'register-form': '지문 등록',
    library: '학습 선택',
    roadmap: '로드맵',
    single: '한문장 모드',
    vault: '문장함',
    study: '학습',
    result: '결과',
  };

  let syncing = false;
  let syncTimer = null;
  let onRoute = null;
  let expectedScreen = null;

  function beginSync(screen) {
    syncing = true;
    expectedScreen = screen || null;
    if (syncTimer) clearTimeout(syncTimer);
    // Keep ignoring echo hashchange/popstate longer than a frame.
    syncTimer = setTimeout(() => {
      syncing = false;
      expectedScreen = null;
      syncTimer = null;
    }, 200);
  }

  function normalizePath(hash) {
    let path = String(hash || '').replace(/^#/, '');
    if (!path || path === '/') return '';
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.split('?')[0].split('#')[0];
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path;
  }

  function screenFromLocation() {
    const path = normalizePath(location.hash);
    if (!path) return null;
    return PATH_SCREEN[path] || null;
  }

  function rememberScreen(screen) {
    if (!SCREEN_PATH[screen]) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, screen);
    } catch (_) { /* ignore */ }
  }

  function rememberedScreen() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return SCREEN_PATH[saved] ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function updateTitle(screen) {
    if (screen === 'home' || !TITLES[screen]) {
      document.title = '통통뱀터 - 통문장을 삼키는 보아뱀';
      return;
    }
    document.title = `${TITLES[screen]} | 통통뱀터`;
  }

  function hashUrl(screen) {
    const path = SCREEN_PATH[screen] || '/home';
    return `${location.pathname}${location.search}#${path}`;
  }

  function setHash(screen, replace) {
    if (!SCREEN_PATH[screen]) {
      console.warn('[AppRouter] unknown screen:', screen);
      return;
    }
    const path = SCREEN_PATH[screen];
    updateTitle(screen);
    rememberScreen(screen);
    if (normalizePath(location.hash) === path) return;

    beginSync(screen);
    const next = hashUrl(screen);
    try {
      if (replace) history.replaceState({ screen }, '', next);
      else history.pushState({ screen }, '', next);
    } catch (err) {
      // Fallback for browsers that reject pushState hash updates.
      console.warn('[AppRouter] pushState failed, using location.hash', err);
      location.hash = path;
    }

    // Some WebKit builds update the URL bar asynchronously — force-correct.
    if (normalizePath(location.hash) !== path) {
      location.hash = path;
    }
  }

  function sync(screen, options) {
    const replace = !!(options && options.replace);
    setHash(screen, replace);
  }

  function bind(handler) {
    onRoute = handler;
  }

  async function applyLocation(options) {
    if (!onRoute) return;
    if (syncing) return;

    const replaceInvalid = !options || options.replaceInvalid !== false;
    let screen = screenFromLocation();

    if (!screen) {
      screen = rememberedScreen() || 'home';
      if (replaceInvalid) setHash(screen, true);
    }
    await onRoute(screen, { fromUrl: true });
  }

  function start() {
    window.addEventListener('hashchange', () => {
      if (syncing) return;
      applyLocation();
    });
    window.addEventListener('popstate', () => {
      if (syncing) return;
      applyLocation({ replaceInvalid: false });
    });
    return applyLocation({ replaceInvalid: true });
  }

  window.AppRouter = {
    SCREEN_PATH,
    bind,
    start,
    sync,
    screenFromLocation,
    updateTitle,
    rememberScreen,
  };
})();
