/**
 * integrations_ui.js — Non-Destructive UI Wiring for Integrations
 * 
 * Attaches integration functions to existing UI elements (buttons, cards)
 * WITHOUT modifying any existing components or creating new UI.
 * 
 * Behaviour:
 *   - On Sources page: wires connect/reconnect buttons, updates status badges
 *   - On Settings page: wires the Integrations sidebar link
 *   - On Dashboard: wires Connected Sources widget
 *   - Adds loading states during connection flows
 * 
 * Depends on:
 *   - app.js (navigate, PAGE_DATA)
 *   - services/integrations.js (window.SecondBrainIntegrations)
 *   - services/auth.js (window.SecondBrainAuth)
 */

(function () {
  'use strict';

  // ── Provider mapping ───────────────────────────────────────
  // Maps text content found in UI elements to provider identifiers
  const PROVIDER_MAP = {
    'gmail': 'google',
    'google drive': 'google',
    'drive': 'google',
    'slack': 'slack',
    'slack workspace': 'slack',
    'notion': 'notion',
    'whatsapp': 'whatsapp',
    'calendar': 'calendar',
    'webhooks': 'webhooks',
  };

  // ── Hook into page load chain ──────────────────────────────
  const _previousOnPageLoad = window.onPageLoad;

  window.onPageLoad = function (page) {
    // Call the previous handler first (features.js → callback.js chain)
    if (typeof _previousOnPageLoad === 'function') {
      _previousOnPageLoad(page);
    }

    // Wire integration UI for relevant pages
    // Use setTimeout to ensure DOM is fully rendered after navigate()
    setTimeout(function () {
      switch (page) {
        case 'sources':
          wireSourcesPage();
          break;
        case 'settings':
          wireSettingsPage();
          break;
        case 'dashboard':
          wireDashboardPage();
          break;
      }
    }, 50);
  };

  // ═══════════════════════════════════════════════════════════
  // SOURCES PAGE WIRING
  // ═══════════════════════════════════════════════════════════

  function wireSourcesPage() {
    // Wire existing source cards (Gmail, Drive, Slack, etc.)
    wireSourceCards();

    // Wire "Available Integrations" buttons (Notion, WhatsApp, Calendar, Webhooks)
    wireAvailableIntegrations();

    // Wire "Add New Source" button
    wireAddNewSourceButton();

    // Wire "Reconnect" buttons
    wireReconnectButtons();

    // Fetch and update integration status
    updateSourceStatuses();
  }

  /**
   * Finds source cards by their title text and attaches click handlers.
   */
  function wireSourceCards() {
    // Source cards are identified by their h3 text content
    const cardTitles = document.querySelectorAll('h3');

    cardTitles.forEach(function (h3) {
      const text = h3.textContent.trim().toLowerCase();
      const provider = _resolveProvider(text);
      if (!provider) return;

      // Find the parent card container
      const card = h3.closest('[class*="rounded"]');
      if (!card || card.dataset.integrationWired) return;

      card.dataset.integrationWired = 'true';
      card.style.cursor = 'pointer';

      card.addEventListener('click', function (e) {
        // Don't intercept if clicking a button inside the card
        if (e.target.closest('button')) return;

        _handleConnect(provider, card);
      });
    });
  }

  /**
   * Wires the "Available Integrations" grid buttons.
   */
  function wireAvailableIntegrations() {
    const buttons = document.querySelectorAll('button');

    buttons.forEach(function (btn) {
      const text = btn.textContent.trim().toLowerCase();
      const provider = _resolveProvider(text);
      if (!provider) return;

      // Only target dashed-border buttons (the "add new" style)
      if (!btn.className.includes('border-dashed')) return;
      if (btn.dataset.integrationWired) return;

      btn.dataset.integrationWired = 'true';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        _handleConnect(provider, btn);
      });
    });
  }

  /**
   * Wires the "Add New Source" button in the header.
   */
  function wireAddNewSourceButton() {
    const buttons = document.querySelectorAll('button');

    buttons.forEach(function (btn) {
      const text = btn.textContent.trim().toLowerCase();
      if (!text.includes('add new source')) return;
      if (btn.dataset.integrationWired) return;

      btn.dataset.integrationWired = 'true';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        // Scroll to the Available Integrations section
        const section = document.querySelector('h3');
        const integrationHeaders = document.querySelectorAll('h3');
        integrationHeaders.forEach(function (h) {
          if (h.textContent.trim().toLowerCase().includes('available integrations')) {
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    });
  }

  /**
   * Wires any "Reconnect" buttons found in source cards.
   */
  function wireReconnectButtons() {
    const buttons = document.querySelectorAll('button');

    buttons.forEach(function (btn) {
      const text = btn.textContent.trim().toLowerCase();
      if (text !== 'reconnect') return;
      if (btn.dataset.integrationWired) return;

      btn.dataset.integrationWired = 'true';

      // Determine which provider this reconnect belongs to
      const card = btn.closest('[class*="rounded"]');
      if (!card) return;

      const h3 = card.querySelector('h3');
      if (!h3) return;

      const provider = _resolveProvider(h3.textContent.trim().toLowerCase());
      if (!provider) return;

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        _handleConnect(provider, btn);
      });
    });
  }

  /**
   * Fetches integration status and updates source card badges.
   */
  async function updateSourceStatuses() {
    if (!window.SecondBrainIntegrations) return;

    const { data, error } = await window.SecondBrainIntegrations.getIntegrationStatus();
    if (error || !data) return;

    // Find all status badges in source cards and update them
    const cards = document.querySelectorAll('[class*="h-\\[160px\\]"], [class*="rounded-DEFAULT"]');

    cards.forEach(function (card) {
      const h3 = card.querySelector('h3');
      if (!h3) return;

      const provider = _resolveProvider(h3.textContent.trim().toLowerCase());
      if (!provider) return;

      const status = data[provider];
      if (!status) return;

      // Find the badge element (span with "Connected", "Syncing", "Paused", etc.)
      const badge = card.querySelector('span[class*="rounded-full"][class*="text-\\[10px\\]"]');
      if (!badge) return;

      _updateBadge(badge, status);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SETTINGS PAGE WIRING
  // ═══════════════════════════════════════════════════════════

  function wireSettingsPage() {
    // Wire the "Integrations" sidebar link to navigate to sources
    const links = document.querySelectorAll('a');
    links.forEach(function (link) {
      const text = link.textContent.trim().toLowerCase();
      if (text.includes('integrations')) {
        if (link.dataset.integrationWired) return;
        link.dataset.integrationWired = 'true';

        link.addEventListener('click', function (e) {
          e.preventDefault();
          if (typeof navigate === 'function') {
            navigate('sources');
          }
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD PAGE WIRING
  // ═══════════════════════════════════════════════════════════

  function wireDashboardPage() {
    // Wire the "Connected Sources" grid on the dashboard
    const sectionTitles = document.querySelectorAll('h4');

    sectionTitles.forEach(function (h4) {
      if (!h4.textContent.trim().toLowerCase().includes('connected sources')) return;

      // Find the grid container next to this heading
      const grid = h4.closest('[class*="rounded"]')?.querySelector('.grid');
      if (!grid) return;

      const cells = grid.querySelectorAll('[class*="aspect-square"]');
      cells.forEach(function (cell) {
        if (cell.dataset.integrationWired) return;

        const label = cell.querySelector('span:last-child');
        if (!label) return;

        const text = label.textContent.trim().toLowerCase();
        const provider = _resolveProvider(text);

        if (provider) {
          cell.dataset.integrationWired = 'true';
          cell.addEventListener('click', function (e) {
            e.preventDefault();
            _handleConnect(provider, cell);
          });
        } else if (text === 'add') {
          // "Add" cell → navigate to sources
          cell.dataset.integrationWired = 'true';
          cell.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof navigate === 'function') {
              navigate('sources');
            }
          });
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Resolves a text label to a provider identifier.
   * @param {string} text - Lowercase text content
   * @returns {string|null} Provider identifier or null
   */
  function _resolveProvider(text) {
    for (var label in PROVIDER_MAP) {
      if (text.includes(label)) {
        return PROVIDER_MAP[label];
      }
    }
    return null;
  }

  /**
   * Handles the connection flow for a provider.
   * Adds loading state, calls integration service, handles result.
   * 
   * @param {string} provider
   * @param {HTMLElement} triggerEl - The element that triggered the connect
   */
  async function _handleConnect(provider, triggerEl) {
    if (!window.SecondBrainIntegrations) {
      _showToast('Integration service not available. Please configure Supabase credentials.', 'warning');
      return;
    }

    // Add loading state
    const originalContent = triggerEl.innerHTML;
    const originalPointerEvents = triggerEl.style.pointerEvents;
    triggerEl.style.pointerEvents = 'none';
    triggerEl.style.opacity = '0.7';

    // Find or create a loading indicator
    const loadingSpan = document.createElement('span');
    loadingSpan.className = 'material-symbols-outlined text-[16px] animate-spin';
    loadingSpan.textContent = 'progress_activity';
    loadingSpan.style.marginLeft = '4px';
    triggerEl.appendChild(loadingSpan);

    try {
      const { success, error } = await window.SecondBrainIntegrations.connectIntegration(provider);

      if (!success) {
        // Restore original state on failure
        triggerEl.innerHTML = originalContent;
        triggerEl.style.pointerEvents = originalPointerEvents;
        triggerEl.style.opacity = '1';
        _showToast(error || `Failed to connect ${provider}`, 'error');
      }
      // If success, the page will redirect — no need to restore
    } catch (err) {
      triggerEl.innerHTML = originalContent;
      triggerEl.style.pointerEvents = originalPointerEvents;
      triggerEl.style.opacity = '1';
      _showToast(`Connection error: ${err.message}`, 'error');
    }
  }

  /**
   * Updates a badge element to reflect integration status.
   */
  function _updateBadge(badge, status) {
    switch (status) {
      case 'connected':
        badge.className = badge.className
          .replace(/bg-\w+-\d+/g, '')
          .replace(/text-\w+-\d+/g, '');
        badge.classList.add('bg-green-100', 'text-green-700');
        badge.innerHTML = '<span class="w-[6px] h-[6px] rounded-full bg-green-500 block"></span> Connected';
        break;
      case 'disconnected':
        badge.className = badge.className
          .replace(/bg-\w+-\d+/g, '')
          .replace(/text-\w+-\d+/g, '');
        badge.classList.add('bg-slate-100', 'text-slate-500');
        badge.innerHTML = '<span class="w-[6px] h-[6px] rounded-full bg-slate-400 block"></span> Not Connected';
        break;
      case 'error':
        badge.className = badge.className
          .replace(/bg-\w+-\d+/g, '')
          .replace(/text-\w+-\d+/g, '');
        badge.classList.add('bg-red-100', 'text-red-700');
        badge.innerHTML = '<span class="w-[6px] h-[6px] rounded-full bg-red-500 block"></span> Error';
        break;
      case 'syncing':
        badge.className = badge.className
          .replace(/bg-\w+-\d+/g, '')
          .replace(/text-\w+-\d+/g, '');
        badge.classList.add('bg-blue-100', 'text-blue-700');
        badge.innerHTML = '<span class="material-symbols-outlined text-[10px] animate-spin">sync</span> Syncing';
        break;
    }
  }

  /**
   * Shows a toast notification using the existing toast pattern from features.js.
   */
  function _showToast(msg, type) {
    // Use existing toast() if available
    if (typeof window.toast === 'function') {
      window.toast(msg);
      return;
    }

    // Fallback: create our own toast
    var iconMap = {
      'error': 'error',
      'warning': 'warning',
      'success': 'check_circle',
    };
    var colorMap = {
      'error': 'text-red-400',
      'warning': 'text-yellow-400',
      'success': 'text-green-400',
    };

    var icon = iconMap[type] || 'info';
    var color = colorMap[type] || 'text-blue-400';

    var t = document.createElement('div');
    t.className = 'fixed bottom-6 right-6 z-[999] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2';
    t.innerHTML = '<span class="material-symbols-outlined ' + color + ' text-[18px]">' + icon + '</span> ' + msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }

  // ── Expose for direct usage ────────────────────────────────
  // These can be called directly from onclick handlers if needed
  window.connectGoogleIntegration = function () {
    if (window.SecondBrainIntegrations) {
      window.SecondBrainIntegrations.connectGoogle();
    } else {
      _showToast('Integration service not ready', 'warning');
    }
  };

  window.connectSlackIntegration = function () {
    if (window.SecondBrainIntegrations) {
      window.SecondBrainIntegrations.connectSlack();
    } else {
      _showToast('Integration service not ready', 'warning');
    }
  };

  window.connectNotionIntegration = function () {
    if (window.SecondBrainIntegrations) {
      window.SecondBrainIntegrations.connectNotion();
    } else {
      _showToast('Integration service not ready', 'warning');
    }
  };

  window.disconnectGoogleIntegration = function () {
    if (window.SecondBrainIntegrations) {
      window.SecondBrainIntegrations.disconnectGoogle();
    } else {
      _showToast('Integration service not ready', 'warning');
    }
  };
})();
