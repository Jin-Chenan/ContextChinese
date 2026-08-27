// This is the ONLY script every gated page needs to include (in <head>,
// after the main stylesheet). It decides everything from here:
//
// Set AUTH_ENABLED to true once you've filled in firebase-config.js with your
// real project values and enabled Email/Password sign-in in the Firebase
// console. Until then, it stays false, NO network requests to Firebase are
// made at all, and every page is revealed immediately with no login required.
const AUTH_ENABLED = false;

function redirectToLogin() {
  const redirect = encodeURIComponent(location.pathname + location.search);
  location.replace('login.html?redirect=' + redirect);
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
  // Nothing is fetched from Firebase at all while disabled — the page just shows.
  revealPage();
  hideSignOutButton();
} else {
  // Failsafe: if Firebase never responds (CDN blocked, offline, bad config),
  // reveal the page after a few seconds instead of leaving it blank forever.
  const fallback = setTimeout(function () {
    console.warn('Firebase took too long to respond — showing the page.');
    revealPage();
  }, 6000);

  loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
    .then(function () { return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'); })
    .then(function () { return loadScript('firebase-config.js'); })
    .then(function () {
      firebase.auth().onAuthStateChanged(
        function (user) {
          clearTimeout(fallback);
          if (user) {
            revealPage();
          } else {
            redirectToLogin();
          }
        },
        function (error) {
          clearTimeout(fallback);
          console.error('Firebase auth state error:', error);
          redirectToLogin();
        }
      );
    })
    .catch(function (e) {
      clearTimeout(fallback);
      console.error('Firebase failed to load (check firebase-config.js and your connection):', e);
      redirectToLogin();
    });
}

function signOutUser() {
  if (!AUTH_ENABLED) return;
  firebase.auth().signOut().then(function () {
    location.replace('login.html');
  });
}
