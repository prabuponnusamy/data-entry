chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openAndFill") {
        
        chrome.tabs.create({
            url: message.url
        }, function(tab) {

            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: fillData,
                        args: [message.payload, message.target]
                    });
                }
            });
        });
    }
});

function fillData(data, target) {
    const rows = data.split("\n");
    //alert("Data received in content script for target: " + target + "\nData:\n" + data);
    insertDataIntoFields(rows, target, false);
}