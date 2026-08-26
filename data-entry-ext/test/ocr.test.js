// Tests for the pure helpers behind the local OCR path (js/ocr, js/v3/ocr-words.js).
//
// Run with:  node --test test/
//
// Only the parts that need no canvas and no wasm are covered here - the rest of
// the pipeline (zoom, binarize, recognition) is exercised in the browser from
// ocr-test.html, which has a `?selftest=1` mode for exactly that.

const test = require('node:test');
const assert = require('node:assert');

const { groupWordsIntoColumns } = require('../js/v3/ocr-words.js');
const { resolveOcrScale, otsuThreshold, OCR_PREPROCESS_DEFAULTS } = require('../js/ocr/image-preprocess.js');
const { mapWordsToSourceCoords, meanWordConfidence } = require('../js/ocr/tesseract-ocr.js');

// Builds RGBA pixel data from grey values, the shape the preprocess helpers take.
function greyPixels(values) {
    const data = new Uint8ClampedArray(values.length * 4);
    values.forEach((v, i) => {
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
    });
    return data;
}

test('words are read column by column, top down', () => {
    const words = [
        { text: '250', x: 300, y: 10 },
        { text: '905', x: 20, y: 10 },
        { text: '400', x: 305, y: 60 },
        { text: '3271', x: 25, y: 60 }
    ];
    assert.deepStrictEqual(groupWordsIntoColumns(words), ['905', '3271', '250', '400']);
});

test('a column tolerates small x drift but splits on a real gap', () => {
    const words = [
        { text: 'a', x: 0, y: 0 },
        { text: 'b', x: 90, y: 10 },   // still the same column (< 100px)
        { text: 'c', x: 400, y: 5 }
    ];
    assert.deepStrictEqual(groupWordsIntoColumns(words), ['a', 'b', 'c']);
    assert.deepStrictEqual(groupWordsIntoColumns(words, 10), ['a', 'b', 'c']);
});

test('zoom is raised for small images and capped for large ones', async t => {
    await t.test('requested scale is used when it is already big enough', () => {
        assert.strictEqual(resolveOcrScale(1000, 900, { scale: 2, minHeight: 800, maxPixels: 12e6 }), 2);
    });

    await t.test('a tiny ticket is zoomed until it reaches the minimum height', () => {
        assert.strictEqual(resolveOcrScale(300, 200, { scale: 2, minHeight: 800, maxPixels: 12e6 }), 4);
    });

    await t.test('a huge image is capped so the canvas stays sane', () => {
        const scale = resolveOcrScale(4000, 3000, { scale: 4, minHeight: 0, maxPixels: 12e6 });
        assert.ok(4000 * scale * 3000 * scale <= 12e6 + 1);
        assert.ok(scale < 4);
    });

    await t.test('defaults never zoom out', () => {
        assert.ok(resolveOcrScale(6000, 5000, OCR_PREPROCESS_DEFAULTS) >= 1);
    });
});

test('otsu picks a threshold between the two peaks', () => {
    const dark = new Array(50).fill(30);
    const light = new Array(50).fill(220);
    const threshold = otsuThreshold(greyPixels(dark.concat(light)));
    assert.ok(threshold > 30 && threshold < 220, `threshold was ${threshold}`);
});

test('word boxes are mapped back onto the original image', () => {
    const words = [{ text: '905', confidence: 96, x0: 74, y0: 44, x1: 134, y1: 74, lineText: '905 250' }];
    const [mapped] = mapWordsToSourceCoords(words, 2, 24);

    assert.strictEqual(mapped.x, 25);   // (74 - 24) / 2
    assert.strictEqual(mapped.y, 10);   // (44 - 24) / 2
    assert.strictEqual(mapped.width, 30);
    assert.strictEqual(mapped.height, 15);
    assert.deepStrictEqual(mapped.box, { x0: 74, y0: 44, x1: 134, y1: 74 });
});

test('mean confidence ignores nothing and survives an empty read', () => {
    assert.strictEqual(meanWordConfidence([{ confidence: 90 }, { confidence: 70 }]), 80);
    assert.strictEqual(meanWordConfidence([]), 0);
});
