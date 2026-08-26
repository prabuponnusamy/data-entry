
/*
    OCR for the ticket images that came out of the WhatsApp zip.

    Two engines:
      - local  : Tesseract.js, bundled in js/vendor/tesseract, runs in this
                 browser. No key, no upload - the default.
      - vision : Google Cloud Vision, needs the API key field filled in.

    Both end up producing the same thing: the recognised words, grouped into
    columns by js/v3/ocr-words.js, dropped into a textarea under the button.
*/

const OCR_ENGINE_FIELD_ID = 'ocrEngine';

function getSelectedOcrEngine() {
    const field = document.getElementById(OCR_ENGINE_FIELD_ID);
    return field ? field.value : 'local';
}

/** Entry point for the "Extract Text" buttons in the validate table. */
async function imageToTextRequest(imageName, thisButton) {
    if (getSelectedOcrEngine() === 'vision') {
        return imageToTextWithVision(imageName, thisButton);
    }
    return imageToTextWithTesseract(imageName, thisButton);
}

/** Local OCR - zooms and re-inks the image first, then reads it. */
async function imageToTextWithTesseract(imageName, thisButton) {
    const imageUrl = imageMap.get(imageName);
    if (!imageUrl) {
        showErrorMessages(['Image not found for OCR: ' + imageName]);
        return '';
    }

    const originalLabel = thisButton ? thisButton.textContent : '';
    if (thisButton) {
        thisButton.disabled = true;
        thisButton.textContent = 'Reading...';
    }

    try {
        const result = await runLocalOcr(imageUrl, {}, (m) => {
            if (thisButton && m && m.status === 'recognizing text') {
                thisButton.textContent = `Reading ${(m.progress * 100).toFixed(0)}%`;
            }
        });
        const values = groupWordsIntoColumns(result.words);
        console.log('Extracted text for image', imageName,
            `(confidence ${result.confidence.toFixed(1)}%):`, values.join('\n'));
        showExtractedText(thisButton, values, `local OCR - ${result.confidence.toFixed(0)}% confidence`);
        return result.text;
    } catch (err) {
        console.error('Local OCR failed:', err);
        showErrorMessages(['Local OCR failed: ' + (err && err.message ? err.message : err)]);
        return '';
    } finally {
        if (thisButton) {
            thisButton.disabled = false;
            thisButton.textContent = originalLabel || 'Extract Text';
        }
    }
}

/** Google Vision OCR - kept as a fallback for images the local engine struggles with. */
async function imageToTextWithVision(imageName, thisButton) {
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
    const page = data.responses?.[0]?.fullTextAnnotation?.pages?.[0];
    const words = page ? extractWords(page) : [];
    console.log('Extracted text for image', imageName, ':', words.join('\n'));
    showExtractedText(thisButton, words, 'Google Vision');
    return text;
}

/** Drops (or refreshes) the textarea that sits under the Extract Text button. */
function showExtractedText(thisButton, values, sourceLabel) {
    if (!thisButton) return;
    let textarea = thisButton.nextElementSibling;
    if (!textarea || !textarea.classList.contains('extracted-text')) {
        textarea = document.createElement('textarea');
        textarea.className = 'extracted-text';
        textarea.rows = 5;
        thisButton.insertAdjacentElement('afterend', textarea);
    }
    textarea.title = sourceLabel || '';
    textarea.value = ":\n" + values.join('\n');
}
