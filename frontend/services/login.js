/**
 * services/login.js — Supabase Login Page & Auth Flow
 * 
 * Registers a 'login' page in the SPA with email/password + Google OAuth.
 * Intercepts "Log in" / "Get Started Free" buttons to show login instead of dashboard.
 * Guards dashboard access behind authentication.
 * 
 * Depends on: app.js (PAGE_DATA, navigate), services/auth.js (SecondBrainAuth)
 */

(function () {
  'use strict';

  // ── Register login page ────────────────────────────────────
  if (typeof PAGE_DATA === 'undefined') {
    console.error('[login.js] PAGE_DATA not found.');
    return;
  }

  PAGE_DATA['login'] = {
    bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex items-center justify-center',
    styles: `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .fade-in-up { animation: fadeInUp 0.4s ease-out; }
      
      .login-card {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      
      .btn-google {
        transition: all 0.2s ease;
      }
      .btn-google:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .btn-google:active {
        transform: translateY(0);
      }
      
      .btn-primary-auth {
        transition: all 0.2s ease;
      }
      .btn-primary-auth:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(86, 69, 212, 0.3);
      }
      .btn-primary-auth:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .input-auth:focus {
        border-color: #5645d4 !important;
        box-shadow: 0 0 0 3px rgba(86, 69, 212, 0.1);
      }

      .divider-text {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .divider-text::before,
      .divider-text::after {
        content: '';
        flex: 1;
        height: 1px;
        background: currentColor;
        opacity: 0.2;
      }

      #login-error {
        animation: fadeInUp 0.3s ease-out;
      }
    `,
    html: `
      <!-- Background gradient -->
      <div class="fixed inset-0 bg-gradient-to-br from-[#0a1530] via-[#1a1040] to-[#0a1530] -z-10"></div>
      <div class="fixed inset-0 -z-10" style="background-image: radial-gradient(ellipse at 30% 20%, rgba(86,69,212,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(86,69,212,0.1) 0%, transparent 50%);"></div>

      <div class="w-full max-w-md mx-auto px-6 fade-in-up">
        <!-- Logo -->
        <div class="text-center mb-8">
          <a href="#" onclick="navigate('landing'); return false;" class="inline-flex items-center gap-2 text-white text-xl font-bold mb-3 hover:opacity-80 transition-opacity">
            <span class="text-2xl">⚡</span> Second Brain
          </a>
          <p class="text-white/50 text-sm">Sign in to your Knowledge Synthesizer</p>
        </div>

        <!-- Login Card -->
        <div class="login-card bg-white/10 border border-white/10 rounded-2xl p-8 shadow-2xl">
          
          <!-- Error message -->
          <div id="login-error" class="hidden mb-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">error</span>
            <span id="login-error-text">An error occurred</span>
          </div>

          <!-- Google OAuth Button -->
          <button id="btn-google-login" onclick="handleGoogleLogin()" class="btn-google w-full flex items-center justify-center gap-3 bg-white text-slate-800 font-semibold py-3 px-4 rounded-xl text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <!-- Divider -->
          <div class="divider-text text-white/40 text-xs my-6 font-medium">or sign in with email</div>

          <!-- Email/Password Form -->
          <form id="login-form" onsubmit="handleEmailLogin(event)" class="space-y-4">
            <div>
              <label class="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Email</label>
              <input 
                id="login-email" 
                type="email" 
                required 
                placeholder="you@example.com"
                class="input-auth w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label class="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Password</label>
              <input 
                id="login-password" 
                type="password" 
                required 
                placeholder="••••••••"
                minlength="6"
                class="input-auth w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all"
              />
            </div>

            <button 
              id="btn-email-login" 
              type="submit" 
              class="btn-primary-auth w-full bg-[#5645d4] hover:bg-[#4535c0] text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 mt-2"
            >
              Sign In
            </button>
          </form>

          <!-- Sign Up toggle -->
          <div class="mt-5 text-center">
            <p class="text-white/40 text-sm">
              Don't have an account? 
              <button id="toggle-signup" onclick="toggleSignupMode()" class="text-[#c6bfff] hover:text-white font-semibold transition-colors">Sign up</button>
            </p>
          </div>
        </div>

        <!-- Footer -->
        <p class="text-center text-white/20 text-xs mt-6">
          Secured by Supabase · Your data stays private
        </p>
      </div>
    `,
  };

  // ── Auth handlers ──────────────────────────────────────────

  let _isSignupMode = false;

  /**
   * Google OAuth login
   */
  window.handleGoogleLogin = async function () {
    const btn = document.getElementById('btn-google-login');
    if (!btn) return;

    _setButtonLoading(btn, true, 'Connecting…');
    _hideError();

    const client = window.SecondBrainAuth?.getSupabaseClient();
    if (!client) {
      _showError('Supabase is not configured. Check your SUPABASE_URL and SUPABASE_ANON_KEY.');
      _setButtonLoading(btn, false, _googleButtonHTML());
      return;
    }

    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      });

      if (error) {
        _showError(error.message);
        _setButtonLoading(btn, false, _googleButtonHTML());
      }
      // If successful, the page will redirect to Google — no need to do anything else
    } catch (err) {
      _showError('Failed to connect to Google: ' + err.message);
      _setButtonLoading(btn, false, _googleButtonHTML());
    }
  };

  /**
   * Email/password login or signup
   */
  window.handleEmailLogin = async function (e) {
    e.preventDefault();

    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const btn = document.getElementById('btn-email-login');

    if (!email || !password) {
      _showError('Please enter email and password.');
      return;
    }

    if (password.length < 6) {
      _showError('Password must be at least 6 characters.');
      return;
    }

    _setButtonLoading(btn, true, _isSignupMode ? 'Creating account…' : 'Signing in…');
    _hideError();

    const client = window.SecondBrainAuth?.getSupabaseClient();
    if (!client) {
      _showError('Supabase is not configured. Check your SUPABASE_URL and SUPABASE_ANON_KEY.');
      _setButtonLoading(btn, false, _isSignupMode ? 'Create Account' : 'Sign In');
      return;
    }

    try {
      let result;

      if (_isSignupMode) {
        result = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + window.location.pathname,
          },
        });
      } else {
        result = await client.auth.signInWithPassword({ email, password });
      }

      if (result.error) {
        _showError(result.error.message);
        _setButtonLoading(btn, false, _isSignupMode ? 'Create Account' : 'Sign In');
        return;
      }

      if (_isSignupMode && result.data?.user && !result.data.session) {
        // Email confirmation required
        _showSuccess('Check your email for a confirmation link!');
        _setButtonLoading(btn, false, 'Create Account');
        return;
      }

      // Success! Navigate to dashboard
      console.info('[login.js] Auth successful, navigating to dashboard.');
      navigate('dashboard');

    } catch (err) {
      _showError('Authentication failed: ' + err.message);
      _setButtonLoading(btn, false, _isSignupMode ? 'Create Account' : 'Sign In');
    }
  };

  /**
   * Toggle between login and signup mode
   */
  window.toggleSignupMode = function () {
    _isSignupMode = !_isSignupMode;
    const btn = document.getElementById('btn-email-login');
    const toggleBtn = document.getElementById('toggle-signup');
    const toggleParent = toggleBtn?.parentElement;

    if (btn) {
      btn.textContent = _isSignupMode ? 'Create Account' : 'Sign In';
    }
    if (toggleParent) {
      toggleParent.innerHTML = _isSignupMode
        ? 'Already have an account? <button id="toggle-signup" onclick="toggleSignupMode()" class="text-[#c6bfff] hover:text-white font-semibold transition-colors">Sign in</button>'
        : 'Don\'t have an account? <button id="toggle-signup" onclick="toggleSignupMode()" class="text-[#c6bfff] hover:text-white font-semibold transition-colors">Sign up</button>';
    }
    _hideError();
  };

  // ── Intercept navigation ───────────────────────────────────
  // Override navigate() to route auth-required pages through login

  const _originalNavigate = window.navigate;

  // Pages that require authentication
  const AUTH_REQUIRED_PAGES = [
    'dashboard', 'search', 'sources', 'grants', 'volunteer',
    'impact', 'mentees', 'projects', 'flashcards', 'settings',
  ];

  window.navigate = async function (page) {
    // Always allow login, landing, and oauth-callback pages
    if (page === 'login' || page === 'landing' || page === 'oauth-callback') {
      _originalNavigate(page);
      return;
    }

    // For auth-required pages, check if user is logged in
    if (AUTH_REQUIRED_PAGES.includes(page)) {
      const session = await window.SecondBrainAuth?.getSession();

      if (!session) {
        // Store intended destination
        window._authRedirectTarget = page;
        console.info('[login.js] Auth required for', page, '— showing login page.');
        _originalNavigate('login');
        return;
      }
    }

    // User is authenticated or page doesn't require auth
    _originalNavigate(page);
  };

  // ── Handle Supabase auth redirect (after Google OAuth) ─────
  // When Supabase redirects back with a session in the URL hash,
  // the SDK auto-picks it up. We listen for auth state changes.

  function _setupAuthListener() {
    if (!window.SecondBrainAuth) return;

    window.SecondBrainAuth.onAuthStateChange(function (event, session) {
      console.info('[login.js] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session) {
        // User just signed in (e.g., after Google OAuth redirect)
        const target = window._authRedirectTarget || 'dashboard';
        window._authRedirectTarget = null;

        // Only navigate if we're currently on login or landing
        if (currentPage === 'login' || currentPage === 'landing') {
          console.info('[login.js] Signed in, navigating to:', target);
          // Use original navigate to skip auth check (we know user is authed)
          _originalNavigate(target);
        }
      }

      if (event === 'SIGNED_OUT') {
        console.info('[login.js] Signed out, returning to landing.');
        _originalNavigate('landing');
      }
    });
  }

  // ── Check for existing session on boot ─────────────────────
  // If user has a valid Supabase session (e.g., from a previous login),
  // handle the URL hash that Supabase may have added

  async function _handleInitialAuth() {
    // Wait a tick for Supabase SDK to process any URL hash tokens
    await new Promise(function (r) { setTimeout(r, 500); });

    const session = await window.SecondBrainAuth?.getSession();
    if (session) {
      console.info('[login.js] Existing session found for:', session.user?.email);
      // If URL has hash fragments from OAuth, clean it up
      if (window.location.hash && window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname);
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  function _showError(msg) {
    const el = document.getElementById('login-error');
    const text = document.getElementById('login-error-text');
    if (el && text) {
      text.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  function _showSuccess(msg) {
    const el = document.getElementById('login-error');
    const text = document.getElementById('login-error-text');
    if (el && text) {
      text.textContent = msg;
      el.className = 'mb-4 bg-green-500/10 border border-green-500/20 text-green-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2';
      el.querySelector('.material-symbols-outlined').textContent = 'check_circle';
    }
  }

  function _hideError() {
    const el = document.getElementById('login-error');
    if (el) el.classList.add('hidden');
  }

  function _setButtonLoading(btn, loading, text) {
    if (!btn) return;
    btn.disabled = loading;
    if (typeof text === 'string') {
      if (loading) {
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> ' + text;
      } else {
        btn.textContent = text;
      }
    } else {
      btn.innerHTML = text; // HTML content (for google button)
    }
  }

  function _googleButtonHTML() {
    return '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google';
  }

  // ── Boot ────────────────────────────────────────────────────
  // Small delay to ensure Supabase SDK and auth.js are fully loaded
  setTimeout(function () {
    _setupAuthListener();
    _handleInitialAuth();
  }, 100);

})();
