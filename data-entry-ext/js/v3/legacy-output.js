
// NOTE: generateOutput/getTicketType are not called anywhere in the current
// pipeline (buildOutputLines in output-builder.js is what's actually used).
// Kept here, split out of the original monolith, so no behavior is dropped.

/**
 * Generates final CSV output from parsed data
 */
function generateOutput(lines, groupedOutLines, isBox) {
    let outLines = [];
    let targetValue = '';
    let amountValue = '';
    let qtyValue = null;

    lines.forEach((line) => {
        if (line.image) {
            outLines.push(`attachment:${line.image}`);
            return;
        }

        if (line.amount) amountValue = line.amount;
        if (line.target) targetValue = line.target;
        if (line.qty) qtyValue = line.qty;

        if (line.data && line.data.length > 0) {
            line.data.forEach(item => {
                const num = item.number || '';
                const qty = item.qty || qtyValue || '1';
                const target = item.target || targetValue || '';
                const amount = line.amount || amountValue || '';

                if (!num) return;

                const ticketType = getTicketType(num.length, isBox, line.cut);
                outLines.push(`${ticketType},${num},${qty},${amount},${target}`);
            });
        }
    });

    groupedOutLines.push(outLines.length > 0 ? outLines.join('\n') : `\n${FAILED_TO_PARSE}\n`);
}

/**
 * Determines ticket type based on number length
 */
function getTicketType(numLen, isBox, isCut) {
    const type = ['', '1D', '2D', '3D', '4D', '5D'][numLen] || '1D';
    const suffix = isBox ? 'Box' : (isCut ? 'Cut' : 'Tkt');
    return type + suffix;
}
