
var headerLineMatchRegex = /^(\[\s*)?\d{2}\/\d{2}\/\d{2,4},\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)\s*(\]?\s*[-~]\s*.+?:)/;

/**
 * Collapses a run of back-to-back lines whose entire trimmed content is
 * exactly AB, AC and/or BC into a single line: all three become ALL, two
 * become that pair joined with '-' (e.g. AB-AC). The lines must be
 * consecutive - anything in between (a number, an amount) breaks the run
 * and leaves those lines untouched. Mirrors extractTarget's same-line
 * ABAC/ABBC/ACBC/ABACBC -> AB-AC/AB-BC/AC-BC/ALL handling, for the case
 * where each token is on its own line.
 */
function mergeAbAcBcLines(message) {
    const targetTokens = ['AB', 'AC', 'BC'];
    var mergedMessage = [];
    for (var i = 0; i < message.length; i++) {
        // Collect the run of distinct target-only lines starting at i
        var runTokens = [];
        var end = i;
        var headerPrefix = '';
        while (end < message.length) {
            const parts = splitOffHeader(message[end]);
            const trimmedUc = parts.body.trim().toUpperCase();
            if (!targetTokens.includes(trimmedUc) || runTokens.includes(trimmedUc)) {
                break;
            }
            // Only the line that opens the run can carry one, and it has to be
            // put back on the merged line.
            if (end === i) {
                headerPrefix = parts.header;
            }
            runTokens.push(trimmedUc);
            end++;
        }
        if (runTokens.length >= 2) {
            const merged = runTokens.length === 3 ? 'ALL' : runTokens.slice().sort().join('-');
            mergedMessage.push(headerPrefix ? headerPrefix + ' ' + merged : merged);
            i = end - 1;
        } else {
            mergedMessage.push(message[i]);
        }
    }
    return mergedMessage;
}

/**
 * Splits an export line into its WhatsApp header and the message text after
 * it, or returns the whole line as the text when there is no header.
 *
 * The export writes the first line of a message on the same line as its
 * timestamp and sender, so a message that opens with a target reads as
 * '29/08/26, 12:36 pm - +91 ...: AB'. Without taking the header off, that line
 * is not a target-only line and drops out of the run below it - 'AB / BC / AC'
 * merges as AC-BC and the AB is lost. splitTargetSegments already skips the
 * header the same way.
 */
function splitOffHeader(line) {
    const headerMatch = line.match(headerLineMatchRegex);
    return headerMatch
        ? { header: line.slice(0, headerMatch[0].length), body: line.slice(headerMatch[0].length) }
        : { header: '', body: line };
}

/**
 * Splits a line that carries several target blocks into one line per block, so
 * a message typed on a single line groups the same way as a multi-line one:
 *
 *   RS 30 941 A 9-10 ALL 14,41 AB 41   ->   RS 30 941 / A 9-10 / ALL 14,41 / AB 41
 *
 * A cut is made before a target token only when numbers appear between it and
 * the previous target token, so a run of tokens that together name one target
 * ("AB AC 41" -> AB-AC) is left alone. Anything before the WhatsApp header's
 * "name:" is skipped - names are not targets.
 */
function splitTargetSegments(line) {
    const upper = line.toUpperCase();
    const headerMatch = upper.match(headerLineMatchRegex);
    const bodyStart = headerMatch ? headerMatch.index + headerMatch[0].length : 0;

    const targetTokenRegex = /\b(?:ABACBC|ABAC|ABBC|ACBC|ABC|ALL|AB|AC|BC|A|B|C)\b/g;
    targetTokenRegex.lastIndex = bodyStart;

    const cuts = [];
    let previousEnd = bodyStart;
    let tokenMatch;
    while ((tokenMatch = targetTokenRegex.exec(upper)) !== null) {
        if (tokenMatch.index > bodyStart && /\d/.test(upper.slice(previousEnd, tokenMatch.index))) {
            cuts.push(tokenMatch.index);
        }
        previousEnd = tokenMatch.index + tokenMatch[0].length;
    }
    if (cuts.length === 0) {
        return [line];
    }

    const segments = [];
    let start = 0;
    cuts.forEach(cut => {
        segments.push(line.slice(start, cut));
        start = cut;
    });
    segments.push(line.slice(start));
    return segments.map(segment => segment.trim()).filter(segment => segment !== '');
}

/**
 * Extracts message groups from raw WhatsApp export
 * Groups are separated by timestamp lines containing ":"
 */
function getMessageGroups() {
    const inputData = (applyTextSubstitutions(document.getElementById(INPUT_FIELD_ID).value).replace(
        /(\d+)\s*To\s*(\d+)/gi,
        "$1 TO $2"
    ));


    const lines = inputData.split('\n').filter(line => line.trim() !== '');
    let messageGroup = [];
    let message = [];
    lines.forEach(line => {
        line = toNormalText(line.trim());
        // Matches regex \[.*: then replace that with empty string and add --- at the end
        if (line.match(headerLineMatchRegex) || line.includes(':')) {
            if (message.length > 0) {
                messageGroup.push(mergeAbAcBcLines(message));
            }
            message = [];
        }
        message.push(line);
    });
    if (message.length > 0) {
        messageGroup.push(mergeAbAcBcLines(message));
    }
    return messageGroup;
}

/**
 * Normalizes each raw message group into a flat, trimmed line list.
 */
function normalizeMessageGroups(groups) {
    var groupsUpdated = [];
    groups.forEach((msg, index) => {
        var lines = [];
        msg.forEach((line, index) => {
            if (line === '') return;
            line = plainTextNormalize(line);
            line.split('\n').map(l => l.trim()).forEach(l => {
                splitTargetSegments(l).forEach(segment => lines.push(segment));
            });
        });
        groupsUpdated.push(lines);
    });
    return groupsUpdated;
}
