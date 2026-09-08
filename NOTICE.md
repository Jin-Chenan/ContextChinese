# Third-party data notice

## CC-CEDICT

This site's dictionary data ([cedict.js](cedict.js)) is derived from **CC-CEDICT**, a
community-maintained free Chinese-English dictionary.

- **Source**: CC-CEDICT, published by MDBG — <https://www.mdbg.net/chinese/dictionary?page=cc-cedict>
- **Original compiler**: CEDICT, © 1997–1998 Paul Andrew Denisowski; continued since 2010 as
  CC-CEDICT by its community of contributors, published by MDBG.
- **Snapshot used**: dated 2026-08-25, 124,936 entries. (MDBG's own site prohibits automated/scripted
  access, per its terms; this snapshot was downloaded manually by the site owner as the official
  CC-BY-SA-licensed release file, rather than by scripting mdbg.net directly.) An earlier version of
  this file used a 2016-06-05 snapshot of 114,624 entries, obtained from a public mirror of the same
  data at <https://github.com/gbraad/cc-cedict>; it has since been replaced by this newer snapshot.
- **License**: Creative Commons Attribution-ShareAlike 4.0 International
  (<https://creativecommons.org/licenses/by-sa/4.0/>), per this snapshot's own embedded header and
  CC-CEDICT's current license as stated on the MDBG page above. This derived file is likewise offered
  under **CC BY-SA 4.0**.

### Changes made to the original data

The original CC-CEDICT text format —

```
traditional simplified [pin1 yin1] /definition 1/definition 2/.../
```

— was mechanically converted into a compact JavaScript array of
`[simplified, pinyin with tone marks, definitions joined by "; "]` for use directly in this site's
pages, with no server or build step. Specifically:

- Numbered pinyin (e.g. `ni3 hao3`) was converted to accented pinyin (`nǐ hǎo`) to match the
  pinyin style used throughout the rest of this site.
- Traditional-character forms were **omitted** from the derived file to reduce its size, since this
  site only displays simplified characters. The complete original data, including traditional forms,
  remains available from the source linked above.
- No definitions, entries, or pinyin readings were edited, removed, or reworded — only the container
  format changed.

### Attribution and re-use

If you reuse [cedict.js](cedict.js) or any data derived from it, per CC BY-SA 4.0 you must:

1. Give appropriate credit to CC-CEDICT / MDBG (see **Source** above), link to the license, and
   indicate that changes were made (as described above).
2. Distribute your own adaptations of this data under CC BY-SA 4.0 as well.
3. Not apply additional legal or technological restrictions that stop others from doing anything the
   license permits.

This notice itself is intended to satisfy the "indicate if changes were made" and attribution
requirements of CC BY-SA 4.0 for this derived file. A visible credit also appears in-app on the
Vocabulary Search and Word Bank pages, which are the pages that use this data.

### Simplified → traditional character map

[settings.js](settings.js) also embeds a second, smaller artifact derived from the same CC-CEDICT
snapshot described above: a single-character `SIMP_TO_TRAD` lookup table (2,528 entries) that powers
the site's Character Script setting (Settings → Character Script), which live-converts the site's
simplified-Chinese text to traditional characters on request.

- **Source, compiler, snapshot, and license**: identical to the CC-CEDICT data above — see those
  fields for details. This map was built from the same 2016-06-05 snapshot obtained from the
  `gbraad/cc-cedict` mirror, not from mdbg.net directly.
- **How it was derived**: CC-CEDICT entries pair a traditional and simplified form for every word, not
  just single characters, and a handful of characters have more than one attested traditional form
  across different entries (e.g. rare or historical variants). To pick the standard form rather than
  an obscure variant, each character's simplified→traditional pairing was tallied across all 114,624
  entries (not just single-character ones), and the most frequent pairing was kept; a character was
  only included in the map at all if some traditional variant of it outnumbered the character staying
  unchanged. This is a mechanical frequency count over the same licensed data, not new editorial
  content.
- **License**: as a derivative of CC-CEDICT, this map is likewise offered under CC BY-SA 4.0, per the
  same attribution and re-use terms described above.

## HSK vocabulary lists

[hsk-lists.js](hsk-lists.js) powers the Word Bank's list-subscription feature (Vocabulary → Word Bank
→ Vocabulary lists), which shows what percentage of a standard word list you already know.

- **Source**: seven "New HSK Vocabulary" PDF word lists (levels 1–6, plus a combined 7–9 list),
  downloaded from [MandarinBean.com](https://mandarinbean.com/) and supplied locally for this site to
  read — each PDF's own header states its word count per level (300 / 200 / 500 / 1000 / 1600 / 1800 /
  5600 words respectively, 11,000 in total before the cleanup described below).
- **License — read before reusing this file**: unlike CC-CEDICT and the drkameleon dataset this file
  previously used, **no explicit reuse license was found for this data.** The PDFs themselves carry no
  copyright or license statement (checked their text and embedded metadata directly), and
  mandarinbean.com's own site displays a footer copyright notice with no published reuse terms. Treat
  this list the same way NOTICE.md's TOCFL section below already treats its own unlicensed source —
  fine for this site's own local, personal, non-commercial use; anyone reusing hsk-lists.js elsewhere
  should get their own copy from the source and check its current terms first.
- **What changed / how this was derived**: each PDF is a scanned-looking but text-layer-based table of
  Word / Pinyin / Part of Speech / Translation columns. This site only needs, per word, the simplified
  form and its pinyin, so only those two columns were extracted — Part of Speech and Translation were
  read only insofar as they helped validate the extraction (see below), then dropped. Extraction used
  [pdf.js](https://mozilla.github.io/pdf.js/) to read each page's text run positions and reconstruct
  rows/columns by coordinate (plain `pdftotext` mangles this particular PDF's embedded font — many
  characters came out as replacement boxes or the wrong glyph entirely, unusable). Two corrections were
  applied on top of the raw extraction: (1) a font quirk maps a handful of common single-component
  characters (e.g. 八, 白) to their lookalike codepoint in the Kangxi Radicals Unicode block instead of
  the real character — normalized back via the Unicode Consortium's own
  [CJKRadicals.txt](https://www.unicode.org/Public/UCD/latest/ucd/CJKRadicals.txt) equivalence table;
  (2) a small number of entries (~36) carry a trailing superscript digit in the source PDF
  distinguishing two senses of the same reading (e.g. "称1"/"称2") — stripped, since both collapse to
  the same (word, pinyin) pair this file tracks; a couple of long compound words' pinyin wrapped onto a
  second line in the PDF and needed that continuation stitched back on. One row (劳, in Level 5) lost
  its second character to a column-alignment glitch — pinyin (láodòng) confirmed it should read 劳动,
  fixed by hand. Exact-duplicate (word, pinyin) pairs left over after the above were removed
  (11,000 → 10,989 total). No other words, levels, or spellings were edited.
## TOCFL vocabulary lists

[tocfl-lists.js](tocfl-lists.js) adds TOCFL (Taiwan's Test of Chinese as a Foreign Language) to the
same list-subscription feature described above.

- **Source**: [ivankra/tocfl](https://github.com/ivankra/tocfl)'s `tocfl-202307.csv`, a parsed and
  cleaned-up version of the current (July 2023) official TOCFL vocabulary, itself sourced from
  `8000zhuyin_202307.zip` published by TOCFL's administering body, 國家華語測驗推動工作委員會 (the
  Steering Committee for the Test of Chinese as a Foreign Language), at tocfl.edu.tw.
- **License — read before reusing this file**: unlike CC-CEDICT and the HSK list above, **no explicit
  open license was found for this data.** tocfl.edu.tw's own footer states only "©
  國家華語測驗推動工作委員會 All rights reserved," with no reuse terms published; the `ivankra/tocfl`
  GitHub repository that parsed it into CSV carries no LICENSE file of its own either. This is
  materially different from every other data source in this notice. It's included here because the
  list is factual reference data (which word belongs to which proficiency band) used for exactly the
  purpose the testing committee itself publishes it for — helping learners study — inside a personal,
  non-commercial learning tool, not redistributed or sold. That reasoning doesn't extend automatically
  to other uses: if you plan to publish, redistribute, or commercialize anything built on this file,
  treat its license as unresolved and get your own clearance from 國家華語測驗推動工作委員會 first.
- **What changed**: reduced to just the simplified form and pinyin per word, grouped by level (`0-1`
  and `0-2` for the two Novice levels, `1` through `5` for Beginner through Fluent). Traditional forms,
  part-of-speech tags, and character variants from the source CSV were dropped; no words or spellings
  were edited.

## Character decomposition data

[char-decompositions.js](char-decompositions.js) powers the "New characters to learn" feature (Search
→ scroll down), alongside a small hand-curated list kept directly in
[word-suggestions.js](word-suggestions.js).

- **Source**: [skishore/makemeahanzi](https://github.com/skishore/makemeahanzi)'s `dictionary.txt`,
  which the project describes as derived from [Unihan](http://unicode.org/charts/unihan.html) and
  [CJKlib](https://github.com/cburgmer/cjklib) — see that repository for its full sourcing. Only
  `dictionary.txt` was used here, not the project's `graphics.txt`/stroke-graphics data (which the
  project itself notes carries a different license, from a font source, and this site has no use for).
- **License — read before reusing this file**: `dictionary.txt` is **GNU LGPL v3 or later**, per the
  project's own `COPYING` file — materially different from CC-CEDICT (CC BY-SA) and the HSK list above
  (no explicit license found there): this one is copyleft. This site's use is publishing the modified
  extract described below as plain client-side JavaScript — genuinely readable/inspectable source, not
  a hidden or compiled asset — with this notice identifying its origin and license. If you reuse
  char-decompositions.js elsewhere, you take on the LGPL's own obligations for that copy: keep this
  same license on it (or a compatible one), and make its source available the same way.
- **What changed / how this was derived**: dictionary.txt covers ~9,500 characters via an "Ideographic
  Description Sequence" (e.g. 明 as `⿰日月`, "left-right of 日 and 月") plus an English definition and
  pinyin per character. This site only kept characters with a SIMPLE, flat 2-or-3-part decomposition
  (no nested sub-decompositions, no unresolved "？" parts) where the target character itself appears
  somewhere in this site's own HSK_LISTS (see the HSK section above) — a stand-in for "commonly useful
  to learn," since dictionary.txt's raw ~9,500 characters include many obscure, archaic, or variant
  forms a modern learner has no reason to meet. For each kept character and its parts, the pinyin and a
  short English gloss come from this site's own CC-CEDICT data (cedict.js, see above) rather than
  dictionary.txt's own `definition`/`etymology` fields — preferring, where a character has more than
  one CC-CEDICT sense, one that isn't just a "surname X" or "variant of Y" note, so a character's most
  common everyday meaning is what's shown. A small set of common bound radical forms (氵 for 水, 亻 for
  人, 讠 for 言, etc.) are mapped by hand to the real character they stand in for, the same way the
  hand-curated list already did for its own few examples — everything else with no usable CC-CEDICT
  sense of its own was left out rather than guessed at. 2,271 characters were kept out of ~9,500.

## Oracular oracle bone script font

[Oracular-Regular.ttf](Oracular-Regular.ttf) and [Oracular-Inverted.ttf](Oracular-Inverted.ttf) power
the click-to-reveal oracle bone script feature on the Vocabulary Search and Word Bank pages (see
[oracle-bone.js](oracle-bone.js) and [oracle-bone-coverage.js](oracle-bone-coverage.js)).

- **Source**: the Jingyuan Oracle Bone Digital Platform (镜原甲骨文数字平台), a digital-humanities
  research project by Peichao Qin (PhD candidate in Asian Studies, University of Cambridge) —
  <https://oracular.azurewebsites.net>. Font version 1.0.1.
- **License**: SIL Open Font License, Version 1.1 — free for personal, research, and commercial use,
  including modification, with no additional permission required. See
  <http://scripts.sil.org/OFL> for the license text, and the font's own download page above for the
  author's full terms and Chinese national copyright registration number.
- **What this site does with it**: no modification to the font files themselves. `oracle-bone-coverage.js`
  is a separately-generated data file listing which standard-Unicode-position characters the font has a
  glyph for, read directly from the font's own `cmap` table — this determines which characters get the
  click-to-reveal affordance at all, since the font's much larger set of rarer-character glyphs lives in
  the Private Use Area with no public mapping back to a specific modern character.

## Seal script font (ebas927.ttf)

[ebas927.ttf](ebas927.ttf) powers the seal-script (篆书) stage of the same click-to-reveal feature
described above, for any character the font has a glyph for alongside Oracular's oracle bone form —
see [oracle-bone.js](oracle-bone.js) and [seal-script-coverage.js](seal-script-coverage.js).

- **Source**: CNS 11643 (中文標準交換碼), Taiwan's national Chinese character encoding standard,
  maintained by the Ministry of Digital Affairs (數位發展部) — specifically its Shuōwén Jiězì
  (說文解字) seal-script TrueType font download, at
  <https://www.cns11643.gov.tw/downloadList.jsp?ID=2&ID2=34&la=1>. This resolves the "not yet
  documented" gap this section previously flagged.
- **License**: the CNS 11643 site's own authorization statement (Government Website Data Openness
  Declaration, <https://www.cns11643.gov.tw/pageView.jsp?ID=59>) offers its font repertoire under
  either of two licenses — the **Open Government Data License, version 1.0** (free to download,
  duplicate, edit and distribute, with attribution to the Ministry of Digital Affairs required when
  publicly distributing) or **SIL Open Font License 1.1** (the same license Oracular uses above — free
  to use, copy, embed, modify, distribute and sell, provided the copyright notice and full license text
  travel with any distribution). Which of the two specifically covers this exact file wasn't confirmed
  by hand; this notice satisfies the attribution term either license requires.
- **What this site does with it**: no modification to the font file itself. `seal-script-coverage.js` is
  a separately-generated data file listing which standard-Unicode-position characters the font has a
  glyph for, read directly from the font's own `cmap` table — same derivation method as
  `oracle-bone-coverage.js` above.

## Everything else in this project

Unless stated otherwise above, the rest of this site's code and content (styling, exercises, other
vocabulary lists, illustrations, etc.) is not part of the CC-CEDICT data and is not covered by this
notice.
