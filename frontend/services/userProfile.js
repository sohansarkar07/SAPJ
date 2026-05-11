/**
 * services/userProfile.js — Real User Profile Population
 *
 * After the dashboard page loads, reads the Supabase session and populates
 * every UI element that previously showed hardcoded "Priya Sharma" data.
 *
 * Elements populated:
 *   #sidebar-user-name     — full name
 *   #sidebar-user-email    — email
 *   #sidebar-user-initials — two-letter initials (or avatar img if available)
 *   #sidebar-user-avatar   — avatar container (may hold <img> for photo accounts)
 *   #dashboard-greeting    — "🌅 Good morning, [first name]."
 *
 * Depends on: services/auth.js (window.SecondBrainAuth)
 */

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────

  /** Turn "Jane Smith" → "JS", or email "jane.smith@..." → "JS" */
  function _initials(name, email) {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return '??';
  }

  /** Pick a greeting based on local hour */
  function _greeting() {
    const h = new Date().getHours();
    if (h < 12) return '🌅 Good morning';
    if (h < 17) return '☀️ Good afternoon';
    return '🌙 Good evening';
  }

  /** First name only */
  function _firstName(name, email) {
    if (name && name.trim()) return name.trim().split(/\s+/)[0];
    if (email) return email.split('@')[0].split('.')[0];
    return 'there';
  }

  // ── Populate DOM ───────────────────────────────────────────

  function _populateProfile(user) {
    if (!user) return;

    const name      = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const email     = user.email || '';
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    const firstName = _firstName(name, email);
    const initials  = _initials(name, email);

    // Sidebar name + email
    const nameEl  = document.getElementById('sidebar-user-name');
    const emailEl = document.getElementById('sidebar-user-email');
    if (nameEl)  nameEl.textContent  = name || email || 'My Account';
    if (emailEl) emailEl.textContent = email;

    // Sidebar avatar — show photo if available, else initials
    const avatarEl   = document.getElementById('sidebar-user-avatar');
    const initialsEl = document.getElementById('sidebar-user-initials');
    if (avatarEl && avatarUrl) {
      // Replace inner span with a proper img tag
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${name}" class="w-full h-full object-cover rounded-full" referrerpolicy="no-referrer"/>`;
    } else if (initialsEl) {
      initialsEl.textContent = initials;
    }

    // Morning greeting in dashboard hero
    const greetingEl = document.getElementById('dashboard-greeting');
    if (greetingEl) {
      greetingEl.textContent = `${_greeting()}, ${firstName}.`;
    }

    console.info('[userProfile.js] Profile populated for:', email);
  }

  // ── Hook into page navigation ──────────────────────────────

  function _tryPopulate() {
    if (!window.SecondBrainAuth) return;
    window.SecondBrainAuth.getSession().then(function (session) {
      if (session?.user) _populateProfile(session.user);
    }).catch(function (err) {
      console.warn('[userProfile.js] Could not fetch session:', err);
    });
  }

  // Run on every page load (the SPA swaps HTML on each navigation)
  const _prevOnPageLoad = window.onPageLoad;
  window.onPageLoad = function (page) {
    if (typeof _prevOnPageLoad === 'function') _prevOnPageLoad(page);

    // Only pages that have the user-profile DOM elements
    if (page === 'dashboard' || page === 'search' || page === 'sources' ||
        page === 'settings'  || page === 'grants' || page === 'flashcards') {
      // Small delay to let the SPA finish injecting HTML
      setTimeout(_tryPopulate, 120);
    }
  };

  // Also listen for auth state changes (handles returning from OAuth redirect)
  setTimeout(function () {
    if (!window.SecondBrainAuth) return;
    window.SecondBrainAuth.onAuthStateChange(function (event, session) {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        setTimeout(function () { _populateProfile(session.user); }, 150);
      }
    });
    // Populate immediately in case the page already loaded with a session
    _tryPopulate();
  }, 300);

})();
