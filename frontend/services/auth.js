/**
 * services/auth.js — Supabase Auth Session Helper
 * 
 * Provides secure access to the current Supabase session and access_token.
 * NEVER stores provider tokens (Google, Slack, etc.) in the frontend.
 * Only the Supabase access_token is used for backend communication.
 * 
 * Configuration: Set window.__ENV__ before loading this script.
 *   window.__ENV__ = {
 *     SUPABASE_URL: 'https://your-project.supabase.co',
 *     SUPABASE_ANON_KEY: 'your-anon-key'
 *   };
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────
  const ENV = window.__ENV__ || {};
  const SUPABASE_URL = ENV.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY || '';

  // ── Singleton Supabase client ──────────────────────────────
  let _supabaseClient = null;

  /**
   * Returns the Supabase client singleton.
   * Lazily initialises on first call.
   * Requires the Supabase JS SDK to be loaded from CDN.
   * @returns {object|null} Supabase client or null if SDK not available
   */
  function getSupabaseClient() {
    if (_supabaseClient) return _supabaseClient;

    // Check if Supabase JS SDK is loaded
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.warn('[auth.js] Supabase JS SDK not loaded. Auth features disabled.');
      return null;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[auth.js] Missing SUPABASE_URL or SUPABASE_ANON_KEY in window.__ENV__. Auth features disabled.');
      return null;
    }

    try {
      _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.info('[auth.js] Supabase client initialised.');
    } catch (err) {
      console.error('[auth.js] Failed to create Supabase client:', err);
      return null;
    }

    return _supabaseClient;
  }

  /**
   * Returns the current Supabase session object.
   * @returns {Promise<object|null>} Session object or null
   */
  async function getSession() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.warn('[auth.js] getSession error:', error.message);
        return null;
      }
      return data?.session || null;
    } catch (err) {
      console.error('[auth.js] getSession exception:', err);
      return null;
    }
  }

  /**
   * Extracts the access_token from the current session.
   * This is the ONLY token used for backend API communication.
   * @returns {Promise<string|null>} JWT access token or null
   */
  async function getAccessToken() {
    const session = await getSession();
    return session?.access_token || null;
  }

  /**
   * Returns the currently authenticated user object.
   * @returns {Promise<object|null>} User object or null
   */
  async function getUser() {
    const session = await getSession();
    return session?.user || null;
  }

  /**
   * Subscribes to auth state changes (login, logout, token refresh).
   * @param {function} callback - Called with (event, session)
   * @returns {object|null} Subscription object with unsubscribe() method
   */
  function onAuthStateChange(callback) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });
      return data?.subscription || null;
    } catch (err) {
      console.error('[auth.js] onAuthStateChange error:', err);
      return null;
    }
  }

  /**
   * Signs out the current user.
   * @returns {Promise<boolean>} true on success
   */
  async function signOut() {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client.auth.signOut();
      if (error) {
        console.warn('[auth.js] signOut error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[auth.js] signOut exception:', err);
      return false;
    }
  }

  // ── Public API ─────────────────────────────────────────────
  window.SecondBrainAuth = {
    getSupabaseClient,
    getSession,
    getAccessToken,
    getUser,
    onAuthStateChange,
    signOut,
  };
})();
