
// Extracts CUT/BOX/OFF/FULL flags from a line, stripping the matched words
// and setting the corresponding flags on cleanedMsg.
function extractFlags(line, cleanedMsg) {
    var cuttingWords = ['CUTTING', 'CUT'];
    for (var i = 0; i < cuttingWords.length; i++) {
        if (line.includes(cuttingWords[i])) {
            cleanedMsg['cut'] = true;
            line = line.replace(cuttingWords[i], '').trim();
        }
    }
    if (line.includes('BOX')) {
        cleanedMsg['isBox'] = true;
        line = line.replace('BOX', ' ').trim();
    }
    if (line.includes('OFF')) {
        line = line.replace('OFF', ' ');
        line = line.trim();
        cleanedMsg['isOff'] = true;
    }
    if (line.includes('FULL') || line.includes('FULLL')) {
        cleanedMsg['isFull'] = true;
        line = line.replace('FULLL', ' ').replace('FULL', ' ').trim();
    }
    return line;
}
