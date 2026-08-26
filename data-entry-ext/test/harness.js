// Runs the browser-side parser under Node so it can be tested without Chrome.
//
// Each parse gets a fresh VM context, so module-level globals the scripts rely
// on (lastTarget, imageMap, ...) can never leak from one test into the next.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const EXT_DIR = path.join(__dirname, '..');

// The scripts parseMessages() needs, in the same order as parse-data.html.
const SOURCE_FILES = [
    'js/constants.js',
    'js/normalizetext.js',
    'js/v3/state.js',
    'js/v3/message-groups.js',
    'js/v3/text-substitution.js',
    'js/v3/text-cleanup.js',
    'js/v3/line-image.js',
    'js/v3/line-word-normalizer.js',
    'js/v3/line-target.js',
    'js/v3/line-flags.js',
    'js/v3/line-amount-qty.js',
    'js/v3/common-amount.js',
    'js/v3/line-numeric-data.js',
    'js/v3/line-processor.js',
    'js/v3/grouping.js',
    'js/v3/output-builder.js',
    'js/v3/legacy-output.js',
    'js/v3/parse-messages.js'
];

// js/v3 files left out of the harness: they drive the page (DOM widgets, OCR
// calls) rather than the text pipeline. Listed so the coverage check below can
// tell "deliberately excluded" apart from "someone added a file and forgot".
const EXCLUDED_V3_FILES = [
    'process-input.js',
    'winning-numbers.js',
    'ocr-words.js'
];

// Fails loudly when a new js/v3 file appears that is neither loaded nor excluded.
function assertAllV3FilesAccountedFor() {
    const loaded = SOURCE_FILES
        .filter(file => file.startsWith('js/v3/'))
        .map(file => path.basename(file));
    const known = loaded.concat(EXCLUDED_V3_FILES);
    const unaccounted = fs.readdirSync(path.join(EXT_DIR, 'js', 'v3'))
        .filter(file => file.endsWith('.js') && !known.includes(file));
    if (unaccounted.length > 0) {
        throw new Error(
            `js/v3 file(s) not handled by test/harness.js: ${unaccounted.join(', ')}. ` +
            'Add each to SOURCE_FILES (part of the parse pipeline) or EXCLUDED_V3_FILES (DOM/OCR only).'
        );
    }
}

// Loads every source file into a fresh context wired to a stub page whose
// #inputData holds `input`. Returns the context, so tests can also reach
// individual functions (mergeAbAcBcLines, extractTarget, ...) directly.
function loadContext(input = '') {
    assertAllV3FilesAccountedFor();

    const elements = {
        inputData: { value: input },
        outputData: { value: '' }
    };
    const context = vm.createContext({
        console,
        document: {
            getElementById: id => elements[id] || (elements[id] = { value: '', selectedIndex: 0 })
        }
    });

    SOURCE_FILES.forEach(file => {
        const source = fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
        new vm.Script(source, { filename: file }).runInContext(context);
    });

    context.elements = elements;
    return context;
}

// Parses `input` exactly as the page does and returns the text that would land
// in #outputData - CSV lines, with '=-#-#-=' between WhatsApp messages.
function parse(input) {
    const context = loadContext(input);
    context.parseMessages();
    return context.elements.outputData.value;
}

// Same as parse(), but split into the individual CSV lines of a single message.
function parseLines(input) {
    return parse(input).split('\n').filter(line => line.trim() !== '');
}

module.exports = { parse, parseLines, loadContext, SOURCE_FILES };
