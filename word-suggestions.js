/* ================= WORD SUGGESTIONS =================
   Detects compound words a learner could form from characters already in
   their Word Bank — whether a character was added on its own or just
   happens to appear inside another saved word. This is meant to keep
   working for as long as someone studies here: every time the Word Bank
   grows, more compounds become reachable, so recompute on every visit
   rather than caching a fixed answer.

   Example: if 雪 (snow) and 人 (person) are both known — 人 could have
   been added on its own, or absorbed from a word like 大人 — then 雪人
   (snowman) becomes a suggestion. */

const COMPOUND_WORDS = [
  {hz:'雪人', py:'xuěrén', en:'snowman', from:['雪','人']},
  {hz:'家人', py:'jiārén', en:'family member', from:['家','人']},
  {hz:'老人', py:'lǎorén', en:'old person / the elderly', from:['老','人']},
  {hz:'大人', py:'dàrén', en:'adult', from:['大','人']},
  {hz:'大家', py:'dàjiā', en:'everyone', from:['大','家']},
  {hz:'老家', py:'lǎojiā', en:'hometown', from:['老','家']},
  {hz:'好吃', py:'hǎochī', en:'delicious', from:['好','吃']},
  {hz:'好看', py:'hǎokàn', en:'good-looking', from:['好','看']},
  {hz:'好喝', py:'hǎohē', en:'tasty to drink', from:['好','喝']},
  {hz:'好人', py:'hǎorén', en:'good person', from:['好','人']},
  {hz:'大小', py:'dàxiǎo', en:'size', from:['大','小']},
  {hz:'买家', py:'mǎijiā', en:'buyer', from:['买','家']},
  {hz:'明白', py:'míngbai', en:'to understand', from:['明','白']},
  {hz:'电话', py:'diànhuà', en:'telephone', from:['电','话']},
  {hz:'生日', py:'shēngrì', en:'birthday', from:['生','日']},
  {hz:'火山', py:'huǒshān', en:'volcano', from:['火','山']},
  {hz:'山水', py:'shānshuǐ', en:'landscape (mountains and water)', from:['山','水']},
  {hz:'女生', py:'nǚshēng', en:'girl / female student', from:['女','生']},
  {hz:'男生', py:'nánshēng', en:'boy / male student', from:['男','生']},
  {hz:'女人', py:'nǚrén', en:'woman', from:['女','人']},
  {hz:'男人', py:'nánrén', en:'man', from:['男','人']},
  {hz:'白天', py:'báitiān', en:'daytime', from:['白','天']},
  {hz:'手心', py:'shǒuxīn', en:'palm of the hand', from:['手','心']},
  {hz:'小心', py:'xiǎoxīn', en:'to be careful', from:['小','心']},
  {hz:'花生', py:'huāshēng', en:'peanut', from:['花','生']},
  {hz:'女朋友', py:'nǚpéngyou', en:'girlfriend', from:['女','朋','友']},
  {hz:'男朋友', py:'nánpéngyou', en:'boyfriend', from:['男','朋','友']},
  {hz:'十一', py:'shíyī', en:'eleven', from:['十','一']},
  {hz:'十二', py:"shí'èr", en:'twelve', from:['十','二']},
  {hz:'十三', py:'shísān', en:'thirteen', from:['十','三']},
  {hz:'二十', py:'èrshí', en:'twenty', from:['二','十']},
  {hz:'三十', py:'sānshí', en:'thirty', from:['三','十']},
];

function getKnownChars(){
  const bank = loadWordBank();
  const chars = new Set();
  bank.forEach(function(w){
    for(const ch of w.hz){
      if(/\p{Script=Han}/u.test(ch)) chars.add(ch);
    }
  });
  return chars;
}

function loadDismissedSuggestions(){
  try{ const raw = localStorage.getItem('ccDismissedSuggestions'); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
}
function saveDismissedSuggestions(arr){
  try{ localStorage.setItem('ccDismissedSuggestions', JSON.stringify(arr)); }catch(e){}
}
function dismissSuggestion(hz){
  const arr = loadDismissedSuggestions();
  if(!arr.includes(hz)){ arr.push(hz); saveDismissedSuggestions(arr); }
}

// Was 24 — raised since the scan below stops at the first N matches in
// CC-CEDICT's own raw file order (not sorted by frequency or usefulness in
// any way), so a valid, common word could end up silently excluded just for
// sitting later in that order than enough other matches, purely by chance —
// e.g. 上下 (a very ordinary word) didn't surface for a Word Bank that
// otherwise already formed 24+ other valid compounds. The suggestions
// section is collapsed by default (see #suggestedWordsSection in
// search.html), so a longer list here doesn't clutter the page — it only
// grows what's available once actually expanded.
const CEDICT_SUGGESTION_LIMIT = 100;

// Scans the full CC-CEDICT dataset (see cedict.js) for short (2-3 character)
// words entirely composed of characters already known, beyond the small
// hand-curated COMPOUND_WORDS list above. Only present on pages that also
// load cedict.js — falls back to [] elsewhere.
function getCedictSuggestions(known, exclude, dismissed, limit){
  if(typeof CEDICT === 'undefined') return [];
  const out = [];
  for(const e of CEDICT){
    const simp = e[0];
    if(simp.length < 2 || simp.length > 3) continue;
    if(exclude.has(simp) || dismissed.has(simp)) continue;
    let allKnown = true;
    for(const ch of simp){ if(!known.has(ch)){ allKnown = false; break; } }
    if(!allKnown) continue;
    const filtered = parentalFilterCedictEntry(simp, e[1], e[2]);
    if(!filtered) continue; // parental controls: every sense of this entry was flagged
    out.push({hz: filtered.hz, py: filtered.py, en: filtered.en, from: simp.split('')});
    if(out.length >= limit) break;
  }
  return out;
}

function getSuggestedWords(){
  const known = getKnownChars();
  const bank = loadWordBank();
  const inBank = new Set(bank.map(function(w){ return w.hz; }));
  const dismissed = new Set(loadDismissedSuggestions());

  const curated = COMPOUND_WORDS.filter(function(c){
    if(inBank.has(c.hz)) return false;
    if(dismissed.has(c.hz)) return false;
    return c.from.every(function(ch){ return known.has(ch); });
  });

  const exclude = new Set(inBank);
  curated.forEach(function(c){ exclude.add(c.hz); });
  const fromCedict = getCedictSuggestions(known, exclude, dismissed, CEDICT_SUGGESTION_LIMIT);

  return curated.concat(fromCedict);
}

/* ================= CHARACTER SUGGESTIONS (a DIFFERENT mechanism) =================
   getSuggestedWords() above combines two or more characters that are each
   already whole, meaningful WORDS in the Word Bank (雪 + 人 -> 雪人).

   This second mechanism is about character composition instead: a single
   new character built out of smaller pieces — some of those pieces are
   ordinary known characters, but others are bound radical forms that are
   never written as a standalone word (e.g. ⻌, the "walking/movement"
   radical) and so could never appear in the Word Bank on their own. Those
   are marked knownAs:null below and treated as always-recognized, since a
   learner picks up basic radicals long before they could "add" one as a
   word. Each entry keeps its parts labelled so the UI can show *why* a
   character was suggested, distinctly from a word-combination suggestion. */
const CHARACTER_DECOMPOSITIONS = [
  {hz:'还', py:'hái', en:'still; yet; also; even more', parts:[
    {display:'不', knownAs:'不', label:'not / no'},
    {display:'⻌', knownAs:null, label:'movement radical (a form of 辶, "to walk")'},
  ]},
  {hz:'休', py:'xiū', en:'to rest', parts:[
    {display:'亻', knownAs:'人', label:'person (radical form of 人)'},
    {display:'木', knownAs:'木', label:'tree'},
  ]},
  {hz:'明', py:'míng', en:'bright', parts:[
    {display:'日', knownAs:'日', label:'sun'},
    {display:'月', knownAs:'月', label:'moon'},
  ]},
  {hz:'好', py:'hǎo', en:'good', parts:[
    {display:'女', knownAs:'女', label:'woman'},
    {display:'子', knownAs:'子', label:'child'},
  ]},
  {hz:'姓', py:'xìng', en:'surname; family name', parts:[
    {display:'女', knownAs:'女', label:'woman'},
    {display:'生', knownAs:'生', label:'life / to be born'},
  ]},
  {hz:'林', py:'lín', en:'woods; forest', parts:[
    {display:'木', knownAs:'木', label:'tree'},
    {display:'木', knownAs:'木', label:'tree'},
  ]},
  {hz:'森', py:'sēn', en:'forest (dense); gloomy', parts:[
    {display:'木', knownAs:'木', label:'tree'},
    {display:'木', knownAs:'木', label:'tree'},
    {display:'木', knownAs:'木', label:'tree'},
  ]},
  {hz:'从', py:'cóng', en:'from; to follow', parts:[
    {display:'人', knownAs:'人', label:'person'},
    {display:'人', knownAs:'人', label:'person'},
  ]},
  {hz:'众', py:'zhòng', en:'crowd; multitude; multiple', parts:[
    {display:'人', knownAs:'人', label:'person'},
    {display:'人', knownAs:'人', label:'person'},
    {display:'人', knownAs:'人', label:'person'},
  ]},
  {hz:'妈', py:'mā', en:'mom; mother', parts:[
    {display:'女', knownAs:'女', label:'woman'},
    {display:'马', knownAs:'马', label:'horse'},
  ]},
  {hz:'沙', py:'shā', en:'sand', parts:[
    {display:'氵', knownAs:'水', label:'water (radical form of 水)'},
    {display:'少', knownAs:'少', label:'few; little'},
  ]},
  {hz:'江', py:'jiāng', en:'river', parts:[
    {display:'氵', knownAs:'水', label:'water (radical form of 水)'},
    {display:'工', knownAs:'工', label:'work; labor'},
  ]},
  {hz:'尖', py:'jiān', en:'sharp; pointed', parts:[
    {display:'小', knownAs:'小', label:'small'},
    {display:'大', knownAs:'大', label:'big'},
  ]},
];

function loadDismissedCharSuggestions(){
  try{ const raw = localStorage.getItem('ccDismissedCharSuggestions'); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
}
function saveDismissedCharSuggestions(arr){
  try{ localStorage.setItem('ccDismissedCharSuggestions', JSON.stringify(arr)); }catch(e){}
}
function dismissCharSuggestion(hz){
  const arr = loadDismissedCharSuggestions();
  if(!arr.includes(hz)){ arr.push(hz); saveDismissedCharSuggestions(arr); }
}

const GENERATED_CHAR_LIMIT = 100;

// Same two-tier shape as getSuggestedWords() above: a small hand-curated
// list (CHARACTER_DECOMPOSITIONS, with richer hand-written etymology hints)
// plus a much larger generated set (GENERATED_CHAR_DECOMPOSITIONS, see
// char-decompositions.js and NOTICE.md for its source/license) — capped the
// same way getCedictSuggestions() caps its own scan, and for the same
// reason: it's scanning in the source data's own file order, not sorted by
// any kind of usefulness, so a generous cap matters more than a tight one.
function getSuggestedCharacters(){
  const known = getKnownChars();
  const bank = loadWordBank();
  const inBank = new Set(bank.map(function(w){ return w.hz; }));
  const dismissed = new Set(loadDismissedCharSuggestions());
  const isReachable = function(c){
    if(inBank.has(c.hz)) return false;
    if(dismissed.has(c.hz)) return false;
    return c.parts.every(function(p){ return p.knownAs === null || known.has(p.knownAs); });
  };

  const curated = CHARACTER_DECOMPOSITIONS.filter(isReachable);
  if(typeof GENERATED_CHAR_DECOMPOSITIONS === 'undefined') return curated;

  const curatedHz = new Set(curated.map(function(c){ return c.hz; }));
  const generated = [];
  for(const c of GENERATED_CHAR_DECOMPOSITIONS){
    if(curatedHz.has(c.hz)) continue; // already covered by the curated list above
    if(!isReachable(c)) continue;
    generated.push(c);
    if(generated.length >= GENERATED_CHAR_LIMIT) break;
  }
  return curated.concat(generated);
}
