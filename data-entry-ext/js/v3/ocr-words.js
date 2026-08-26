
// Turns OCR word boxes into column-ordered values (for OCR'd ticket
// screenshots, where numbers run down columns rather than across lines).
// Shared by the Google Vision path (imageparser.js) and the local Tesseract
// path (js/ocr/tesseract-ocr.js), which both hand over {text, x, y} words.

const OCR_COLUMN_THRESHOLD = 100; // px gap that still counts as the same column

/**
 * Buckets words into columns by x position, then reads each column top-down.
 * Returns the word values in that order.
 */
function groupWordsIntoColumns(words, threshold) {
    const gap = threshold || OCR_COLUMN_THRESHOLD;
    const sorted = [...words].sort((a, b) => a.x - b.x);

    const columns = [];
    sorted.forEach(w => {
        let col = columns.find(c => Math.abs(c.x - w.x) < gap);

        if (!col) {
            col = { x: w.x, items: [] };
            columns.push(col);
        }
        col.items.push(w);
    });

    const values = [];
    columns.forEach(col => {
        col.items.sort((a, b) => a.y - b.y);
        col.items.forEach(i => values.push(i.text));
    });
    return values;
}

// Used by imageparser.js to turn a Google Vision fullTextAnnotation page into
// column-ordered word values.
function extractWords(page) {
    const words = [];
    page.blocks.forEach(block => {
        block.paragraphs.forEach(p => {
            p.words.forEach(w => {
                const text = w.symbols.map(s => s.text).join('');
                const x = w.boundingBox.vertices[0].x || 0;
                const y = w.boundingBox.vertices[0].y || 0;
                words.push({ text, x, y });
            });
        });
    });
    return groupWordsIntoColumns(words);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupWordsIntoColumns, extractWords, OCR_COLUMN_THRESHOLD };
}
