
//1DCut 1DTkt 2DCut 2DTkt  3DBox 3DCut 3DTkt 4DBox 4DCut 4DTkt 5DBox 5DCut 5DTkt
const TARGET_1D_TKT = '1DTkt';
const TARGET_1D_CUT = '1DCut';
const TARGET_2D_TKT = '2DTkt';
const TARGET_2D_CUT = '2DCut';
const TARGET_3D_TKT = '3DTkt';
const TARGET_3D_CUT = '3DCut';
const TARGET_3D_BOX = '3DBox';
const TARGET_4D_TKT = '4DTkt';
const TARGET_4D_CUT = '4DCut';
const TARGET_4D_BOX = '4DBox';
const TARGET_5D_TKT = '5DTkt';
const TARGET_5D_CUT = '5DCut';
const TARGET_5D_BOX = '5DBox';

// 1D field names
const aFieldName = "a[]";
const bFieldName = "b[]";
const cFieldName = "c[]";
const aQtyFieldName = "a_qty[]";
const bQtyFieldName = "b_qty[]";
const cQtyFieldName = "c_qty[]";

var abFieldName = "ab[]";
var bcFieldName = "bc[]";
var acFieldName = "ac[]";
var abQtyFieldName = "ab_qty[]";
var acQtyFieldName = "ac_qty[]";
var bcQtyFieldName = "bc_qty[]";

// 3D Tkt, 3D Box, 4D Tkt, 4D Box
var abcFieldName = "abc[]";
var abcQtyFieldName = "abc_qty[]";

// 5D Tkt
var abcdeFieldName = "abcde[]";
var abcdeQtyFieldName = "abcde_qty[]";
// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openExtensionUI') {
        injectExtensionUI();
        sendResponse({ success: true });
    } else if (request.action === 'insertData') {
        //handleInsertData(request.ticketType, request.inputData, sendResponse);
        //alert('Insert Data action received in content script' + request.ticketType + ' ' + request.inputData);
        handleInsertData(request.ticketType, request.inputData, request.quantity, request.scriptVersion, request.target1D2D, request.showData);
        return true; // keep the message channel open for async response
    } else if (request.action === 'clearData') {
        //handleInsertData(request.ticketType, request.inputData, sendResponse);
        //alert('Insert Data action received in content script' + request.ticketType + ' ' + request.inputData);
        handleClearData();
        return true; // keep the message channel open for async response
    } else {
        // Always respond to avoid closing the port unexpectedly
        sendResponse({ success: false, error: 'Unknown action' });
    }
});


function injectExtensionUI() {
    // Check if UI already exists
    if (document.getElementById('data-entry-extension-container')) {
        showExtensionUI();
        return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'data-entry-extension-container';
    container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    padding: 24px;
  `;

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  `;
    closeBtn.onclick = () => container.remove();

    // Create content
    const content = document.createElement('div');
    content.innerHTML = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #222;">Data Entry Extension</h2>
    <p style="color: #666; font-size: 14px; margin: 0 0 16px 0;">Extension is active on this website.</p>
    <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; color: #555;">
      Ready for data entry operations.
    </div>
  `;

    modal.appendChild(closeBtn);
    modal.appendChild(content);
    container.appendChild(modal);
    document.body.appendChild(container);
}

function showExtensionUI() {
    const container = document.getElementById('data-entry-extension-container');
    if (container) {
        container.style.display = 'flex';
    }
}

function lastInputByName(name) {
    const list = document.getElementsByName(name);
    return list.length ? list[list.length - 1] : null;
}

function getLastInputIndex(name) {
    const list = document.getElementsByName(name);
    return list.length ? list.length - 1 : -1;
}

function insertDataAtSection(elementName, dataLine, showData) {
    const input = lastInputByName(elementName);

    if (input && showData) {
        // 2️⃣ Find the parent row
        const row = input.closest('div.row');
        // 3️⃣ Create new sibling element
        const newDiv = document.createElement('div');
        newDiv.className = 'row';
        newDiv.innerHTML = `
            <div class="col-sm-6">
                <div style="border-radius:1px; border-bottom:2px solid #132cd9; margin-bottom: 16px;" role="alert">
                        <b>${dataLine}</b>
                </div>
            </div>
            <div class="col-sm-6"></div>
        `;
        // 4️⃣ Insert as FIRST sibling (before row)
        //row.parentNode.insertBefore(newDiv, row);
        //row.parentNode.prepend(newDiv);
        //insert before the row
        row.parentNode.insertBefore(newDiv, row);
    }
}

function setLastValue(name, value) {
    const el = lastInputByName(name);
    if (el) {
        // If value is already present alert and return error
        if (el.value && el.value.trim() !== '') {
            console.warn(`Field ${name} already has value: ${el.value}`);
            alert(`Field ${name} already has value: ${el.value}`);
            // return error;
            throw new Error(`Field ${name} already has value: ${el.value}`);
        }
        el.value = value;
    } else {
        console.warn(`No input found with name: ${name}`);
        alert(`No input found with name: ${name}`);
        // return error;
        throw new Error(`No input found with name: ${name}`);
    }
}

function handleClearData() {
    try {
        console.log('Processing Clear Data');
        const clearButtons = document.querySelectorAll('.remove_field');
        clearButtons.forEach(btn => btn.click());
        // take all input fields and clear their values
        const inputFields = document.querySelectorAll('input[type="text"], input[type="number"]');
        inputFields.forEach(input => {
            if (input.name !== 'date') {
                input.value = '';
            }
        });  // name matching in const field names
    } catch (error) {
        console.error('Error handling clear data:', error);
    }
}

/**
 * Handle Insert Data from popup
 * Processes ticket type and input data
 */
function handleInsertData(type, value, quantity, scriptVersion, target1D2D, showData) {
    try {
        console.log('Processing Insert Data:', { type, value, quantity, scriptVersion, target1D2D, showData });

        // Validate inputs
        if (!type || type === 'select') {
            sendResponse({ success: false, error: 'Invalid ticket type' });
            return;
        }

        if (!value || value.trim() === '') {
            sendResponse({ success: false, error: 'Empty input data' });
            return;
        }

        // Parse input data (lines separated by newlines)
        const lines = value.trim().split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            sendResponse({ success: false, error: 'No valid data lines found' });
            return;
        }
        valuesToInsert = [];
        if (scriptVersion == '2024') {
            // For PDF version, adjust field names if necessary
            value.split(/[-\s\n,.\/]/).forEach(function (val, index) {
                var formatted = parseInt(val.trim());
                if (val.trim().length > 0 && !isNaN(formatted)) {
                    valuesToInsert.push([val.trim(), quantity, target1D2D].join(","));
                }
            });
        } else if (scriptVersion == 'PDF') {
            value.split(/[\s\n,.]+/).forEach(function (token) {
                const trimmed = (token || '').trim();
                //const parsed = parseInt(trimmed, 10);
                noAndQty = trimmed.split(/[-=*/]+/);
                const parsed = parseInt(noAndQty[0], 10);
                const qtyParsed = noAndQty[1] ? parseInt(noAndQty[1], 10) : null;
                if (trimmed.length > 0 && !isNaN(parsed) && qtyParsed !== null) {
                    //alert("Value to insert: " + noAndQty[0] + ", Qty: " + qtyParsed);
                    valuesToInsert.push([noAndQty[0], qtyParsed, target1D2D].join(","));
                } else {
                    alert("Invalid entry skipped: " + trimmed);
                    console.log("Invalid entry skipped: " + trimmed);
                }
            });
        } else {
            valuesToInsert = value.split("\n");
        }
        insertDataIntoFields(valuesToInsert, type, showData);
    } catch (error) {
        console.error('Error handling insert data:', error);
    }
}

function insertDataIntoFields(valuesToInsert, type, showData) {
    //alert("No of entries to insert: " + valuesToInsert.length);
    const addButton = document.querySelector('.add_field_button');
    validateDataLength(type, valuesToInsert);
    if (type === TARGET_1D_TKT) {
        let first = true;

        valuesToInsert.forEach(line => {
            if (first) {
                first = false;
            } else {
                addButton.click();
            }
            const parts = line.split(",");
            const num = parts[0];
            const qty = parts[1];
            const targets = parts[2].toUpperCase().split("-");

            // find the div class name row which contains aFieldName and find its parent and add a child div with class row as first child
            insertDataAtSection(aFieldName, line, showData);
            if (targets.includes("A")) {
                setLastValue(aFieldName, num);
                setLastValue(aQtyFieldName, qty);

            }
            if (targets.includes("B")) {
                setLastValue(bFieldName, num);
                setLastValue(bQtyFieldName, qty);

            }
            if (targets.includes("C")) {
                setLastValue(cFieldName, num);
                setLastValue(cQtyFieldName, qty);

            }
            if (targets.includes("ALL")) {
                setLastValue(aFieldName, num);
                setLastValue(aQtyFieldName, qty);

                setLastValue(bFieldName, num);
                setLastValue(bQtyFieldName, qty);

                setLastValue(cFieldName, num);
                setLastValue(cQtyFieldName, qty);
                return;
            }
        });

    } else if (type === TARGET_2D_TKT) {
        let first = true;

        valuesToInsert.forEach(line => {
            if (first) {
                first = false;
            } else {
                addButton.click();
            }

            const parts = line.split(",");
            const num = parts[0];
            const qty = parts[1];
            const targets = parts[2].toUpperCase().split("-");
            insertDataAtSection(abFieldName, line, showData);

            if (targets.includes("AB")) {
                setLastValue(abFieldName, num);
                setLastValue(abQtyFieldName, qty);

            }
            if (targets.includes("BC")) {
                setLastValue(bcFieldName, num);
                setLastValue(bcQtyFieldName, qty);

            }
            if (targets.includes("AC")) {
                setLastValue(acFieldName, num);
                setLastValue(acQtyFieldName, qty);

            }
            if (targets.includes("ALL")) {
                setLastValue(abFieldName, num);
                setLastValue(abQtyFieldName, qty);

                setLastValue(bcFieldName, num);
                setLastValue(bcQtyFieldName, qty);

                setLastValue(acFieldName, num);
                setLastValue(acQtyFieldName, qty);
                return;
            }
        });

    } else if (
        type === TARGET_3D_BOX ||
        type === TARGET_3D_TKT ||
        type === TARGET_4D_BOX ||
        type === TARGET_4D_TKT
    ) {
        let first = true;

        valuesToInsert.forEach(line => {
            if (first) {
                first = false;
            } else {
                addButton.click();
            }

            const parts = line.split(",");
            const num = parts[0];
            const qty = parts[1];
            insertDataAtSection(abcFieldName, line, showData);

            setLastValue(abcFieldName, num);
            setLastValue(abcQtyFieldName, qty);
        });

    } else if (type === TARGET_5D_TKT) {
        let first = true;

        valuesToInsert.forEach((line, index) => {
            if (first) {
                first = false;
            } else {
                addButton.click();
            }

            const parts = line.split(",");
            const num = parts[0];
            const qty = parts[1];
            insertDataAtSection(abcdeFieldName, line, showData);
            setLastValue(abcdeFieldName, num);
            setLastValue(abcdeQtyFieldName, qty);
        });
    }

}

/**
 * Check the data length is matching the expected length for the ticket type.
 */
function validateDataLength(type, values) {
    const expectedLength = {
        [TARGET_1D_TKT]: 1,
        [TARGET_2D_TKT]: 2,
        [TARGET_3D_TKT]: 3,
        [TARGET_3D_BOX]: 3,
        [TARGET_4D_TKT]: 4,
        [TARGET_4D_BOX]: 4,
        [TARGET_5D_TKT]: 5
    }[type];

    values.filter(v => v.trim() !== "").forEach(line => {
        const numPart = line.split(",")[0].trim();
        if (numPart.length !== expectedLength) {
            alert(`Invalid data length for ${type}: ${numPart} (expected ${expectedLength} digits)`);
            throw new Error(`Invalid data length for ${type}: ${numPart} (expected ${expectedLength} digits)`);
        }
        const qtyPart = line.split(",")[1] ? line.split(",")[1].trim() : null;
        if (!qtyPart || isNaN(qtyPart) || parseInt(qtyPart) <= 0) {
            alert(`Invalid quantity for ${type}: ${qtyPart} (must be a positive number)`);
            throw new Error(`Invalid quantity for ${type}: ${qtyPart} (must be a positive number)`);
        }
        if (type === TARGET_1D_TKT  || type === TARGET_2D_TKT) {
            const targetPart = (line.split(",")[2] ? line.split(",")[2].trim().toUpperCase() : null)?.split("-").map(t => t.trim());
            const validTargets = ["A", "B", "C", "AB", "BC", "AC", "ALL"];
            if (!targetPart || !targetPart.every(t => validTargets.includes(t))) {
                alert(`Invalid target for ${type}: ${targetPart} (must be one of ${validTargets.join(", ")})`);
                throw new Error(`Invalid target for ${type}: ${targetPart} (must be one of ${validTargets.join(", ")})`);
            }
        }
    });
}

/**
 * Display success message when data is inserted
 */
function displayInsertDataSuccess(ticketTypeLabel, lineCount) {
    // Check if notification already exists
    let notification = document.getElementById('data-entry-notification');
    if (notification) {
        notification.remove();
    }

    // Create notification element
    notification = document.createElement('div');
    notification.id = 'data-entry-notification';
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4caf50;
    color: white;
    padding: 16px 24px;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10001;
    animation: slideIn 0.3s ease-in-out;
  `;

    notification.innerHTML = `
    <strong>✓ Data Inserted Successfully</strong><br>
    <span style="font-size: 12px;">Type: ${ticketTypeLabel} | Lines: ${lineCount}</span>
  `;

    document.body.appendChild(notification);

    // Add animation styles if not already present
    if (!document.getElementById('data-entry-animation-style')) {
        const style = document.createElement('style');
        style.id = 'data-entry-animation-style';
        style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
        document.head.appendChild(style);
    }

    // Auto-remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-in-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

console.log('Data Entry Extension content script loaded');
