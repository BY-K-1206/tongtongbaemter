/* ==========================================================================
   AppSupabase — config + client factory (URL / anon key)
   ========================================================================== */

window.AppSupabase = (function () {
  'use strict';

  const CONFIG_KEY = 'ttbt_supabase_v1';

  function readSaved() {
    try {
      const raw = window.localStorage.getItem(CONFIG_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const url = String((parsed && parsed.url) || '').trim();
      const anonKey = String((parsed && parsed.anonKey) || '').trim();
      if (!url || !anonKey) return null;
      return { url, anonKey };
    } catch (_) {
      return null;
    }
  }

  function getConfig() {
    const saved = readSaved();
    if (saved) return saved;
    const baked = window.__TTBT_SUPABASE__ || {};
    const url = String(baked.url || '').trim();
    const anonKey = String(baked.anonKey || '').trim();
    if (!url || !anonKey) return null;
    return { url, anonKey };
  }

  function saveConfig(url, anonKey) {
    const next = {
      url: String(url || '').trim(),
      anonKey: String(anonKey || '').trim(),
    };
    if (!next.url || !next.anonKey) {
      window.localStorage.removeItem(CONFIG_KEY);
      return null;
    }
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  }

  function isConfigured() {
    return !!getConfig();
  }

  function createClient() {
    const cfg = getConfig();
    if (!cfg) return null;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('[AppSupabase] supabase-js가 로드되지 않았습니다.');
      return null;
    }
    return window.supabase.createClient(cfg.url, cfg.anonKey);
  }

  return { CONFIG_KEY, getConfig, saveConfig, isConfigured, createClient };
})();
