/* ================= SETTINGS (persisted via localStorage, shared across pages) =================
   One place for every user preference: appearance, audio, tone colouring, and
   the Hanzi Writing Practice grading knobs. Include this in <head>, before the
   page's own scripts, so the theme applies before first paint. */

const DEFAULT_SETTINGS = {
  theme: 'light',              // 'light' | 'dark'
  hiddenNavCategories: [],     // category keys removed entirely from the top nav bar — see NAV_CATEGORIES
  navCategoryOrder: [],        // category keys in display order; [] means the default order below
  speechRate: 0.85,            // used by the shared speak() helper
  toneColors: false,           // "Pinyin Tone Colors" — colour-code tone marks in pinyin text
  hanziToneColors: false,      // "Hanzi Tone Color" — colour characters drawn in Writing Practice by their tone. Shares tonePaletteOverrides below with toneColors, but is otherwise independent and only ever touches drawn characters, never hanzi text elsewhere on the site.
  tonePaletteOverrides: {},    // e.g. {"1":"#c0392b"} — custom colors per tone, keyed '1'-'4' and '0' (neutral); shared by both toneColors and hanziToneColors
  hwHintAfterMisses: 3,        // Writing Practice: show a hint after N misses on a stroke
  hwLeniency: 1,               // Writing Practice: how forgiving stroke grading is
  hwStrokeFadeDuration: 400,   // Writing Practice: ms a mistaken stroke lingers before fading
  hwDrawingWidthScale: 1,      // Writing Practice: multiplier on the brush/drawing line thickness
  hwAutoAdvanceMultiChar: false, // Writing Practice: auto-advance to a word's next character on success, skipping the Next click — only between characters of the same multi-character word, never into a new word
  hanziScript: 'simplified',   // 'simplified' | 'traditional' — all site content is authored simplified; 'traditional' converts it live
  uiLanguage: 'en',            // 'en' | 'zh' — language of the nav bar and account menu (site content itself is unaffected)
  excludeKnownFromPractice: false, // when true, words tagged "K" (Known) are left out of Rapid Fire / Typing / Reading practice queues
  ptAudioOnCorrect: false,     // Type Pinyin: speak the word aloud once it's typed correctly
  mpAudioOnCorrect: false,     // Match Pinyin: speak the word aloud once its last character is matched correctly
  hwAudioOnCorrect: false,     // Writing Practice: speak the word aloud once its last character is drawn correctly
  forceStopAudioOnNext: false, // Cuts off any still-playing audio the moment the next card is displayed, in Type Pinyin, Match Pinyin, and Writing Practice
};

// window.__ccSettingsOverride is set only by settings.html, to live-preview
// changes staged (but not yet saved) by its Save button workflow — every
// other page never touches it, so this is a no-op for them.
function loadSettings(){
  try{
    const raw = localStorage.getItem('ccSettings');
    const base = raw ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)) : Object.assign({}, DEFAULT_SETTINGS);
    return window.__ccSettingsOverride ? Object.assign(base, window.__ccSettingsOverride) : base;
  }catch(e){ return Object.assign({}, DEFAULT_SETTINGS); }
}
function saveSettings(patch){
  const next = Object.assign({}, loadSettings(), patch);
  try{ localStorage.setItem('ccSettings', JSON.stringify(next)); }catch(e){}
  return next;
}
function resetSettings(){
  try{ localStorage.removeItem('ccSettings'); }catch(e){}
}

/* ---------- theme ---------- */
function applyTheme(){
  const theme = loadSettings().theme;
  if(theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}
applyTheme(); // run immediately (before body paints) to avoid a flash of the wrong theme

/* ---------- nav category visibility ----------
   Each top-level nav-item carries data-nav-cat="learn|dictionary|hanzi|pinyin|
   zhuyin|geography|history" in its HTML. Hiding a category injects a plain CSS
   rule targeting that attribute — this applies the moment the element is
   parsed, with no need to wait for DOMContentLoaded and no flash of a tab
   that's supposed to be hidden. */
const NAV_CATEGORIES = [
  {key:'learn', label:'Learn'},
  {key:'dictionary', label:'Dictionary'},
  {key:'hanzi', label:'Hanzi'},
  {key:'pinyin', label:'Pinyin'},
  {key:'zhuyin', label:'Zhuyin'},
  {key:'geography', label:'Geography'},
  {key:'history', label:'History'},
];
function applyNavVisibility(){
  const hidden = loadSettings().hiddenNavCategories || [];
  let styleEl = document.getElementById('ccNavVisibilityStyle');
  if(!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'ccNavVisibilityStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = hidden.map(function(key){
    return '[data-nav-cat="' + key + '"]{display:none !important;}';
  }).join('\n');
}
applyNavVisibility();

/* ---------- nav category order ----------
   Also applied as injected CSS (flexbox `order`), for the same reason as
   visibility above: it takes effect the instant each nav-item is parsed,
   regardless of DOM-ready timing, with no reshuffle visible after load. */
function getNavCategoryOrder(){
  const saved = loadSettings().navCategoryOrder;
  const allKeys = NAV_CATEGORIES.map(function(c){ return c.key; });
  if(!Array.isArray(saved) || !saved.length) return allKeys.slice();
  const filtered = saved.filter(function(k){ return allKeys.indexOf(k) !== -1; });
  allKeys.forEach(function(k){ if(filtered.indexOf(k) === -1) filtered.push(k); });
  return filtered;
}
function applyNavOrder(){
  const order = getNavCategoryOrder();
  let styleEl = document.getElementById('ccNavOrderStyle');
  if(!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'ccNavOrderStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = order.map(function(key, i){
    return '[data-nav-cat="' + key + '"]{order:' + i + ';}';
  }).join('\n');
}
applyNavOrder();

/* ---------- tone palette ----------
   Tone colors are CSS custom properties (--tone-1..4, --tone-0 for neutral) so
   they can be overridden per-user without touching the stylesheet. */
const TONE_KEYS = ['1', '2', '3', '4', '0'];
function applyTonePalette(){
  const overrides = loadSettings().tonePaletteOverrides || {};
  TONE_KEYS.forEach(function(k){
    if(overrides[k]) document.documentElement.style.setProperty('--tone-' + k, overrides[k]);
    else document.documentElement.style.removeProperty('--tone-' + k);
  });
}
applyTonePalette();

/* ---------- speech rate ---------- */
function getSpeechRate(){
  return loadSettings().speechRate;
}

/* ---------- tone colouring ----------
   Wraps each pinyin syllable's tone-marked vowel run in a <span class="tone-c
   tone-c-N"> so CSS can colour it. Only runs inside known pinyin-bearing
   elements so Hanzi / English text is never touched. */
const TONE_MARK = {
  'ā':1,'á':2,'ǎ':3,'à':4, 'ē':1,'é':2,'ě':3,'è':4,
  'ī':1,'í':2,'ǐ':3,'ì':4, 'ō':1,'ó':2,'ǒ':3,'ò':4,
  'ū':1,'ú':2,'ǔ':3,'ù':4, 'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4,
  // Uppercase too — CEDICT capitalizes the first letter of proper nouns
  // (e.g. Ānhuī), which can land directly on the accented vowel.
  'Ā':1,'Á':2,'Ǎ':3,'À':4, 'Ē':1,'É':2,'Ě':3,'È':4,
  'Ī':1,'Í':2,'Ǐ':3,'Ì':4, 'Ō':1,'Ó':2,'Ǒ':3,'Ò':4,
  'Ū':1,'Ú':2,'Ǔ':3,'Ù':4, 'Ǖ':1,'Ǘ':2,'Ǚ':3,'Ǜ':4,
};
// .hw-context-row (not .hw-context itself) is the actual host for the pinyin
// text node now that Writing Practice wraps it with an audio button — this
// only walks an element's own direct childNodes (see colorizeTonesIn below),
// so with the button in play the text has to be listed at the level it
// actually lives at, or the glyph-fix/tone-color pass silently never reaches
// it and the raw tone-marked characters fall back to the browser's default
// font instead of the site's font-matched rendering.
const PINYIN_HOSTS = '.py, .dict-py, .converse-py, .translate-reveal, .hw-context, .hw-context-row, ' +
  '.trainer-reveal, .quiz-pinyin, .tone-key-grid, .dictate-feedback .py, ' +
  '#conversePy, #revealPy, #dictatePy, .syl-result';

function toneOfWord(word){
  for(const ch of word){ if(TONE_MARK[ch]) return TONE_MARK[ch]; }
  return 0;
}

// Neither Zilla Slab nor Noto Serif has real glyphs for these rare,
// pinyin-specific characters. Substituting a different font for the *whole*
// letter (tried first, twice — a unicode-range @font-face, then an explicit
// font-family+font-size span) always leaves a visible seam, because it's
// still a different typeface's letterforms next to Zilla Slab's, no matter
// how closely the size is matched. So for the single-mark vowels (the tone-3
// carons and friends), don't substitute the letter at all: split it into its
// plain base letter — which Zilla Slab renders natively, guaranteed identical
// to the rest of the word — plus a small standalone accent mark positioned
// above it with CSS. Only the rarer ü-tone combinations (which stack two
// marks) still use the font-substitution fallback.
const TONE_ACCENT_MARK = {1:'ˉ', 2:'ˊ', 3:'ˇ', 4:'ˋ'}; // macron, acute, caron, grave
// Lowercase i uses the dotless form (ı) as its base — a normal 'i' keeps its
// own dot, which would sit awkwardly stacked underneath the tone mark instead
// of being replaced by it, same as real precomposed accented-i glyphs do.
const ACCENT_DECOMPOSE = {
  'ā':['a',1],'á':['a',2],'ǎ':['a',3],'à':['a',4], 'ē':['e',1],'é':['e',2],'ě':['e',3],'è':['e',4],
  'ī':['ı',1],'í':['ı',2],'ǐ':['ı',3],'ì':['ı',4], 'ō':['o',1],'ó':['o',2],'ǒ':['o',3],'ò':['o',4],
  'ū':['u',1],'ú':['u',2],'ǔ':['u',3],'ù':['u',4],
  'Ā':['A',1],'Á':['A',2],'Ǎ':['A',3],'À':['A',4], 'Ē':['E',1],'É':['E',2],'Ě':['E',3],'È':['E',4],
  'Ī':['I',1],'Í':['I',2],'Ǐ':['I',3],'Ì':['I',4], 'Ō':['O',1],'Ó':['O',2],'Ǒ':['O',3],'Ò':['O',4],
  'Ū':['U',1],'Ú':['U',2],'Ǔ':['U',3],'Ù':['U',4],
};
const PINYIN_GLYPH_FIX_CHARS = new Set(['ǚ','Ǚ','ǘ','Ǘ','ǖ','Ǖ','ǜ','Ǜ','ü','Ü']);
// The decomposed accent-mark rendering (base letter + separately-positioned
// mark) is two real DOM text characters, not one — select-and-copy would
// naturally pick up both in document order (e.g. "e" + "ˋ" -> "zheˋ" instead
// of "zhè"), breaking the common case of copying a word out to paste
// elsewhere. Fixed by splitting each decomposed accent into a user-select:none
// "visual" span (what's actually seen) plus a separate, invisible-but-present
// "copy" span holding the real precomposed character — user-select:none
// removes the visual span from any selection/clipboard entirely, so a copy
// only ever picks up the correct original character.
function wrapPinyinGlyphFixes(word){
  let out = '';
  for(const ch of word){
    if(ACCENT_DECOMPOSE[ch]){
      const pair = ACCENT_DECOMPOSE[ch];
      out += '<span class="py-acc-wrap"><span class="py-visual" aria-hidden="true">' + pair[0] +
        '<span class="py-acc">' + TONE_ACCENT_MARK[pair[1]] + '</span></span><span class="py-copy">' + ch + '</span></span>';
    } else if(PINYIN_GLYPH_FIX_CHARS.has(ch)){
      out += '<span class="pinyin-glyph-fix">' + ch + '</span>';
    } else {
      out += ch;
    }
  }
  return out;
}
(function injectPinyinGlyphFixStyle(){
  const style = document.createElement('style');
  style.id = 'ccPinyinGlyphFixStyle';
  style.textContent =
    ".pinyin-glyph-fix{font-family:'Noto Serif SC', serif; font-size:0.86em;}" +
    ".py-acc-wrap{position:relative; display:inline-block;}" +
    ".py-visual{user-select:none;}" +
    ".py-acc{position:absolute; left:50%; top:0.38em; transform:translateX(-50%); font-size:0.85em; line-height:1; font-weight:900; font-family:'Inter', sans-serif;}" +
    // .py-copy must keep real, non-zero dimensions — a first attempt collapsed
    // it to width:0/height:0, which made drag-selection skip over it entirely
    // (a zero-area box has nothing for the browser's selection hit-testing to
    // catch), silently dropping the accented letter from copied text rather
    // than fixing it. Full-size + color:transparent keeps it genuinely
    // invisible (unlike opacity, which still selection-hides in some engines)
    // while occupying real, selectable screen space.
    ".py-copy{position:absolute; left:0; top:0; color:transparent;}";
  document.head.appendChild(style);
})();
// Only ever touches el's own direct text-node children — never nested
// elements. Some hosts (e.g. Hanzi Writing Practice's .hw-context) mix bare
// pinyin text with a nested element like <span class="hw-mean"> for the
// English meaning; rebuilding from el.textContent (as this used to) flattens
// that nested element away entirely, destroying its content and styling.
//
// The glyph fix (wrapPinyinGlyphFixes) always applies, regardless of whether
// tone COLORING is toggled on — it's a font-rendering correctness fix, not a
// color feature, so turning colors off must not revert pinyin to the broken
// mismatched-font rendering. Only the <span class="tone-c tone-c-N"> color
// wrapper itself is conditional on the setting.
//
// Deliberately has no "already processed, skip" flag: once a run of pinyin is
// wrapped, it lives inside element children rather than as a raw text node,
// so a second pass naturally finds nothing left to do — that makes this safe
// to call repeatedly. A flag-based guard was tried first, but pages that
// fully replace a host's content on every new word/card (e.g. hwContext.innerHTML
// = ... on each Writing Practice character) left the old flag stuck "already
// colored" on the *element*, which survives its children being replaced —
// silently skipping every word after the first.
function colorizeTonesIn(el){
  if(!el) return;
  const colorOn = loadSettings().toneColors;
  Array.from(el.childNodes).forEach(function(node){
    if(node.nodeType !== 3) return; // leave element children untouched
    const text = node.nodeValue;
    if(!text || !/[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜ]/.test(text)) return;
    // Track whether any word actually needs markup — with colors off, an
    // unaccented run (e.g. plain "t" left over beside a wrapped "ā") has
    // nothing to change. Skipping the DOM write for those is required, not
    // just an optimization: replaceChild-ing in an identical clone is still
    // a mutation, and with colors off those plain runs land as direct
    // siblings (not nested inside a wrapper span), so the mutation observer
    // would reprocess and re-replace them forever — an infinite loop that
    // pegs the page and blocks interaction.
    let changed = false;
    const html = text.replace(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜ]+/g, function(word){
      const needsFix = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜ]/.test(word);
      if(!needsFix && !colorOn) return word;
      changed = true;
      const fixed = wrapPinyinGlyphFixes(word);
      return colorOn ? '<span class="tone-c tone-c-' + toneOfWord(word) + '">' + fixed + '</span>' : fixed;
    });
    if(!changed) return;
    const wrapper = document.createElement('span');
    wrapper.innerHTML = html;
    const frag = document.createDocumentFragment();
    while(wrapper.firstChild) frag.appendChild(wrapper.firstChild);
    el.replaceChild(frag, node);
  });
}
// Unwraps just the <span class="tone-c"> color wrapper (promoting its
// children in place), leaving any nested glyph-fix spans untouched — turning
// tone colors off should only remove the color, not undo the font fix.
function clearToneColoring(){
  document.querySelectorAll(PINYIN_HOSTS).forEach(function(el){
    let changed = false;
    el.querySelectorAll('.tone-c').forEach(function(span){
      const parent = span.parentNode;
      if(!parent) return;
      while(span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      changed = true;
    });
    if(changed) el.normalize();
  });
}
function applyToneColors(){
  if(!loadSettings().toneColors) clearToneColoring();
  document.querySelectorAll(PINYIN_HOSTS).forEach(colorizeTonesIn);
}
let _toneObserver = null;
function startToneColorObserver(){
  if(_toneObserver) return;
  _toneObserver = new MutationObserver(function(){
    document.querySelectorAll(PINYIN_HOSTS).forEach(colorizeTonesIn);
  });
  _toneObserver.observe(document.body, {childList:true, subtree:true, characterData:true});
}
document.addEventListener('DOMContentLoaded', function(){
  applyToneColors();
  startToneColorObserver();
});

/* ---------- focus categories (shared by Writing, Typing, Reading, and — in
   future — Hearing practice) ----------
   A word or character can be independently flagged as "focused" per skill:
   struggling to write 我 doesn't mean you're struggling to type or read it.
   Stored as {"我": ["writing","typing"], ...} under the same localStorage key
   the old single-list version used, so existing focused characters survive
   as a one-time migration (they're assumed to all be from Writing, since
   Hanzi Writing Practice was the only page that wrote to this key before). */
const FOCUS_CATEGORIES = [
  {key:'writing', label:'Writing', short:'W', varColor:'--seal'},
  {key:'typing', label:'Typing', short:'T', varColor:'--gold'},
  {key:'reading', label:'Reading', short:'R', varColor:'--jade'},
  {key:'hearing', label:'Hearing', short:'H', varColor:'--slate'},
];
// "Known" is a fifth, separate tag — not a focus category (it doesn't mean
// "needs attention", it means "fully confident in this word already", across
// all four skills). Kept out of FOCUS_CATEGORIES/isHyperfocus since it isn't
// part of the Writing/Typing/Reading/Hearing set that Hyperfocus is defined
// over; it's word-level (like Typing/Hearing) rather than per-character.
const KNOWN_TAG = {key:'known', label:'Known', short:'K', varColor:'--plum'};
function loadFocusMap(){
  try{
    const raw = localStorage.getItem('ccFocusedChars');
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    if(Array.isArray(parsed)){
      const migrated = {};
      parsed.forEach(function(ch){ if(ch) migrated[ch] = ['writing']; });
      saveFocusMap(migrated);
      return migrated;
    }
    return (parsed && typeof parsed === 'object') ? parsed : {};
  }catch(e){ return {}; }
}
function saveFocusMap(map){
  try{ localStorage.setItem('ccFocusedChars', JSON.stringify(map)); }catch(e){}
}
function getFocusCategories(ch){
  const map = loadFocusMap();
  return map[ch] || [];
}
function isFocusedIn(ch, category){
  return getFocusCategories(ch).indexOf(category) !== -1;
}
function isFocusedAny(ch){
  return getFocusCategories(ch).length > 0;
}
function isHyperfocus(ch){
  const cats = getFocusCategories(ch);
  return FOCUS_CATEGORIES.every(function(c){ return cats.indexOf(c.key) !== -1; });
}
function setFocusCategory(ch, category, on){
  if(!ch) return;
  const map = loadFocusMap();
  const cats = new Set(map[ch] || []);
  if(on) cats.add(category); else cats.delete(category);
  if(cats.size) map[ch] = Array.from(cats); else delete map[ch];
  saveFocusMap(map);
}
function toggleFocusCategory(ch, category){
  setFocusCategory(ch, category, !isFocusedIn(ch, category));
}
function getAllFocusedChars(){
  return Object.keys(loadFocusMap());
}
function getFocusedCharsIn(category){
  const map = loadFocusMap();
  return Object.keys(map).filter(function(ch){ return map[ch].indexOf(category) !== -1; });
}
// Bulk toggle for multi-character Word Bank entries under a char-based
// category (Writing, Reading): treats the whole entry as "on" only when
// every one of its Han characters is individually focused in that category.
function isEntryFocused(hz, category){
  const chars = Array.from(hz).filter(function(ch){ return /[一-鿿]/.test(ch); });
  return chars.length > 0 && chars.every(function(ch){ return isFocusedIn(ch, category); });
}
function toggleEntryFocus(hz, category){
  const chars = Array.from(hz).filter(function(ch){ return /[一-鿿]/.test(ch); });
  const allOn = chars.length > 0 && chars.every(function(ch){ return isFocusedIn(ch, category); });
  chars.forEach(function(ch){ setFocusCategory(ch, category, !allOn); });
}

/* ---------- Hanzi Writing Practice knobs (read by hanzi-writing.html) ---------- */
function getWritingPracticeOptions(){
  const s = loadSettings();
  return {
    showHintAfterMisses: s.hwHintAfterMisses,
    leniency: s.hwLeniency,
    strokeFadeDuration: s.hwStrokeFadeDuration,
  };
}


/* ---------- character script (simplified / traditional) ----------
   All site content is authored in simplified Chinese. When the user chooses
   'traditional', every Han-character text node on the page is converted live
   via a character-for-character CC-CEDICT-derived map (see NOTICE.md) — the
   underlying content never changes, only what's displayed. Each text node's
   original (always-simplified) value is cached the first time it's seen, and
   every re-render converts FROM that cached original, never from whatever is
   currently on screen, so switching back and forth stays exact and reversible.
   Note: the Hanzi Writing Practice canvas draws strokes from HanziWriter's own
   character data rather than DOM text, so the traced/quizzed character there
   is unaffected by this setting — only surrounding labels convert. */
const SIMP_TO_TRAD = {"体":"體","综":"綜","儿":"兒","货":"貨","声":"聲","盘":"盤","罗":"羅","鉴":"鑒","裤":"褲","点":"點","书":"書","线":"線","图":"圖","挡":"擋","绷":"繃","镜":"鏡","帐":"帳","记":"記","忆":"憶","内":"內","转":"轉","弯":"彎","沟":"溝","㑇":"㑳","却":"卻","厨":"廚","岛":"島","惬":"愜","据":"據","携":"攜","㨫":"㩜","橹":"櫓","饮":"飲","涧":"澗","瘪":"癟","脉":"脈","词":"詞","镰":"鐮","飒":"颯","驮":"馱","鲃":"䰾","鱼":"魚","鹅":"鵝","鹮":"䴉","鹬":"鷸","麸":"麩","对":"對","应":"應","识":"識","并":"並","则":"則","为":"為","谓":"謂","干":"乾","净":"淨","无":"無","变":"變","鸡":"雞","来":"來","个":"個","国":"國","劲":"勁","响":"響","灵":"靈","欧":"歐","游":"遊","荡":"蕩","样":"樣","萝":"蘿","头":"頭","两":"兩","叹":"嘆","侧":"側","传":"傳","价":"價","复":"復","论":"論","断":"斷","获":"獲","钱":"錢","旧":"舊","绪":"緒","险":"險","忧":"憂","动":"動","劳":"勞","踪":"蹤","态":"態","气":"氣","脑":"腦","话":"話","诺":"諾","呜":"嗚","归":"歸","阴":"陰","红":"紅","锅":"鍋","闹":"鬧","问":"問","团":"團","乱":"亂","场":"場","块":"塊","涂":"塗","尘":"塵","厢":"廂","数":"數","惊":"驚","当":"當","关":"關","万":"萬","开":"開","见":"見","泪":"淚","师":"師","贬":"貶","审":"審","难":"難","买":"買","斗":"鬥","阵":"陣","层":"層","风":"風","顺":"順","带":"帶","过":"過","计":"計","于":"於","载":"載","绳":"繩","愿":"願","弹":"彈","顷":"頃","径":"徑","厅":"廳","办":"辦","长":"長","钥":"鑰","锁":"鎖","扫":"掃","挥":"揮","拨":"撥","拥":"擁","击":"擊","掷":"擲","揽":"攬","辙":"轍","败":"敗","终":"終","时":"時","会":"會","间":"間","际":"際","经":"經","东":"東","独":"獨","蚂":"螞","杆":"桿","进":"進","条":"條","龙":"龍","务":"務","总":"總","脚":"腳","趋":"趨","决":"決","谎":"謊","准":"準","烟":"煙","闻":"聞","处":"處","鹤":"鶴","发":"發","鸟":"鳥","诚":"誠","种":"種","窝":"窩","穷":"窮","窥":"窺","窍":"竅","笔":"筆","销":"銷","杀":"殺","奖":"獎","双":"雙","节":"節","诗":"詩","筹":"籌","箩":"籮","坏":"壞","纸":"紙","级":"級","统":"統","丝":"絲","挂":"掛","维":"維","网":"網","尽":"盡","脸":"臉","资":"資","举":"舉","说":"說","讲":"講","规":"規","贸":"貿","叶":"葉","着":"著","满":"滿","输":"輸","号":"號","电":"電","倾":"傾","钟":"鐘","视":"視","亲":"親","泽":"澤","觉":"覺","览":"覽","遗":"遺","余":"餘","银":"銀","币":"幣","触":"觸","溃":"潰","驷":"駟","马":"馬","语":"語","贫":"貧","贯":"貫","几":"幾","跃":"躍","胆":"膽","较":"較","辈":"輩","轮":"輪","辞":"辭","赞":"贊","兽":"獸","连":"連","递":"遞","边":"邊","从":"從","针":"針","锤":"錘","卖":"賣","错":"錯","门":"門","闪":"閃","项":"項","雾":"霧","颗":"顆","汤":"湯","类":"類","护":"護","颦":"顰","鳞":"鱗","鸣":"鳴","邻":"鄰","党":"黨","专":"專","齐":"齊","战":"戰","争":"爭","镐":"鎬","宁":"寧","宠":"寵","艰":"艱","县":"縣","韪":"韙","鲷":"鯛","张":"張","区":"區","业":"業","构":"構","痒":"癢","凑":"湊","热":"熱","虫":"蟲","爷":"爺","乡":"鄉","阶":"階","树":"樹","荤":"葷","鳃":"鰓","鳗":"鰻","刚":"剛","亚":"亞","装":"裝","侠":"俠","义":"義","台":"臺","戏":"戲","胜":"勝","诸":"諸","赛":"賽","顶":"頂","请":"請","运":"運","费":"費","离":"離","围":"圍","纪":"紀","晒":"曬","宝":"寶","监":"監","烂":"爛","碱":"鹼","屉":"屜","峡":"峽","坝":"壩","库":"庫","镇":"鎮","废":"廢","后":"後","栏":"欄","极":"極","权":"權","幂":"冪","猫":"貓","铁":"鐵","园":"園","温":"溫","湾":"灣","叠":"疊","胶":"膠","棱":"稜","远":"遠","锦":"錦","纲":"綱","联":"聯","爱":"愛","兰":"蘭","饭":"飯","云":"雲","苏":"蘇","债":"債","学":"學","恋":"戀","测":"測","锥":"錐","贞":"貞","乌":"烏","滨":"濱","鸦":"鴉","鸥":"鷗","军":"軍","车":"車","农":"農","题":"題","鹀":"鵐","键":"鍵","顾":"顧","庐":"廬","驾":"駕","鲜":"鮮","页":"頁","单":"單","势":"勢","齿":"齒","汉":"漢","组":"組","织":"織","调":"調","泻":"瀉","报":"報","坟":"墳","将":"將","筑":"築","岗":"崗","扬":"揚","剑":"劍","楼":"樓","标":"標","馆":"館","剧":"劇","钢":"鋼","华":"華","机":"機","广":"廣","环":"環","医":"醫","证":"證","财":"財","乐":"樂","涨":"漲","犹":"猶","岭":"嶺","瘾":"癮","睑":"瞼","确":"確","领":"領","导":"導","缴":"繳","尔":"爾","苍":"蒼","访":"訪","诉":"訴","课":"課","谕":"諭","议":"議","轨":"軌","达":"達","钩":"鉤","敌":"敵","颌":"頜","颔":"頷","颚":"顎","饶":"饒","龈":"齦","滥":"濫","划":"劃","届":"屆","属":"屬","颏":"頦","摆":"擺","槛":"檻","礼":"禮","营":"營","狱":"獄","画":"畫","仪":"儀","药":"藥","订":"訂","诏":"詔","员":"員","贱":"賤","辖":"轄","锚":"錨","闸":"閘","陆":"陸","飞":"飛","没":"沒","评":"評","产":"產","圆":"圓","伦":"倫","亏":"虧","备":"備","伤":"傷","仅":"僅","俭":"儉","匮":"匱","许":"許","冻":"凍","负":"負","昼":"晝","轩":"軒","轾":"輊","实":"實","颠":"顛","卫":"衛","黄":"黃","饰":"飾","别":"別","选":"選","择":"擇","摇":"搖","扰":"擾","烦":"煩","写":"寫","协":"協","厌":"厭","欢":"歡","状":"狀","灭":"滅","约":"約","誉":"譽","听":"聽","渊":"淵","谋":"謀","设":"設","够":"夠","众":"眾","术":"術","纳":"納","积":"積","辩":"辯","称":"稱","挠":"撓","恶":"惡","么":"麼","猪":"豬","队":"隊","耻":"恥","悦":"悅","愤":"憤","启":"啟","怀":"懷","紧":"緊","认":"認","叽":"嘰","罢":"罷","墙":"牆","扩":"擴","厉":"厲","吗":"嗎","况":"況","竞":"競","减":"減","济":"濟","补":"補","谢":"謝","强":"強","轻":"輕","稳":"穩","换":"換","简":"簡","结":"結","绝":"絕","缕":"縷","给":"給","谈":"談","羁":"羈","胫":"脛","兴":"興","适":"適","莱":"萊","迹":"跡","馒":"饅","虚":"虛","鹰":"鷹","范":"範","该":"該","详":"詳","讳":"諱","谙":"諳","让":"讓","须":"鬚","赀":"貲","赖":"賴","虑":"慮","训":"訓","辍":"輟","麦":"麥","续":"續","违":"違","逊":"遜","钺":"鉞","锈":"鏽","随":"隨","观":"觀","弃":"棄","显":"顯","饱":"飽","帮":"幫","鸭":"鴨","凉":"涼","粮":"糧","录":"錄","坛":"壇","禄":"祿","职":"職","袭":"襲","厦":"廈","损":"損","纶":"綸","脱":"脫","氢":"氫","丢":"丟","现":"現","纱":"紗","莲":"蓮","驱":"驅","细":"細","鸽":"鴿","检":"檢","剂":"劑","质":"質","蝾":"蠑","锋":"鋒","艺":"藝","历":"歷","残":"殘","频":"頻","谱":"譜","邮":"郵","坚":"堅","压":"壓","坜":"壢","驻":"駐","络":"絡","汇":"匯","执":"執","摄":"攝","纤":"纖","肿":"腫","讯":"訊","诊":"診","码":"碼","韩":"韓","鹃":"鵑","枪":"槍","枢":"樞","寿":"壽","鹭":"鷺","钻":"鑽","签":"簽","缀":"綴","缝":"縫","继":"繼","责":"責","鹟":"鶲","妇":"婦","莺":"鶯","鹧":"鷓","鸪":"鴣","悬":"懸","试":"試","贼":"賊","轴":"軸","柜":"櫃","搁":"擱","浅":"淺","阳":"陽","烧":"燒","参":"參","贝":"貝","凤":"鳳","仆":"僕","舰":"艦","祷":"禱","编":"編","罚":"罰","宾":"賓","旷":"曠","验":"驗","阔":"闊","幺":"么","丑":"醜","陈":"陳","谬":"謬","肠":"腸","盐":"鹽","宫":"宮","龟":"龜","钉":"釘","怜":"憐","讨":"討","贷":"貸","晕":"暈","瑶":"瑤","浆":"漿","窦":"竇","呕":"嘔","哕":"噦","妈":"媽","尸":"屍","垒":"壘","涩":"澀","癣":"癬","姜":"薑","馏":"餾","窜":"竄","迟":"遲","临":"臨","聪":"聰","与":"與","迁":"遷","岁":"歲","狭":"狹","仑":"崙","钛":"鈦","铀":"鈾","锰":"錳","杂":"雜","异":"異","钠":"鈉","舱":"艙","盗":"盜","贩":"販","诿":"諉","译":"譯","铃":"鈴","缤":"繽","纷":"紛","宪":"憲","钒":"釩","灯":"燈","痨":"癆","丰":"豐","脏":"臟","绑":"綁","腌":"醃","蕴":"蘊","桥":"橋","铺":"鋪","颜":"顏","喷":"噴","冈":"岡","陉":"陘","矿":"礦","亘":"亙","斋":"齋","们":"們","鹦":"鸚","鹉":"鵡","绶":"綬","奥":"奧","纯":"純","圣":"聖","孙":"孫","虏":"虜","奋":"奮","释":"釋","额":"額","缠":"纏","谊":"誼","挤":"擠","纽":"紐","还":"還","驰":"馳","庄":"莊","顿":"頓","沪":"滬","阁":"閣","蓝":"藍","锃":"鋥","丽":"麗","诛":"誅","疯":"瘋","杰":"傑","丛":"叢","蜗":"蝸","壮":"壯","梦":"夢","暂":"暫","祸":"禍","缘":"緣","横":"橫","谁":"誰","赃":"贓","狮":"獅","税":"稅","献":"獻","刹":"剎","毕":"畢","壳":"殼","绍":"紹","讫":"訖","账":"賬","鸫":"鶇","琼":"瓊","偿":"償","扑":"撲","购":"購","钦":"欽","阃":"閫","驭":"馭","养":"養","亿":"億","贵":"貴","赈":"賑","叙":"敘","眦":"眥","讹":"訛","飨":"饗","读":"讀","卧":"臥","贤":"賢","凭":"憑","钓":"釣","诞":"誕","讽":"諷","硕":"碩","俪":"儷","迈":"邁","萨":"薩","庙":"廟","玛":"瑪","俩":"倆","雏":"雛","谟":"謨","闲":"閑","颐":"頤","恒":"恆","兹":"茲","侣":"侶","懒":"懶","缩":"縮","辐":"輻","户":"戶","伫":"佇","乔":"喬","卢":"盧","绣":"繡","档":"檔","浓":"濃","伞":"傘","洼":"窪","缓":"緩","龋":"齲","疗":"療","贰":"貳","占":"佔","优":"優","铧":"鏵","尝":"嘗","鲁":"魯","晓":"曉","铳":"銃","龛":"龕","茧":"繭","缚":"縛","践":"踐","偻":"僂","夺":"奪","赶":"趕","贾":"賈","洁":"潔","绩":"績","酿":"釀","肴":"餚","唤":"喚","习":"習","惯":"慣","聋":"聾","胀":"脹","痹":"痺","鸿":"鴻","仓":"倉","链":"鏈","钴":"鈷","芦":"蘆","骂":"罵","蚀":"蝕","贴":"貼","壶":"壺","笺":"箋","闭":"閉","俣":"俁","伣":"俔","谚":"諺","湿":"濕","镖":"鏢","镳":"鑣","杠":"槓","龄":"齡","猎":"獵","炼":"煉","厂":"廠","练":"練","缮":"繕","撑":"撐","冲":"衝","伥":"倀","储":"儲","廪":"廩","颉":"頡","鸮":"鴞","隐":"隱","蜡":"蠟","烛":"燭","毙":"斃","葱":"蔥","粪":"糞","薮":"藪","赔":"賠","腾":"騰","傥":"儻","浇":"澆","阅":"閱","偬":"傯","伪":"偽","钞":"鈔","伟":"偉","滤":"濾","瘫":"癱","误":"誤","颇":"頗","滞":"滯","侦":"偵","缉":"緝","窃":"竊","㐷":"傌","篱":"籬","伧":"傖","佣":"傭","诵":"誦","颂":"頌","伛":"傴","担":"擔","惨":"慘","箧":"篋","羡":"羨","盖":"蓋","轧":"軋","颓":"頹","㑩":"儸","佥":"僉","侨":"僑","侥":"僥","偾":"僨","静":"靜","陇":"隴","侬":"儂","侩":"儈","傤":"儎","傧":"儐","俦":"儔","侪":"儕","拟":"擬","傩":"儺","俨":"儼","鹫":"鷲","勋":"勛","帅":"帥","彝":"彞","谐":"諧","阋":"鬩","畅":"暢","饥":"飢","凶":"兇","顽":"頑","斩":"斬","荣":"榮","润":"潤","秃":"禿","缆":"纜","辉":"輝","霁":"霽","卤":"鹵","娄":"婁","酱":"醬","钳":"鉗","彻":"徹","兑":"兌","软":"軟","韵":"韻","兖":"兗","殓":"殮","禀":"稟","赘":"贅","敛":"斂","涝":"澇","衬":"襯","讧":"訌","焕":"煥","歼":"殲","栖":"棲","颊":"頰","轿":"轎","枫":"楓","珑":"瓏","吨":"噸","厕":"廁","亩":"畝","厘":"釐","韬":"韜","宽":"寬","筛":"篩","赢":"贏","轭":"軛","诈":"詐","蚁":"蟻","饷":"餉","铸":"鑄","册":"冊","砺":"礪","纹":"紋","诬":"誣","笋":"筍","蛰":"蟄","饼":"餅","砖":"磚","碛":"磧","炉":"爐","艳":"艷","滩":"灘","飕":"颼","疮":"瘡","凛":"凜","凯":"凱","丧":"喪","预":"預","喽":"嘍","殡":"殯","笼":"籠","辑":"輯","锯":"鋸","镬":"鑊","蛮":"蠻","摊":"攤","蘖":"櫱","骤":"驟","碍":"礙","嘱":"囑","肤":"膚","讼":"訟","桨":"槳","雳":"靂","创":"創","犊":"犢","帜":"幟","诱":"誘","删":"刪","铲":"鏟","苋":"莧","猬":"蝟","剥":"剝","铭":"銘","鹄":"鵠","鹜":"鶩","辫":"辮","刭":"剄","锉":"銼","铅":"鉛","翘":"翹","赵":"趙","沥":"瀝","刬":"剗","讷":"訥","采":"採","䌽":"綵","剐":"剮","肾":"腎","驶":"駛","剀":"剴","刘":"劉","禅":"禪","锡":"錫","庆":"慶","鹗":"鶚","刽":"劊","刿":"劌","鹛":"鶥","鸻":"鴴","娇":"嬌","澜":"瀾","篑":"簣","赏":"賞","矶":"磯","晋":"晉","纣":"紂","励":"勵","腊":"臘","庞":"龐","饲":"飼","辄":"輒","骄":"驕","馁":"餒","骑":"騎","朴":"樸","恳":"懇","谨":"謹","勚":"勩","劢":"勱","劝":"勸","惩":"懲","诫":"誡","谏":"諫","匀":"勻","阑":"闌","茎":"莖","饺":"餃","妆":"妝","脓":"膿","阀":"閥","鸲":"鴝","纬":"緯","鹨":"鷚","匦":"匭","拢":"攏","奁":"奩","轸":"軫","钧":"鈞","龌":"齷","龊":"齪","渔":"漁","枣":"棗","浔":"潯","谯":"譙","赡":"贍","辕":"轅","郑":"鄭","驴":"驢","鳌":"鰲","垫":"墊","骆":"駱","蚕":"蠶","袄":"襖","鹂":"鸝","绿":"綠","鹊":"鵲","玺":"璽","缅":"緬","钮":"鈕","惧":"懼","笃":"篤","耸":"聳","帘":"簾","绕":"繞","鹈":"鵜","鹕":"鶘","厍":"厙","鸠":"鳩","苇":"葦","榄":"欖","谅":"諒","腻":"膩","厣":"厴","芜":"蕪","椭":"橢","谒":"謁","讥":"譏","垄":"壟","潜":"潛","婴":"嬰","刍":"芻","诘":"詰","贪":"貪","谍":"諜","馈":"饋","驳":"駁","缔":"締","饿":"餓","夹":"夾","灾":"災","贿":"賄","骗":"騙","拦":"攔","诀":"訣","砚":"硯","筝":"箏","蔺":"藺","铜":"銅","骊":"驪","觅":"覓","辟":"闢","唠":"嘮","嚣":"囂","咛":"嚀","贺":"賀","寻":"尋","恼":"惱","渗":"滲","铎":"鐸","帧":"幀","辽":"遼","堑":"塹","哑":"啞","赌":"賭","卺":"巹","涤":"滌","纵":"縱","坠":"墜","篮":"籃","裆":"襠","袜":"襪","颈":"頸","忾":"愾","谘":"諮","衔":"銜","缰":"韁","迩":"邇","浑":"渾","啬":"嗇","咏":"詠","隽":"雋","钙":"鈣","吴":"吳","栋":"棟","箫":"簫","阖":"闔","闾":"閭","呐":"吶","嘘":"噓","吕":"呂","韦":"韋","贡":"貢","哔":"嗶","嗫":"囁","钝":"鈍","谴":"譴","啸":"嘯","噜":"嚕","逻":"邏","蔼":"藹","诅":"詛","哒":"噠","哝":"噥","询":"詢","啮":"嚙","呛":"嗆","呙":"咼","恸":"慟","悯":"憫","赋":"賦","抢":"搶","瞒":"瞞","啰":"囉","哟":"喲","呗":"唄","哗":"嘩","诃":"訶","尧":"堯","殇":"殤","肃":"肅","吣":"唚","栈":"棧","飙":"飆","荆":"荊","谜":"謎","唡":"啢","啭":"囀","咙":"嚨","㖞":"喎","骚":"騷","驼":"駝","吓":"嚇","枞":"樅","疱":"皰","铬":"鉻","唝":"嗊","诟":"詬","唢":"嗩","荫":"蔭","啀":"嘊","啯":"嘓","啧":"嘖","唛":"嘜","谑":"謔","严":"嚴","馋":"饞","哓":"嘵","呒":"嘸","虾":"蝦","啴":"嘽","㖊":"噚","咝":"噝","蝉":"蟬","嗳":"噯","哙":"噲","涌":"湧","洒":"灑","哜":"嚌","呖":"嚦","亸":"嚲","喾":"嚳","饬":"飭","嘤":"嚶","冁":"囅","呓":"囈","谦":"謙","锢":"錮","萧":"蕭","鹑":"鶉","飘":"飄","溅":"濺","谛":"諦","纥":"紇","銮":"鑾","鹘":"鶻","囱":"囪","囵":"圇","垦":"墾","殴":"毆","滚":"滾","鲱":"鯡","凿":"鑿","窑":"窯","绅":"紳","鲮":"鯪","鳖":"鱉","这":"這","轰":"轟","埚":"堝","杨":"楊","挣":"掙","垭":"埡","绋":"紼","桩":"樁","础":"礎","辅":"輔","侄":"姪","庑":"廡","韧":"韌","垩":"堊","垴":"堖","舆":"輿","茔":"塋","垲":"塏","埘":"塒","绸":"綢","缪":"繆","坞":"塢","埙":"塤","螨":"蟎","毁":"毀","渍":"漬","钵":"缽","堕":"墮","橱":"櫥","垱":"壋","圹":"壙","垆":"壚","垅":"壠","壸":"壼","寝":"寢","衮":"袞","枭":"梟","戗":"戧","魇":"魘","闺":"閨","屿":"嶼","挞":"撻","鹡":"鶺","鸰":"鴒","捞":"撈","鲨":"鯊","鹳":"鸛","鹎":"鵯","鲆":"鮃","惭":"慚","谣":"謠","烩":"燴","鲵":"鯢","鲽":"鰈","鳄":"鱷","鸨":"鴇","胪":"臚","䴗":"鶪","鹏":"鵬","谭":"譚","玑":"璣","籁":"籟","蝼":"螻","蝎":"蠍","赐":"賜","绒":"絨","馅":"餡","诡":"詭","谲":"譎","赠":"贈","奂":"奐","䜣":"訢","娲":"媧","隶":"隸","姹":"奼","瓮":"甕","骛":"騖","毡":"氈","蝇":"蠅","鲠":"鯁","嫔":"嬪","娆":"嬈","娅":"婭","姗":"姍","慑":"懾","胁":"脅","骇":"駭","娱":"娛","妫":"媯","媪":"媼","袅":"裊","妪":"嫗","萦":"縈","妩":"嫵","娴":"嫻","婳":"嫿","媭":"嬃","婵":"嬋","嫱":"嬙","嫒":"嬡","嬷":"嬤","婶":"嬸","娈":"孌","癫":"癲","颖":"穎","篓":"簍","轲":"軻","鸾":"鸞","膑":"臏","诲":"誨","孪":"孿","㝉":"宁","抚":"撫","谧":"謐","弥":"彌","谳":"讞","泄":"洩","骏":"駿","阙":"闕","碜":"磣","陕":"陝","绰":"綽","赎":"贖","绌":"絀","缭":"繚","畴":"疇","衅":"釁","觑":"覷","鹪":"鷦","䴙":"鷿","䴘":"鷈","鲈":"鱸","锐":"銳","尴":"尷","鳍":"鰭","屃":"屭","屡":"屢","峦":"巒","屦":"屨","钾":"鉀","巅":"巔","榉":"櫸","巩":"鞏","岚":"嵐","岘":"峴","祯":"禎","崃":"崍","岖":"嶇","萤":"螢","颢":"顥","峥":"崢","嵘":"嶸","岽":"崬","嵝":"嶁","崭":"嶄","嵚":"嶔","崂":"嶗","峤":"嶠","峣":"嶢","峄":"嶧","崄":"嶮","岙":"嶴","岿":"巋","䴓":"鳾","蛊":"蠱","觋":"覡","巯":"巰","彦":"彥","帼":"幗","鲫":"鯽","帏":"幃","帻":"幘","帱":"幬","遥":"遙","馀":"餘","牺":"犧","鲸":"鯨","厩":"廄","厮":"廝","锣":"鑼","绵":"綿","瓯":"甌","邺":"鄴","皱":"皺","弑":"弒","荐":"薦","弪":"弳","焘":"燾","骞":"騫","纠":"糾","彟":"彠","贻":"貽","绘":"繪","瘅":"癉","畲":"畬","铉":"鉉","徕":"徠","渐":"漸","绞":"絞","颤":"顫","惮":"憚","懑":"懣","怼":"懟","讶":"訝","悮":"悞","凄":"淒","恻":"惻","怆":"愴","怅":"悵","闷":"悶","疟":"瘧","浊":"濁","恽":"惲","悫":"愨","恺":"愷","霭":"靄","愠":"慍","怄":"慪","怂":"慫","悭":"慳","郁":"鬱","惫":"憊","轼":"軾","愦":"憒","慭":"憖","怃":"憮","怿":"懌","懔":"懍","恹":"懨","忏":"懺","戆":"戇","戋":"戔","戬":"戩","锹":"鍬","牵":"牽","绢":"絹","铐":"銬","镯":"鐲","赉":"賚","搂":"摟","搅":"攪","诨":"諢","趸":"躉","镲":"鑔","绥":"綏","阄":"鬮","缳":"繯","缢":"縊","擞":"擻","蹿":"躥","铆":"鉚","抛":"拋","挛":"攣","攒":"攢","谪":"謫","骥":"驥","跷":"蹺","拣":"揀","聩":"聵","挟":"挾","躯":"軀","扪":"捫","抡":"掄","掴":"摑","挜":"掗","阐":"闡","橥":"櫫","揿":"搇","捣":"搗","裢":"褳","讪":"訕","揾":"搵","捂":"摀","掼":"摜","挚":"摯","抠":"摳","抟":"摶","掺":"摻","挦":"撏","锏":"鐧","泼":"潑","㧑":"撝","挢":"撟","掸":"撣","挝":"撾","捡":"撿","掳":"擄","闯":"闖","琅":"瑯","锒":"鋃","摈":"擯","拧":"擰","撷":"擷","撸":"擼","㧰":"擽","摅":"攄","撵":"攆","撄":"攖","搀":"攙","撺":"攛","辔":"轡","轶":"軼","讦":"訐","敚":"敓","闰":"閏","栅":"柵","敳":"敱","牍":"牘","绉":"縐","诌":"謅","斓":"斕","鹩":"鷯","谰":"讕","鸺":"鵂","鹠":"鶹","鳢":"鱧","绛":"絳","涡":"渦","鹌":"鵪","獭":"獺","炽":"熾","矾":"礬","晖":"暉","闱":"闈","鸬":"鸕","鹚":"鶿","莹":"瑩","旸":"暘","冯":"馮","鹱":"鸌","晔":"曄","昙":"曇","暧":"曖","昽":"曨","锟":"錕","沧":"滄","夸":"誇","绦":"絛","觐":"覲","胧":"朧","淀":"澱","钰":"鈺","镕":"鎔","陧":"隉","钊":"釗","缨":"纓","贽":"贄","鲍":"鮑","纾":"紓","桠":"椏","橼":"櫞","栎":"櫟","鸢":"鳶","骜":"驁","镁":"鎂","椤":"欏","栀":"梔","枧":"梘","樱":"櫻","凫":"鳧","榈":"櫚","枨":"棖","梾":"棶","椁":"槨","缄":"緘","桢":"楨","搒":"榜","杩":"榪","榅":"榲","梿":"槤","桤":"榿","闩":"閂","椠":"槧","椮":"槮","狲":"猻","桦":"樺","桡":"橈","辆":"輛","竖":"豎","檩":"檁","柽":"檉","桧":"檜","槚":"檟","樯":"檣","梼":"檮","槟":"檳","柠":"檸","栉":"櫛","椟":"櫝","槠":"櫧","栌":"櫨","枥":"櫪","榇":"櫬","栊":"櫳","棂":"欞","栾":"欒","莳":"蒔","欤":"歟","诠":"詮","镶":"鑲","蹒":"蹣","烫":"燙","殁":"歿","殒":"殞","㱮":"殨","殚":"殫","㱩":"殰","谤":"謗","喂":"餵","邓":"鄧","毵":"毿","牦":"氂","氇":"氌","汹":"洶","痉":"痙","氲":"氳","铝":"鋁","锌":"鋅","烃":"烴","氩":"氬","铵":"銨","浒":"滸","浃":"浹","蓠":"蘺","秽":"穢","沦":"淪","疴":"痾","砾":"礫","馍":"饃","涛":"濤","泞":"濘","藓":"蘚","鳅":"鰍","铢":"銖","泾":"涇","蓟":"薊","赣":"贛","蛎":"蠣","鲤":"鯉","莅":"蒞","鲋":"鮒","涟":"漣","渌":"淥","亵":"褻","诣":"詣","涞":"淶","纺":"紡","炖":"燉","绮":"綺","涣":"渙","浈":"湞","沩":"溈","驯":"馴","涢":"溳","荥":"滎","浐":"滻","绎":"繹","沤":"漚","溆":"漵","颍":"潁","疡":"瘍","滗":"潷","涠":"潿","渑":"澠","浍":"澮","觞":"觴","潍":"濰","泺":"濼","滢":"瀅","渎":"瀆","浏":"瀏","濒":"瀕","泸":"瀘","潇":"瀟","潆":"瀠","潴":"瀦","泷":"瀧","濑":"瀨","潋":"瀲","沣":"灃","滠":"灄","灏":"灝","滦":"灤","滟":"灩","烬":"燼","鱿":"魷","钎":"釺","鹞":"鷂","鲳":"鯧","饪":"飪","炜":"煒","硷":"礆","茕":"煢","琐":"瑣","炀":"煬","罴":"羆","荧":"熒","炝":"熗","烁":"爍","颎":"熲","烨":"燁","盏":"盞","焖":"燜","灿":"燦","㶶":"燶","缦":"縵","丬":"爿","矫":"矯","虽":"雖","绊":"絆","荦":"犖","狈":"狽","狰":"猙","狞":"獰","犸":"獁","狯":"獪","猃":"獫","狝":"獮","㺍":"獱","犷":"獷","猕":"獼","猡":"玀","糁":"糝","珏":"玨","馐":"饈","馔":"饌","陨":"隕","玡":"琊","珐":"琺","珲":"琿","玮":"瑋","玱":"瑲","琏":"璉","瑷":"璦","珰":"璫","㻅":"璯","玙":"璵","璎":"瓔","瓒":"瓚","脐":"臍","罂":"罌","饴":"飴","诧":"詫","钜":"鉅","铠":"鎧","荨":"蕁","箪":"簞","痖":"瘂","痪":"瘓","疭":"瘲","瘗":"瘞","瘆":"瘮","疬":"癧","疠":"癘","瘘":"瘻","痫":"癇","疖":"癤","癞":"癩","瘿":"癭","痈":"癰","绀":"紺","轫":"軔","鹲":"鸏","蔹":"蘞","钨":"鎢","镴":"鑞","皑":"皚","驹":"駒","鹇":"鷳","粤":"粵","荚":"莢","镈":"鎛","绽":"綻","皲":"皸","睁":"睜","睐":"睞","铄":"鑠","纭":"紜","眍":"瞘","䁖":"瞜","阇":"闍","眬":"矓","瞩":"矚","镓":"鎵","硁":"硜","硖":"硤","砗":"硨","钡":"鋇","砀":"碭","砜":"碸","礴":"礡","硙":"磑","硗":"磽","硚":"礄","砻":"礱","饵":"餌","脔":"臠","祦":"禑","祎":"禕","祃":"禡","祢":"禰","秆":"稈","赁":"賃","穑":"穡","颡":"顙","稣":"穌","贮":"貯","秾":"穠","穞":"穭","阒":"闃","黩":"黷","窎":"窵","窭":"窶","鲛":"鮫","靥":"靨","箓":"籙","笕":"筧","镞":"鏃","筼":"篔","筜":"簹","筚":"篳","箦":"簀","䉤":"籔","篯":"籛","箨":"籜","笾":"籩","簖":"籪","粝":"糲","籴":"糴","粜":"糶","鲣":"鰹","纡":"紆","纨":"紈","绔":"絝","纫":"紉","闽":"閩","纰":"紕","纮":"紘","锭":"錠","纴":"紝","䌷":"紬","绂":"紱","绁":"紲","纻":"紵","绐":"紿","䌹":"絅","绗":"絎","缡":"縭","绚":"絢","绖":"絰","绡":"綃","绠":"綆","绨":"綈","绤":"綌","缎":"緞","绻":"綣","绹":"綯","绾":"綰","赚":"賺","绺":"綹","绫":"綾","绲":"緄","缁":"緇","绯":"緋","绱":"緔","缃":"緗","缂":"緙","缗":"緡","缌":"緦","缑":"緱","缈":"緲","缏":"緶","缇":"緹","缙":"縉","缒":"縋","缣":"縑","缊":"縕","缞":"縗","缜":"縝","缟":"縞","缛":"縟","骋":"騁","缧":"縲","䌸":"縳","絷":"縶","缥":"縹","缫":"繅","缯":"繒","缋":"繢","缲":"繰","䍁":"繸","缱":"繾","颣":"纇","缬":"纈","纩":"纊","缵":"纘","锾":"鍰","芈":"羋","鸵":"鴕","羟":"羥","鲐":"鮐","跹":"躚","翚":"翬","翙":"翽","鸹":"鴰","锨":"鍁","耧":"耬","鬓":"鬢","聍":"聹","聂":"聶","阈":"閾","铨":"銓","臜":"臢","胨":"腖","脶":"腡","镣":"鐐","诽":"誹","腽":"膃","腘":"膕","脍":"膾","诩":"詡","鳑":"鰟","鲏":"鮍","舣":"艤","舻":"艫","鲢":"鰱","荛":"蕘","荬":"蕒","苎":"苧","镑":"鎊","荞":"蕎","荠":"薺","芲":"菕","毂":"轂","蓥":"鎣","苌":"萇","莴":"萵","荭":"葒","莼":"蒓","茏":"蘢","荪":"蓀","荜":"蓽","苁":"蓯","蒌":"蔞","锷":"鍔","蒋":"蔣","茑":"蔦","蒇":"蕆","莸":"蕕","蒉":"蕢","蓣":"蕷","蕰":"薀","荟":"薈","芗":"薌","蔷":"薔","荙":"薘","谔":"諤","钗":"釵","䓕":"薳","荩":"藎","苈":"藶","蕲":"蘄","苹":"蘋","虬":"虯","鳟":"鱒","蛱":"蛺","蜕":"蛻","蚬":"蜆","饯":"餞","鲼":"鱝","蛳":"螄","䗖":"螮","螀":"螿","蝈":"蟈","虮":"蟣","蛲":"蟯","蛏":"蟶","䴕":"鴷","虿":"蠆","蛴":"蠐","蚝":"蠔","蟏":"蠨","裈":"褌","袆":"褘","褛":"褸","裥":"襇","袯":"襏","裣":"襝","褴":"襤","䙓":"襬","襕":"襴","阎":"閻","觇":"覘","觍":"覥","觎":"覦","觊":"覬","觏":"覯","觌":"覿","觯":"觶","赅":"賅","讠":"訁","讣":"訃","讱":"訒","诂":"詁","讬":"託","诋":"詆","讵":"詎","诒":"詒","骘":"騭","诐":"詖","诇":"詗","诎":"詘","诜":"詵","诙":"詼","诖":"詿","诔":"誄","锄":"鋤","诓":"誆","诳":"誑","诶":"誒","诮":"誚","诰":"誥","谇":"誶","訚":"誾","谄":"諂","谆":"諄","诤":"諍","诹":"諏","诼":"諑","谂":"諗","谀":"諛","谞":"諝","谝":"諞","谥":"諡","谌":"諶","谖":"諼","誊":"謄","谡":"謖","谫":"謭","讴":"謳","谩":"謾","谮":"譖","谵":"譫","诪":"譸","谉":"讅","詟":"讋","䜩":"讌","雠":"讎","谗":"讒","谶":"讖","谠":"讜","岂":"豈","豮":"豶","䝙":"貙","贠":"貟","餍":"饜","贳":"貰","贶":"貺","贲":"賁","赂":"賂","赊":"賒","赇":"賕","赒":"賙","赓":"賡","赕":"賧","赍":"齎","赗":"賵","赙":"賻","赜":"賾","赟":"贇","赝":"贗","赆":"贐","赑":"贔","赪":"赬","兒":"儿","趱":"趲","踬":"躓","跄":"蹌","蹰":"躕","踊":"踴","躏":"躪","跸":"蹕","跶":"躂","踌":"躊","跻":"躋","踯":"躑","跞":"躒","蹑":"躡","躜":"躦","辊":"輥","腭":"齶","轱":"軲","辘":"轆","轵":"軹","轺":"軺","辇":"輦","辂":"輅","辁":"輇","辀":"輈","辎":"輜","辋":"輞","辌":"輬","辏":"輳","辗":"輾","辒":"轀","轳":"轤","辚":"轔","轹":"轢","逦":"邐","迳":"逕","郸":"鄲","郏":"郟","郓":"鄆","邹":"鄒","邬":"鄔","郧":"鄖","郐":"鄶","邝":"鄺","酂":"酇","郦":"酈","酝":"醞","酦":"醱","酾":"釃","酽":"釅","镏":"鎦","阊":"閶","钆":"釓","钇":"釔","钌":"釕","钯":"鈀","钋":"釙","鼹":"鼴","钐":"釤","钏":"釧","钍":"釷","钕":"釹","钫":"鈁","钘":"鈃","钭":"鈄","钚":"鈈","钤":"鈐","钣":"鈑","钑":"鈒","钬":"鈥","钪":"鈧","铌":"鈮","铈":"鈰","钶":"鈳","铛":"鐺","钹":"鈸","铍":"鈹","钸":"鈽","钿":"鈿","铊":"鉈","铇":"鉋","铋":"鉍","铂":"鉑","钷":"鉕","钲":"鉦","钼":"鉬","钽":"鉭","铰":"鉸","铒":"鉺","铪":"鉿","铚":"銍","铣":"銑","镂":"鏤","铫":"銚","铦":"銛","铑":"銠","铷":"銣","铱":"銥","铟":"銦","铥":"銩","铕":"銪","铯":"銫","锑":"銻","铤":"鋌","铗":"鋏","铓":"鋩","铻":"鋙","锊":"鋝","锓":"鋟","锔":"鋦","锇":"鋨","铖":"鋮","锆":"鋯","锂":"鋰","铽":"鋱","镚":"鏰","锞":"錁","锖":"錆","锫":"錇","锩":"錈","铔":"錏","锕":"錒","锱":"錙","铮":"錚","锛":"錛","锬":"錟","锜":"錡","锠":"錩","铼":"錸","锝":"鍀","钔":"鍆","锴":"鍇","锳":"鍈","镀":"鍍","铡":"鍘","钖":"鍚","锻":"鍛","锽":"鍠","锸":"鍤","锲":"鍥","锘":"鍩","锶":"鍶","锗":"鍺","锺":"鍾","锿":"鎄","镅":"鎇","镉":"鎘","镃":"鎡","铩":"鎩","锼":"鎪","镒":"鎰","镍":"鎳","镎":"鎿","镟":"鏇","镆":"鏌","镠":"鏐","镝":"鏑","铿":"鏗","锵":"鏘","镗":"鏜","镘":"鏝","镛":"鏞","錾":"鏨","镤":"鏷","镪":"鏹","铙":"鐃","铹":"鐒","镦":"鐓","镡":"鐔","镫":"鐙","镢":"鐝","镨":"鐠","锎":"鐦","镄":"鐨","镌":"鐫","镭":"鐳","镮":"鐶","镱":"鐿","镔":"鑌","锧":"鑕","镥":"鑥","镧":"鑭","镵":"鑱","镊":"鑷","闫":"閆","闬":"閈","闶":"閌","闳":"閎","闵":"閔","阂":"閡","阆":"閬","阉":"閹","阏":"閼","阍":"閽","阌":"閿","阕":"闋","阗":"闐","阘":"闒","闿":"闓","阚":"闞","阓":"闠","阛":"闤","闼":"闥","鸷":"鷙","颧":"顴","驿":"驛","叇":"靆","叆":"靉","靓":"靚","靔":"靝","䩄":"靦","腼":"靦","鞑":"韃","鞯":"韉","韨":"韍","韫":"韞","顸":"頇","顼":"頊","颀":"頎","颃":"頏","颁":"頒","颅":"顱","颋":"頲","颕":"頴","颙":"顒","颛":"顓","颟":"顢","颥":"顬","颞":"顳","飐":"颭","飑":"颮","飓":"颶","飔":"颸","飏":"颺","飖":"颻","飗":"飀","飚":"飈","饣":"飠","饤":"飣","饦":"飥","饨":"飩","饫":"飫","饸":"餄","饹":"餎","饽":"餑","馂":"餕","饾":"餖","馄":"餛","馃":"餜","糇":"餱","饧":"餳","馎":"餺","饩":"餼","馊":"餿","馌":"饁","馑":"饉","馓":"饊","馕":"饢","骝":"騮","骡":"騾","驲":"馹","驽":"駑","驵":"駔","骀":"駘","驸":"駙","骈":"駢","骃":"駰","骎":"駸","骍":"騂","骓":"騅","骔":"騌","骒":"騍","骐":"騏","骙":"騤","䯄":"騧","骧":"驤","驺":"騶","骟":"騸","蓦":"驀","骖":"驂","骠":"驃","骢":"驄","骅":"驊","骕":"驌","骦":"驦","骁":"驍","骣":"驏","骉":"驫","肮":"骯","髅":"髏","髇":"髐","髌":"髕","髋":"髖","魉":"魎","鳔":"鰾","鱽":"魛","鲀":"魨","鲂":"魴","鲅":"鮁","鲧":"鮌","鲇":"鮎","鲊":"鮓","鲒":"鮚","鲘":"鮜","鲕":"鮞","鲖":"鮦","鲔":"鮪","鲑":"鮭","鲪":"鮶","鲝":"鮺","鲩":"鯇","鲻":"鯔","鲯":"鯕","鲭":"鯖","鲞":"鯗","鲲":"鯤","鲰":"鯫","鲶":"鯰","鳀":"鯷","鳊":"鯿","鲗":"鰂","䲠":"鰆","鹣":"鶼","鳇":"鰉","鳆":"鰒","鳒":"鰜","鲥":"鰣","鳏":"鰥","鳎":"鰨","鳐":"鰩","鳁":"鰮","鳓":"鰳","鲦":"鰷","鲹":"鰺","鲡":"鱺","鳛":"鰼","鳙":"鱅","鳕":"鱈","鳝":"鱔","鳜":"鱖","鲟":"鱘","鲎":"鱟","鲙":"鱠","鳣":"鱣","鲿":"鱨","鲚":"鱭","鳠":"鱯","鸤":"鳲","鸩":"鴆","鸳":"鴛","鸯":"鴦","鹆":"鵒","鸱":"鴟","鸸":"鴯","鹋":"鶓","䴔":"鵁","鹁":"鵓","鹓":"鵷","鹍":"鵾","鹒":"鶊","鹙":"鶖","鹖":"鶡","鸧":"鶬","鹢":"鷁","鹝":"鷊","鹥":"鷖","鸶":"鷥","鹔":"鷫","鹴":"鸘","鸴":"鷽","㶉":"鸂","鹯":"鸇","鹾":"鹺","黉":"黌","黪":"黲","黡":"黶","黾":"黽","鼋":"黿","鼍":"鼉","齑":"齏","龀":"齔","龁":"齕","龂":"齗","龅":"齙","龇":"齜","龃":"齟","龉":"齬","龆":"齠","厐":"龎","䶮":"龑","龚":"龔"};
const _hanziScriptOriginals = new WeakMap();
const HAN_CHAR_RE = /[一-鿿]/;
function convertHanziText(text, mode){
  if(mode !== 'traditional') return text;
  let out = '';
  for(const ch of text) out += SIMP_TO_TRAD[ch] || ch;
  return out;
}
function walkHanziTextNodes(root, cb){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node){
      const p = node.parentNode;
      if(!p) return NodeFilter.FILTER_REJECT;
      const tag = p.nodeName;
      if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') return NodeFilter.FILTER_REJECT;
      if(!HAN_CHAR_RE.test(node.nodeValue)) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while((n = walker.nextNode())) cb(n);
}
function applyHanziScript(){
  if(!document.body) return;
  const mode = loadSettings().hanziScript;
  walkHanziTextNodes(document.body, function(node){
    let original = _hanziScriptOriginals.get(node);
    if(original === undefined){
      original = node.nodeValue;
      _hanziScriptOriginals.set(node, original);
    }
    const next = convertHanziText(original, mode);
    if(node.nodeValue !== next) node.nodeValue = next;
  });
}
let _hanziScriptObserver = null;
function startHanziScriptObserver(){
  if(_hanziScriptObserver) return;
  _hanziScriptObserver = new MutationObserver(function(){ applyHanziScript(); });
  _hanziScriptObserver.observe(document.body, {childList:true, subtree:true, characterData:true});
}
document.addEventListener('DOMContentLoaded', function(){
  applyHanziScript();
  startHanziScriptObserver();
});

/* ---------- interface language ----------
   Translates the nav bar, its dropdown menus, and the account (gear) menu
   between English and Chinese. This is scoped to that shared site chrome —
   exercise content, dictionary entries, and page bodies keep whatever
   language they were authored in. Nav-category buttons already show their
   Chinese name via a .cn span next to the English word (e.g. '学习 Learn'),
   so in Chinese mode the redundant English word is hidden rather than
   duplicated; every other tagged label is swapped to its translation. */
const I18N = {
  'nav.learn': '学习', 'nav.dictionary': '词典', 'nav.hanzi': '汉字',
  'nav.pinyin': '拼音', 'nav.zhuyin': '注音', 'nav.geography': '地理', 'nav.history': '历史',
  'learn.read': '阅读', 'learn.dictate': '听写', 'learn.translate': '翻译', 'learn.converse': '对话',
  'dict.search': '搜索', 'dict.wordbank': '生词库',
  'hanzi.strokes': '笔画', 'hanzi.radicals': '部首', 'hanzi.writing': '写字练习',
  'pinyin.tones': '声调', 'pinyin.components': '拼音成分', 'pinyin.match': '拼音匹配', 'pinyin.typing': '拼音打字',
  'zhuyin.chart': '注音表',
  'geography.provinces': '省级行政区',
  'history.dynasties': '朝代', 'history.postimperial': '帝制之后', 'history.modern': '现代',
  'gear.settings': '设置', 'gear.help': '帮助', 'gear.logout': '登出',
  'brand.tagline': '学中文',
};
const _i18nOriginals = new WeakMap();
function applyLanguage(){
  const lang = loadSettings().uiLanguage;
  let hideStyle = document.getElementById('ccI18nHideStyle');
  if(!hideStyle){
    hideStyle = document.createElement('style');
    hideStyle.id = 'ccI18nHideStyle';
    document.head.appendChild(hideStyle);
  }
  hideStyle.textContent = lang === 'zh' ? '.i18n-label{display:none;}' : '';
  document.querySelectorAll('[data-i18n]:not(.i18n-label)').forEach(function(el){
    let original = _i18nOriginals.get(el);
    if(original === undefined){
      original = el.textContent;
      _i18nOriginals.set(el, original);
    }
    const key = el.getAttribute('data-i18n');
    el.textContent = (lang === 'zh' && I18N[key]) ? I18N[key] : original;
  });
}
document.addEventListener('DOMContentLoaded', applyLanguage);
