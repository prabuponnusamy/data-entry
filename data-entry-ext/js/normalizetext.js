
function plainTextNormalize(str) {

    function convertChar(ch) {
        const code = ch.codePointAt(0);

        // ---------- FULLWIDTH ASCII ----------
        if (code >= 0xFF01 && code <= 0xFF5E)
            return String.fromCharCode(code - 0xFEE0);

        // ---------- CIRCLED NUMBERS ----------
        if (code >= 0x2460 && code <= 0x2468)
            return String(code - 0x245F);
        if (code === 0x2469) return "10";

        // ---------- SUPERSCRIPT DIGITS ----------
        const superMap = {
            0x2070: "0", 0x00B9: "1", 0x00B2: "2", 0x00B3: "3",
            0x2074: "4", 0x2075: "5", 0x2076: "6",
            0x2077: "7", 0x2078: "8", 0x2079: "9"
        };
        if (superMap[code]) return superMap[code];

        // ---------- SUBSCRIPT DIGITS ----------
        if (code >= 0x2080 && code <= 0x2089)
            return String(code - 0x2080);

        // ---------- FANCY DIGIT RANGES ----------
        const digitRanges = [
            [0x1D7CE, 0x1D7D7], // bold
            [0x1D7D8, 0x1D7E1], // double struck
            [0x1D7E2, 0x1D7EB], // sans
            [0x1D7EC, 0x1D7F5], // sans bold
            [0x1D7F6, 0x1D7FF], // monospace
        ];
        for (const [s, e] of digitRanges)
            if (code >= s && code <= e)
                return String(code - s);

        // ---------- LETTER RANGES ----------
        const letterRanges = [
            // Bold
            [0x1D400, 0x1D419, 65], [0x1D41A, 0x1D433, 97],
            // Italic
            [0x1D434, 0x1D44D, 65], [0x1D44E, 0x1D467, 97],
            // Bold Italic
            [0x1D468, 0x1D481, 65], [0x1D482, 0x1D49B, 97],
            // Sans-serif
            [0x1D5A0, 0x1D5B9, 65], [0x1D5BA, 0x1D5D3, 97],
            // Sans-serif Bold
            [0x1D5D4, 0x1D5ED, 65], [0x1D5EE, 0x1D607, 97],
            // Monospace
            [0x1D670, 0x1D689, 65], [0x1D68A, 0x1D6A3, 97],
        ];
        for (const [s, e, b] of letterRanges)
            if (code >= s && code <= e)
                return String.fromCharCode(b + (code - s));

        // ---------- DOUBLE-STRUCK LETTERS ----------
        const specialDouble = {
            'ℂ': 'C', 'ℍ': 'H', 'ℕ': 'N', 'ℙ': 'P', 'ℚ': 'Q', 'ℝ': 'R', 'ℤ': 'Z'
        };
        if (specialDouble[ch]) return specialDouble[ch];

        if (code >= 0x1D538 && code <= 0x1D551)
            return String.fromCharCode(65 + (code - 0x1D538));

        if (code >= 0x1D552 && code <= 0x1D56B)
            return String.fromCharCode(97 + (code - 0x1D552));

        // ---------- CLEAN INVISIBLE MARKS ----------
        if (code === 0x200E || code === 0x200F)
            return "";

        return ch;
    }

    let out = [...str].map(convertChar).join('');

    // ---------- WHITESPACE CLEAN ----------
    out = out.replace(/\s+/g, ' ').trim();

    return out;
}

function fixWords(text) {
    return text.replace(/\b\w+\b/g, w =>
        dict[w.toLowerCase()] || w
    );
}

const dictionary = new Set(["all", "board", "hello", "world"]); // sample

function splitJoinedWord(word) {
    const results = [];

    for (let i = 1; i < word.length; i++) {
        const left = word.slice(0, i);
        const right = word.slice(i);

        if (dictionary.has(left) && dictionary.has(right)) {
            results.push([left, right]);
        }
    }

    return results;
}

function splitTextAndNumbers(line) {

    cleanedLine = '';
    lastCharType = '';
    for (i = 0; i < line.length; i++) {
        char = line.charAt(i);
        const isAlphabet = char.match(/[A-Z]/i);
        const isDigit = char.match(/[0-9]/);
        const isSpecialChar = char.match(/[^A-Za-z0-9]/);
        if (isAlphabet) {
            if (lastCharType && lastCharType !== 'alpha') {
                cleanedLine += ' ';
            }
            lastCharType = 'alpha';
        } else if (isDigit) {
            if (lastCharType && lastCharType !== 'digit') {
                cleanedLine += ' ';
            }
            lastCharType = 'digit';
        } else if (isSpecialChar) {
            if (lastCharType && lastCharType !== 'special') {
                cleanedLine += ' ';
            }
            lastCharType = 'special';
        }
        cleanedLine += char;
    }
    return cleanedLine.replace(/\s+/g, ' ').trim();
}

function replaceUnwantedChars(line) {

    // If line contains only date like 
    // Replace double .. with single .
    // replace double ,, or spaces with single space
    line = line.replace(/\bD\b/ig, '').trim();
    line = line.replace(/₹/ig, 'RS');
    line = line.replace(/\$/ig, 'RS');
    line = line.replace(/ரூ./ig, 'RS');
    line = line.replace(/\d{2}-\d{2}-\d{4}/, '').trim();
    line = line.replace('KL', '').trim();
    line = line.replace(/\d+[^a-zA-Z0-9]*DIGIT/g, '').trim();
    line = line.replace(/\.{2,}/g, '.').trim();
    line = line.replace(/,{2,}/g, ',').trim();
    line = line.replace(/\s{2,}/g, ' ').trim();
    line = line.replace(/\bX\b/g, '-').trim();
    line = line.replace('HALF', 'OFF');
    line = line.replace('HAFF', 'OFF');
    line = line.replace(/\bSER\b/g, 'SET');
    line = line.replace(/\bSR\b/g, 'SET');
    line = line.replace(/\bSR\b/g, 'SET');
    line = line.replace(/\bEA\b/g, 'EACH');

    line = line.replace(/\bECH\b/gi, 'EACH');
    // line = line.replace(/(\d{1,2}\s*(?:[.:]\d{2})?(?:[.:])?\s*(?:AM|PM))/i, '').trim();

    line = line.replace('ONE', '1');
    line = line.replace('TWO', '2');
    line = line.replace('DABC', 'ABC');
    // Replace ALLLL or ALLL with ALL
    line = line.replace(/\bALLL+\b/g, 'ALL').trim();
    // If line start and end with * then remove *
    if (line.startsWith('*')) {
        line = line.slice(1).trim();
    }
    if (line.endsWith('*')) {
        line = line.slice(0, -1).trim();
    }
    line = line.replace('0FF', 'OFF');
    line = line.replace('FUII', 'FULL');
    // If line starts and ends with . then remove .
    if (line.endsWith('.')) {
        line = line.slice(0, -1).trim();
    }
    // replace line ₹28 with RS28
    line = line.replace(/₹/g, 'RS');
    line = line.replaceAll('CHANCE', 'SET');

    line = line.replace("ABBCAC", " ALL "); // replace multiple spaces with single space
    line = line.replaceAll('ECH', ' EACH '); // replace multiple spaces with single space
    line = line.replace('ALL', ' ALL '); // add space before ALL to avoid partial match
    line = line.replace('R.S', 'RS');
    line = line.replace(/^\((\d+(?:\.\d+)?)\)$/g, "RS $1");
    line = line.replace(/\bTK\b/g, 'RS');
    return cleanupLine(line);
}
