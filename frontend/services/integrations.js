/**
 * services/integrations.js — Integration Service
 * 
 * Handles connecting/disconnecting external integrations (Google, Slack, Notion, etc.)
 * All OAuth flows are managed by the backend. Frontend only:
 *   1. Requests a redirect URL from the backend
 *   2. Redirects the user to the OAuth provider
 *   3. Fetches connection status after callback
 * 
 * SECURITY: No provider tokens are ever stored or processed in the frontend.
 * 
 * Depends on: services/apiClient.js (window.SecondBrainAPI)
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  const _statusCache = {
    data: null,
    timestamp: 0,
    TTL: 30000, // 30 seconds cache
  };

  // ── Core Functions ─────────────────────────────────────────

  /**
   * Initiates an integration connection flow.
   * Calls the backend to get an OAuth redirect URL, then redirects the user.
   * 
   * @param {string} provider - Integration provider (e.g. 'google', 'slack', 'notion')
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async function connectIntegration(provider) {
    if (!provider) {
      return { success: false, error: 'Provider is required' };
    }

    const normalised = provider.toLowerCase().trim();

    try {
      const { data, error } = await window.SecondBrainAPI.post(
        `/api/integrations/${normalised}/connect`
      );

      if (error) {
        console.warn(`[integrations] Connect ${normalised} failed:`, error);
        return { success: false, error };
      }

      if (data?.redirect_url) {
        // Redirect user to OAuth provider (backend-generated URL)
        console.info(`[integrations] Redirecting to ${normalised} OAuth...`);
        window.location.href = data.redirect_url;
        return { success: true, error: null };
      }

      // Some providers may connect directly without redirect
      if (data?.status === 'connected') {
        _invalidateCache();
        return { success: true, error: null };
      }

      return { success: false, error: 'No redirect URL received from backend' };
    } catch (err) {
      console.error(`[integrations] Connect ${normalised} exception:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Disconnects an integration.
   * 
   * @param {string} provider
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async function disconnectIntegration(provider) {
    if (!provider) {
      return { success: false, error: 'Provider is required' };
    }

    const normalised = provider.toLowerCase().trim();

    const { data, error } = await window.SecondBrainAPI.post(
      `/api/integrations/${normalised}/disconnect`
    );

    if (error) {
      return { success: false, error };
    }

    _invalidateCache();
    return { success: true, error: null };
  }

  /**
   * Fetches the connection status of all integrations.
   * Returns a map like: { google: 'connected', slack: 'disconnected', notion: 'disconnected' }
   * 
   * Uses a short-lived cache to avoid excessive API calls.
   * 
   * @param {boolean} [forceRefresh=false] - Skip cache and fetch fresh data
   * @returns {Promise<{data: object|null, error: string|null}>}
   */
  async function getIntegrationStatus(forceRefresh = false) {
    // Check cache
    if (
      !forceRefresh &&
      _statusCache.data &&
      (Date.now() - _statusCache.timestamp) < _statusCache.TTL
    ) {
      return { data: _statusCache.data, error: null };
    }

    const { data, error } = await window.SecondBrainAPI.get('/api/integrations/status');

    if (error) {
      return { data: null, error };
    }

    // Update cache
    _statusCache.data = data;
    _statusCache.timestamp = Date.now();

    return { data, error: null };
  }

  /**
   * Checks if a specific provider is connected.
   * 
   * @param {string} provider
   * @returns {Promise<boolean>}
   */
  async function isConnected(provider) {
    const { data } = await getIntegrationStatus();
    if (!data) return false;
    const normalised = provider.toLowerCase().trim();
    return data[normalised] === 'connected';
  }

  // ── Convenience Wrappers ───────────────────────────────────

  function connectGoogle() { return connectIntegration('google'); }
  function connectSlack() { return connectIntegration('slack'); }
  function connectNotion() { return connectIntegration('notion'); }
  function connectWhatsApp() { return connectIntegration('whatsapp'); }
  function connectCalendar() { return connectIntegration('calendar'); }

  function disconnectGoogle() { return disconnectIntegration('google'); }
  function disconnectSlack() { return disconnectIntegration('slack'); }
  function disconnectNotion() { return disconnectIntegration('notion'); }

  // ── Internal ───────────────────────────────────────────────

  function _invalidateCache() {
    _statusCache.data = null;
    _statusCache.timestamp = 0;
  }

  // ── Public API ─────────────────────────────────────────────
  window.SecondBrainIntegrations = {
    connectIntegration,
    disconnectIntegration,
    getIntegrationStatus,
    isConnected,
    // Convenience
    connectGoogle,
    connectSlack,
    connectNotion,
    connectWhatsApp,
    connectCalendar,
    disconnectGoogle,
    disconnectSlack,
    disconnectNotion,
  };
})();
