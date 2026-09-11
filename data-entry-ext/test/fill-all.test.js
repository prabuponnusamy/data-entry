// Covers the page side of Fill All: which blocks are queued, what the confirm
// says, and what is sent to the service worker.
//
// eventlistener.js drives the DOM, so it gets a stub page rather than the
// parse harness's one. Only the pieces these functions touch are stubbed; a
// missing one shows up as a TypeError rather than a silent pass.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const EXT_DIR = path.join(__dirname, '..');

/** One block cell as renderFinalOutput writes it: a Fill button and a textarea. */
function block(target, targetkey, text) {
    const textarea = { value: text, tagName: 'TEXTAREA' };
    const button = {
        dataset: { action: 'fill', target: target, targetkey: targetkey },
        parentElement: { querySelector: (sel) => (sel === 'textarea' ? textarea : null) }
    };
    return button;
}

/**
 * A section wrapper as renderFinalOutput writes it: one image's blocks. The
 * page-wide query returns every block; a section returns only its own.
 */
function section(blocks) {
    const el = { querySelectorAll: () => blocks };
    blocks.forEach((button) => {
        button.closest = (selector) => (selector === '.output-section' ? el : null);
    });
    return el;
}

/**
 * Loads constants.js and eventlistener.js against a stub page holding
 * `blocks`, and returns the context plus whatever reached chrome.runtime.
 */
function load(blocks, fields, reply) {
    const elements = Object.assign(
        {
            websiteBaseUrlInput: { value: 'https://abidear.com/employee' },
            supplierId: { value: 'ABC123' },
            autoSubmitCheckbox: { checked: false },
            dryRunCheckbox: { checked: false },
            fillBannerCheckbox: { checked: true },
            debugModeCheckbox: { checked: false }
        },
        fields || {}
    );

    const sent = [];
    const alerts = [];
    const confirms = [];

    const context = vm.createContext({
        console,
        alert: (msg) => alerts.push(msg),
        confirm: (msg) => {
            confirms.push(msg);
            return true;
        },
        localStorage: { getItem: () => null, setItem: () => {} },
        chrome: {
            runtime: {
                sendMessage: (msg, callback) => {
                    sent.push(msg);
                    if (callback && reply) callback(reply);
                }
            }
        },
        document: {
            getElementById: (id) => elements[id] || null,
            querySelectorAll: () => blocks,
            addEventListener: () => {}
        }
    });

    ['js/constants.js', 'js/entrydate.js', 'js/eventlistener.js'].forEach((file) => {
        const source = fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
        new vm.Script(source, { filename: file }).runInContext(context);
    });

    context.sent = sent;
    context.alerts = alerts;
    context.confirms = confirms;
    return context;
}

test('Fill All collects every block on the page', () => {
    const ctx = load([
        block('3DTkt', '3DTkt30', '315,1,\n917,1,'),
        block('2DTkt', '2DTkt', '78,2,AB')
    ]);
    const blocks = Array.from(ctx.collectFillBlocks());

    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].target, '3DTkt');
    assert.strictEqual(blocks[0].targetTkt, '3DTkt30');
    assert.strictEqual(blocks[0].url, 'https://abidear.com/employee/3dticket');
    assert.strictEqual(blocks[0].text, '315,1,\n917,1,');
    assert.strictEqual(blocks[1].url, 'https://abidear.com/employee/2dticket');
});

test('an empty block is left out of the queue', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,'), block('2DTkt', '2DTkt', '   ')]);
    assert.strictEqual(Array.from(ctx.collectFillBlocks()).length, 1);
});

test('the base URL is only slashed once', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,')], {
        websiteBaseUrlInput: { value: 'https://abidear.com/employee/' }
    });
    assert.strictEqual(
        Array.from(ctx.collectFillBlocks())[0].url,
        'https://abidear.com/employee/3dticket'
    );
});

test('Fill All sends one message carrying every block', () => {
    const ctx = load([
        block('3DTkt', '3DTkt30', '315,1,\n917,1,'),
        block('2DTkt', '2DTkt', '78,2,AB')
    ]);
    ctx.fillAllBlocks();

    assert.strictEqual(ctx.sent.length, 1);
    assert.strictEqual(ctx.sent[0].action, 'fillAll');
    assert.strictEqual(ctx.sent[0].blocks.length, 2);
    assert.strictEqual(ctx.sent[0].supplierValueLabel, 'ABC123');
    assert.strictEqual(ctx.sent[0].autoSubmit, false);
});

test('nothing is queued when there is nothing to fill', () => {
    const ctx = load([]);
    ctx.fillAllBlocks();
    assert.strictEqual(ctx.sent.length, 0);
    assert.match(ctx.alerts[0], /Nothing to fill/);
});

test('the confirm names the amount each group is priced at', () => {
    // A group entered at the wrong price is invisible in a row count, and this
    // is the last screen before the live site.
    const ctx = load(
        [
            block('3DTkt', '3DTkt30', '315,1,\n917,1,'),
            block('3DTkt', '3DTkt60', '884,1,'),
            block('2DTkt', '2DTkt', '78,2,AB')
        ],
        { debugModeCheckbox: { checked: true }, autoSubmitCheckbox: { checked: true } }
    );
    ctx.fillAllBlocks();

    const prompt = ctx.confirms[0];
    assert.match(prompt, /Fill 3 block\(s\), 4 row\(s\)\?/);
    assert.match(prompt, /3DTkt30 — 2 row\(s\)/);
    assert.match(prompt, /3DTkt60 — 1 row\(s\)/);
    assert.match(prompt, /2DTkt — 1 row\(s\)/);
    assert.match(prompt, /Supplier: ABC123/);
    assert.match(prompt, /AUTO-SUBMIT IS ON/);
});

test('the confirm says when auto-submit is a dry run', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,')], {
        debugModeCheckbox: { checked: true },
        autoSubmitCheckbox: { checked: true },
        dryRunCheckbox: { checked: true }
    });
    ctx.fillAllBlocks();
    assert.match(ctx.confirms[0], /DRY RUN — nothing will be submitted/);
});

test('a missing base URL queues nothing', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,')], {
        websiteBaseUrlInput: { value: '' }
    });
    ctx.fillAllBlocks();
    assert.strictEqual(ctx.sent.length, 0);
    assert.match(ctx.alerts[0], /website base URL/);
});

test('a group fills only the blocks under its own image', () => {
    // The output is laid out one section per image; filling a group takes that
    // separator rather than the whole page.
    const first = [block('3DTkt', '3DTkt30', '315,1,'), block('2DTkt', '2DTkt', '78,1,AB')];
    const second = [block('4DTkt', '4DTkt20', '0897,1,')];
    const firstSection = section(first);
    section(second);

    const ctx = load(first.concat(second));
    ctx.fillAllBlocks(firstSection);

    assert.strictEqual(ctx.sent.length, 1);
    assert.deepStrictEqual(
        Array.from(ctx.sent[0].blocks).map((b) => b.targetTkt),
        ['3DTkt30', '2DTkt']
    );
});

test('a started run hands back so the group can be marked filled', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,')], {}, { ok: true });
    let started = 0;
    ctx.fillAllBlocks(undefined, () => started++);
    assert.strictEqual(started, 1);
});

test('a refused run is not marked filled', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,')], {}, { ok: false, error: 'Not signed in' });
    let started = 0;
    ctx.fillAllBlocks(undefined, () => started++);
    assert.strictEqual(started, 0);
    assert.match(ctx.alerts[0], /Not signed in/);
});

test('only blocks with data are marked', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,'), block('2DTkt', '2DTkt', '  ')]);
    assert.deepStrictEqual(
        Array.from(ctx.fillButtonsWithData()).map((b) => b.dataset.targetkey),
        ['3DTkt30']
    );
});

test('Fill All still takes every section', () => {
    const first = [block('3DTkt', '3DTkt30', '315,1,')];
    const second = [block('4DTkt', '4DTkt20', '0897,1,')];
    section(first);
    section(second);

    const ctx = load(first.concat(second));
    ctx.fillAllBlocks();
    assert.strictEqual(Array.from(ctx.sent[0].blocks).length, 2);
});

test('the entry date goes with the run and is named in the confirm', () => {
    // Entered the day after, the site's own date would file under the wrong draw.
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,')], {
        entryDate: { value: ' 09-09-2026 ' },
        debugModeCheckbox: { checked: true }
    });
    ctx.fillAllBlocks();
    assert.strictEqual(ctx.sent[0].entryDate, '09-09-2026');
    assert.match(ctx.confirms[0], /Date: 09-09-2026/);
});

test('with no entry date the site keeps its own', () => {
    const ctx = load([block('3DTkt', '3DTkt30', '315,1,')]);
    ctx.fillAllBlocks();
    assert.strictEqual(ctx.sent[0].entryDate, '');
});

test('an entry date that is not a real DD-MM-YYYY date queues nothing', () => {
    ['9/9/2026', '31-02-2026'].forEach((value) => {
        const ctx = load([block('3DTkt', '3DTkt30', '315,1,')], { entryDate: { value: value } });
        ctx.fillAllBlocks();
        assert.strictEqual(ctx.sent.length, 0, value);
        assert.match(ctx.alerts[0], /DD-MM-YYYY/);
    });
});
