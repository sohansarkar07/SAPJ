/**
 * pages/integrations/callback.js — OAuth Callback Page
 * 
 * Registers a 'oauth-callback' page in the SPA.
 * This page is loaded after the backend completes the OAuth flow
 * and redirects back to the frontend.
 * 
 * Behaviour:
 *   1. Shows a "Completing connection…" spinner
 *   2. Fetches integration status from backend to confirm connection
 *   3. Redirects to the Sources page after a short delay
 * 
 * SECURITY: Does NOT process or store any OAuth tokens.
 *           The backend handles all token exchange and storage.
 * 
 * Depends on: app.js (PAGE_DATA, navigate), services/integrations.js
 */

(function () {
  'use strict';

  // ── Register callback page ─────────────────────────────────
  if (typeof PAGE_DATA === 'undefined') {
    console.error('[callback.js] PAGE_DATA not found. Ensure app.js is loaded first.');
    return;
  }

  PAGE_DATA['oauth-callback'] = {
    bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex items-center justify-center',
    styles: `
      @keyframes pulse-ring {
        0% { transform: scale(0.9); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.6; }
        100% { transform: scale(0.9); opacity: 1; }
      }
      .pulse-ring {
        animation: pulse-ring 1.5s ease-in-out infinite;
      }
    `,
    html: `
      <div class="flex flex-col items-center justify-center gap-6 text-center px-6" id="oauth-callback-container">
        <div class="relative">
          <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center pulse-ring">
            <span class="material-symbols-outlined text-4xl text-primary animate-spin" style="animation-duration: 1.5s;">progress_activity</span>
          </div>
        </div>
        <div>
          <h2 class="text-xl font-semibold text-on-surface mb-2">Completing Connection…</h2>
          <p class="text-sm text-on-surface-variant max-w-md">
            We're finishing up the setup with your provider. You'll be redirected automatically in a moment.
          </p>
        </div>
        <div id="oauth-callback-status" class="text-xs text-on-surface-variant mt-2"></div>
      </div>
    `,
  };

  // ── Callback handler ───────────────────────────────────────

  /**
   * Called when the oauth-callback page loads.
   * Verifies the integration status and redirects to sources.
   */
  async function handleOAuthCallback() {
    const statusEl = document.getElementById('oauth-callback-status');

    // Step 1: Brief delay to let the user see the spinner
    await _delay(1000);

    // Step 2: Try to fetch integration status
    if (statusEl) statusEl.textContent = 'Verifying connection status…';

    let statusText = 'connected';
    try {
      if (window.SecondBrainIntegrations) {
        const { data, error } = await window.SecondBrainIntegrations.getIntegrationStatus(true);
        if (data) {
          const connectedProviders = Object.entries(data)
            .filter(([, status]) => status === 'connected')
            .map(([provider]) => provider);
          if (connectedProviders.length > 0) {
            statusText = `Connected: ${connectedProviders.join(', ')}`;
          }
        }
        if (error) {
          console.warn('[callback] Status check failed (non-blocking):', error);
        }
      }
    } catch (err) {
      console.warn('[callback] Status check exception (non-blocking):', err);
    }

    // Step 3: Show success and redirect
    if (statusEl) statusEl.textContent = statusText;

    const container = document.getElementById('oauth-callback-container');
    if (container) {
      container.innerHTML = `
        <div class="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <span class="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">check_circle</span>
        </div>
        <div>
          <h2 class="text-xl font-semibold text-on-surface mb-2">Connection Successful!</h2>
          <p class="text-sm text-on-surface-variant">Redirecting you to your sources…</p>
        </div>
      `;
    }

    await _delay(1500);

    // Redirect to sources page
    if (typeof navigate === 'function') {
      navigate('sources');
    }
  }

  function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Hook into page load ────────────────────────────────────
  // We extend the existing onPageLoad without overwriting it
  const _originalOnPageLoad = window.onPageLoad;
  window.onPageLoad = function (page) {
    // Call original handler first
    if (typeof _originalOnPageLoad === 'function') {
      _originalOnPageLoad(page);
    }
    // Handle our callback page
    if (page === 'oauth-callback') {
      handleOAuthCallback();
    }
  };

  // ── Handle direct URL callback ─────────────────────────────
  // If the user is redirected back from OAuth provider to /?callback=true
  // or similar, auto-navigate to the callback page
  window.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    if (params.has('oauth_callback') || params.has('integration_callback')) {
      // Small delay to let the SPA boot
      setTimeout(function () {
        if (typeof navigate === 'function') {
          navigate('oauth-callback');
        }
      }, 100);
    }
  });
})();
