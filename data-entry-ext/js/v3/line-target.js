
// Extracts the A/B/C target combination (e.g. AB, AC-BC, ALL) from a line,
// stripping the matched tokens and setting cleanedMsg['target'].
function extractTarget(line, cleanedMsg) {
    line = line.replace("ABACBC", 'ALL').trim();
    const tokens = line.toUpperCase().match(/\b(?:ABAC|ABBC|ACBC|ABC|ALL|AB|AC|BC|A|B|C)\b/g);
    if (tokens) {
        const uniqueTokens = [...new Set(tokens)];
        // replace the tokens from line with empty using word boundary to avoid partial match and trim the line
        uniqueTokens.forEach(token => {
            line = line.replace(new RegExp('\\b' + token + '\\b', 'g'), '').trim();
        });

        if (uniqueTokens.includes('ALL') && uniqueTokens.length > 1) {
            // If ALL is present along with other tokens, remove ALL
            const index = uniqueTokens.indexOf('ALL');
            if (index > -1) {
                uniqueTokens.splice(index, 1);
            }
        }
        uniqueTokens.sort();
        const joinedTokens = uniqueTokens.join('-');
        var targetVal = joinedTokens;
        if (joinedTokens === 'AB-AC-BC' || joinedTokens === 'A-B-C' || joinedTokens === 'ABC') {
            targetVal = 'ALL';
        } else {
            targetVal = targetVal.replace("ABAC", "AB-AC");
            targetVal = targetVal.replace("ABBC", "AB-BC");
            targetVal = targetVal.replace("ACBC", "AC-BC");
        }
        cleanedMsg['target'] = targetVal;
        if (line == '' && targetVal != '') {
            lastTarget = targetVal;
        }
    }
    return line;
}
