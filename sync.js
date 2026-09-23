// Per-account data sync. Loaded synchronously in <head>, BEFORE settings.js, on
// every page that keeps user data. localStorage stays the working copy, so
// every page's existing load/save helpers keep working untouched — this
// script (1) decides whose data is in this browser, (2) mirrors an allowlist
// of keys to the signed-in account's rows in public.user_data (see
// supabase/migrations/20260102000000_user_data.sql), and (3) makes sure one
// account can never see another's data on a shared browser.
//
// Who is signed in is read straight out of supabase-js's own persisted
// session (the sb-*-auth-token localStorage entry) — no network, so the
// decision is available synchronously, before any page code reads storage.
(function(){
  'use strict';

  var SYNC_KEYS = [
    'ccWordBank','ccFolders','ccFolderWords','ccListSubscriptions','ccCustomLists',
    'ccFocusedChars','ccStudyProgress','ccDailyStudyProgress','ccDailyStudyCollections',
    'ccWritingSession','ccDictateWriteSession','ccReadPassageState','ccRespExchangeState',
    'ccSettings','ccVocabListMetric','ccDismissedSuggestions','ccDismissedCharSuggestions',
    'ccCultureEditorData','ccHistoryEditorData','ccLessonsEditorData','ccGeographyEditorData'
  ];
  var SYNCED = {};
  SYNC_KEYS.forEach(function(k){ SYNCED[k] = true; });
  // Bookkeeping keys — deliberately NOT in the allowlist above.
  var OWNER_KEY = 'ccSyncOwner';   // uid whose data currently sits in this browser
  var META_KEY  = 'ccSyncMeta';    // key -> server updated_at we last synced
  var DIRTY_KEY = 'ccSyncDirty';   // keys written locally but not yet pushed
  var RELOAD_GUARD = 'ccSyncReloadedAt';
  var HOLD_ID = 'ccSyncHold';
  var FLUSH_DELAY_MS = 1500;
  var HYDRATE_TIMEOUT_MS = 8000;
  var SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  var proto, rawSet, rawGet, rawRemove;
  try{
    proto = Storage.prototype;
    rawSet = proto.setItem; rawGet = proto.getItem; rawRemove = proto.removeItem;
    void window.localStorage; // throws where storage is blocked
  }catch(e){ return; } // no storage at all — nothing to sync, nothing to protect

  function lget(k){ try{ return rawGet.call(localStorage, k); }catch(e){ return null; } }
  function lset(k, v){ try{ rawSet.call(localStorage, k, v); }catch(e){} }
  function lrem(k){ try{ rawRemove.call(localStorage, k); }catch(e){} }
  function lgetJSON(k){ try{ var r = lget(k); return r ? JSON.parse(r) : {}; }catch(e){ return {}; } }

  // ---- shared supabase loader (auth-guard.js uses this too, so
  // supabase-config.js — whose top-level `let supabaseClient` can't be
  // declared twice — is only ever injected once) ----
  var supaPromise = null;
  function loadScript(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  window.ccEnsureSupabase = function(){
    if(supaPromise) return supaPromise;
    supaPromise = Promise.resolve()
      .then(function(){ return (typeof supabase !== 'undefined') ? null : loadScript(SUPABASE_CDN); })
      .then(function(){ return (typeof supabaseClient !== 'undefined') ? null : loadScript('supabase-config.js'); })
      .then(function(){
        if(typeof supabaseClient === 'undefined') throw new Error('Supabase client is not configured');
        return supabaseClient;
      });
    supaPromise.catch(function(){ supaPromise = null; }); // allow a retry after a failure
    return supaPromise;
  };

  // ---- session (synchronous, from supabase-js's own storage) ----
  function readSession(){
    try{
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(k && /^sb-.+-auth-token$/.test(k)){
          var j = JSON.parse(lget(k));
          if(j && j.currentSession) j = j.currentSession;
          if(j && j.user && j.user.id) return { uid: j.user.id, token: j.access_token };
        }
      }
    }catch(e){}
    return null;
  }

  // ---- default backend: public.user_data through supabase-js ----
  var defaultBackend = {
    fetchAll: function(uid){
      return window.ccEnsureSupabase().then(function(c){
        return c.from('user_data').select('key,value,updated_at').eq('user_id', uid);
      }).then(unwrap);
    },
    list: function(uid){
      return window.ccEnsureSupabase().then(function(c){
        return c.from('user_data').select('key,updated_at').eq('user_id', uid);
      }).then(unwrap);
    },
    fetchKeys: function(uid, keys){
      return window.ccEnsureSupabase().then(function(c){
        return c.from('user_data').select('key,value,updated_at').eq('user_id', uid).in('key', keys);
      }).then(unwrap);
    },
    // Resolves to { key: updated_at } for the upserted rows.
    push: function(uid, upserts, removes){
      return window.ccEnsureSupabase().then(function(c){
        var jobs = [];
        if(upserts.length){
          jobs.push(c.from('user_data')
            .upsert(upserts.map(function(r){ return { user_id: uid, key: r.key, value: r.value }; }), { onConflict: 'user_id,key' })
            .select('key,updated_at').then(unwrap));
        }
        if(removes.length){
          jobs.push(c.from('user_data').delete().eq('user_id', uid).in('key', removes).then(unwrap));
        }
        return Promise.all(jobs);
      }).then(function(results){
        var map = {};
        (results[0] || []).forEach(function(r){ if(r && r.key) map[r.key] = r.updated_at; });
        return map;
      });
    }
  };
  function unwrap(res){
    if(res && res.error) throw res.error;
    return (res && res.data) || [];
  }

  // ---- state ----
  var backend = defaultBackend;
  var uid = null;
  var ready = false;       // signed in, owns local data, safe to push
  var hydrating = false;   // writes are ignored while another account's data is being swapped in
  var flushing = false;
  var flushTimer = null;
  var dirty = {};
  var meta = {};

  function saveDirty(){ if(Object.keys(dirty).length) lset(DIRTY_KEY, JSON.stringify(dirty)); else lrem(DIRTY_KEY); }
  function saveMeta(){ lset(META_KEY, JSON.stringify(meta)); }
  function wipeSynced(){ SYNC_KEYS.forEach(lrem); }
  function wipeBookkeeping(){ lrem(OWNER_KEY); lrem(META_KEY); lrem(DIRTY_KEY); dirty = {}; meta = {}; }

  // Keeps every page hidden — including from auth-guard.js's own
  // revealPage() — until the swap finishes, so nobody flashes another
  // account's (or an empty) state.
  function hold(){
    if(document.getElementById(HOLD_ID)) return;
    var st = document.createElement('style');
    st.id = HOLD_ID;
    st.textContent = 'html{visibility:hidden !important;}';
    (document.head || document.documentElement).appendChild(st);
  }
  function release(){
    var st = document.getElementById(HOLD_ID);
    if(st && st.parentNode) st.parentNode.removeChild(st);
  }
  // A page that already read empty/stale storage at parse time needs one
  // reload to pick up freshly-synced data; guarded so a failure can never
  // turn into a reload loop.
  function reloadOnce(){
    try{
      var last = +sessionStorage.getItem(RELOAD_GUARD) || 0;
      if(Date.now() - last < 10000){ release(); return; }
      sessionStorage.setItem(RELOAD_GUARD, String(Date.now()));
    }catch(e){}
    location.reload();
  }

  // ---- write path ----
  function markDirty(k){
    dirty[k] = 1;
    saveDirty();
    scheduleFlush();
  }
  function scheduleFlush(){
    if(flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(function(){ flushTimer = null; flush(); }, FLUSH_DELAY_MS);
  }
  function flush(){
    if(!ready || flushing) return Promise.resolve();
    var keys = Object.keys(dirty);
    if(!keys.length) return Promise.resolve();
    flushing = true;
    var pushed = {}, upserts = [], removes = [];
    keys.forEach(function(k){
      var v = lget(k);
      if(v === null) removes.push(k); else { upserts.push({ key: k, value: v }); pushed[k] = v; }
    });
    return Promise.resolve().then(function(){
      return backend.push(uid, upserts, removes);
    }).then(function(stamps){
      keys.forEach(function(k){
        // Still dirty if it changed again while the request was in flight.
        var cur = lget(k);
        if((cur === null && removes.indexOf(k) !== -1) || cur === pushed[k]){
          delete dirty[k];
          if(stamps && stamps[k]) meta[k] = stamps[k];
        }
      });
      saveDirty(); saveMeta();
    }).catch(function(){ /* stays dirty — retried on the next write or page load */ })
    .then(function(){
      flushing = false;
      if(Object.keys(dirty).length) scheduleFlush();
    });
  }
  // Last-chance push while the page is going away: a normal request would be
  // cancelled, so use keepalive (browser-capped near 64KB — anything bigger
  // simply stays dirty and goes out on the next visit).
  function flushOnHide(){
    if(!ready) return;
    var sess = readSession();
    if(!sess || sess.uid !== uid || typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') return;
    var rows = [];
    Object.keys(dirty).forEach(function(k){
      var v = lget(k);
      if(v !== null) rows.push({ user_id: uid, key: k, value: v });
    });
    if(!rows.length) return;
    var body = JSON.stringify(rows);
    if(body.length > 60000) return;
    try{
      fetch(SUPABASE_URL + '/rest/v1/user_data?on_conflict=user_id,key', {
        method: 'POST', keepalive: true,
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + sess.token,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: body
      }).catch(function(){});
    }catch(e){}
  }

  // ---- storage shim ----
  function installShim(){
    proto.setItem = function(k, v){
      rawSet.call(this, k, v); // unchanged behavior — including quota errors thrown to the caller
      if(this === localStorage && SYNCED[k] && ready && !hydrating) markDirty(k);
    };
    proto.removeItem = function(k){
      rawRemove.call(this, k);
      if(this === localStorage && SYNCED[k] && ready && !hydrating) markDirty(k);
    };
  }

  // ---- account switch / first sign-in ----
  // mode 'replace': another account's data was just wiped — take the server's.
  // mode 'adopt': nobody owned this browser's data yet (today's browsers, or
  // anonymous use) — server wins per key where it has one, and whatever
  // exists only locally is kept and uploaded to this account.
  function hydrate(mode){
    hold();
    hydrating = true;
    var settled = false;
    var timer = setTimeout(function(){
      if(settled) return;
      settled = true; hydrating = false; release(); // owner stays unset: retry next load, never push empties
    }, HYDRATE_TIMEOUT_MS);
    Promise.resolve().then(function(){ return backend.fetchAll(uid); }).then(function(rows){
      if(settled) return;
      settled = true; clearTimeout(timer);
      var serverKeys = {}, changed = false;
      rows.forEach(function(r){
        if(!SYNCED[r.key]) return;
        serverKeys[r.key] = true;
        if(lget(r.key) !== r.value){ lset(r.key, r.value); changed = true; }
        meta[r.key] = r.updated_at;
      });
      if(mode === 'adopt'){
        SYNC_KEYS.forEach(function(k){ if(!serverKeys[k] && lget(k) !== null) dirty[k] = 1; });
      }
      saveMeta(); saveDirty();
      lset(OWNER_KEY, uid);
      hydrating = false; ready = true;
      if(changed){ reloadOnce(); return; }
      release();
      if(Object.keys(dirty).length) scheduleFlush();
    }).catch(function(){
      if(settled) return;
      settled = true; clearTimeout(timer);
      hydrating = false; release(); // e.g. table not created yet — behaves like today, no push
    });
  }

  // Same account as last time: push anything left unsent, then quietly pick up
  // changes made on another device (only keys we have no unsent edits for).
  function refreshFromServer(){
    Promise.resolve().then(function(){ return backend.list(uid); }).then(function(rows){
      var stale = [];
      rows.forEach(function(r){
        if(!SYNCED[r.key] || dirty[r.key]) return;
        if(meta[r.key] !== r.updated_at) stale.push(r.key);
      });
      if(!stale.length) return;
      return backend.fetchKeys(uid, stale).then(function(full){
        var changed = false;
        full.forEach(function(r){
          if(dirty[r.key]) return;
          if(lget(r.key) !== r.value){ lset(r.key, r.value); changed = true; }
          meta[r.key] = r.updated_at;
        });
        saveMeta();
        if(changed) reloadOnce();
      });
    }).catch(function(){});
  }

  function boot(opts){
    opts = opts || {};
    backend = opts.backend || defaultBackend;
    var sess = ('session' in opts) ? opts.session : readSession();
    var owner = lget(OWNER_KEY);
    dirty = lgetJSON(DIRTY_KEY);
    meta = lgetJSON(META_KEY);
    ready = false; hydrating = false;
    uid = sess ? sess.uid : null;

    if(!sess){
      // Signed out (explicit sign-out, expired session, or another tab): the
      // next person at this browser must start clean — unless there are
      // unsent edits we couldn't push, in which case keep them for now.
      if(owner && !Object.keys(dirty).length){ wipeSynced(); wipeBookkeeping(); }
      return;
    }
    if(owner && owner === uid){
      ready = true;
      if(Object.keys(dirty).length) scheduleFlush();
      refreshFromServer();
      return;
    }
    if(owner && owner !== uid){
      // Someone else's data is in this browser — never show or upload it.
      wipeSynced(); wipeBookkeeping();
      hydrate('replace');
      return;
    }
    hydrate('adopt');
  }

  installShim();
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){ flushOnHide(); }
  });
  window.addEventListener('pagehide', flushOnHide);

  window.ccSync = {
    boot: boot,
    flush: function(){ return flush(); },
    // Push anything pending, then stop treating this browser's data as owned
    // (used by sign-out so the next account never inherits it).
    prepareSignOut: function(){
      return flush().then(function(){
        if(!Object.keys(dirty).length){ wipeSynced(); wipeBookkeeping(); }
        ready = false;
      });
    },
    isSignedIn: function(){ return !!readSession(); },
    _state: function(){ return { uid: uid, ready: ready, hydrating: hydrating, dirty: Object.keys(dirty), owner: lget(OWNER_KEY) }; }
  };

  boot();
})();
