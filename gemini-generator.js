/* ================= Gemini-backed sentence generation =================
   Replaces the old hand-rolled sentence-generator.js (deleted — its rigid
   template system never reliably produced correct, natural Chinese; see
   this project's own history of one-off patches to it). Read's "Folders"
   mode and Converse's "Folders" mode now ask Google's Gemini API to write
   fresh Mandarin content from a folder's own vocabulary directly, instead
   of assembling it from a fixed set of sentence templates.

   This does NOT touch cedict.js or how any OTHER page uses it — Word Bank,
   Search, and every other page still look words up in CC-CEDICT exactly as
   before. The only thing being "disassociated" here is the old generator's
   OWN internal reliance on CEDICT-gloss heuristics (genClassify and
   friends) for building sentences — Read/Converse now just hand Gemini the
   {hz,py,en} triples a folder already contains (however they got there)
   and let the model itself handle grammar, not a hardcoded classifier.

   Both exported functions are ASYNC (a real network call, unlike the old
   synchronous generator) and return the same insufficientContent-shaped
   result the pages already know how to handle:
     generatePassageAI(folderWords, sentenceCount) -> { sentences, quiz } | { insufficientContent: true, error? }
     generateExchangeAI(folderWords)               -> { prompt, options, correctIndex } | { insufficientContent: true, error? }

   Also exposes geminiSegmentText/ccEscapeHtml, used by read.html for both
   its Read and Respond activities (Respond was converse.html before that
   page was folded into read.html) to render each generated folder-word as
   its own clickable span, grouped as ONE unit even when it's 2+ characters
   (never split into separate per-character pieces) — clicking one tags it
   Reading (Read) or Hearing (Respond), the exact same settings.js
   focus-tag storage Word Bank already uses. geminiPriorityWords/
   geminiPriorityInstruction then feed those same tags back into the NEXT
   prompt, so a tagged word is
   asked for more often going forward. */

// Your own Gemini API key, used directly from the browser — there's no
// backend in this project to keep it server-side behind, so it's visible
// to anyone who opens dev tools on this page (same as any purely static
// site calling a paid API straight from client JS). Fine for your own
// local use; don't publish this file's contents anywhere the key
// shouldn't be seen.
const GEMINI_API_KEY = 'AQ.Ab8RN6LSYtF6HaIKl0Jz4HCrLwRC70lX2Mv1VuMpAe9SSAxNhw';
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ---------- shared prompt building ----------

function geminiVocabBlock(folderWords){
  return folderWords.map(w => `${w.hz} (${w.py}) — ${w.en}`).join('\n');
}

// The linguistic rules this project's own generator was explicitly
// corrected on over many rounds — carried forward here as GUIDANCE for the
// model to apply with its own actual language ability, not re-implemented
// as rigid template code (a hardcoded classifier is exactly what wasn't
// working before).
function geminiCoreInstructions(folderWords){
  return `You are writing short Mandarin Chinese practice content for a language learner, using ONLY the vocabulary listed below — this is the single most important rule. Every content word (every noun, verb, and adjective) you use in the Chinese must be one of the words in this list. You may ALSO freely use, even though they're not listed: the personal pronouns 我/你/他/她/我们/你们/他们/她们, and closed-class grammar particles with no independent meaning of their own (的/了/吗/呢/不/没/也/都/很/非常/在/要/过/是/比/更/和/还/就/才/会/能/是不是). Never substitute a different noun/verb/adjective than what's listed below, even a very common one the learner probably also knows — if it's not in the list, it cannot appear.

Learner's vocabulary (hanzi (pinyin) — English meaning):
${geminiVocabBlock(folderWords)}

Grammar to apply carefully, not just to sprinkle in:
- 了 marks a completed action, normally paired with a past time word like 昨天 ("yesterday") — e.g. 我昨天喝了茶 ("I drank tea yesterday").
- 过 marks that the subject has done something before, at some unspecified past time (experience) — e.g. 我喝过茶 ("I have drunk tea before"). Don't combine 了 and 过 on the same verb.
- 在 before a verb marks an action in progress right now — e.g. 我在吃 ("I'm eating"). Never combine 在 with 了/过/要 on the same verb.
- 要 before a verb marks something that will happen in the future, normally paired with a future time word like 明天 ("tomorrow") — e.g. 明天我要吃 ("Tomorrow I'm going to eat").
- Distinguish 喜欢 from 想/想要 carefully: 喜欢 is a general, standing fondness for something (我喜欢音乐 — "I like music"); 想/想要 is wanting something in the moment, or what someone wants to do next (我想吃 — "I want to eat now"). Only use whichever one actually fits the meaning — don't default to 喜欢 out of habit.
- Vary the sentence structure across the different sentences you write — don't repeat the same shape every time. Vary where a time word sits (before the subject, or right after it) and vary how questions are formed (吗 tag questions, A-not-A questions like 好不好, and 是不是 questions), rather than always reaching for the same one.
- If, and only if, the vocabulary above genuinely cannot support even one coherent, grammatical sentence (e.g. there's no usable verb or adjective at all among these words), respond with insufficientContent: true instead of forcing something using words outside the list. Only do this as a genuine last resort — try hard to find a workable sentence first.
- Write pinyin with proper tone marks (e.g. "nǐ hǎo"), never numbered tones (never "ni3 hao3").
- The JSON schema requires every field even when insufficientContent is true — in that case still fill the other fields in with empty strings/arrays/zero, don't omit them.

Respond ONLY with the requested JSON — no other commentary.`;
}

// Words the learner has specifically flagged (by hovering a word in a
// generated passage/exchange and tagging it — see readToggleWordFocus and
// respToggleWordFocus, both in read.html now that Respond/Converse lives
// there too) as needing extra exposure, so future generations feature them
// more. Reading uses the
// per-CHARACTER 'reading' tag (matching how that category is stored
// everywhere else in this project — settings.js's own anyCharFocused,
// looser than the Word Bank row badge's "every character" rule, since
// tagging just the one hard character in a word should still boost the
// whole word); Hearing uses the per-WORD 'hearing' tag directly. Reads
// straight from settings.js's own focus-tag storage (already loaded by
// both Read and Converse), degrading quietly to "no priority words" if
// that isn't available for some reason rather than erroring.
function geminiPriorityWords(folderWords, category){
  if(typeof isFocusedIn !== 'function') return [];
  return folderWords
    .filter(w => category === 'reading' ? anyCharFocused(w.hz, 'reading') : isFocusedIn(w.hz, 'hearing'))
    .map(w => w.hz);
}

function geminiPriorityInstruction(folderWords, category){
  const words = geminiPriorityWords(folderWords, category);
  if(!words.length) return '';
  const skill = category === 'reading' ? 'reading (recognizing on the page)' : 'hearing (recognizing by ear)';
  return `\n\nThe learner has specifically flagged these words as ones they want MORE ${skill} practice with — feature at least one of them (ideally more than one, if it stays natural) more prominently than the rest of the vocabulary, without forcing something unnatural: ${words.join('、')}.`;
}

async function geminiGenerate(promptText, schema){
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let res;
  try {
    res = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.9,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if(!res.ok){
    const bodyText = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}${bodyText ? ': ' + bodyText.slice(0, 300) : ''}`);
  }
  const data = await res.json();
  const candidate = data && data.candidates && data.candidates[0];
  const finishReason = candidate && candidate.finishReason;
  const textOut = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
  if(!textOut){
    throw new Error('Gemini API returned no content' + (finishReason ? ` (finishReason: ${finishReason})` : ''));
  }
  return JSON.parse(textOut);
}

// ---------- vocabulary safety net ----------
// The core instructions above ask Gemini to use ONLY the folder's own
// words, but an LLM (unlike the old hardcoded generator) can't be
// mechanically forced to comply — so this checks its work afterward,
// preserving the "words that don't appear in the user's folder should not
// be shown" rule this project has always enforced, just as a post-hoc
// validator now instead of a build-time constraint. Same closed-class
// scaffolding the prompt itself offers Gemini, kept in sync with it.
const GEMINI_ALLOWED_SCAFFOLD_HZ = ['我','你','他','她','我们','你们','他们','她们',
  '的','了','吗','呢','不','没','也','都','很','非常','挺','有','点','儿','在','要','过',
  '是','比','更','和','还','就','才','会','能','吧','啊','什么','怎么','么',
  '：','，','。','？','！','、','A','B'];

function geminiExtractHzText(result){
  const parts = [];
  if(Array.isArray(result.sentences)) result.sentences.forEach(s => { if(s && s.hz) parts.push(s.hz); });
  if(result.prompt && result.prompt.hz) parts.push(result.prompt.hz);
  if(Array.isArray(result.options)) result.options.forEach(o => { if(o && typeof o === 'object' && o.hz) parts.push(o.hz); });
  return parts.join('');
}

// Greedy longest-match tokenizer, shared by geminiValidateVocabulary below
// (does every token resolve to something recognized?) and by
// geminiSegmentText (used to render hover-to-tag spans in Read/Converse —
// see readRenderPassageHZ/convRenderPromptHZ) so segmentation always agrees
// with what was actually validated, using ONE tokenizing pass rather than
// two separately-maintained ones. Each token is {text, isFolderWord,
// recognized} — isFolderWord is true only for an actual vocabulary word
// (not a pronoun/particle from the scaffold), which is what "taggable for
// extra practice" means; recognized is false when nothing matched at all
// (an out-of-vocabulary token slipped through — the whole point of
// geminiValidateVocabulary's own check below).
function geminiTokenize(hzText, folderWords){
  const folderSet = new Set(folderWords.map(w => w.hz));
  const vocab = new Set(folderWords.map(w => w.hz).concat(GEMINI_ALLOWED_SCAFFOLD_HZ));
  let maxLen = 1;
  vocab.forEach(w => { if(w.length > maxLen) maxLen = w.length; });
  const tokens = [];
  let i = 0;
  while(i < hzText.length){
    if(/[\s\p{P}A-Za-z0-9]/u.test(hzText[i])){ // punctuation/latin/space always passes through as-is
      tokens.push({ text: hzText[i], isFolderWord: false, recognized: true });
      i++; continue;
    }
    let matched = null;
    for(let len = Math.min(maxLen, hzText.length - i); len >= 1; len--){
      const cand = hzText.slice(i, i + len);
      if(vocab.has(cand)){ matched = cand; break; }
    }
    if(matched){
      tokens.push({ text: matched, isFolderWord: folderSet.has(matched), recognized: true });
      i += matched.length;
    } else {
      tokens.push({ text: hzText[i], isFolderWord: false, recognized: false });
      i++;
    }
  }
  return tokens;
}

// Can every character of the combined Chinese output be covered using only
// the folder's own words plus the fixed scaffold above? Deliberately
// word-level (not just "is every CHARACTER individually somewhere in the
// folder"), which would wrongly accept a brand-new word built by
// recombining characters from two different folder words.
function geminiValidateVocabulary(hzText, folderWords){
  return geminiTokenize(hzText, folderWords).every(t => t.recognized);
}

// Word-level segmentation for hover-to-tag UI (see gemini-generator.js's
// own header comment) — reuses the SAME tokenizer validation already ran,
// so a taggable span always corresponds to a real folder word actually
// used in the generated text, never a pronoun/particle or an unrecognized
// fragment.
function geminiSegmentText(hzText, folderWords){
  return geminiTokenize(hzText, folderWords);
}

function ccEscapeHtml(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Read: generatePassageAI ----------

const GEMINI_PASSAGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    insufficientContent: { type: 'BOOLEAN' },
    sentences: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { hz: { type: 'STRING' }, py: { type: 'STRING' }, en: { type: 'STRING' } },
        required: ['hz', 'py', 'en'],
      },
    },
    quizQuestion: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' } },
    correctIndex: { type: 'INTEGER' },
  },
  required: ['insufficientContent', 'sentences', 'quizQuestion', 'options', 'correctIndex'],
};

function geminiPassagePrompt(folderWords, sentenceCount){
  return `${geminiCoreInstructions(folderWords)}

Write a short ${sentenceCount}-sentence passage in Mandarin using the rules above. Vary its FORM, not just its content — about 4 times out of 10, write it as a two-person dialogue instead of a plain narrative: prefix each line's Chinese with "A: " or "B: " and each line's English with "Person A: " or "Person B: " (keeping the SAME subject/topic across a question and its answer, so the answer actually addresses what was asked), alternating speakers line by line. Otherwise (the remaining 6 times out of 10) write it as a short narrative about one consistent subject with no prefixes at all. Whichever form you pick, make each sentence connect to the one before it (reusing or building on the same topic) rather than reading as unrelated one-liners — for a very short (2-sentence) dialogue this just means one line asks something and the other line actually answers it; for a longer one, let the back-and-forth develop the same topic further with each exchange.

Then write one comprehension question ("What is the most appropriate meaning of this passage?") with exactly 4 English answer options. The CORRECT option must be a direct, literal, sentence-by-sentence translation of the passage exactly as written — translate what each sentence actually says, in order, rather than a smoothed-over paraphrase or summary. Never add a feeling, reaction, or detail the Chinese doesn't actually state (饭馆里的菜非常好吃 is "The food in the restaurant is very delicious" — a plain statement about the food — not "we enjoyed the delicious food", since no one is described as enjoying anything there), and never drop a word like 还/再 that changes the literal meaning (明天我和朋友还要再去吃炒饭 must keep "again" — "Tomorrow my friend and I are going again to eat fried rice" — not silently become a first-time plan). The 3 wrong-but-plausible distractors should be written in that SAME direct, literal-translation style and length, translating a passage that changes a concrete detail or two (a different food, time word, or action) — not simply a vaguer or more loosely-paraphrased version of events than the correct option, which would let a reader spot the correct answer just because it alone reads like an exact translation. Give the 0-based index of the correct option as correctIndex.${geminiPriorityInstruction(folderWords, 'reading')}`;
}

async function generatePassageAI(folderWords, sentenceCount){
  const count = sentenceCount || 3;
  const words = folderWords || [];
  if(!words.length) return { insufficientContent: true };
  let lastError = null;
  for(let attempt = 0; attempt < 2; attempt++){
    let result;
    try {
      let prompt = geminiPassagePrompt(words, count);
      if(attempt > 0) prompt += '\n\nYour previous attempt used at least one word that was NOT in the learner\'s vocabulary list above. Try again — every content word must come from that list.';
      result = await geminiGenerate(prompt, GEMINI_PASSAGE_SCHEMA);
    } catch(err){
      lastError = err;
      continue;
    }
    if(result.insufficientContent) return { insufficientContent: true };
    if(!Array.isArray(result.sentences) || !result.sentences.length) continue;
    if(!Array.isArray(result.options) || result.options.length !== 4) continue;
    if(!geminiValidateVocabulary(geminiExtractHzText(result), words)) continue;
    return {
      sentences: result.sentences,
      quiz: {
        question: result.quizQuestion || 'What is the most appropriate meaning of this passage?',
        options: result.options,
        correctIndex: (typeof result.correctIndex === 'number' && result.correctIndex >= 0 && result.correctIndex < 4) ? result.correctIndex : 0,
      },
    };
  }
  return lastError ? { insufficientContent: true, error: lastError.message } : { insufficientContent: true };
}

// ---------- Converse: generateExchangeAI ----------

const GEMINI_EXCHANGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    insufficientContent: { type: 'BOOLEAN' },
    prompt: {
      type: 'OBJECT',
      properties: { hz: { type: 'STRING' }, py: { type: 'STRING' }, en: { type: 'STRING' } },
      required: ['hz', 'py', 'en'],
    },
    options: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { hz: { type: 'STRING' }, py: { type: 'STRING' }, en: { type: 'STRING' } },
        required: ['hz', 'py', 'en'],
      },
    },
    correctIndex: { type: 'INTEGER' },
  },
  required: ['insufficientContent', 'prompt', 'options', 'correctIndex'],
};

function geminiExchangePrompt(folderWords){
  return `${geminiCoreInstructions(folderWords)}

Write ONE short Mandarin question (the "prompt") about a single person/topic drawn from the vocabulary above. Then write exactly 4 possible short Mandarin replies as multiple-choice options — one the single CORRECT, natural answer to that exact question (same subject/topic as what was asked, not a different person or topic), and 3 plausible-sounding but wrong distractors (built from the same kind of vocabulary, similar length/shape, but that do NOT actually answer what was asked — e.g. about a different topic, or the wrong polarity) so a learner has to actually understand the question rather than recognize one shared word. Give the 0-based index of the correct option as correctIndex.${geminiPriorityInstruction(folderWords, 'hearing')}`;
}

async function generateExchangeAI(folderWords){
  const words = folderWords || [];
  if(!words.length) return { insufficientContent: true };
  let lastError = null;
  for(let attempt = 0; attempt < 2; attempt++){
    let result;
    try {
      let prompt = geminiExchangePrompt(words);
      if(attempt > 0) prompt += '\n\nYour previous attempt used at least one word that was NOT in the learner\'s vocabulary list above. Try again — every content word must come from that list.';
      result = await geminiGenerate(prompt, GEMINI_EXCHANGE_SCHEMA);
    } catch(err){
      lastError = err;
      continue;
    }
    if(result.insufficientContent) return { insufficientContent: true };
    if(!result.prompt || !result.prompt.hz) continue;
    if(!Array.isArray(result.options) || result.options.length !== 4) continue;
    if(!geminiValidateVocabulary(geminiExtractHzText(result), words)) continue;
    return {
      prompt: result.prompt,
      options: result.options,
      correctIndex: (typeof result.correctIndex === 'number' && result.correctIndex >= 0 && result.correctIndex < 4) ? result.correctIndex : 0,
    };
  }
  return lastError ? { insufficientContent: true, error: lastError.message } : { insufficientContent: true };
}
