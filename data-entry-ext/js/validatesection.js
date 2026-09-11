//const requestMeta = [];
var lastFocusedTextareaIdx = 0;
// ============================================================================
// SECTION 4: TABLE GENERATION & UI
// ============================================================================

// A 3D/4D ticket line that ended up with no amount.
function isAmountMissingLine(line) {
    const splits = line.trim().split(',');
    return !!(splits[0]
        && (splits[0].startsWith('3DTkt') || splits[0].startsWith('4DTkt'))
        && splits[3] === '');
}

// Words that mark a number as a quantity ("2set", "each 20", "20 st").
const QTY_WORD_PATTERN = '(?:SETS|SET|SAT|SAF|EACH|ECH|ETC|CHANCE|ST|CH|E|S|P|T)';

// Leading zeros are kept in the output ("09") but may be typed either way.
function unpadNumber(value) {
    return value.replace(/^0+(?=\d)/, '');
}

// True when `line` contains both numbers as separate numeric tokens - i.e. the
// pair was typed together, so the parser had to decide which one is the qty.
function lineHasBothNumbers(line, number, qty) {
    const tokens = (line.match(/\d+/g) || []).map(unpadNumber);
    const index = tokens.indexOf(unpadNumber(number));
    if (index === -1) {
        return false;
    }
    const remaining = tokens.slice();
    remaining.splice(index, 1);
    return remaining.includes(unpadNumber(qty));
}

// True when the line spells the qty out ("20set", "each 20") - it was read off
// the text rather than guessed.
function isQtyStatedOnLine(line, qty) {
    const qtyAfterWord = new RegExp(QTY_WORD_PATTERN + '[^A-Za-z0-9]*' + qty + '\\b', 'i');
    const qtyBeforeWord = new RegExp('\\b' + qty + '[^A-Za-z0-9]*' + QTY_WORD_PATTERN + '\\b', 'i');
    return qtyAfterWord.test(line) || qtyBeforeWord.test(line);
}

// A number/qty pair of the same digit length ("ALL 14,41" -> 14 qty 41). The
// parser cannot tell a second ticket number from a quantity here, so it keeps
// the number+qty reading and the row is flagged for a look.
//
// Both values are looked up in the message's own lines: the guess only happened
// if they were typed on the same line and that line does not name the qty. A
// qty carried down from its own line ("Each 20set") is not a guess, and neither
// is the default qty of 1.
function isQtyGuessedLine(outLine, inputLines) {
    const splits = outLine.trim().split(',');
    const number = splits[1];
    const qty = splits[2];
    if (!/^\d+$/.test(number) || !/^\d+$/.test(qty)
        || qty === '1' || number.length !== qty.length) {
        return false;
    }

    const sharedLine = inputLines.find(line => lineHasBothNumbers(line, number, qty));
    return !!sharedLine && !isQtyStatedOnLine(sharedLine, qty);
}

function generateTable() {
    const inputData = document.getElementById('inputData').value;
    const outputData = document.getElementById('outputData');
    const showFailedParsing = false;//document.getElementById('showFailedParsing').checked;
    // Parse input groups
    const lines = inputData.split('\n').filter(l => l.trim());
    let inputGroups = [];
    let msg = [];
    lines.forEach(line => {
        if (line.match(/.*?:/)) {
            if (msg.length) inputGroups.push(msg);
            msg = [];
        }
        msg.push(line);
    });
    if (msg.length) inputGroups.push(msg);

    // Parse output groups
    const outLines = outputData.value.split('\n').filter(l => l.trim());
    let outGroups = [];
    let outMsg = [];
    outLines.forEach(line => {
        if (line.includes('=-#-#-=')) {
            if (outMsg.length) outGroups.push(outMsg);
            outMsg = [];
        } else {
            outMsg.push(line);
        }
    });
    if (outMsg.length) outGroups.push(outMsg);

    // Build table
    let tableHTML = `<table><thead><tr><th>#</th><th>Original</th><th>Formatted</th></tr></thead><tbody>`;
    const maxLen = Math.max(inputGroups.length, outGroups.length);

    for (let i = 0; i < maxLen; i++) {
        var hasWinningNumber = [];

        const inputMsg = inputGroups[i] ? inputGroups[i].join('\n') : '';
        const outputMsg = outGroups[i] ? outGroups[i].filter(l => l.trim()).join('\n') : '';
        
        var match = [];
        outGroups[i] && outGroups[i].forEach(line => {
            var matches = getWinningNumberMatchResult(line);
            if (matches.length > 0) {
                match.push(...matches);
            }
        });
        outGroups[i] && outGroups[i].forEach(line => { });
        const isFailedParsing = outputMsg.includes(FAILED_TO_PARSE);
        const groupOutLines = outGroups[i] || [];
        const warnings = [];
        if (groupOutLines.some(isAmountMissingLine)) {
            warnings.push('Amount missing');
        }
        if (groupOutLines.some(l => isQtyGuessedLine(l, inputGroups[i] || []))) {
            warnings.push('Number and qty are the same length - check which is the qty');
        }
        const show = !showFailedParsing || isFailedParsing;
        imagePath = outputMsg.toUpperCase().replace('ATTACHMENT:', '').trim();
        const imageUrl = imageMap.get(imagePath);
        //console.log('Looking for image with key:', imagePath);
        //console.log('Available images in map:', Array.from(imageMap.keys()));
        //console.log('Found image URL:', imageUrl);

        // Build image HTML with fallback if image not found
        // Audio gets a player; there is no text in it for Extract Text to read.
        const imgHtml = !imageUrl ? `` : isAudioAttachment(imagePath) ? `<br/>
            ${attachmentMediaHtml(imagePath, imageUrl, outputMsg)}
        ` : `<br/>
            <button class="extract-text-btn" data-image-name="${imagePath.toUpperCase()}">Extract Text</button>
            <br/>
            ${attachmentMediaHtml(imagePath, imageUrl, outputMsg)}
        `;
        // How to set focus on textarea after generating table - set focus on first textarea only
        tableHTML += `<tr style="display:${show ? 'table-row' : 'none'}"><td>${i + 1} <button class="delete-row-btn">Delete</button></td>
            <td>
                ${match.length > 0 ? match.map(m => `<span class="lottery-winning-number">🎉 ${m} 🎉</span><br/>`).join('') : ''}
                <textarea id="original-msg-${i}" name="original-msg" class="original-msg ${match.length > 0 ? 'winning-ticket' : ''}" data-idx="${i}" rows="${inputGroups[i]?.length || 1}">${inputMsg}</textarea>${imgHtml}</td>
            <td>
                <textarea id="formatted-msg-${i}" name="formatted-msg" class="formatted-msg ${isFailedParsing ? 'error-output' : (warnings.length > 0 ? 'warning-output' : '')}" data-error="${isFailedParsing ? 'true' : 'false'}" title="${warnings.join(' | ')}" rows="${outGroups[i]?.length || 1}">${outputMsg}</textarea>
            </td>
            </tr>`;
    }

    tableHTML += `</tbody></table>`;
    document.getElementById('tableContainer').innerHTML = tableHTML;

    // Get element by attr data-idx and set focus
    if (lastFocusedTextareaIdx !== null) {
        const taToFocus = document.querySelector(`.original-msg[data-idx="${lastFocusedTextareaIdx}"]`);
        if (taToFocus) {
            //taToFocus.focus();
        }
    }

    // when changes done in original-msg, update inputData
    const originalMsgTextareas = document.querySelectorAll('.original-msg');
    originalMsgTextareas.forEach((ta, index) => {
        // After input change and focus out, update inputData
        ta.addEventListener("focus", e => {
            lastFocusedTextareaIdx = index;
            e.target.dataset.oldValue = e.target.value;
        });

        ta.addEventListener('blur', e => {
            if (e.target.value !== e.target.dataset.oldValue) {
                copyInputEditedData();
                parseMessages();
                generateTable();
                generateFinalOutput();
            }
        });
    });

    // Add event listener to delete row button
    const deleteRowButtons = document.querySelectorAll('.delete-row-btn');
    deleteRowButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            // Identify the row to delete
            const rowToDelete = btn.closest('tr');
            if (rowToDelete) {
                rowToDelete.remove();
                copyInputEditedData();
                parseMessages();
                generateTable();
                generateFinalOutput();
            }
        });
    });

    const extractTextButtons = document.querySelectorAll('.extract-text-btn');
    extractTextButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const imageName = btn.dataset.imageName;
            if (imageName) {
                imageToTextRequest(imageName, btn);
            } else {
                showErrorMessages(['Image not found for OCR']);
            }
        });
    });
}

function getWinningNumberMatchResult(value) {
    const values = value.split(',');
    if (values.length >= 5) {
        var key = values[0].trim();
        var val = values[1].trim();
        var target = values[4].trim();
        //{ "1D_A": A, "1D_B": B, "1D_C": C, "2D_AB": AB, "2D_AC": AC, "2D_BC": BC, "3D": last3, "4D": last4, "5D": last5 };
        return getWinningNumberMatch(key, val, target);
    }
    return [];
}

function getWinningNumberMatch(key, val, target) {
    var match = [];
    switch (key) {
        case TARGET_1D_TKT: {
            match.push(val == winningNumbers.A && (target == "A" || target == "ALL") ? "1D A - " + val : "");
            match.push(val == winningNumbers.B && (target == "B" || target == "ALL") ? "1D B - " + val : "");
            match.push(val == winningNumbers.C && (target == "C" || target == "ALL") ? "1D C - " + val : "");
            return match.filter(m => m.trim() !== '');
        }
        case TARGET_2D_TKT: {
            match.push(val == winningNumbers.AC && (target == "AC"  || target == "ALL") ? "2D AC - " + val : "");
            match.push(val == winningNumbers.BC && (target == "BC" || target == "ALL") ? "2D BC - " + val : "");
            match.push(val == winningNumbers.AB && (target == "AB" || target == "ALL") ? "2D AB - " + val : "");
            return match.filter(m => m.trim() !== '');
        }
        case TARGET_3D_BOX:
        case TARGET_3D_TKT:
        case TARGET_3D_CUT: {
            match.push(val == winningNumbers.threeD ? "3D - " + val : "");
            return match.filter(m => m.trim() !== '');
        }
        case TARGET_4D_BOX:
        case TARGET_4D_TKT:
        case TARGET_4D_CUT: {
            match.push(val == winningNumbers.fourD ? "4D - " + val : "");
            return match.filter(m => m.trim() !== '');
        }
        case TARGET_5D_TKT:
        case TARGET_5D_CUT:
        case TARGET_5D_BOX: {
            match.push(val == winningNumbers.fiveD ? "5D - " + val : "");
            return match.filter(m => m.trim() !== '');
        }
        default:
            console.warn('Unknown ticket type for winning number match:', key);
            return match.filter(m => m.trim() !== '');
    }
}
