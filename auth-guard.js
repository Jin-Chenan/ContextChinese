// This is the ONLY script every gated page needs to include (in <head>,
// after the main stylesheet). It decides everything from here:
//
// Set AUTH_ENABLED to true once you've filled in supabase-config.js with your
// real project values (and turned on Email sign-in under Supabase Dashboard >
// Authentication > Providers). Until then, it stays false, NO network
// requests to Supabase are made at all, and every page is revealed
// immediately with no login required.
const AUTH_ENABLED = false;

// A page can redirect an unauthenticated visitor somewhere other than
// login.html by defining AUTH_UNAUTHENTICATED_REDIRECT (a plain global,
// since this isn't a module) BEFORE its own <script src="auth-guard.js">
// tag — index.html uses this to send visitors without an account to
// landing.html (the marketing page) instead of straight to the login form.
// Every other gated page leaves it undefined and keeps the default.
function redirectToLogin() {
  const redirect = encodeURIComponent(location.pathname + location.search);
  const target = (typeof AUTH_UNAUTHENTICATED_REDIRECT !== 'undefined') ? AUTH_UNAUTHENTICATED_REDIRECT : 'login.html';
  location.replace(target + '?redirect=' + redirect);
}

function revealPage() {
  document.documentElement.style.visibility = 'visible';
}

function hideSignOutButton() {
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[onclick="signOutUser()"]').forEach(function (btn) {
      btn.style.display = 'none';
    });
  });
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

if (!AUTH_ENABLED) {
  // Nothing is fetched from Supabase at all while disabled — the page just shows.
  revealPage();
  hideSignOutButton();
} else {
  // Failsafe: if Supabase never responds (CDN blocked, offline, bad config),
  // reveal the page after a few seconds instead of leaving it blank forever.
  const fallback = setTimeout(function () {
    console.warn('Supabase took too long to respond — showing the page.');
    revealPage();
  }, 6000);

  // One script instead of Firebase's separate app+auth compat bundles —
  // supabase-js ships as a single UMD file. @2 (not a pinned patch version)
  // is Supabase's own documented CDN snippet — jsDelivr resolves it to the
  // latest 2.x release.
  loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')
    .then(function () { return loadScript('supabase-config.js'); })
    .then(function () {
      // getSession() is a one-shot read of whatever session (if any) is
      // already persisted in this browser — the direct equivalent of
      // Firebase's onAuthStateChanged firing once with the current user on
      // page load. This file only ever needs that initial check, not a
      // running subscription to LATER changes, so getSession() alone (not
      // the separate onAuthStateChange listener) is the right call here.
      return supabaseClient.auth.getSession();
    })
    .then(function (result) {
      clearTimeout(fallback);
      if (result.error) {
        console.error('Supabase auth session error:', result.error);
        redirectToLogin();
        return;
      }
      if (result.data.session) {
        revealPage();
      } else {
        redirectToLogin();
      }
    })
    .catch(function (e) {
      clearTimeout(fallback);
      console.error('Supabase failed to load (check supabase-config.js and your connection):', e);
      redirectToLogin();
    });
}

function signOutUser() {
  if (!AUTH_ENABLED) return;
  supabaseClient.auth.signOut().then(function () {
    location.replace('login.html');
  });
}
