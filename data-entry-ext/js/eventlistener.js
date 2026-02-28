
function copyWhatsappInput() {
    const textarea = document.getElementById('inputData');
    if (textarea) {
        navigator.clipboard.writeText(textarea.value);
    }
}

function copyTextWithNewLine(txt) {
    navigator.clipboard.writeText('\n' + txt.trim() + '\n');
}

function openNewTabWithData(actionEl) {
    //alert("Opening new tab with target: " + target + " and data:\n" + data);
    websiteBaseUrl = document.getElementById('websiteBaseUrlInput').value;
    targetTime = document.getElementById('targetTime').value;
    target = actionEl.dataset.target;
    if (websiteBaseUrl == '') {
        alert('Please enter the website base URL. Eg https://abidear.com/employee');
        return
    }
    var allowedTktTargets = [TARGET_1D_TKT, TARGET_2D_TKT, TARGET_3D_TKT, TARGET_3D_BOX, TARGET_4D_TKT, TARGET_4D_BOX, TARGET_5D_TKT];
    if (!allowedTktTargets.includes(target)) {
        alert('Unknown target: ' + target);
        return;
    }
    urlSuffix = {
        [TARGET_1D_TKT]: '1dticket', [TARGET_2D_TKT]: '2dticket', [TARGET_3D_TKT]: '3dticket', [TARGET_4D_TKT]: '4dticket', [TARGET_5D_TKT]: '5dticket',
            [TARGET_3D_BOX]: '3dbox', [TARGET_4D_BOX]: '4dbox'
    };
    urlMap = {
        'na': {
            [TARGET_1D_TKT]: '/order/1dticket', [TARGET_2D_TKT]: '/order/2dticket', [TARGET_3D_TKT]: '/order/3dticket', [TARGET_4D_TKT]: '/order/4dticket', [TARGET_5D_TKT]: '/order/5dticket',
            [TARGET_3D_BOX]: '/order/3dbox', [TARGET_4D_BOX]: '/order/4dbox'
        },
        'one': {
            [TARGET_1D_TKT]: '/drawOne/1dticket', [TARGET_2D_TKT]: '/drawOne/2dticket', [TARGET_3D_TKT]: '/drawOne/3dticket', [TARGET_4D_TKT]: '/drawOne/4dticket',
            [TARGET_3D_BOX]: '/drawOne/3dbox', [TARGET_4D_BOX]: '/drawOne/4dbox'
        },
        'two': {
            [TARGET_1D_TKT]: '/drawTwo/1dticket', [TARGET_2D_TKT]: '/drawTwo/2dticket', [TARGET_3D_TKT]: '/drawTwo/3dticket', [TARGET_4D_TKT]: '/drawTwo/4dticket',
            [TARGET_3D_BOX]: '/drawTwo/3dbox', [TARGET_4D_BOX]: '/drawTwo/4dbox'
        },
        'three': {
            [TARGET_1D_TKT]: '/drawThree/1dticket', [TARGET_2D_TKT]: '/drawThree/2dticket', [TARGET_3D_TKT]: '/drawThree/3dticket', [TARGET_4D_TKT]: '/drawThree/4dticket',
            [TARGET_3D_BOX]: '/drawThree/3dbox', [TARGET_4D_BOX]: '/drawThree/4dbox'
        }
    }
    const url = websiteBaseUrl+ (websiteBaseUrl.substring(websiteBaseUrl.length - 1) === '/' || urlSuffix[target].startsWith('/') ? '' : '/') + (urlSuffix[target] || '');

    var data = copyTextarea(actionEl);
    chrome.runtime.sendMessage({
        action: "openAndFill",
        payload: data,
        url: url,
        target: target
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
                case 'copy-with':
                    copyTextWithNewLine(actionEl.dataset.value || '');
                    break;
                case 'copy-whatsapp':
                    copyWhatsappInput();
                    actionEl.textContent = 'Copied!';
                    break;
                default:
                    // unknown data-action; do nothing
                    break;
            }
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
    });
});


