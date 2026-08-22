/* ==========================================================================
   AppAuth — facade over AuthAdapter + session→store bind hook
   ==========================================================================
   UI calls AppAuth only. Inject window.__APP_AUTH__ before this script loads
   to swap Firebase/Supabase Auth later (same METHODS).

   onAuthStateChange also notifies AppStorage.onAuthSessionChange so a cloud
   data adapter can re-scope by userId and run one-shot local→cloud merge.
   ========================================================================== */

window.AppAuthContract = (function () {
  'use strict';

  const METHODS = [
    'getSession',
    'signInEmail',
    'signUpEmail',
    'signOut',
    'onAuthStateChange',
    'listUsers',
    'setUserRole',
  ];

  // Roles used now. lecturer reserved for challenge epic.
  const ROLES = ['user', 'admin'];

  function assertAdapter(auth, label) {
    if (!auth || typeof auth !== 'object') {
      throw new Error(`[AppAuth] ${label || 'adapter'} is missing`);
    }
    const missing = METHODS.filter((name) => typeof auth[name] !== 'function');
    if (missing.length) {
      console.warn(`[AppAuth] ${label || 'adapter'} missing methods:`, missing.join(', '));
    }
    return auth;
  }

  function create() {
    if (window.__APP_AUTH__) {
      return assertAdapter(window.__APP_AUTH__, '__APP_AUTH__');
    }
    if (typeof window.createLocalAuth !== 'function') {
      throw new Error('[AppAuth] load auth-local.js or set window.__APP_AUTH__');
    }
    return assertAdapter(window.createLocalAuth(), 'local');
  }

  return { METHODS, ROLES, assertAdapter, create };
})();

window.AppAuth = (function () {
  'use strict';

  const auth = window.AppAuthContract.create();
  let cachedSession = null;
  let bindReady = false;

  async function notifyStore(session) {
    cachedSession = session;
    if (window.AppStorage && typeof window.AppStorage.onAuthSessionChange === 'function') {
      try {
        await window.AppStorage.onAuthSessionChange(session);
      } catch (err) {
        console.error('[AppAuth] store session bind failed', err);
      }
    }
  }

  function wireStoreBind() {
    if (bindReady) return;
    bindReady = true;
    auth.onAuthStateChange((session) => {
      notifyStore(session);
    });
  }

  wireStoreBind();

  async function getSession() {
    const session = await auth.getSession();
    cachedSession = session;
    return session;
  }

  function getCachedSession() {
    return cachedSession;
  }

  async function signInEmail(email, password) {
    const session = await auth.signInEmail(email, password);
    await notifyStore(session);
    return session;
  }

  async function signUpEmail(email, password) {
    const session = await auth.signUpEmail(email, password);
    await notifyStore(session);
    return session;
  }

  async function signOut() {
    await auth.signOut();
    await notifyStore(null);
  }

  function onAuthStateChange(cb) {
    return auth.onAuthStateChange(cb);
  }

  async function listUsers() {
    return auth.listUsers();
  }

  async function setUserRole(userId, role) {
    return auth.setUserRole(userId, role);
  }

  function isAdmin(session) {
    const s = session || cachedSession;
    return !!(s && s.role === 'admin');
  }

  // Warm cache + initial store bind (guest = null).
  getSession().then((session) => notifyStore(session)).catch(() => {});

  return {
    getSession,
    getCachedSession,
    signInEmail,
    signUpEmail,
    signOut,
    onAuthStateChange,
    listUsers,
    setUserRole,
    isAdmin,
    ROLES: window.AppAuthContract.ROLES,
  };
})();
