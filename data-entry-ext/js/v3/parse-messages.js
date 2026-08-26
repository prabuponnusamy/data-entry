
/**
 * Parses the raw WhatsApp export from the input textarea into grouped,
 * per-message CSV output lines, and writes the result into #outputData.
 */
function parseMessages() {
    var groups = getMessageGroups();
    var groupsUpdated = normalizeMessageGroups(groups);

    var groupedOutLines = [];
    groupsUpdated.forEach((groupLines, gindex) => {
        var lines = [];
        groupLines.forEach((groupLine, index) => {
            var cleanedMsg = processGroupLine(groupLine, gindex, index);
            if (cleanedMsg) {
                lines.push(cleanedMsg);
            }
        });

        // Group data lines
        var cleanedUpGroupedLinesFirstLevel = groupCleanedUpDataFirstLevel(lines);
        var cleanedUpGroupedLines = groupCleanedUpDataSecondLevel(cleanedUpGroupedLinesFirstLevel);
        var outLines = buildOutputLines(cleanedUpGroupedLines);
        groupedOutLines.push(outLines.length > 0 ? outLines.join('\n') : '\n' + FAILED_TO_PARSE + '\n');
    });

    document.getElementById('outputData').value = groupedOutLines.join('\n=-#-#-=\n');
    return groupedOutLines;
}
