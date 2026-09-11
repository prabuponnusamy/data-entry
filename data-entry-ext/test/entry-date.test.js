// Covers the entry date: which day is read off the WhatsApp message headers,
// and what counts as a date the site's date box will take.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const EXT_DIR = path.join(__dirname, '..');

function load() {
    const context = vm.createContext({ console });
    ['js/constants.js', 'js/entrydate.js'].forEach((file) => {
        const source = fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
        new vm.Script(source, { filename: file }).runInContext(context);
    });
    return context;
}

// Values out of the VM carry its prototypes, which deepStrictEqual rejects.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('message dates are read day first, as an Indian phone writes them', () => {
    const ctx = load();
    const text = [
        '09/09/26, 7:15 pm - +91 98765 43210: 3D',
        '123 5set',
        '10/09/26, 9:02 am - Anu: ok',
        '09/09/26, 19:20 - Anu: AB 45'
    ].join('\n');
    assert.deepStrictEqual(plain(ctx.readMessageDates(text)), ['09-09-2026', '10-09-2026', '09-09-2026']);
});

test('iOS bracket headers and four-digit years are read', () => {
    const ctx = load();
    const text = '‎[29/08/2026, 12:36:10 PM] Anu: 3D 123\n[1/9/26, 8:05 AM] Anu: AB';
    assert.deepStrictEqual(plain(ctx.readMessageDates(text)), ['29-08-2026', '01-09-2026']);
});

test('month first is used when a header can only be read that way', () => {
    const ctx = load();
    const text = '09/13/26, 7:15 PM - Anu: 3D\n09/12/26, 7:16 PM - Anu: AB';
    assert.deepStrictEqual(plain(ctx.readMessageDates(text)), ['13-09-2026', '12-09-2026']);
});

test('system lines and dates typed inside a message are not message dates', () => {
    const ctx = load();
    const text = [
        '01/01/24, 10:00 am - Messages and calls are end-to-end encrypted. Only people in this chat can read them.',
        '09/09/26, 7:15 pm - Anu: 3D',
        '12/12/26 123 5set'
    ].join('\n');
    assert.deepStrictEqual(plain(ctx.readMessageDates(text)), ['09-09-2026']);
});

test('the entry date is the day most messages were sent', () => {
    const ctx = load();
    const text = [
        '09/09/26, 7:15 pm - Anu: 3D 123',
        '09/09/26, 7:20 pm - Anu: AB 45',
        '10/09/26, 9:02 am - Anu: ok'
    ].join('\n');
    assert.deepStrictEqual(plain(ctx.pickEntryDate(text)), {
        date: '09-09-2026',
        dates: [
            { date: '09-09-2026', messages: 2 },
            { date: '10-09-2026', messages: 1 }
        ]
    });
});

test('a tie goes to the later day, across a month and year end', () => {
    const ctx = load();
    const text = '31/12/26, 11:50 pm - Anu: 3D 123\n01/01/27, 12:10 am - Anu: 3D 456';
    assert.strictEqual(ctx.pickEntryDate(text).date, '01-01-2027');
});

test('text with no message headers has no entry date', () => {
    const ctx = load();
    assert.deepStrictEqual(plain(ctx.pickEntryDate('3D\n123 5set')), { date: '', dates: [] });
});

test('an entry date must be a real date written DD-MM-YYYY', () => {
    const ctx = load();
    assert.strictEqual(ctx.isValidEntryDate('10-09-2026'), true);
    assert.strictEqual(ctx.isValidEntryDate('29-02-2028'), true);
    assert.strictEqual(ctx.isValidEntryDate('29-02-2026'), false);
    assert.strictEqual(ctx.isValidEntryDate('10/09/2026'), false);
    assert.strictEqual(ctx.isValidEntryDate('1-9-2026'), false);
});
