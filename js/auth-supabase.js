/* ==========================================================================
   Supabase Auth — AppAuth adapter
   ========================================================================== */

window.createSupabaseAuth = function createSupabaseAuth(client) {
  'use strict';

  const ROLES = ['user', 'admin'];
  const listeners = new Set();

  function emit(session) {
    listeners.forEach((cb) => {
      try { cb(session); } catch (err) { console.error('[SupabaseAuth]', err); }
    });
  }

  function sbError(err, fallback) {
    const msg = String((err && err.message) || '');
    if (/invalid login credentials/i.test(msg)) {
      return new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    if (/user already registered/i.test(msg)) {
      return new Error('이미 가입된 이메일입니다.');
    }
    if (/password should be at least/i.test(msg)) {
      return new Error('비밀번호는 6자 이상이어야 합니다.');
    }
    if (/email not confirmed/i.test(msg)) {
      return new Error('이메일 인증이 필요합니다. Supabase에서 Confirm email을 끄거나 메일을 확인해 주세요.');
    }
    return new Error(fallback || msg || '인증에 실패했습니다.');
  }

  async function profileFor(user) {
    if (!user) return null;
    const { data, error } = await client
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw sbError(error, '프로필을 불러오지 못했습니다.');
    return {
      userId: user.id,
      email: (data && data.email) || user.email || '',
      role: data && data.role === 'admin' ? 'admin' : 'user',
    };
  }

  async function sessionFromAuth() {
    const { data, error } = await client.auth.getSession();
    if (error) throw sbError(error, '세션을 확인하지 못했습니다.');
    const user = data && data.session && data.session.user;
    if (!user) return null;
    return profileFor(user);
  }

  async function getSession() {
    return sessionFromAuth();
  }

  async function signInEmail(email, password) {
    const { data, error } = await client.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || ''),
    });
    if (error) throw sbError(error);
    const session = await profileFor(data && data.user);
    emit(session);
    return session;
  }

  async function signUpEmail(email, password) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new Error('이메일을 확인해 주세요.');
    }
    if (String(password || '').length < 6) {
      throw new Error('비밀번호는 6자 이상이어야 합니다.');
    }
    const { data, error } = await client.auth.signUp({
      email: normalized,
      password: String(password || ''),
    });
    if (error) throw sbError(error);
    if (!data || !data.session || !data.user) {
      throw new Error('가입은 됐어요. 이메일 인증 후 로그인해 주세요. (캠프면 Confirm email을 끄세요)');
    }
    const session = await profileFor(data.user);
    emit(session);
    return session;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw sbError(error, '로그아웃에 실패했습니다.');
    emit(null);
  }

  function onAuthStateChange(cb) {
    if (typeof cb !== 'function') return () => {};
    listeners.add(cb);
    const { data } = client.auth.onAuthStateChange(async (_event, sbSession) => {
      try {
        const session = sbSession && sbSession.user ? await profileFor(sbSession.user) : null;
        cb(session);
      } catch (err) {
        console.error('[SupabaseAuth]', err);
        cb(null);
      }
    });
    const sub = data && data.subscription;
    return () => {
      listeners.delete(cb);
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    };
  }

  async function requireAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      throw new Error('관리자만 가능합니다.');
    }
    return session;
  }

  async function listUsers() {
    await requireAdmin();
    const { data, error } = await client
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });
    if (error) throw sbError(error, '사용자 목록을 불러오지 못했습니다.');
    return (data || []).map((p) => ({
      userId: p.id,
      email: p.email,
      role: p.role === 'admin' ? 'admin' : 'user',
      createdAt: p.created_at ? Date.parse(p.created_at) : null,
    }));
  }

  async function setUserRole(userId, role) {
    const session = await requireAdmin();
    if (ROLES.indexOf(role) === -1) throw new Error('허용되지 않은 역할입니다.');
    const { data: admins, error: adminErr } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    if (adminErr) throw sbError(adminErr);
    const { data: target, error: targetErr } = await client
      .from('profiles')
      .select('id, email, role, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (targetErr) throw sbError(targetErr);
    if (!target) throw new Error('사용자를 찾을 수 없습니다.');
    if (target.role === 'admin' && role !== 'admin' && (admins || []).length <= 1) {
      throw new Error('마지막 관리자의 역할은 바꿀 수 없습니다.');
    }
    const { data, error } = await client
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, email, role, created_at')
      .single();
    if (error) throw sbError(error, '역할 변경에 실패했습니다.');
    if (session.userId === userId) {
      emit({
        userId: data.id,
        email: data.email,
        role: data.role === 'admin' ? 'admin' : 'user',
      });
    }
    return {
      userId: data.id,
      email: data.email,
      role: data.role,
      createdAt: data.created_at ? Date.parse(data.created_at) : null,
    };
  }

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
