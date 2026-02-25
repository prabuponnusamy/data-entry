
function imageToTextRequest() {
    if (visionRequests.length > 0) {
        console.log('Sending OCR requests for images:', visionRequests);
        const body = { requests: visionRequests };
        const googleVisionApiKey = document.getElementById('googleVisionApiKey').value || '';
        if (!googleVisionApiKey) {
            console.error('Google Vision API key missing');
            alert('Google Vision API key is required for OCR functionality. Please enter the API key and try again.');
            return;
        }

        const response = fetch(
            "https://vision.googleapis.com/v1/images:annotate?key=" + googleVisionApiKey,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }
        ).then(response => {
            response.json().then(data => {
                //console.log('OCR Response:', data);
                data.responses.forEach((res, index) => {
                    const text = res.fullTextAnnotation?.text || '';
                    console.log('Extracted text for image', requestMeta[index], ':', text);
                });
            });
        });
    }
}

async function imageToTextRequest(imageName, thisButton) {
    if (!visionRequests.get(imageName)) {
        return '';
    }
    const googleVisionApiKey = document.getElementById('googleVisionApiKey').value || '';
    if (!googleVisionApiKey) {
        console.error('Google Vision API key missing');
        alert('Google Vision API key is required for OCR functionality. Please enter the API key and try again.');
        return '';
    }
    const body = {
        requests: [visionRequests.get(imageName)]
    };
    const response = await fetch(
        "https://vision.googleapis.com/v1/images:annotate?key=" + googleVisionApiKey,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }
    );
    const data = await response.json();
    const text = data.responses?.[0]?.fullTextAnnotation?.text || '';
    const words = extractWords(data.responses[0].fullTextAnnotation.pages[0]);
    console.log('Extracted text for image', imageName, ':', words.join('\n'));
    if (thisButton) {
        // create new textarea and append after this button with extracted text
        const textarea = document.createElement('textarea');
        textarea.className = 'extracted-text';
        textarea.rows = 5;
        textarea.value = ":\n" + words.join('\n');
        thisButton.insertAdjacentElement('afterend', textarea);
    }
}

