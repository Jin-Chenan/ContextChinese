// Supabase project configuration.
// Get these values from: Supabase Dashboard > Project Settings > API —
// the "Project URL" and the "anon" / "public" key. Never put the
// "service_role" key here or in any other client-side file — that key
// bypasses Row Level Security entirely and must only ever be used from a
// trusted server (e.g. a Supabase Edge Function), never shipped to a
// browser.
const SUPABASE_URL = "REPLACE_WITH_YOUR_SUPABASE_URL"; // e.g. https://xxxxxxxxxxxxxxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY";

// One client, reused by every page that loads this file (auth-guard.js,
// login.html, settings.html, landing.html) — mirrors how
// firebase.initializeApp() used to set up one shared `firebase` app object.
// Session persistence (localStorage) and token auto-refresh are on by
// default — no extra config needed for parity with Firebase Auth's own
// default behavior.
//
// Wrapped in try/catch (unlike the old firebase.initializeApp(), which
// accepted a placeholder config without complaint until the first real
// network call) — createClient() validates the URL immediately and throws
// a real, uncaught exception on anything that isn't a well-formed
// http(s) URL, which the placeholder above still is until it's replaced.
// Every caller already checks `typeof supabaseClient === 'undefined'` (or
// wraps its own call in try/catch) for exactly this not-set-up-yet state,
// so leaving it undefined here instead of letting the page-load itself
// throw is what makes those checks actually reachable.
let supabaseClient;
try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn('Supabase client not created — supabase-config.js still has placeholder values.', e);
}
