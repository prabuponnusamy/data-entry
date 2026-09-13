// ============================================================================
// SECTION 0: TAB MANAGEMENT
// ============================================================================

/**
 * Initialize tab functionality
 */
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const targetPane = document.getElementById(tabId);
            if (targetPane) {
                targetPane.classList.add('active');
            }

            // Start each tab at the top. Instant, not smooth: a message-number
            // link switches tab and then jumps to its anchor, and a smooth
            // scroll still running would fight that jump.
            window.scrollTo(0, 0);
        });
    });
}


function copyWhatsappInput() {
    const textarea = document.getElementById('inputData');
    if (textarea) {
        navigator.clipboard.writeText(textarea.value);
    }
}

function copyTextWithNewLine(txt) {
    navigator.clipboard.writeText('\n' + txt.trim() + '\n');
}


function copyTextarea(button) {
    // Find the parent and find the textarea element within the same parent
    const textarea = button.parentElement.querySelector('textarea');
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    // Change the all the textareas with class copied-now to class copied
    const copiedNowTextareas = document.querySelectorAll('.copied-now');
    copiedNowTextareas.forEach(ta => {
        ta.classList.remove('copied-now');
        ta.classList.add('copied');
    });
    // change textarea border color to green
    textarea.classList.remove('copied');
    textarea.classList.add('copied-now');
    navigator.clipboard.writeText(textarea.value).then(() => {
        const originalText = button.textContent;
        if (originalText.includes('Copy') || originalText.includes('Copied')) {
            button.textContent = 'Copied! @ ' + new Date().toLocaleTimeString();
        } else if (originalText.includes('Fill') || originalText.includes('Filled')) {
            button.textContent = 'Filled! @ ' + new Date().toLocaleTimeString();
        }

        button.style.background = '#28a745';
        /*
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 1500);
        */
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
    return textarea.value;
}

/**
 * Show blocks as filled the way a single Fill does: each textarea turns green
 * and its button says when. Whatever was green from an earlier fill drops to
 * the "done before" colour first, so only the latest run stands out.
 */
function markBlocksFilled(buttons) {
    document.querySelectorAll('.copied-now').forEach(ta => {
        ta.classList.remove('copied-now');
        ta.classList.add('copied');
    });
    const label = 'Filled! @ ' + new Date().toLocaleTimeString();
    buttons.forEach(button => {
        const textarea = button.parentElement.querySelector('textarea');
        if (textarea) {
            textarea.classList.remove('copied');
            textarea.classList.add('copied-now');
        }
        button.textContent = label;
        button.style.background = '#28a745';
    });
}

function copyInputEditedData() {
    const msgs = document.querySelectorAll('.original-msg');
    let value = '';
    msgs.forEach(ta => value += ta.value + '\n');
    document.getElementById('inputData').value = value;
    // Save the input in the local storage
    localStorage.setItem('inputData', value);
}


function showInfoMessages(messages) {
    showMessages(messages, 'info');
}

function showErrorMessages(header, messages) {
    showMessages(header, messages, 'error');
}

function clearMessages() {
    const statusMessageDiv = document.getElementById('status-message');
    statusMessageDiv.className = 'status-message';
    statusMessageDiv.innerHTML = '';
}

function showSuccessMessages(header, messages) {
    showMessages(header, messages, 'success');
}

function showMessages(header, values, classNameValue) {
    // status-message
    const messageCountAndStatus = document.getElementById('messageCountAndStatus');
    messageCountAndStatus.className = 'message-count-status ' + classNameValue;
    messageCountAndStatus.innerHTML = header;

    if (values.length > 0) {
        const statusMessageDiv = document.getElementById('status-message');
        statusMessageDiv.className = 'status-message' + ' ' + classNameValue;
        statusMessageDiv.innerHTML = '';
        let errorHTML = '<ul>';
        values.forEach(msg => {
            errorHTML += `<li>${msg}</li>`;
        });
        errorHTML += '</ul>';
        statusMessageDiv.innerHTML = errorHTML;
    }
}
