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
Dictionary Search and Word Bank pages, which are the pages that use this data.

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

[hsk-lists.js](hsk-lists.js) powers the Word Bank's list-subscription feature (Dictionary → Word Bank
→ Vocabulary lists), which shows what percentage of a standard word list you already know.

- **Source**: [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
  by Yanis Zafirópulos ("Dr.Kameleon"), a compiled dataset covering the HSK 3.0 (2021) standard. That
  project's own README describes it as drawing on existing HSK word lists, CC-CEDICT, the
  makemeahanzi project, and frequency data — see that repository for its full sourcing.
- **License**: MIT. The upstream `LICENSE` file (copyright Yanis Zafirópulos) is reproduced here in
  full as required by its terms:

  > Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
  > associated documentation files (the "Software"), to deal in the Software without restriction,
  > including without limitation the rights to use, copy, modify, merge, publish, distribute,
  > sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
  > furnished to do so, subject to the following conditions: The above copyright notice and this
  > permission notice shall be included in all copies or substantial portions of the Software. THE
  > SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
  > LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  > NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  > DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

- **What changed**: the upstream dataset carries many fields (radicals, part of speech, Wade-Giles,
  Bopomofo, classifiers, multiple HSK 2.0/3.0 tag formats, etc.). This site only needs, per word, the
  simplified form and its pinyin, filtered to the HSK 3.0 ("new-N") level tags — levels 1 through 6
  individually, and level 7 covering the combined 7–9 advanced tier as the upstream data (and the
  official HSK 3.0 standard itself) publishes it. Everything else was dropped; no words, levels, or
  spellings were edited.
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

## Everything else in this project

Unless stated otherwise above, the rest of this site's code and content (styling, exercises, other
vocabulary lists, illustrations, etc.) is not part of the CC-CEDICT data and is not covered by this
notice.
