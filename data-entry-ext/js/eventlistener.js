
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
    var tktMap = {
        "1DTkt": "1d_tkt", "1DCut": "1d_tkt",
        "2DTkt": "2d_tkt", "2DCut": "2d_tkt",
        "3DBox": "3d_box", "3DCut": "3d_tkt", "3DTkt": "3d_tkt",
        "4DTkt": "4d_tkt", "4DBox": "4d_box", "4DCut": "4d_tkt",
        "5DTkt": "5d_tkt", "5DCut": "5d_tkt", "5DBox": "5d_box"
    };
    urlMap = {
        'na': {"1d_tkt": '/order/1dticket', "2d_tkt": '/order/2dticket', "3d_tkt": '/order/3dticket', "4d_tkt": '/order/4dticket', "5d_tkt": '/order/5dticket',
               "3d_box": '/order/3dbox', "4d_box": '/order/4dbox'},
        'one': {
            "1d_tkt": '/drawOne/1dticket', "2d_tkt": '/drawOne/2dticket', "3d_tkt": '/drawOne/3dticket', "4d_tkt": '/drawOne/4dticket',
            "3d_box": '/drawOne/3dbox', "4d_box": '/drawOne/4dbox'
        },
        'two': {
            "1d_tkt": '/drawTwo/1dticket', "2d_tkt": '/drawTwo/2dticket', "3d_tkt": '/drawTwo/3dticket', "4d_tkt": '/drawTwo/4dticket',
            "3d_box": '/drawTwo/3dbox', "4d_box": '/drawTwo/4dbox'
        },
        'three': {
            "1d_tkt": '/drawThree/1dticket', "2d_tkt": '/drawThree/2dticket', "3d_tkt": '/drawThree/3dticket', "4d_tkt": '/drawThree/4dticket',
            "3d_box": '/drawThree/3dbox', "4d_box": '/drawThree/4dbox'
        }
    }
    if (!tktMap[target]) {
        alert('Unknown target: ' + target);
        return;
    }
    const url = websiteBaseUrl + (urlMap[targetTime][tktMap[target]] || '');

    var data = copyTextarea(actionEl);
    chrome.runtime.sendMessage({
        action: "openAndFill",
        payload: data,
        url: url,
        target: tktMap[target]
    });
}



// Parse Data functionality
document.addEventListener('DOMContentLoaded', () => {

    // ============================================================================
    // SECTION 5: EVENT LISTENERS
    // ============================================================================

    // Initialize tab functionality
    initializeTabs();
    // CSP-safe delegated click handlers (replaces inline `onclick` usage)

    document.getElementById('parseInputBtn')?.addEventListener('click', () => {
        parseMessages();
        generateTable();
        generateFinalOutput();
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
        parseMessages();
        generateTable();
        generateFinalOutput();
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
        parseMessages();
        generateTable();
        generateFinalOutput();
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
                parseMessages();
                generateTable();
                generateFinalOutput();
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
});


