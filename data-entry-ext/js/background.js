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
                        args: [message.payload, message.target, message.supplierValueLabel, message.targetTkt]
                    });
                }
            });
        });
    }
});

function fillData(data, target, supplierValueLabel, targetTkt) {
    const rows = data.split("\n");
    // alert("Data received in content script for target: " + target + "\nData:\n" + data);
    //alert(targetTkt);
    insertDataIntoFields(rows, target, false, supplierValueLabel, targetTkt);
}