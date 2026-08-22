/* Inject Supabase adapters before AppStorage / AppAuth boot. */
(function () {
  'use strict';
  const client = window.AppSupabase && window.AppSupabase.createClient
    ? window.AppSupabase.createClient()
    : null;
  if (!client) return;
  window.__TTBT_SUPABASE_CLIENT__ = client;
  if (typeof window.createSupabaseStore === 'function') {
    window.__APP_STORE__ = window.createSupabaseStore(client);
  }
  if (typeof window.createSupabaseAuth === 'function') {
    window.__APP_AUTH__ = window.createSupabaseAuth(client);
  }
})();
