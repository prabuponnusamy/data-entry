
function processInput() {
    resetInput();
    parseMessages();
    generateTable();
    generateFinalOutput();
}

function resetInput() {
    // Reset url
    document.getElementById('websiteBaseUrlSelect').selectedIndex = 0;
    document.getElementById('websiteBaseUrlInput').value = '';
}
