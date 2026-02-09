// Check if current tab is on an allowed website
document.addEventListener('DOMContentLoaded', () => {
    // Initialize tabs
    initializeTabs();

    const statusEl = document.getElementById('status');
    const statusMessage = document.getElementById('statusMessage');
    const parseBtn = document.getElementById('parseBtn');

    const allowedDomains = [
        'orangepblw.com',
        'rajasree.org',
        'sameeraa.com',
        'klpoorna.com',
        'akshayajackpot.com',
        'anushuya.com',
        'abidear.com',
        'chandhni.com'
    ];

    // Handle Parse Data button
    if (parseBtn) {
        parseBtn.addEventListener('click', () => {
            const parseDataUrl = chrome.runtime.getURL('parse-data.html');
            chrome.tabs.create({ url: parseDataUrl });
        });
    }

    // Handle Insert Data button
    const insertBtn = document.getElementById('insertBtn');
    const clearBtn = document.getElementById('clearBtn');
    if (insertBtn) {
        insertBtn.addEventListener('click', async () => {
            //handleInsertDataBtnClick();
            const ticketTypeSelect = document.getElementById('tkt_option');
            const inputTextarea = document.getElementById('inputAreaField');
            const quantityField = document.getElementById('qty_option');
            const scriptVersionField = document.getElementById('script_version');
            const target1D2DField = document.getElementById('1D2D_target');

            const ticketType = ticketTypeSelect.value;
            const inputData = inputTextarea.value.trim();
            const quantity = parseInt(quantityField.value) || 1;
            const scriptVersion = scriptVersionField.value;
            const target1D2D = target1D2DField.value;
            // Validation
            if (ticketType === 'select') {
                alert('Please select a ticket type');
                return;
            }

            if (!inputData) {
                alert('Please enter data in the input field');
                return;
            }

            // Display the details
            const ticketTypeLabel = ticketTypeSelect.options[ticketTypeSelect.selectedIndex].text;
            const details = `Ticket Type: ${ticketTypeLabel}\n\nInput Data:\n${inputData}\n\nQuantity: ${quantity}\nEntry Type: ${scriptVersion}`;

            console.log('Insert Data Details:', {
                ticketType: ticketType,
                ticketTypeLabel: ticketTypeLabel,
                inputData: inputData,
                quantity: quantity,
                scriptVersion: scriptVersion,
                target1D2D: target1D2D
            });

            // Display in alert (you can replace this with your own UI)

            getCurrentTab().then(tab => {
                console.log("Current Tab ID is:", tab.id);
                chrome.tabs.sendMessage(tab.id, {
                    action: 'insertData',
                    ticketType: ticketType,
                    inputData: inputData,
                    quantity: quantity,
                    scriptVersion: scriptVersion,
                    target1D2D: target1D2D,
                    showData: document.getElementById('showDataChkbox').checked ? true : false
                }, (response) => {
                    console.log('Response from content script:', response);
                });
            });

        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            const tab = await getCurrentTab();
            getCurrentTab().then(tab => {
                console.log("Current Tab ID is:", tab.id);
                chrome.tabs.sendMessage(tab.id, {
                    action: 'clearData'
                }, (response) => {
                    console.log('Response from content script:', response);
                });
            });
        });
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;

        const currentUrl = tabs[0].url;
        const url = new URL(currentUrl);
        const hostname = url.hostname.replace('www.', '');

        const isAllowed = allowedDomains.some(domain =>
            hostname === domain || hostname.endsWith('.' + domain)
        );

        if (isAllowed) {
            statusEl.className = 'status active';
            statusEl.textContent = '✓ Extension Active';
        } else {
            statusEl.className = 'status inactive';
            statusEl.textContent = '✗ Not on an allowed website';
        }

        // set default ticket type based on last part of url
        
        tktOptionDefault = '1d_tkt';
        if (currentUrl.includes('/2dticket')) {
            tktOptionDefault = '2d_tkt';
        } else if (currentUrl.endsWith('/3dticket')) {
            tktOptionDefault = '3d_tkt';
        } else if (currentUrl.endsWith('/3dbox')) {
            tktOptionDefault = '3d_box';
        } else if (currentUrl.endsWith('/4dticket')) {
            tktOptionDefault = '4d_tkt';
        } else if (currentUrl.endsWith('/4dbox')) {
            tktOptionDefault = '4d_box';
        } else if (currentUrl.endsWith('/5dticket')) {
            tktOptionDefault = '5d_tkt';
        }
        const ticketTypeSelect = document.getElementById('tkt_option');
        if (ticketTypeSelect) {
            ticketTypeSelect.value = tktOptionDefault;
        }
    });
});

async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    // Get current tab url
    // tabs is an array, but since currentWindow: true and active: true, it will have only one entry
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

// Tab switching functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Activate selected button
    const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }

    // Save active tab to storage
    chrome.storage.local.set({ activeTab: tabName });
}

