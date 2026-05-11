/**
 * services/login.js — Supabase Login Page & Auth Flow
 *
 * Registers a 'login' page in the SPA.
 * Guards all auth-required pages by intercepting the global navigate() function.
 * Directly intercepts "Log in" / "Get Started Free" buttons on the landing page.
 *
 * Depends on: app.js (PAGE_DATA, navigate), services/auth.js (SecondBrainAuth)
 */

(function () {
  'use strict';

  // ── Guard ──────────────────────────────────────────────────
  if (typeof PAGE_DATA === 'undefined') {
    console.error('[login.js] PAGE_DATA not found. Ensure app.js loads first.');
    return;
  }

  // ── Register login page ─────────────────────────────────────
  PAGE_DATA['login'] = {
    bodyClass: 'bg-background text-on-background font-body text-body min-h-screen flex items-center justify-center',
    styles: `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .fade-in-up { animation: fadeInUp 0.4s ease-out; }
      .login-card {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      .btn-google { transition: all 0.2s ease; }
      .btn-google:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .btn-google:active { transform: translateY(0); }
      .btn-primary-auth { transition: all 0.2s ease; }
      .btn-primary-auth:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(86,69,212,0.3); }
      .btn-primary-auth:disabled { opacity:0.6; cursor:not-allowed; transform:none; box-shadow:none; }
      .input-auth:focus { border-color:#5645d4!important; box-shadow:0 0 0 3px rgba(86,69,212,0.1); }
      .divider-line { display:flex; align-items:center; gap:12px; }
      .divider-line::before, .divider-line::after { content:''; flex:1; height:1px; background:currentColor; opacity:0.2; }
    `,
    html: `
      <div class="fixed inset-0 -z-10" style="background:linear-gradient(135deg,#0a1530,#1a1040,#0a1530);"></div>
      <div class="fixed inset-0 -z-10" style="background-image:radial-gradient(ellipse at 30% 20%,rgba(86,69,212,0.18) 0%,transparent 55%),radial-gradient(ellipse at 75% 80%,rgba(86,69,212,0.12) 0%,transparent 55%);"></div>

      <div class="w-full max-w-md mx-auto px-6 fade-in-up">
        <!-- Logo -->
        <div class="text-center mb-8">
          <a href="#" id="login-back-btn" class="inline-flex items-center gap-2 text-white text-xl font-bold mb-3 hover:opacity-80 transition-opacity">
            <span class="text-2xl">⚡</span> Second Brain
          </a>
          <p class="text-white/50 text-sm" id="login-subtitle">Sign in to your Knowledge Synthesizer</p>
        </div>

        <!-- Card -->
        <div class="login-card bg-white/10 border border-white/10 rounded-2xl p-8 shadow-2xl">

          <!-- Alert banner -->
          <div id="login-alert" class="hidden mb-4 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]" id="login-alert-icon">error</span>
            <span id="login-alert-text"></span>
          </div>

          <!-- Google Button -->
          <button id="btn-google-login" class="btn-google w-full flex items-center justify-center gap-3 bg-white text-slate-800 font-semibold py-3 px-4 rounded-xl text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div class="divider-line text-white/40 text-xs my-6 font-medium">or sign in with email</div>

          <!-- Email Form -->
          <form id="login-form" class="space-y-4">
            <div>
              <label class="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Email</label>
              <input id="login-email" type="email" required placeholder="you@example.com"
                class="input-auth w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all"/>
            </div>
            <div>
              <label class="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Password</label>
              <input id="login-password" type="password" required placeholder="••••••••" minlength="6"
                class="input-auth w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all"/>
            </div>
            <button id="btn-email-login" type="submit"
              class="btn-primary-auth w-full bg-[#5645d4] hover:bg-[#4535c0] text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 mt-2">
              Sign In
            </button>
          </form>

          <div class="mt-5 text-center">
            <p id="toggle-wrapper" class="text-white/40 text-sm">
              Don't have an account?
              <button id="toggle-signup" class="text-[#c6bfff] hover:text-white font-semibold transition-colors ml-1">Sign up</button>
            </p>
          </div>
        </div>

        <p class="text-center text-white/20 text-xs mt-6">Secured by Supabase · Your data stays private</p>
      </div>
    `,
  };

  // ── State ───────────────────────────────────────────────────
  let _isSignupMode = false;

  // ── Auth-required pages ─────────────────────────────────────
  const AUTH_REQUIRED = [
    'dashboard', 'search', 'sources', 'grants', 'volunteer',
    'impact', 'mentees', 'projects', 'flashcards', 'settings',
  ];

  // Labels that should show login page instead of jumping straight to dashboard
  const LOGIN_TRIGGERS = ['log in', 'login', 'sign in', 'get started free', 'get started', 'start synthesizing'];

  // ── Override navigate() to guard pages ─────────────────────
  const _originalNavigate = window.navigate;

  window.navigate = async function (page) {
    // Passthrough pages — never require auth
    if (!page || page === 'login' || page === 'landing' || page === 'oauth-callback') {
      _originalNavigate(page);
      return;
    }

    if (AUTH_REQUIRED.includes(page)) {
      try {
        const session = window.SecondBrainAuth
          ? await window.SecondBrainAuth.getSession()
          : null;

        if (!session) {
          window._authRedirectTarget = page;
          console.info('[login.js] Not authenticated — redirecting to login (wanted:', page, ')');
          _originalNavigate('login');
          // Wire up event listeners after DOM swap
          setTimeout(_wireLoginPage, 50);
          return;
        }
      } catch (err) {
        console.warn('[login.js] Session check failed, redirecting to login:', err);
        _originalNavigate('login');
        setTimeout(_wireLoginPage, 50);
        return;
      }
    }

    _originalNavigate(page);
  };

  // ── Intercept landing-page buttons via onPageLoad ──────────
  const _prevOnPageLoad = window.onPageLoad;
  window.onPageLoad = function (page) {
    if (typeof _prevOnPageLoad === 'function') _prevOnPageLoad(page);

    setTimeout(function () {
      if (page === 'landing') _wireLandingButtons();
      if (page === 'login')   _wireLoginPage();
    }, 80);
  };

  /**
   * On the landing page, find all "Log in" / "Get Started" buttons
   * and re-wire them to go to the login page instead of dashboard.
   */
  function _wireLandingButtons() {
    document.querySelectorAll('a, button').forEach(function (el) {
      if (el.dataset.loginWired) return;
      const text = el.textContent.trim().toLowerCase();
      const isLoginTrigger = LOGIN_TRIGGERS.some(function (t) { return text === t || text.includes(t); });
      if (!isLoginTrigger) return;

      el.dataset.loginWired = 'true';

      // Replace the existing click handler by capturing it in a new one
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();   // prevent app.js from routing to dashboard
        _originalNavigate('login');
        setTimeout(_wireLoginPage, 80);
      }, true); // useCapture = true so this fires before app.js listeners
    });
    console.info('[login.js] Landing buttons wired.');
  }

  /**
   * Wire all interactive elements on the login page.
   */
  function _wireLoginPage() {
    const googleBtn  = document.getElementById('btn-google-login');
    const emailForm  = document.getElementById('login-form');
    const toggleBtn  = document.getElementById('toggle-signup');
    const backBtn    = document.getElementById('login-back-btn');

    if (googleBtn && !googleBtn.dataset.wired) {
      googleBtn.dataset.wired = 'true';
      googleBtn.addEventListener('click', _handleGoogleLogin);
    }

    if (emailForm && !emailForm.dataset.wired) {
      emailForm.dataset.wired = 'true';
      emailForm.addEventListener('submit', _handleEmailLogin);
    }

    if (toggleBtn && !toggleBtn.dataset.wired) {
      toggleBtn.dataset.wired = 'true';
      toggleBtn.addEventListener('click', _toggleMode);
    }

    if (backBtn && !backBtn.dataset.wired) {
      backBtn.dataset.wired = 'true';
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        _originalNavigate('landing');
      });
    }
  }

  // ── Auth Handlers ───────────────────────────────────────────

  async function _handleGoogleLogin() {
    const btn = document.getElementById('btn-google-login');
    _setBtnLoading(btn, true, 'Connecting…');
    _clearAlert();

    const client = window.SecondBrainAuth && window.SecondBrainAuth.getSupabaseClient();
    if (!client) {
      _showAlert('error', 'Supabase not configured. Check SUPABASE_URL and SUPABASE_ANON_KEY in index.html.');
      _setBtnLoading(btn, false, null); // restore google HTML
      return;
    }

    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) {
        _showAlert('error', error.message);
        _setBtnLoading(btn, false, null);
      }
      // On success browser redirects — nothing more needed here
    } catch (err) {
      _showAlert('error', 'Google login failed: ' + err.message);
      _setBtnLoading(btn, false, null);
    }
  }

  async function _handleEmailLogin(e) {
    e.preventDefault();

    const email    = (document.getElementById('login-email')?.value || '').trim();
    const password = document.getElementById('login-password')?.value || '';
    const btn      = document.getElementById('btn-email-login');

    if (!email || !password) { _showAlert('error', 'Please enter your email and password.'); return; }
    if (password.length < 6) { _showAlert('error', 'Password must be at least 6 characters.'); return; }

    _setBtnLoading(btn, true, _isSignupMode ? 'Creating account…' : 'Signing in…');
    _clearAlert();

    const client = window.SecondBrainAuth && window.SecondBrainAuth.getSupabaseClient();
    if (!client) {
      _showAlert('error', 'Supabase not configured. Check your credentials in index.html.');
      _setBtnLoading(btn, false, _isSignupMode ? 'Create Account' : 'Sign In');
      return;
    }

    try {
      let result;
      if (_isSignupMode) {
        result = await client.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
      } else {
        result = await client.auth.signInWithPassword({ email, password });
      }

      if (result.error) {
        _showAlert('error', result.error.message);
        _setBtnLoading(btn, false, _isSignupMode ? 'Create Account' : 'Sign In');
        return;
      }

      // Signup with email confirmation
      if (_isSignupMode && result.data?.user && !result.data.session) {
        _showAlert('success', '✓ Check your email for a confirmation link!');
        _setBtnLoading(btn, false, 'Create Account');
        return;
      }

      // Authenticated — go to the intended page or dashboard
      console.info('[login.js] Signed in successfully.');
      const dest = window._authRedirectTarget || 'dashboard';
      window._authRedirectTarget = null;
      _originalNavigate(dest);

    } catch (err) {
      _showAlert('error', 'Authentication error: ' + err.message);
      _setBtnLoading(btn, false, _isSignupMode ? 'Create Account' : 'Sign In');
    }
  }

  function _toggleMode() {
    _isSignupMode = !_isSignupMode;
    const btn     = document.getElementById('btn-email-login');
    const wrapper = document.getElementById('toggle-wrapper');
    const sub     = document.getElementById('login-subtitle');

    if (btn) btn.textContent = _isSignupMode ? 'Create Account' : 'Sign In';
    if (sub) sub.textContent = _isSignupMode ? 'Create your account' : 'Sign in to your Knowledge Synthesizer';

    if (wrapper) {
      wrapper.innerHTML = _isSignupMode
        ? 'Already have an account? <button id="toggle-signup" class="text-[#c6bfff] hover:text-white font-semibold transition-colors ml-1">Sign in</button>'
        : 'Don\'t have an account? <button id="toggle-signup" class="text-[#c6bfff] hover:text-white font-semibold transition-colors ml-1">Sign up</button>';
      const newToggle = document.getElementById('toggle-signup');
      if (newToggle) newToggle.addEventListener('click', _toggleMode);
    }
    _clearAlert();
  }

  // ── Supabase auth state listener ────────────────────────────
  function _setupAuthListener() {
    if (!window.SecondBrainAuth) return;

    window.SecondBrainAuth.onAuthStateChange(function (event, session) {
      console.info('[login.js] Auth event:', event);

      if (event === 'SIGNED_IN' && session) {
        if (currentPage === 'login' || currentPage === 'landing') {
          const dest = window._authRedirectTarget || 'dashboard';
          window._authRedirectTarget = null;
          console.info('[login.js] SIGNED_IN → navigating to', dest);
          _originalNavigate(dest);
        }
      }

      if (event === 'SIGNED_OUT') {
        _originalNavigate('landing');
      }
    });
  }

  // ── UI Helpers ──────────────────────────────────────────────

  function _showAlert(type, msg) {
    const el   = document.getElementById('login-alert');
    const icon = document.getElementById('login-alert-icon');
    const text = document.getElementById('login-alert-text');
    if (!el) return;

    el.className = [
      'mb-4 text-sm px-4 py-3 rounded-xl flex items-center gap-2',
      type === 'success'
        ? 'bg-green-500/10 border border-green-500/20 text-green-300'
        : 'bg-red-500/10 border border-red-500/20 text-red-300',
    ].join(' ');
    if (icon) icon.textContent = type === 'success' ? 'check_circle' : 'error';
    if (text) text.textContent = msg;
  }

  function _clearAlert() {
    const el = document.getElementById('login-alert');
    if (el) el.className = 'hidden';
  }

  function _setBtnLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = loading;

    if (loading) {
      btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> ' + label;
      return;
    }

    // Restore: null = restore google SVG, string = plain text
    if (label === null) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg> Continue with Google`;
    } else {
      btn.textContent = label;
    }
  }

  // ── Boot ─────────────────────────────────────────────────────
  setTimeout(function () {
    _setupAuthListener();
  }, 200);

})();
