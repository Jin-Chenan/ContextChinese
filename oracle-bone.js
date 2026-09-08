/* ================= HISTORICAL SCRIPT REVEAL =================
 * Click a hanzi character (in Search or Word Bank) and it steps through its
 * earlier script forms — oracle bone (Oracular font, see NOTICE.md), then
 * seal script (ebas927.ttf) — before crossfading back to the modern
 * character. Only characters a font actually has a glyph for get that stage
 * at all: a character with both gets a 3-stage cycle (bone -> seal ->
 * modern), one with only one of the two gets a 2-stage cycle, and one with
 * neither stays plain text with no special affordance — a "reveal" with no
 * real glyph behind it would just show a blank/tofu box.
 *
 * Both fonts' own glyphs sit at the TRADITIONAL form's codepoint (both
 * scripts predate character simplification by millennia — most
 * simplified-only characters have no glyph in either), so this reuses
 * SIMP_TO_TRAD from settings.js to look up which character to actually
 * render, while the on-page text reverts to the original simplified
 * character (whatever was actually passed in) once the reveal finishes.
 *
 * Every revealed script form gets its own full OB_STAGE_MS on screen before
 * moving on — a character with 1 historical stage (bone-only or seal-only)
 * finishes its cycle in ~OB_STAGE_MS; a character with both (e.g. 马/馬)
 * takes ~2x that, since each form gets the same uncompressed dwell time
 * rather than a fixed total being split thinner across however many stages
 * a character happens to have. Each step between forms is a real crossfade —
 * the outgoing and incoming glyph are both on screen and blending together
 * for OB_XFADE ms, rather than one fading fully out before the other fades
 * in — via a cloned "ghost" of the old glyph absolutely-positioned on top of
 * the live span; see crossfadeChar. OB_STAGE_MS is measured from the start
 * of one crossfade to the start of the next, so it already includes that
 * crossfade's own OB_XFADE at its front.
 */
const OB_XFADE = 400;     // ms per crossfade step (fixed)
const OB_STAGE_MS = 5000; // ms each revealed stage stays on screen before advancing (includes its own crossfade-in)

(function injectOracleBoneStyle(){
  const style = document.createElement('style');
  style.id = 'ccOracleBoneStyle';
  style.textContent =
    "@font-face{font-family:'Oracular'; src:url('Oracular-Regular.ttf') format('truetype'); font-display:swap;}" +
    "@font-face{font-family:'SealScript'; src:url('ebas927.ttf') format('truetype'); font-display:swap;}" +
    // .ob-char is the positioning container (stays in normal text flow,
    // sized by its .ob-char-inner child); .ob-char-inner is the live span
    // whose text/font actually gets swapped; .ob-char-ghost is a throwaway
    // clone of the PREVIOUS .ob-char-inner, absolutely-positioned right on
    // top of it, that fades out while the live span (already holding the
    // new glyph, starting from opacity 0) fades in — see crossfadeChar.
    ".ob-char{display:inline-block; position:relative;}" +
    // NOT overflow:hidden here, ever, even as a temporary inline style (see
    // revealScriptForms, which clips via clip-path instead) — even with no
    // explicit width/height set (so nothing would actually be clipped),
    // overflow being anything other than 'visible' changes how an
    // inline-block gets BASELINE-aligned per the CSS spec: with
    // overflow:visible, its baseline is its content's own text baseline
    // (what lets it sit flush with plain-text siblings like 你 next to
    // 好); with any other overflow value, an inline-block with no in-flow
    // line-box descendants of its own baseline type instead uses its
    // bottom margin edge. That shift doesn't stay contained to the element
    // it's set on either — it changes how that element participates in
    // EVERY ancestor's own line box, which measurably grew whole search
    // result rows taller for the duration of a reveal the first two times
    // this was "fixed" (once by locking only .ob-char-inner's own size,
    // once by also locking its immediate parent's — the shift just kept
    // propagating one level further up each time). clip-path doesn't
    // trigger this rule at all, at any level, which is why revealScriptForms
    // uses it instead for the one moment real clipping is actually needed.
    ".ob-char-inner{display:inline-block; transition:opacity " + OB_XFADE + "ms ease;}" +
    ".ob-char.ob-clickable{cursor:pointer;}" +
    // .ob-run only groups consecutive clickable characters for layout
    // purposes now (their five-dot rows sit flush against each other
    // without it having to draw anything itself) — the underline used to be
    // one shared border-bottom on .ob-run, replaced below by an explicit
    // per-character .ob-dots row instead, since that border could only ever
    // read as "however many dots this character's width happens to fit,"
    // not an exact, meaningful count.
    ".ob-run{display:inline-block;}" +
    // No static overflow:hidden here either — same baseline-alignment
    // reasoning as .ob-char-inner above. cloneNode(true) (see crossfadeChar)
    // copies the LOCKED width/height/clip-path inline styles over from
    // .ob-char-inner (they're plain inline styles, not tied to its class),
    // so this ghost is only ever actually visible while those are already
    // set — nothing extra needed here to match.
    ".ob-char-ghost{position:absolute; left:0; top:0; transition:opacity " + OB_XFADE + "ms ease; pointer-events:none;}" +
    ".ob-char-inner.ob-bone, .ob-char-ghost.ob-bone{font-family:'Oracular', var(--serif-cn);}" +
    ".ob-char-inner.ob-seal, .ob-char-ghost.ob-seal{font-family:'SealScript', var(--serif-cn);}" +
    // Absolutely positioned (relative to .ob-char, which is what carries
    // position:relative), NOT a normal-flow block sibling of .ob-char-inner
    // — stacking it in normal flow made .ob-char's own box taller than just
    // the glyph, which pushed the whole inline-block's default
    // vertical-align:baseline UP to compensate for the extra height sitting
    // below it, so the character itself rendered noticeably higher than
    // plain text on the same line. Taking the dots out of flow means
    // .ob-char's box height is just its glyph's height again — same
    // baseline as any other character next to it — while the dots still
    // render in the same visual spot, right under the glyph, exactly like
    // a real underline would (which never affects line height either).
    // top:1.5em (matching this site's own global line-height:1.5, i.e.
    // exactly where .ob-char's box bottom sits for the MODERN font — the
    // same spot the old border-bottom underline used to sit, with no added
    // gap on top of that) rather than top:100%, which sounds equivalent
    // but isn't: Oracular/SealScript's own font metrics are tall enough
    // that the browser expands .ob-char-inner's box to fit them even past
    // the specified line-height, growing that ONE character's box a few
    // pixels shorter or taller than its still-modern-font siblings the
    // instant its font swaps — 100% of a height that just changed drops
    // the dots to a different row than the rest of the word. em is keyed
    // to font-SIZE, which never changes across the swap, so the dots stay
    // put regardless of which font the glyph above them happens to be
    // using at the moment.
    //
    // Five explicit 1fr grid columns (not flex with gap) — flex only sizes
    // each dot to its own tiny width and clusters however many are
    // VISIBLE at the start of the row, so hiding 4 of 5 left one 3px dot
    // sitting in a corner instead of spanning anything close to the
    // glyph's width. Pinning each dot to its own numbered column via
    // :nth-child (below) means dot 1 always owns the leftmost fifth of the
    // full glyph width, dot 2 the next fifth, and so on — hiding the later
    // ones never moves the earlier ones, and five-of-five still spans
    // edge-to-edge like the underline did.
    //
    // Idle (clickable, not yet clicked) always shows all five;
    // revealScriptForms adds ob-stage-bone/ob-stage-seal to the SAME
    // .ob-char currently animating, cutting that down to just the dot(s)
    // for whichever historical stage is on screen right now via the
    // :nth-child selectors below, which always keep a LEFTMOST prefix of
    // the five visible (dot 1 alone, or dots 1-3) — growing left-to-right
    // the way an underline being drawn in should look, never re-centering
    // as a shrunken group. One dot while Oracle Bone is showing, three
    // while Seal Script is (each stage keeps its own fixed count
    // throughout its whole dwell time, not a growing/time-proportional
    // fill — this is a per-stage marker, not a countdown). Reverts to all
    // five once the cycle finishes and the character crossfades back to
    // its modern form (see revealScriptForms's own final class cleanup).
    ".ob-dots{position:absolute; left:0; top:1.5em; width:100%; display:grid; grid-template-columns:repeat(5, 1fr);}" +
    ".ob-dot{width:3px; height:3px; border-radius:50%; background:var(--seal); justify-self:center;}" +
    ".ob-dot:nth-child(1){grid-column:1;}" +
    ".ob-dot:nth-child(2){grid-column:2;}" +
    ".ob-dot:nth-child(3){grid-column:3;}" +
    ".ob-dot:nth-child(4){grid-column:4;}" +
    ".ob-dot:nth-child(5){grid-column:5;}" +
    ".ob-char.ob-stage-bone .ob-dot, .ob-char.ob-stage-seal .ob-dot{display:none;}" +
    ".ob-char.ob-stage-bone .ob-dot:nth-child(1){display:block;}" +
    ".ob-char.ob-stage-seal .ob-dot:nth-child(-n+3){display:block;}";
  document.head.appendChild(style);
})();

// Both custom fonts above are otherwise fetched lazily, on first actual use
// — fine the first time a font is needed at all, but font-display:swap
// means a not-yet-loaded font renders with its fallback (var(--serif-cn),
// i.e. the plain MODERN glyph) for however long the file takes to arrive,
// then swaps to the real one once it's ready. A 3-stage character's bone
// -> seal step transitions directly from one historical font to the
// other — if seal hasn't been used yet (bone usually loads first, simply
// by being needed first), that swap-in delay shows up as a flash of the
// modern character right in the middle of what should be a bone-to-seal
// crossfade. Eagerly loading both fonts via the FontFace API the moment
// this script runs — well before a user could plausibly click to trigger a
// reveal — means both are already fully fetched and registered in
// document.fonts by the time any reveal actually happens, so that
// swap-in-progress window never gets a chance to be visible. font-display
// stays on the @font-face rules regardless, as a fallback for the rare case
// a reveal is triggered before this preload finishes (e.g. a very fast
// click right after page load, or a blocked/slow font request) — same
// swap behavior as before, not a regression.
(function preloadHistoricalScriptFonts(){
  if(!('fonts' in document) || typeof FontFace === 'undefined') return;
  try{
    const oracular = new FontFace('Oracular', "url('Oracular-Regular.ttf')");
    const seal = new FontFace('SealScript', "url('ebas927.ttf')");
    Promise.all([oracular.load(), seal.load()]).then(function(loaded){
      loaded.forEach(function(f){ document.fonts.add(f); });
    }).catch(function(){});
  }catch(e){}
})();

// Builds the same visual text a plain hanzi string would (e.g. inside
// .dict-hz), but with each individually-covered character wrapped for
// click-to-reveal, and every run of CONSECUTIVE covered characters grouped
// under one shared .ob-run wrapper — so e.g. "老师" (both characters
// covered) gets a single unbroken dotted line under the whole word, rather
// than two separate borders that could land out of phase at the boundary
// between them. A word with only some characters covered (like 你好, where
// only 好 has a glyph) still only underlines that run, not the whole word.
// Each clickable character's own data-stages ("bone", "seal", or
// "bone,seal") records which script forms it actually has, in reveal
// order — see revealScriptForms. A clickable character's glyph itself lives
// in a nested .ob-char-inner span (see injectOracleBoneStyle) so
// revealScriptForms has a single live element to crossfade; plain
// (non-clickable) characters don't need that nesting since they never
// animate. Drop-in replacement for interpolating a raw hz string.
function renderOracleHz(hz){
  if(typeof ORACLE_BONE_CHARS === 'undefined') return hz; // coverage data not loaded — fail safe to plain text
  const chars = Array.from(hz);
  const stagesFor = chars.map(function(ch){
    const trad = (typeof SIMP_TO_TRAD !== 'undefined' && SIMP_TO_TRAD[ch]) || ch;
    const stages = [];
    if(ORACLE_BONE_CHARS.has(trad)) stages.push('bone');
    if(typeof SEAL_SCRIPT_CHARS !== 'undefined' && SEAL_SCRIPT_CHARS.has(trad)) stages.push('seal');
    return stages;
  });
  let out = '';
  let i = 0;
  while(i < chars.length){
    if(!stagesFor[i].length){
      out += '<span class="ob-char">' + chars[i] + '</span>';
      i++;
      continue;
    }
    let run = '';
    while(i < chars.length && stagesFor[i].length){
      const ch = chars[i];
      const trad = (typeof SIMP_TO_TRAD !== 'undefined' && SIMP_TO_TRAD[ch]) || ch;
      // Five plain dots, always — CSS (see injectOracleBoneStyle) is what
      // actually cuts that down to one or three once revealScriptForms
      // marks this character with ob-stage-bone/ob-stage-seal; the markup
      // itself doesn't need to know which stage (or whether one's even
      // active) at render time.
      const dots = '<span class="ob-dots">' + '<span class="ob-dot"></span>'.repeat(5) + '</span>';
      run += '<span class="ob-char ob-clickable" data-simp="' + ch + '" data-trad="' + trad + '" data-stages="' + stagesFor[i].join(',') + '" ' +
        'onclick="event.stopPropagation(); revealScriptForms(this)" ' +
        'title="Click to see this character\'s earlier script forms">' +
        '<span class="ob-char-inner">' + ch + '</span>' + dots + '</span>';
      i++;
    }
    out += '<span class="ob-run">' + run + '</span>';
  }
  return out;
}

// Crossfades a .ob-char's live glyph to newText/newClass: clones the
// current .ob-char-inner into an absolutely-positioned .ob-char-ghost
// sitting exactly on top of it (so the OLD glyph stays fully visible right
// where it was), then jumps the live span straight to the new glyph at
// opacity 0 (with its own transition disabled for that one instant swap —
// otherwise the 1->0 jump would itself animate, which is exactly the
// sequential fade-out-then-fade-in look this replaces), then re-enables the
// transition and fades the live span 0->1 while fading the ghost 1->0 at
// the same time. Both glyphs are on screen and blending for the whole
// OB_XFADE window. The ghost is removed once its fade-out finishes.
function crossfadeChar(el, newText, newClass){
  const inner = el.querySelector('.ob-char-inner');
  if(!inner) return;
  const ghost = inner.cloneNode(true);
  ghost.classList.remove('ob-char-inner');
  ghost.classList.add('ob-char-ghost');
  ghost.style.opacity = '1';
  el.appendChild(ghost);

  inner.style.transition = 'none';
  inner.style.opacity = '0';
  inner.classList.remove('ob-bone', 'ob-seal');
  if(newClass) inner.classList.add(newClass);
  inner.textContent = newText;
  void inner.offsetWidth; // force the instant opacity:0 jump to commit before the transition is re-enabled

  inner.style.transition = '';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      inner.style.opacity = '1';
      ghost.style.opacity = '0';
    });
  });
  setTimeout(function(){ ghost.remove(); }, OB_XFADE);
}

// Steps a clicked character through its stages, OB_STAGE_MS per stage (see
// the file-level comment above). Re-clicking mid-cycle is ignored
// (ob-animating) rather than restarting, so rapid clicks can't leave the
// element's text/class state out of sync with itself.
function revealScriptForms(el){
  if(el.classList.contains('ob-animating')) return;
  const stageKeys = (el.dataset.stages || '').split(',').filter(Boolean);
  if(!stageKeys.length) return;
  const simp = el.dataset.simp;
  const trad = el.dataset.trad;
  const scriptClass = {bone:'ob-bone', seal:'ob-seal'};
  // Separate from scriptClass above (that one's the FONT the glyph itself
  // renders in) — this one drives the .ob-dots row underneath via the CSS
  // in injectOracleBoneStyle: one dot for the whole time Oracle Bone is on
  // screen, three for the whole time Seal Script is, back to all five once
  // the cycle ends and el.className is reset below.
  const dotStageClass = {bone:'ob-stage-bone', seal:'ob-stage-seal'};
  // Locks .ob-char-inner to its CURRENT (modern-glyph) rendered size for the
  // whole reveal — Oracular/SealScript are different fonts with their own
  // metrics at the same font-size, so left unlocked, this inline-block
  // naturally resizes itself to whatever font happens to be showing right
  // now, visibly resizing the character's own box (and reflowing whatever
  // sits next to or below it, like .dict-hz's own width, or the row height)
  // the instant each font swaps in. Locking to the modern glyph's own
  // footprint for the duration keeps that box perfectly still through every
  // stage.
  //
  // Clipping the locked box uses clip-path:inset(0), NOT overflow:hidden —
  // despite .ob-char-inner's own CSS comment explaining exactly why
  // overflow:hidden is needed here (to stop a historical glyph's taller
  // font metrics from visibly bleeding out past the locked box), actually
  // using it turned out to cause a DIFFERENT, worse regression: per the
  // same CSS baseline rule that comment already describes (any overflow
  // other than visible shifts an inline-block's baseline to its bottom
  // margin edge), setting it on inner doesn't just affect inner's own
  // alignment — it also changes how inner participates in EVERY ancestor's
  // line box, which measurably grew el's, .ob-run's, and the whole row's
  // own height for the entire reveal (confirmed against the live render:
  // a search result row grew from 85px to 96px the instant a character was
  // clicked). clip-path isn't covered by that baseline special-case, so it
  // avoids the bulk of that growth — but not quite all of it: even with
  // overflow left at its default 'visible', a taller historical glyph's
  // true (un-clipped-for-LAYOUT-purposes, only clipped for PAINT) content
  // still measurably shifts how inner's content-baseline aligns within
  // el's own line box, which still grew el (and .ob-run) a few pixels in
  // testing — clip-path is a paint-time effect, it doesn't make the browser
  // lay out inner's content any differently than the unclipped glyph would.
  // Explicitly locking el's and .ob-run's own heights (measured before any
  // of inner's changes below, same reasoning as inner's own lock) closes
  // that remaining gap directly, regardless of the underlying cause — el's
  // parent is always exactly one .ob-run per renderOracleHz, so this never
  // needs a null check the way inner's lookup does.
  const inner = el.querySelector('.ob-char-inner');
  const run = el.parentElement;
  if(inner){
    const elRect = el.getBoundingClientRect();
    const runRect = run.getBoundingClientRect();
    const rect = inner.getBoundingClientRect();
    inner.style.width = rect.width + 'px';
    inner.style.height = rect.height + 'px';
    inner.style.clipPath = 'inset(0)';
    el.style.height = elRect.height + 'px';
    run.style.height = runRect.height + 'px';
  }
  el.classList.add('ob-animating');
  let i = 0;
  function advance(){
    if(i < stageKeys.length){
      crossfadeChar(el, trad, scriptClass[stageKeys[i]]);
      el.classList.remove('ob-stage-bone', 'ob-stage-seal');
      el.classList.add(dotStageClass[stageKeys[i]]);
      i++;
      setTimeout(advance, OB_STAGE_MS);
    } else {
      crossfadeChar(el, simp, null);
      el.classList.remove('ob-stage-bone', 'ob-stage-seal');
      setTimeout(function(){
        el.classList.remove('ob-animating');
        if(inner){
          inner.style.width = ''; inner.style.height = ''; inner.style.clipPath = '';
          el.style.height = '';
          run.style.height = '';
        }
      }, OB_XFADE);
    }
  }
  advance();
}
