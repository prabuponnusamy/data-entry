

//const requestMeta = [];
var lastFocusedTextareaIdx = 0;
// ============================================================================
// SECTION 4: TABLE GENERATION & UI
// ============================================================================

function generateTable() {
    const inputData = document.getElementById('inputData').value;
    const outputData = document.getElementById('outputData');
    const showFailedParsing = false;//document.getElementById('showFailedParsing').checked;

    const _1DAWinningNumber = (document.getElementById('1dAWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _1DBWinningNumber = (document.getElementById('1dBWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _1DCWinningNumber = (document.getElementById('1dCWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _2DABWinningNumber = (document.getElementById('2dABWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _2DACWinningNumber = (document.getElementById('2dACWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _2DBCWinningNumber = (document.getElementById('2dBCWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _3DWinningNumber = (document.getElementById('3dWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _4DWinningNumber = (document.getElementById('4dWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));
    const _5DWinningNumber = (document.getElementById('5dWinningNumbers').value || '').split(',').filter(n => n.trim() !== '').map(n => new RegExp(`\\b${n.trim()}\\b`));

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
        // Add the winning number info if any of the winning number matches in the output message - check for whole word match using regex
        match =_1DAWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("1D A - " + match);
        }  
        match =_1DBWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("1D B - " + match);
        }  
        match =_1DCWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("1D C - " + match);
        }  
        match =_2DABWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("2D AB - " + match);
        }  
        match =_2DACWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("2D AC - " + match);
        }  
        match =_2DBCWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("2D BC - " + match);
        }  
        match =_3DWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("3D - " + match);
        }  
        match =_4DWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("4D - " + match);
        }  
        match =_5DWinningNumber.filter(regex => regex.test(inputMsg)).map(regex => regex.source.replace(/\\b/g, '')).join(', ');
        if (match) {
            hasWinningNumber.push("5D - " + match);
        }
        const isFailedParsing = outputMsg.includes(FAILED_TO_PARSE);
        const show = !showFailedParsing || isFailedParsing;
        imagePath = outputMsg.toUpperCase().replace('ATTACHMENT:', '').trim();
        const imageUrl = imageMap.get(imagePath);
        //console.log('Looking for image with key:', imagePath);
        //console.log('Available images in map:', Array.from(imageMap.keys()));
        //console.log('Found image URL:', imageUrl);

        // Build image HTML with fallback if image not found
        const imgHtml = imageUrl ? `<br/>
            <button class="extract-text-btn" data-image-name="${imagePath.toUpperCase()}">Extract Text</button>
            <br/>
            <img src="${imageUrl}" alt="${outputMsg}" style="max-width: 200px; margin-top: 10px;">
        ` : ``;
        // How to set focus on textarea after generating table - set focus on first textarea only
        tableHTML += `<tr style="display:${show ? 'table-row' : 'none'}"><td>${i + 1} <button class="delete-row-btn">Delete</button></td>
            <td>
                ${hasWinningNumber.length > 0 ? `<span class="lottery-winning-number">🎉 ${hasWinningNumber.join(', ')} 🎉</span><br/>` : ''}
                <textarea id="original-msg-${i}" name="original-msg" class="original-msg ${hasWinningNumber.length > 0 ? 'winning-ticket' : ''}" data-idx="${i}" rows="${inputGroups[i]?.length || 1}">${inputMsg}</textarea>${imgHtml}</td>
            <td>
                <textarea id="formatted-msg-${i}" name="formatted-msg" class="formatted-msg ${isFailedParsing ? 'error-output' : ''}" data-error="${isFailedParsing ? 'true' : 'false'}" rows="${outGroups[i]?.length || 1}">${outputMsg}</textarea>
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
