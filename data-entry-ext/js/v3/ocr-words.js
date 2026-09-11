
// Used by imageparser.js to turn a Google Vision fullTextAnnotation page into
// column-ordered word values (for OCR'd ticket screenshots).
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
    words.sort((a, b) => a.x - b.x);

    const columns = [];
    const threshold = 100; // tweak

    words.forEach(w => {
        let col = columns.find(c =>
            Math.abs(c.x - w.x) < threshold);

        if (!col) {
            col = { x: w.x, items: [] };
            columns.push(col);
        }
        col.items.push(w);
    });
    var values = [];
    columns.forEach(col => {
        col.items.sort((a, b) => a.y - b.y);
        //console.log("COLUMN");
        col.items.forEach(i => values.push(i.text));
    });
    return values;
}

const smallCaps = {
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e',
  'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j',
  'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o',
  'ᴘ': 'p', 'ʀ': 'r', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v',
  'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z'
};

function toNormalText(str) {
  return [...str].map(c => smallCaps[c] || c).join('');
}
