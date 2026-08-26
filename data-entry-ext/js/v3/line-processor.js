
/**
 * Processes one normalized raw line into a cleanedMsg record.
 * Mirrors the original per-line pipeline exactly, including every point
 * where the original code stopped processing a line early once it was
 * fully consumed (image line, empty target-only line, RS-amount-only line,
 * qty-only line, TO-range line, noise-word line, or plain numeric line).
 * Returns null for a blank raw line (nothing to record), otherwise the
 * cleanedMsg object (which may end up with no data and nparsed=true).
 */
function processGroupLine(groupLine, gindex, index) {
    const groupLineUc = groupLine.trim().toUpperCase();
    if (groupLineUc == '') {
        return null;
    }

    var cleanedMsg = {
        groupIndex: gindex,
        lineIndex: index,
        originalLine: groupLine,
        data: []
    };
    var line = groupLineUc;

    const imageResult = extractImageLine(line);
    if (imageResult.isImage) {
        cleanedMsg['image'] = imageResult.image;
        return cleanedMsg;
    }
    line = imageResult.line;

    line = normalizeLineWords(line);
    cleanedMsg['cleanedLine'] = line;

    line = extractTarget(line, cleanedMsg);
    if (line == '') {
        return cleanedMsg;
    }

    line = extractFlags(line, cleanedMsg);
    specialCharResult = uniqueSpecialChars(line);
    if (specialCharResult.length > 0) {
        cleanedMsg['specialCharsSize'] = specialCharResult.length;
    }
    line = tildeNormalize(line);

    const amountResult = extractAmount(line, cleanedMsg, groupLineUc);
    line = amountResult.line;
    if (amountResult.consumed) {
        return cleanedMsg;
    }

    const qtyResult = extractQty(line, cleanedMsg);
    line = qtyResult.line;
    if (qtyResult.consumed) {
        return cleanedMsg;
    }
    if (cleanedMsg['qty']) {
        cleanedMsg['qtyVal'] = cleanedMsg['qty'];
    }

    line = cleanupLine(line);
    if (line == '') {
        return cleanedMsg;
    }

    if (expandNumberRange(line, cleanedMsg)) {
        return cleanedMsg;
    }

    if (isNoiseWordLine(line)) {
        return cleanedMsg;
    }

    if (parseNumberTokens(line, cleanedMsg)) {
        return cleanedMsg;
    }

    // If could not parse the line
    cleanedMsg['nparsed'] = true;
    return cleanedMsg;
}
