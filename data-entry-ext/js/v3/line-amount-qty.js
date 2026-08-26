
// Decides which side of RS the amount sits on, e.g. "760 RS60" (after) vs
// "60RS 760" (before). Both look identical by the time the line reaches
// extractAmount - normalizeLineWords has spaced RS out from its digits - so the
// raw line is used, where the tighter binding still shows: no separator beats a
// space, a space beats punctuation. Returns true when the amount comes first.
// Falls back to false (the RS-then-amount reading) when nothing distinguishes
// the two sides.
function amountComesBeforeRs(rawLine) {
    if (!rawLine) return false;
    // Currency symbols and words only become RS here; this is the same line
    // normalizeLineWords works on, one step before it spaces RS out.
    rawLine = replaceUnwantedChars(rawLine);

    const separatorRank = (separator) => {
        if (separator === '') return 0;
        return /^\s+$/.test(separator) ? 1 : 2;
    };

    const rsPattern = /(?<![A-Za-z])RS(?![A-Za-z])/gi;
    let rsMatch;
    while ((rsMatch = rsPattern.exec(rawLine)) !== null) {
        const before = rawLine.slice(0, rsMatch.index).match(/(\d+)([^A-Za-z0-9]*)$/);
        const after = rawLine.slice(rsMatch.index + 2).match(/^([^A-Za-z0-9]*)(\d+)/);
        if (before && after) {
            const beforeRank = separatorRank(before[2]);
            const afterRank = separatorRank(after[1]);
            if (beforeRank !== afterRank) {
                return beforeRank < afterRank;
            }
            // Equally bound on both sides ("100 RUPEES 760 765"): the amount is
            // the pair sitting at an edge of the line, the numbers being the
            // body. Ambiguous either way when both sides are at an edge.
            const startsLine = rsMatch.index - before[0].length === 0;
            const endsLine = rsMatch.index + 2 + after[0].length === rawLine.length;
            if (startsLine !== endsLine) {
                return startsLine;
            }
            return false;
        }
        if (before || after) {
            return !!before;
        }
    }
    return false;
}

// Extracts an "RS <amount>" / "<amount> RS" value from a line.
// Returns { line, consumed } where consumed=true means the original code
// would have stopped processing this raw line entirely at this point.
// `rawLine` is the line as it arrived, before word normalization - only used to
// tell the two readings apart when RS has numbers on both sides.
function extractAmount(line, cleanedMsg, rawLine) {
    const rsFirst = /\bRS[^A-Za-z0-9]*(\d+)\b/i;   // RS60 760 765
    const rsLast = /\b(\d+)[^A-Za-z0-9]*RS\b/i;    // 60RS 760 765
    const amountPatterns = amountComesBeforeRs(rawLine) ? [rsLast, rsFirst] : [rsFirst, rsLast];

    for (const pattern of amountPatterns) {
        const match = line.match(pattern);
        if (!match) continue;
        cleanedMsg['amount'] = match[1];
        // Re-normalize: removing a match from the middle leaves a gap that
        // would otherwise split the remaining numbers apart.
        line = tildeNormalize(line.replace(match[0], ' '));
        return { line, consumed: line === '' };
    }

    return { line, consumed: false };
}

// Extracts a ticket quantity from unit words/abbreviations (EACH, SET, T, ...)
// next to a number. Tries several shapes in sequence, same as the original
// inline logic: each match can fully consume the line and stop processing.
// Returns { line, consumed }.
function extractQty(line, cleanedMsg) {
    // Check line matches 813..2set then get 813 and 2 - 557. 2SET
    var setMatch = line.match(/(?!\bTO\b)(EACH|ECH|ETC|E|T)+[^A-Za-z0-9]*(\d{1,5})[^A-Za-z0-9]*(?!\bTO\b)(SET|SETS|SAT|SAF|ST|CH|CHANCE|E|S|P|T)+/);
    if (setMatch) {
        cleanedMsg['qty'] = setMatch[2];
        line = line.replace(setMatch[0], ' ').trim();
        if (line === '') {
            return { line, consumed: true };
        }
    }

    // Check line matches 813..2set then get 813 and 2 - 557. 2SET
    setMatch = line.match(/(?!\bTO\b)(EACH|ECH|ETC|SET|E|S|T)+[^A-Za-z0-9]*(\d{1,5})[^A-Za-z0-9]*/);
    if (setMatch) {
        cleanedMsg['qty'] = setMatch[2];
        line = line.replace(setMatch[0], ' ').trim();
        if (line === '') {
            return { line, consumed: true };
        }
    }

    // Check line matches 813..2set then get 813 and 2 - 557. 2SET
    setMatch = line.match(/(\d{1,5})[^A-Za-z0-9]*(?!\bTO\b)(SET|SETS|SAT|SAF|ST|CH|CHANCE|E|S|P|T)+/);
    if (setMatch) {
        cleanedMsg['qty'] = setMatch[1];
        line = line.replace(setMatch[0], ' ').trim();
        if (line === '') {
            return { line, consumed: true };
        }
    }

    setMatch = line.match(/(\d{1,5})[^A-Za-z0-9]*(?!\bTO\b)(EACH|ECH|ETC|E|S|P|T)+/);
    if (setMatch) {
        cleanedMsg['qty'] = setMatch[1];
        line = line.replace(setMatch[0], ' ').trim();
        if (line === '') {
            return { line, consumed: true };
        }
    }

    return { line, consumed: false };
}
