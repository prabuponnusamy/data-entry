# data-entry-ext — context notes

Chrome MV3 extension (no build step, no dependencies) that turns pasted WhatsApp
lottery-ticket messages into CSV rows and fills them into the betting sites'
order forms.

`npm test` runs the parser tests; `npm start` serves the folder on :8777 for the
OCR bench. Everything else is plain `<script src>` files loaded by the HTML
pages — globals, no modules, no bundler.

## The two pages

| Page | Purpose |
| --- | --- |
| `parse-data.html` | The workhorse. Paste/zip-import WhatsApp text → parse → validate → grouped output with Copy/Fill buttons. Three tabs: **Input data**, **Validate data**, **Final content**. |
| `ocr-test.html` | Standalone bench for tuning the local Tesseract settings. Not part of the parse pipeline. |
| `popup.html` | Extension popup; just a status indicator. |

## Parse pipeline (js/v3/) — the important part

`processInput()` (`process-input.js`) is the single entry point. It is called on
`#inputData` blur, on any settings change, and after a zip import. It runs:

    parseMessages()  ->  generateTable()  ->  generateFinalOutput()

### 1. `parseMessages()` — `parse-messages.js`

Reads `#inputData`, writes CSV into `#outputData`, one block per WhatsApp
message separated by `=-#-#-=`.

    getMessageGroups()          message-groups.js   split raw export into messages
      applyTextSubstitutions()  text-substitution.js #deleteText / #replaceText rules
      mergeAbAcBcLines()                            AB \n AC \n BC  -> ALL
    normalizeMessageGroups()                        plainTextNormalize + splitTargetSegments
    processGroupLine() per line line-processor.js   -> a "cleanedMsg" record
    groupCleanedUpDataFirstLevel()  grouping.js     split lines into data groups
    groupCleanedUpDataSecondLevel() grouping.js     decide who owns the stray lines
    buildOutputLines()          output-builder.js   emit the CSV rows

### 2. `processGroupLine()` — one line in, one `cleanedMsg` out

Order matters; each step can fully consume the line and stop:

1. `extractImageLine`  — `<attached: x.jpg>` → `cleanedMsg.image`, return.
2. `normalizeLineWords` (`line-word-normalizer.js`) — strips noise words from
   `replacements` (constants.js), splits `1times` → `1 TIMES`, two fuzzy
   spell-correction passes against `english_words`.
3. `extractTarget`  (`line-target.js`)  → `target` (`AB`, `AC-BC`, `ALL`, …)
4. `extractFlags`   (`line-flags.js`)   → `cut`, `isBox`, `isOff`, `isFull`
5. `tildeNormalize` (`text-cleanup.js`) — every run of punctuation becomes `~`,
   so `529=box` and `529 - box` look identical from here on.
6. `extractAmount`  (`line-amount-qty.js`) → `amount` (needs the RAW line to
   tell `760 RS60` from `60RS 760`)
7. `extractQty`     (`line-amount-qty.js`) → `qty` from SET/EACH/T words
8. `expandNumberRange` (`30 TO 50`) → `data[]`, or `isNoiseWordLine`, or
   `parseNumberTokens` (`123~4` → number+qty) → `data[]`
9. anything left ⇒ `nparsed: true` ⇒ renders as `FAILED TO PARSE`.

A `cleanedMsg` therefore either carries `data[]` (numbers) or carries loose
attributes (a lone `RS 30`, `2 SET`, `BC`) that belong to nearby numbers.

### 3. Grouping — `grouping.js` (the subtle part)

**First level** splits the message's lines into groups. A new group starts when
the digit-length changes (2D → 3D) **or**, for 3D+, when `isBox` flips. Lines
without `data` become `beforeData` (above the numbers) or `afterData` (below).

**Second level** decides who owns a stray line between two groups:
- a *target* line heads the numbers **below** it (`BC / 09 / 89`);
- everything else (`RS 30`, `2 SET`) trails the numbers **above** it, but only
  if that group is still missing what the line carries.

⚠️ **This is why an amount does not spread across the whole message.** A single
`Rs. 30` at the top is claimed by the first group only; the `isBox` flip starts
new groups that have no amount line of their own.

### 4. `buildOutputLines()` — `output-builder.js`

Per group, collapses `beforeData`/`afterData` into `qty / isBox / isCut / isOff
/ amt / targetValue`, then emits one row per number:

    type,number,qty,amount,target

- `type` = `1DTkt 1DCut 2DTkt 2DCut 3DTkt 3DBox 3DCut 4D… 5D…` (constants.js)
- **1D/2D rows carry a target and an empty amount; 3D/4D/5D rows carry an
  amount and an empty target.** Per-entry values (`d.amount`) win over the
  group value (`amt`), which is why `529` gets `30` but the rest do not.
- Common amount override: `applyCommonAmount()` (`common-amount.js`) — see below.

`legacy-output.js` is dead code kept from the pre-split monolith.

### 5. `generateTable()` — `validatesection.js`

Renders the Validate tab: original message textarea (`.original-msg`) next to
the parsed CSV textarea (`.formatted-msg`), plus heuristic warnings
(`isAmountMissingLine`, `isQtyGuessedLine`).

### 6. `generateFinalOutput()` — `generateoutput.js`

Reads the (possibly hand-edited) `.formatted-msg` textareas, validates digit
lengths, and buckets rows by **`key = type + amount`** → `3DTkt30`, `3DBox`,
`2DTkt`. Each bucket becomes a textarea (chunked by the per-dimension record
limits) with Copy/Fill buttons. Note the rendered value is only
`number,qty,target` — **the amount lives in the bucket key, not in the text.**

`#amountMapping` (`3DBox=3DBox30`) rewrites those keys after the fact.
`#available-amount-keys` lists the keys currently in play.

### 7. Fill — `eventlistener.js` → `background.js` → `js/ext/content-script.js`

`openNewTabWithData()` maps the type to a URL suffix (`3dbox`, `1dticket`, …)
under `#websiteBaseUrlInput`, and posts `{payload, url, target, targetTkt,
supplierValueLabel}` to the background worker, which opens the tab and lets the
content script fill the `abc[]` / `abc_qty[]` style fields.

## Other pieces

- `js/normalizetext.js` — `plainTextNormalize`, `replaceUnwantedChars`
  (currency symbols → `RS`), `splitTextAndNumbers`, `fixWords` (the `dict` in
  constants.js).
- `js/processzipfile.js` + `js/imageparser.js` — WhatsApp `.zip` import,
  `imageMap` of attachments, Google Vision OCR path.
- `js/ocr/` — local Tesseract path: `image-preprocess.js` (zoom, Sauvola
  binarize, sharpen) and `tesseract-ocr.js`. Both OCR paths funnel through
  `js/v3/ocr-words.js` (`groupWordsIntoColumns`) because ticket photos read
  down columns, not across rows.
- `js/v3/state.js` — `imageMap`, `visionRequests` globals.
- `js/v3/winning-numbers.js` + `js/common.js` — winning-number highlighting.
- State that survives reloads lives in `localStorage`: `inputData`, `imageMap`,
  `visionRequests`, `winningNumberValue`, `deleteText`, `replaceText`,
  `ocrEngine`, `commonAmount`, `commonAmountMode`.

## Tests — `test/`

`test/harness.js` runs the real `js/v3` pipeline in a fresh Node VM context per
call, against a stub `document` whose `getElementById` auto-creates
`{value: '', selectedIndex: 0}` for any id. So DOM-reading helpers work in tests
and default to "off"; set `context.elements.<id>.value` to exercise them.

A fresh context per parse is deliberate — the scripts keep globals
(`lastTarget`, `imageMap`) that would otherwise leak between tests.

**Any new `js/v3/*.js` file must be added to `SOURCE_FILES` or
`EXCLUDED_V3_FILES` in `harness.js`, or every test fails.**

## Gotchas

- Order of `<script>` tags in `parse-data.html` **is** the dependency graph.
- Everything is a global; `var`/implicit globals are used freely.
- Lines are upper-cased early (`groupLineUc`), so all matching is uppercase.
- Numbers keep leading zeros (`099`) — they are strings throughout.
