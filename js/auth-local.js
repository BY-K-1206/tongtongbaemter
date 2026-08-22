/* ==========================================================================
   LocalAuth — AppAuth adapter (localStorage stub)
   ==========================================================================
   Dev/offline stand-in until Firebase/Supabase Auth. Same method surface.
   Roles now: user | admin. Reserved for later: lecturer (challenges).
   Seed admin (first boot): admin@ttbt.local / admin
   ========================================================================== */

window.createLocalAuth = function createLocalAuth() {
  'use strict';

  const KEYS = {
    profiles: 'earthsentence_auth_profiles_v1',
    session: 'earthsentence_auth_session_v1',
  };

  const ROLES = ['user', 'admin']; // lecturer: later

  const listeners = new Set();

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* quota */ }
  }

  function generateId() {
    return `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async function hashPassword(password) {
    const text = String(password || '');
    if (!window.crypto || !window.crypto.subtle) {
      return `plain:${text}`;
    }
    const buf = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text)
    );
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function publicSession(profile) {
    if (!profile) return null;
    return {
      userId: profile.id,
      email: profile.email,
      role: profile.role === 'admin' ? 'admin' : 'user',
    };
  }

  function listProfiles() {
    return readJSON(KEYS.profiles, []);
  }

  function saveProfiles(list) {
    writeJSON(KEYS.profiles, list);
  }

  async function seedAdminIfNeeded() {
    const list = listProfiles();
    if (list.some((p) => p.role === 'admin')) return;
    const seedEmail = 'admin@ttbt.local';
    const existing = list.find((p) => p.email === seedEmail);
    if (existing) {
      existing.role = 'admin';
      existing.updatedAt = Date.now();
      saveProfiles(list);
      return;
    }
    list.push({
      id: generateId(),
      email: seedEmail,
      passwordHash: await hashPassword('admin'),
      role: 'admin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    saveProfiles(list);
  }

  function emit(session) {
    listeners.forEach((cb) => {
      try { cb(session); } catch (err) { console.error('[LocalAuth]', err); }
    });
  }

  function requireAdmin() {
    const session = readJSON(KEYS.session, null);
    if (!session || session.role !== 'admin') {
      throw new Error('관리자만 가능합니다.');
    }
    return session;
  }

  async function getSession() {
    await seedAdminIfNeeded();
    const session = readJSON(KEYS.session, null);
    if (!session || !session.userId) return null;
    const profile = listProfiles().find((p) => p.id === session.userId);
    if (!profile) {
      writeJSON(KEYS.session, null);
      return null;
    }
    const next = publicSession(profile);
    writeJSON(KEYS.session, next);
    return next;
  }

  async function signInEmail(email, password) {
    await seedAdminIfNeeded();
    const normalized = normalizeEmail(email);
    const profile = listProfiles().find((p) => p.email === normalized);
    if (!profile) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    const hash = await hashPassword(password);
    if (profile.passwordHash !== hash) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const session = publicSession(profile);
    writeJSON(KEYS.session, session);
    emit(session);
    return session;
  }

  async function signUpEmail(email, password) {
    await seedAdminIfNeeded();
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes('@')) {
      throw new Error('이메일을 확인해 주세요.');
    }
    if (String(password || '').length < 4) {
      throw new Error('비밀번호는 4자 이상이어야 합니다.');
    }
    const list = listProfiles();
    if (list.some((p) => p.email === normalized)) {
      throw new Error('이미 가입된 이메일입니다.');
    }
    const profile = {
      id: generateId(),
      email: normalized,
      passwordHash: await hashPassword(password),
      role: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.push(profile);
    saveProfiles(list);
    const session = publicSession(profile);
    writeJSON(KEYS.session, session);
    emit(session);
    return session;
  }

  async function signOut() {
    writeJSON(KEYS.session, null);
    emit(null);
  }

  function onAuthStateChange(cb) {
    if (typeof cb !== 'function') return () => {};
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  async function listUsers() {
    requireAdmin();
    return listProfiles()
      .map((p) => ({
        userId: p.id,
        email: p.email,
        role: p.role === 'admin' ? 'admin' : 'user',
        createdAt: p.createdAt || null,
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async function setUserRole(userId, role) {
    const session = requireAdmin();
    if (!ROLES.includes(role)) {
      throw new Error('허용되지 않은 역할입니다.');
    }
    const list = listProfiles();
    const index = list.findIndex((p) => p.id === userId);
    if (index === -1) throw new Error('사용자를 찾을 수 없습니다.');

    if (list[index].role === 'admin' && role !== 'admin') {
      const adminCount = list.filter((p) => p.role === 'admin').length;
      if (adminCount <= 1) {
        throw new Error('마지막 관리자의 역할은 바꿀 수 없습니다.');
      }
    }

    list[index].role = role;
    list[index].updatedAt = Date.now();
    saveProfiles(list);

    if (session.userId === userId) {
      const next = publicSession(list[index]);
      writeJSON(KEYS.session, next);
      emit(next);
    }
    return {
      userId: list[index].id,
      email: list[index].email,
      role: list[index].role,
      createdAt: list[index].createdAt,
    };
  }

  seedAdminIfNeeded();

  return {
    getSession,
    signInEmail,
    signUpEmail,
    signOut,
    onAuthStateChange,
    listUsers,
    setUserRole,
  };
};
