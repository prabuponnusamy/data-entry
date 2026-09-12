
function copyWhatsappInput() {
    const textarea = document.getElementById('inputData');
    if (textarea) {
        navigator.clipboard.writeText(textarea.value);
    }
}

function copyTextWithNewLine(txt) {
    navigator.clipboard.writeText('\n' + txt.trim() + '\n');
}

// Ticket type -> the page on the site that files it. Also the list of targets
// that can be filled at all: anything not named here has nowhere to go.
const FILL_URL_SUFFIX = {
    [TARGET_1D_TKT]: '1dticket', [TARGET_2D_TKT]: '2dticket', [TARGET_3D_TKT]: '3dticket', [TARGET_4D_TKT]: '4dticket', [TARGET_5D_TKT]: '5dticket',
    [TARGET_3D_BOX]: '3dbox', [TARGET_4D_BOX]: '4dbox'
};

/**
 * The base URL and the ticket type's page, joined with exactly one slash.
 * Empty when either half is missing, which is what the callers check.
 */
function buildFillUrl(target) {
    const base = (document.getElementById('websiteBaseUrlInput')?.value || '').trim();
    const suffix = FILL_URL_SUFFIX[target];
    if (!base || !suffix) return '';
    return base.replace(/\/+$/, '') + '/' + suffix;
}

/** Reads a checkbox that may not be on the page; `fallback` is used when it is not. */
function isChecked(id, fallback) {
    const el = document.getElementById(id);
    return el ? el.checked === true : fallback === true;
}

function openNewTabWithData(actionEl) {
    //alert("Opening new tab with target: " + target + " and data:\n" + data);
    target = actionEl.dataset.target;
    targetkey = actionEl.dataset.targetkey
    if (!FILL_URL_SUFFIX[target]) {
        alert('Unknown target: ' + target);
        return;
    }
    const url = buildFillUrl(target);
    if (!url) {
        alert('Please enter the website base URL. Eg https://abidear.com/employee');
        return
    }

    var data = copyTextarea(actionEl);
    var supplierValueLabel = document.getElementById("supplierId")?.value;
    var autoSubmit = document.getElementById("autoSubmitCheckbox")?.checked;
    var debugMode = document.getElementById("debugModeCheckbox")?.checked;

    console.log("Data to fill:\n" + data + "\n\nSupplier: " + supplierValueLabel + "\n\nURL: " + url + "\n\nTarget: " + target + "\n\nTarget Tkt: " + targetkey + "\n\nAuto Submit: " + autoSubmit);
    if (debugMode) {
        confirmation = confirm("Do you want to proceed with filling the data?");
        if (!confirmation) {
            alert("Data filling cancelled by user.");
            return;
        }
    }

    if (!data || data.trim() === '') {
        alert('No data to fill. Please enter some data to fill.');
        return;
    }
    if (!supplierValueLabel || supplierValueLabel.trim() === '') {
        alert('Please select a supplier before filling the data.');
        return;
    }
    const entryDate = readEntryDateForFill();
    if (entryDate === null) return;
    chrome.runtime.sendMessage({
        action: "openAndFill",
        payload: data,
        url: url,
        target: target,
        supplierValueLabel: supplierValueLabel,
        targetTkt: targetkey,
        autoSubmit: autoSubmit,
        entryDate: entryDate
    });
}



/**
 * Say whether the picked site still has a session, next to the site itself.
 *
 * The worker owns the check, so the page and a run agree on what "signed in"
 * means. A run refuses to start on a dead session; showing it here means that
 * is known when the site is picked, not after the data is ready to file.
 */
function reportSignInStatus() {
    const status = document.getElementById('signInStatus');
    if (!status) return;

    const url = buildFillUrl(TARGET_3D_TKT);
    const base = (document.getElementById('websiteBaseUrlInput')?.value || '').trim();

    if (!url) {
        status.innerHTML = '';
        status.className = 'sign-in-status';
        return;
    }

    status.innerHTML = 'Checking sign-in…';
    status.className = 'sign-in-status checking';
    chrome.runtime.sendMessage({ action: 'checkSignIn', url: url }, (response) => {
        if (chrome.runtime.lastError || !response) {
            status.innerHTML = '';
            status.className = 'sign-in-status';
            resetTargetWebsiteDetailsFromHeader();
            return;
        }
        // replace the content after employee/ and append login - employee/login
        status.innerHTML = response.signedIn ? '✓ ' + base : '✗ Not signed in — log in first. <a href="' + url.replace(/\/employee\/.*/, '/employee/login') + '" target="_blank">Log in</a>';
        status.className = 'sign-in-status ' + (response.signedIn ? 'ok' : 'bad');
        if (!response.signedIn) resetTargetWebsiteDetailsFromHeader();
    });
}

/**
 * Every block that still has data in it, as the queue wants them: page-wide, or
 * under `scope` when one group is being filled. DOM order is run order.
 *
 * A block is a Fill button and the textarea beside it, which is what
 * renderFinalOutput writes; emptying a textarea is how a block is taken out of
 * the run.
 */
function collectFillBlocks(scope) {
    return fillButtonsWithData(scope).map(button => ({
        target: button.dataset.target,
        targetTkt: button.dataset.targetkey,
        url: buildFillUrl(button.dataset.target),
        text: blockText(button)
    }));
}

/** The textarea beside a Fill button, trimmed; empty when there is none. */
function blockText(button) {
    const textarea = button.parentElement.querySelector('textarea');
    return textarea ? textarea.value.trim() : '';
}

/** The Fill buttons whose block would be queued — the ones with data in them. */
function fillButtonsWithData(scope) {
    const buttons = (scope || document).querySelectorAll('[data-action="fill"]');
    return Array.from(buttons).filter(button => blockText(button) !== '');
}

/** What the confirm shows: the amount each group is priced at, not just a count. */
function fillConfirmText(blocks, supplierValueLabel, autoSubmit, dryRun, entryDate) {
    const rows = blocks.reduce((sum, block) => sum + block.text.split('\n').length, 0);
    const lines = [
        `Fill ${blocks.length} block(s), ${rows} row(s)?`,
        ''
    ];
    blocks.forEach(block => {
        lines.push(`${block.targetTkt} — ${block.text.split('\n').length} row(s)`);
    });
    lines.push('');
    lines.push(`Supplier: ${supplierValueLabel}`);
    lines.push(`Date: ${entryDate || 'as the site shows it'}`);
    if (dryRun) {
        lines.push('DRY RUN — nothing will be submitted.');
    } else if (autoSubmit) {
        lines.push('AUTO-SUBMIT IS ON — each page is saved once its boxes check out.');
    }
    return lines.join('\n');
}

function resetTargetWebsiteDetailsFromHeader() {
    // Select
    const websiteBaseUrlSelect = document.getElementById('websiteBaseUrlSelect');
    const baseUrlInput = document.getElementById('websiteBaseUrlInput');
    // textbox
    const supplierSelect = document.getElementById('supplierId');
    const targetWebsiteInputDiv = document.getElementById('target-page-input');
    websiteBaseUrlSelect.value = '';
    baseUrlInput.value = '';
    supplierSelect.value = '';
    targetWebsiteInputDiv.innerHTML = '';
}

/**
 * Hand the whole run to the service worker in one message. The worker owns the
 * tab from here: the page it opens works through the blocks one page load at a
 * time, so nothing further is needed from this page.
 *
 * `onStarted` runs once the worker says the run began — not when it refused,
 * e.g. because the site is signed out.
 */
function fillAllBlocks(scope, onStarted) {
    const base = (document.getElementById('websiteBaseUrlInput')?.value || '').trim();
    if (!base) {
        alert('Please enter the website base URL. Eg https://abidear.com/employee');
        return;
    }

    const blocks = collectFillBlocks(scope);
    if (blocks.length === 0) {
        alert('Nothing to fill — there are no blocks with data here.');
        return;
    }

    const unknown = blocks.filter(block => !block.url).map(block => block.target);
    if (unknown.length > 0) {
        alert('Unknown target: ' + [...new Set(unknown)].join(', '));
        return;
    }

    const supplierValueLabel = document.getElementById('supplierId')?.value;
    if (!supplierValueLabel || supplierValueLabel.trim() === '') {
        alert('Please select a supplier before filling the data.');
        return;
    }

    const entryDate = readEntryDateForFill();
    if (entryDate === null) return;

    const autoSubmit = isChecked('autoSubmitCheckbox');
    const dryRun = isChecked('dryRunCheckbox');
    const showFillBanner = isChecked('fillBannerCheckbox', true);

    console.log('Blocks to fill:', blocks, 'Supplier:', supplierValueLabel, 'Auto Submit:', autoSubmit);

    // Debug mode is the ask-first switch for a single Fill; a run of blocks
    // reads the same way, with what is about to be filed spelled out.
    if (isChecked('debugModeCheckbox') &&
        !confirm(fillConfirmText(blocks, supplierValueLabel, autoSubmit, dryRun, entryDate))) {
        return;
    }

    chrome.runtime.sendMessage({
        action: 'fillAll',
        blocks: blocks,
        supplierValueLabel: supplierValueLabel,
        autoSubmit: autoSubmit,
        dryRun: dryRun,
        showFillBanner: showFillBanner,
        entryDate: entryDate
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn('[data-entry]', chrome.runtime.lastError.message);
            return;
        }
        if (response && response.ok === false) {
            alert(response.error);
        } else if (response && response.ok && onStarted) {
            onStarted();
        }
    });
}

// Parse Data functionality
document.addEventListener('DOMContentLoaded', () => {
    winningNumbers = new WinningNumbers({});

    // ============================================================================
    // SECTION 5: EVENT LISTENERS
    // ============================================================================

    // Initialize tab functionality
    initializeTabs();
    // CSP-safe delegated click handlers (replaces inline `onclick` usage)

    document.getElementById('parseInputBtn')?.addEventListener('click', () => {
        processInput();
    });

    document.getElementById('processBtn')?.addEventListener('click', generateTable);

    document.getElementById('copyEditedInputDataBtn')?.addEventListener('click', () => {
        copyInputEditedData();
    });

    document.getElementById('copyEditedDataBtn')?.addEventListener('click', () => {
        const msgs = document.querySelectorAll('.formatted-msg');
        let value = '';
        msgs.forEach(ta => value += ta.value + '\n=-#-#-=\n');
        document.getElementById('outputData').value = value;
    });

    document.getElementById('processZipBtn')?.addEventListener('click', (event) => {
        parseZipFile(event);
    });

    document.getElementById('processZipOfZipsBtn')?.addEventListener('click', () => {
        parseZipOfZips();
    });

    document.getElementById('zipBatchContainer')?.addEventListener('change', onZipBatchUrlChange);

    document.getElementById('showOnlyErrorsBtn')?.addEventListener('click', () => {
        document.getElementById('validate-tab').click();
        // find elements with data-error attribute
        const formattedMessages = document.querySelectorAll('.formatted-msg');
        formattedMessages.forEach(textarea => {
            //tr>td>textarea
            const row = textarea.closest('tr');
            if (textarea.getAttribute('data-error')) {
                // show the row of the textarea
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
    document.getElementById('showAllBtn')?.addEventListener('click', () => {
        document.getElementById('validate-tab').click();
        const formattedMessages = document.querySelectorAll('.formatted-msg');
        formattedMessages.forEach(textarea => {
            const row = textarea.closest('tr');
            row.style.display = 'block';
        });
    });
    // Generate final output
    document.getElementById('generateFinalOutputBtn').addEventListener('click', function () {
        const btn = document.getElementById('generateFinalOutputBtn');
        originalText = btn.textContent;
        btn.textContent = "Button clicked ✓";
        generateFinalOutput();
        setTimeout(() => document.getElementById('generateFinalOutputBtn').textContent = 'Gen Output', 1500);
    });

    // When input data loose focus, update table
    document.getElementById('inputData')?.addEventListener('blur', () => {
        // Save the input in the local storage
        localStorage.setItem('inputData', document.getElementById('inputData').value);
        processInput();
    });

    // Show which zip the restored content came from
    restoreZipFileName();

    // Delete/replace clean-up rules: restore, then persist on every edit and
    // re-parse once the user leaves the field.
    [DELETE_TEXT_FIELD_ID, REPLACE_TEXT_FIELD_ID].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.value = localStorage.getItem(fieldId) || '';
        field.addEventListener('input', () => localStorage.setItem(fieldId, field.value));
        field.addEventListener('change', () => {
            localStorage.setItem(fieldId, field.value);
            processInput();
        });
    });

    // Zip -> target URL map: restore, persist on every edit, and re-resolve the
    // zip batch once the user leaves the field.
    const zipTargetUrlMapField = document.getElementById(ZIP_TARGET_URL_MAP_FIELD_ID);
    if (zipTargetUrlMapField) {
        zipTargetUrlMapField.value = localStorage.getItem(ZIP_TARGET_URL_MAP_FIELD_ID) || '';
        zipTargetUrlMapField.addEventListener('input', () => localStorage.setItem(ZIP_TARGET_URL_MAP_FIELD_ID, zipTargetUrlMapField.value));
        zipTargetUrlMapField.addEventListener('change', () => {
            localStorage.setItem(ZIP_TARGET_URL_MAP_FIELD_ID, zipTargetUrlMapField.value);
            zipTargetUrlMapChanged();
        });
    }

    // set default value of inputData textarea from local storage if available
    const savedInputData = localStorage.getItem('inputData');
    if (savedInputData) {
        document.getElementById('inputData').value = savedInputData;
        const savedImageMap = localStorage.getItem('imageMap');
        if (savedImageMap) {
            imageMap = new Map(JSON.parse(savedImageMap));
        }
        const savedVisionRequests = localStorage.getItem('visionRequests');
        if (savedVisionRequests) {
            visionRequests = new Map(JSON.parse(savedVisionRequests));
        }
        // set winning number input value from local storage
        document.getElementById('lotteryWinningNumber').value = localStorage.getItem('winningNumberValue') || '';
        winningNumberChangeListener();
        processInput();
    }

    // Save button saveInputDataBtn
    document.getElementById('saveInputDataBtn')?.addEventListener('click', () => {
        copyInputEditedData();
        // Allow to download the input data as txt file
        // give save as button functionality to download the input data as txt file
        const inputData = document.getElementById('inputData').value;
        if (!inputData || inputData.trim() === '') {
            alert('Input data is empty. Please enter some data to save.');
            return;
        }
        const blob = new Blob([inputData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.textContent = 'Download input data';
        a.download = 'input_data.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Get elements by data-action attribute and add event listener

    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (actionEl) {
            e.preventDefault();
            const action = actionEl.dataset.action;
            switch (action) {
                case 'copy':
                    copyTextarea(actionEl);
                    actionEl.textContent = 'Copied!';
                    break;
                case 'fill':
                    openNewTabWithData(actionEl);
                    break;
                case 'fill-group':
                    fillGroup(actionEl);
                    break;
                case 'copy-with':
                    copyTextWithNewLine(actionEl.dataset.value || '');
                    break;
                case 'copy-whatsapp':
                    copyWhatsappInput();
                    actionEl.textContent = 'Copied!';
                    break;
                case 'load-zip':
                    loadBatchZip(Number(actionEl.dataset.index));
                    break;
                default:
                    // unknown data-action; do nothing
                    break;
            }
            return;
        }

        // Message number links (#original-msg-N) point into the Validate tab.
        // Switch to it first, and unhide the row if "show only errors" hid it,
        // so the anchor jump that follows has something visible to scroll to.
        const msgLink = e.target.closest('a[href^="#original-msg-"]');
        if (msgLink) {
            document.getElementById('validate-tab')?.click();
            const target = document.getElementById(msgLink.getAttribute('href').slice(1));
            const row = target?.closest('tr');
            if (row) row.style.display = '';
            return;
        }

        // fallback: delete row button (keeps existing class-based behavior)
        const delBtn = e.target.closest('button.delete-row-btn');
        if (delBtn) {
            const row = delBtn.closest('tr');
            if (row) {
                row.remove();
                copyInputEditedData();
                processInput();
            }
            return;
        }

        // fallback: extract text button with data-image-name
        const extractBtn = e.target.closest('button.extract-text-btn[data-image-name]');
        if (extractBtn) {
            const imageName = extractBtn.dataset.imageName;
            if (imageName) imageToTextRequest(imageName, extractBtn);
            return;
        }
    });

    Array.from(document.getElementsByName('winningNumbers')).forEach(wnElem => {
        wnElem.addEventListener('change', () => {
            generateFinalOutput();
        });
    });

    window.addEventListener('beforeunload', function (event) {
        event.preventDefault(); // Prevent the default action
        event.returnValue = ''; // Display a confirmation dialog
    });

    document.getElementById('lotteryWinningNumber').addEventListener('change', (event) => {
        const winningNumberValue = event.target.value;
        localStorage.setItem('winningNumberValue', winningNumberValue);
        winningNumbers.setNumberMap({});
        winningNumberChangeListener();
    });

    // Select websiteBaseUrlSelect value to websiteBaseUrlInput
    document.getElementById('websiteBaseUrlSelect').addEventListener('change', (event) => {
        const selectedValue = event.target.value;
        document.getElementById('websiteBaseUrlInput').value = selectedValue;
        getAllFields();
        reportSignInStatus();

    });

    // Store autoSubmitCheckbox value in local storage
    document.getElementById('autoSubmitCheckbox').addEventListener('change', (event) => {
        const autoSubmitValue = event.target.checked;
        localStorage.setItem('autoSubmitCheckbox', autoSubmitValue);
    });
    // Set autoSubmitCheckbox value from local storage on page load
    const autoSubmitValue = localStorage.getItem('autoSubmitCheckbox');
    if (autoSubmitValue !== null) {
        document.getElementById('autoSubmitCheckbox').checked = (autoSubmitValue === 'true');
    }

    // Store debugModeCheckbox value in local storage
    document.getElementById('debugModeCheckbox').addEventListener('change', (event) => {
        const debugModeValue = event.target.checked;
        localStorage.setItem('debugModeCheckbox', debugModeValue);
    });
});


