// This is the ONLY script every gated page needs to include (in <head>,
// after the main stylesheet), preceded by a one-line tag declaring which of
// three tiers the page is in:
//
//   <script>const GATE_MODE = 'public';</script>
//
//   'public'    — no gate at all. Page reveals immediately, no Supabase
//                 calls are made. For pages with nothing worth paywalling
//                 (index.html, settings.html, help.html, every practice
//                 page, the content-editor tools) and the auth entry point
//                 itself (login.html doesn't include this file at all).
//   'paywalled' — requires a signed-in user AND an active/trialing
//                 subscription. Redirects to login.html if not signed in,
//                 or pricing.html if signed in but not subscribed. Used by
//                 the reference/content pages (Radicals, Strokes, Grammar,
//                 Search, Culture, Geography, History, Lessons, Bopomofo
//                 Chart, Pinyin Components).
//   'free'      — reveals immediately for EVERYONE, signed in or not —
//                 never redirects. Once the entitlement check resolves (in
//                 the background), sets window.CC_SUBSCRIBED and dispatches
//                 a 'cc-entitlement-ready' event so the page's own script
//                 can unlock extra features for an already-subscribed
//                 visitor, or restrict everyone else to a free-tier limit.
//                 Used by word-bank.html (3 folders / 25 words each on the
//                 free plan, unlimited once CC_SUBSCRIBED).
//
// If GATE_MODE is missing entirely, default to 'paywalled' — a page that
// forgets the tag should end up over-restricted, never accidentally open.
const gateMode = (typeof GATE_MODE !== 'undefined') ? GATE_MODE : 'paywalled';

// A page can redirect an unauthenticated visitor somewhere other than
// login.html by defining AUTH_UNAUTHENTICATED_REDIRECT (a plain global,
// since this isn't a module) BEFORE its own <script src="auth-guard.js">
// tag — index.html uses this to send visitors without an account to
// landing.html (the marketing page) instead of straight to the login form.
// Every other gated page leaves it undefined and keeps the default.
function redirectTo(page) {
  const redirect = encodeURIComponent(location.pathname + location.search);
  location.replace(page + '?redirect=' + redirect);
}
function redirectToLogin() {
  const target = (typeof AUTH_UNAUTHENTICATED_REDIRECT !== 'undefined') ? AUTH_UNAUTHENTICATED_REDIRECT : 'login.html';
  redirectTo(target);
}
function redirectToPricing() { redirectTo('pricing.html'); }

function revealPage() {
  document.documentElement.style.visibility = 'visible';
}

// Only hides sign-out where there is genuinely nobody to sign out — a signed-
// in visitor on a 'public' page needs it too (it's how they switch accounts).
function hideSignOutButton() {
  if (window.ccSync && window.ccSync.isSignedIn()) return;
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

// sync.js (loaded before this file on every page that includes it) owns the
// single shared loader for supabase-js + supabase-config.js — supabase-config.js
// declares a top-level `let supabaseClient`, so it must only ever be injected
// once per page. The inline chain is just a fallback for a page without sync.js.
function ensureSupabase() {
  if (window.ccEnsureSupabase) return window.ccEnsureSupabase();
  return loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')
    .then(function () { return loadScript('supabase-config.js'); });
}

// Settles a 'free' page: reveals it (always — a free page must work even if
// Supabase is completely unreachable) and records whether this visitor is
// entitled to the full feature set, from every code path (success, auth
// error, load failure, or timeout) so the page's own script can always rely
// on the event firing exactly once instead of only on the happy path.
function settleFree(subscribed) {
  revealPage();
  window.CC_SUBSCRIBED = subscribed;
  document.dispatchEvent(new CustomEvent('cc-entitlement-ready'));
}

function checkSubscription(uid) {
  // maybeSingle() (not single()) since a user with no subscriptions row yet
  // is the common case, not an error — single() would reject on zero rows.
  return supabaseClient.from('subscriptions').select('status').eq('user_id', uid).maybeSingle()
    .then(function (result) {
      if (result.error) { console.error('Subscription check failed:', result.error); return false; }
      if (!result.data) return false;
      const status = result.data.status;
      // 'comped' is never set by Stripe or the webhook — it's a manually-
      // granted free-access status for an account that should skip billing
      // entirely (the site owner's own account, or anyone else granted a
      // free pass by hand). See supabase/README.md's "Granting complimentary
      // access" section for how to set it.
      return status === 'active' || status === 'trialing' || status === 'comped';
    })
    .catch(function (err) {
      console.error('Subscription check failed:', err);
      return false; // fail closed
    });
}

if (gateMode === 'public') {
  // Nothing is fetched from Supabase at all — the page just shows.
  revealPage();
  hideSignOutButton();
} else {
  // Failsafe: if Supabase never responds (CDN blocked, offline, bad
  // config), a 'free' page still has to work for everyone, so it reveals
  // unentitled rather than staying blank. A 'paywalled' page fails closed
  // instead — staying hidden is a bug report; revealing on a network
  // hiccup would be a hole in the whole point of this file.
  const fallback = setTimeout(function () {
    console.warn('Supabase took too long to respond.');
    if (gateMode === 'free') settleFree(false);
  }, 6000);

  ensureSupabase()
    .then(function () {
      // getSession() is a one-shot read of whatever session is already
      // persisted in this browser — this file only ever needs that initial
      // check, not a running subscription to LATER changes.
      return supabaseClient.auth.getSession();
    })
    .then(function (result) {
      if (result.error) {
        clearTimeout(fallback);
        console.error('Supabase auth session error:', result.error);
        if (gateMode === 'free') settleFree(false); else redirectToLogin();
        return;
      }
      const user = result.data.session && result.data.session.user;
      if (gateMode === 'free') {
        clearTimeout(fallback);
        if (!user) { settleFree(false); return; }
        checkSubscription(user.id).then(settleFree);
        return;
      }
      // gateMode === 'paywalled'
      if (!user) {
        clearTimeout(fallback);
        redirectToLogin();
        return;
      }
      checkSubscription(user.id).then(function (active) {
        clearTimeout(fallback);
        if (active) revealPage(); else redirectToPricing();
      });
    })
    .catch(function (e) {
      clearTimeout(fallback);
      console.error('Supabase failed to load (check supabase-config.js and your connection):', e);
      if (gateMode === 'free') settleFree(false); else redirectToLogin();
    });
}

// Works on every gate mode, including 'public' pages (where Supabase isn't
// loaded yet — ensureSupabase() brings it in on demand). Pending edits are
// pushed to the account first and this browser's copy of the account's data
// is cleared, so whoever signs in next never inherits it.
function signOutUser() {
  const flush = (window.ccSync && window.ccSync.prepareSignOut) ? window.ccSync.prepareSignOut() : Promise.resolve();
  flush.catch(function () {})
    .then(function () { return ensureSupabase(); })
    .then(function () { return supabaseClient.auth.signOut(); })
    .catch(function (e) { console.error('Sign out failed:', e); })
    .then(function () { location.replace('login.html'); });
}
