// Regression tests for the WhatsApp-message parser (js/v3).
//
// Run with:  node --test test/
//
// Every case here is a real message shape that was reported broken at some
// point - keep adding one whenever a parse bug turns up, so a fix for one
// shape cannot silently break another.

const test = require('node:test');
const assert = require('node:assert');
const { parse, parseLines, loadContext } = require('./harness.js');

// Asserts the CSV lines produced for `input`, ignoring blank lines.
function assertOutput(input, expected) {
    assert.deepStrictEqual(parseLines(input), expected);
}

// Calls mergeAbAcBcLines directly. The result crosses the VM boundary, where
// arrays carry the sandbox's Array prototype, so copy it into this realm to
// keep deepStrictEqual happy.
function mergeLines(lines) {
    return Array.from(loadContext().mergeAbAcBcLines(lines));
}

test('target lines head the numbers below them', async t => {
    await t.test('a lone target applies to the numbers that follow', () => {
        assertOutput('Bc\n09\n89', [
            '2DTkt,09,1,,BC',
            '2DTkt,89,1,,BC'
        ]);
    });

    await t.test('a target after other numbers applies downward, not upward', () => {
        assertOutput('12\n34\nBc\n09\n89', [
            '2DTkt,12,1,,',
            '2DTkt,34,1,,',
            '2DTkt,09,1,,BC',
            '2DTkt,89,1,,BC'
        ]);
    });

    await t.test('each target block keeps its own numbers', () => {
        assertOutput('AB\n12\n34\nBc\n09\n89', [
            '2DTkt,12,1,,AB',
            '2DTkt,34,1,,AB',
            '2DTkt,09,1,,BC',
            '2DTkt,89,1,,BC'
        ]);
    });

    await t.test('a target survives 1D quantity lines above it', () => {
        assertOutput('B 0-10set\n B 8-5set\nBc \n09\n89', [
            '1DTkt,0,10,,B',
            '1DTkt,8,5,,B',
            '2DTkt,09,1,,BC',
            '2DTkt,89,1,,BC'
        ]);
    });
});

test('amount lines trail the numbers above them', async t => {
    await t.test('an amount goes up when nothing above claimed one', () => {
        assertOutput('659\nrs30\n123', [
            '3DTkt,659,1,30,',
            '3DTkt,123,1,,'
        ]);
    });

    await t.test('an amount stays down when the numbers above already have one', () => {
        assertOutput('rs 60\n659\nrs30\n123', [
            '3DTkt,659,1,60,',
            '3DTkt,123,1,30,'
        ]);
    });

    await t.test('an amount does not overwrite the previous block across a target', () => {
        assertOutput('rs 60\n659\nrs30\nAB\n65', [
            '3DTkt,659,1,60,',
            '2DTkt,65,1,,AB'
        ]);
    });

    await t.test('only the first of two amounts goes up', () => {
        assertOutput('659\nrs30\nrs40\n123', [
            '3DTkt,659,1,30,',
            '3DTkt,123,1,40,'
        ]);
    });
});

test('an amount on the same line as its numbers', async t => {
    await t.test('the amount leads the numbers', () => {
        const expected = ['3DTkt,760,1,60,', '3DTkt,765,1,60,'];
        assertOutput('60rs-760,765,', expected);
        assertOutput('60rs-760,765', expected);
        assertOutput('60 rs-760,765', expected);
        assertOutput('rs60-760,765', expected);
    });

    await t.test('the amount trails the numbers', () => {
        const expected = ['3DTkt,760,1,60,', '3DTkt,765,1,60,'];
        assertOutput('760,765 rs60', expected);
        assertOutput('760,765 60rs', expected);
    });

    await t.test('the tighter binding to RS wins when it sits between numbers', () => {
        assertOutput('760 rs60', ['3DTkt,760,1,60,']);
        assertOutput('60rs 760', ['3DTkt,760,1,60,']);
    });

    await t.test('evenly spaced RS falls back to whichever end of the line it is on', () => {
        const expected = ['3DTkt,760,1,100,', '3DTkt,765,1,100,'];
        assertOutput('100 rupees 760,765', expected);
        assertOutput('760,765 rupees 100', expected);
    });
});

test('a message typed on one line groups like a multi-line one', async t => {
    const oneLine = 'Rs 30 941 A 9-10 All 14,41 AB 41 AC 41';
    const multiLine = 'Rs 30\n941\nA 9-10\nAll 14,41\nAB 41\nAC 41';

    await t.test('each target starts a new block', () => {
        assertOutput(oneLine, parseLines(multiLine));
    });

    await t.test('tokens naming one target are not split apart', () => {
        assertOutput('AB AC 41', ['2DTkt,41,1,,AB-AC']);
        assertOutput('12 AB AC 41', ['2DTkt,12,1,,', '2DTkt,41,1,,AB-AC']);
    });
});

test('quantity words', async t => {
    await t.test('"times" counts as a set', () => {
        assertOutput('Rs 25 - All box - 1 times\n845', ['3DBox,845,1,25,']);
        assertOutput('Rs 25 - All box - 2times\n845,846', ['3DBox,845,2,25,', '3DBox,846,2,25,']);
    });

    await t.test('a leftover RS is not an unparsed line', () => {
        assertOutput('Rs10rs\n467,468', ['3DTkt,467,1,10,', '3DTkt,468,1,10,']);
    });
});

test('AB/AC/BC on their own lines merge into one target', async t => {
    await t.test('three back-to-back lines become ALL', () => {
        assertOutput('AB\nAC\nBC\n12\n34', [
            '2DTkt,12,1,,ALL',
            '2DTkt,34,1,,ALL'
        ]);
    });

    await t.test('two back-to-back lines become the pair', () => {
        assertOutput('AB\nAC\n12', ['2DTkt,12,1,,AB-AC']);
        assertOutput('AB\nBC\n12', ['2DTkt,12,1,,AB-BC']);
        assertOutput('AC\nBC\n12', ['2DTkt,12,1,,AC-BC']);
    });

    await t.test('lines separated by other content are left alone', () => {
        assert.deepStrictEqual(mergeLines(['AB', '100', 'AC']), ['AB', '100', 'AC']);
        assert.deepStrictEqual(mergeLines(['AB', 'AC', '100', 'BC']), ['AB-AC', '100', 'BC']);
        assert.deepStrictEqual(mergeLines(['AB', '100', 'AC', 'BC']), ['AB', '100', 'AC-BC']);
    });

    await t.test('a repeated token breaks the run', () => {
        assert.deepStrictEqual(mergeLines(['AB', 'AB', 'AC']), ['AB', 'AB-AC']);
    });

    await t.test('a single target line is untouched', () => {
        assert.deepStrictEqual(mergeLines(['AB', '100']), ['AB', '100']);
    });
});

test('number length picks the ticket type', async t => {
    await t.test('1D through 5D', () => {
        assertOutput('ALL\n7', ['1DTkt,7,1,,ALL']);
        assertOutput('ALL\n12', ['2DTkt,12,1,,ALL']);
        assertOutput('659', ['3DTkt,659,1,,']);
        assertOutput('6592', ['4DTkt,6592,1,,']);
        assertOutput('65921', ['5DTkt,65921,1,,']);
    });

    await t.test('leading zeros are kept', () => {
        assertOutput('Bc\n09\n89', ['2DTkt,09,1,,BC', '2DTkt,89,1,,BC']);
    });
});

test('flags and quantities', async t => {
    await t.test('BOX switches the ticket type', () => {
        assertOutput('659\nbox\nrs30', ['3DBox,659,1,30,']);
    });

    await t.test('a TO range expands into individual numbers', () => {
        assertOutput('30 to 50', [
            '2DTkt,30,1,,',
            '2DTkt,40,1,,',
            '2DTkt,50,1,,'
        ]);
    });
});

test('messages are separated in the output', () => {
    const input = '12/01/25, 10:00 AM - X: 12\n34\n12/01/25, 10:05 AM - Y: 56';
    assert.strictEqual(parse(input), [
        '2DTkt,12,1,,',
        '2DTkt,34,1,,',
        '=-#-#-=',
        '2DTkt,56,1,,'
    ].join('\n'));
});

test('each parse starts from clean state', () => {
    // lastTarget and friends are module-level globals; a target set by one
    // message must not leak into the next parse.
    parse('ALL\n12');
    assertOutput('34', ['2DTkt,34,1,,']);
});

test('common amount', async t => {
    // The shape this exists for: one "Rs. 30" at the top, then a BOX/TKT flip
    // that starts new groups the amount never reaches.
    const message = 'Rs. 30\n529\n529=box\n349=box\n943=6\n297=3\n099=box\n076=4';

    // Parses `input` with the Common amount field set to `value` / `mode`.
    function parseWithCommonAmount(input, value, mode) {
        const context = loadContext(input);
        context.elements.commonAmount = { value: value };
        context.elements.commonAmountMode = { value: mode };
        context.parseMessages();
        return context.elements.outputData.value.split('\n').filter(line => line.trim() !== '');
    }

    await t.test('unset, nothing changes', () => {
        assertOutput(message, [
            '3DTkt,529,1,30,',
            '3DBox,529,1,,',
            '3DBox,349,1,,',
            '3DTkt,943,6,,',
            '3DTkt,297,3,,',
            '3DBox,099,1,,',
            '3DTkt,076,4,,'
        ]);
    });

    await t.test('fills the entries that ended up without an amount', () => {
        assert.deepStrictEqual(parseWithCommonAmount(message, '30', 'missing'), [
            '3DTkt,529,1,30,',
            '3DBox,529,1,30,',
            '3DBox,349,1,30,',
            '3DTkt,943,6,30,',
            '3DTkt,297,3,30,',
            '3DBox,099,1,30,',
            '3DTkt,076,4,30,'
        ]);
    });

    await t.test('missing mode leaves an amount the message stated', () => {
        assert.deepStrictEqual(parseWithCommonAmount('Rs. 60\n529\n349=box', '30', 'missing'), [
            '3DTkt,529,1,60,',
            '3DBox,349,1,30,'
        ]);
    });

    await t.test('all mode overrides an amount the message stated', () => {
        assert.deepStrictEqual(parseWithCommonAmount('Rs. 60\n529\n349=box', '30', 'all'), [
            '3DTkt,529,1,30,',
            '3DBox,349,1,30,'
        ]);
    });

    await t.test('1D/2D rows keep their target and stay amount-free', () => {
        assert.deepStrictEqual(parseWithCommonAmount('Bc\n09\n89', '30', 'all'), [
            '2DTkt,09,1,,BC',
            '2DTkt,89,1,,BC'
        ]);
    });

    await t.test('OFF still marks the amount', () => {
        assert.deepStrictEqual(parseWithCommonAmount('529 off', '30', 'missing'), [
            '3DTkt,529,1,30 OFF,'
        ]);
    });

    await t.test('a non-numeric value is ignored', () => {
        assert.deepStrictEqual(parseWithCommonAmount('529\n349=box', 'abc', 'all'), [
            '3DTkt,529,1,,',
            '3DBox,349,1,,'
        ]);
    });
});
