
/*
    Read the zip file from input element and parse the data
    Once read clean local dir.
    extract zip file to chrome extension local dir
    Identify all txt files in the extracted dir
    Read each txt file and place in the inputData textarea
    Extract images and save them to appropriate location based on OS
*/
// Shows which zip the data in the textareas came from, and remembers it so the
// name is still there after a reload.
function setZipFileName(name) {
    const label = document.getElementById(ZIP_FILE_NAME_FIELD_ID);
    if (label) {
        label.textContent = name ? 'Zip file: ' + name : '';
        label.title = name || '';
    }
    const label1 = document.getElementById(ZIP_FILE_NAME_FIELD_ID + "1");
    if (label1) {
        label1.textContent = name ? 'Zip file: ' + name : '';
        label1.title = name || '';
    }
    const label2 = document.getElementById(ZIP_FILE_NAME_FIELD_ID + "2");
    if (label2) {
        label2.textContent = name ? 'Zip file: ' + name : '';
        label2.title = name || '';
    }
}

// Restores the name saved by the last processed zip.
function restoreZipFileName() {
    setZipFileName(localStorage.getItem(ZIP_FILE_NAME_FIELD_ID) || '');
}

// Finder adds a __MACOSX/ folder and "._name" resource forks to zips made on a
// Mac. They carry the real files' extensions but hold no chat text or image.
function isJunkZipEntry(path) {
    return /(^|\/)__MACOSX\//.test(path) || /(^|\/)\._/.test(path);
}

// Audio an export can carry, as the type an <audio> element plays it as.
// WhatsApp voice notes are .opus: Opus in an Ogg container.
const AUDIO_MIME_TYPES = {
    opus: 'audio/ogg', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav'
};

function audioMimeType(name) {
    return name.includes('.') ? AUDIO_MIME_TYPES[name.split('.').pop().toLowerCase()] || '' : '';
}

function isAudioAttachment(name) {
    return audioMimeType(name) !== '';
}

// An attachment found in the zip: a player for audio, the picture otherwise.
function attachmentMediaHtml(name, url, alt) {
    if (isAudioAttachment(name)) {
        return `<audio controls preload="metadata" src="${url}" title="${alt}" style="width: 240px; margin-top: 10px;"></audio>`;
    }
    return `<img src="${url}" alt="${alt}" style="max-width: 200px; margin-top: 10px;">`;
}

/**
 * The chat text and attachments in one WhatsApp export zip. `images` holds
 * every attachment shown on the page - pictures and audio (`audio: true`) -
 * each with its object URL made here, once, so showing the same zip again
 * does not make another.
 */
function readZipExport(zip) {
    const texts = [];
    const images = [];
    zip.forEach(function (relativePath, zipEntry) {
        if (zipEntry.dir || isJunkZipEntry(relativePath)) return;
        if (zipEntry.name.endsWith('.txt')) {
            texts.push(zipEntry.async('string'));
        } else if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(zipEntry.name) || isAudioAttachment(zipEntry.name)) {
            images.push(zipEntry.async('blob').then(function (blob) {
                const audio = isAudioAttachment(zipEntry.name);
                // Zip entries come out untyped; the player needs the format.
                const typed = audio ? new Blob([blob], { type: audioMimeType(zipEntry.name) }) : blob;
                return { name: zipEntry.name.toUpperCase(), blob: typed, url: URL.createObjectURL(typed), audio: audio };
            }));
        }
    });
    return Promise.all([Promise.all(texts), Promise.all(images)]).then(function ([textValues, imageValues]) {
        return { texts: textValues, images: imageValues };
    });
}

// Points the image lookups at one zip's images, and converts them for OCR.
function useZipImages(images) {
    imageMap.clear();
    visionRequests.clear();
    images.forEach(function (image) {
        imageMap.set(image.name, image.url);
        // OCR reads text off pictures only.
        if (image.audio) return;
        blobToBase64(image.blob).then(function (base64) {
            visionRequests.set(image.name, {
                image: { content: base64 },
                features: [{ type: "TEXT_DETECTION" }]
            });
        }).catch(function (error) {
            console.error('Error converting blob to base64:', error);
        });
    });
}

// Puts one zip's content through the page: input, validation and final output.
function showZipExport(name, contents) {
    useZipImages(contents.images);
    resetEntryDate();
    document.getElementById('inputData').value = contents.texts.join('\n');
    // Save the input in the local storage
    localStorage.setItem('inputData', document.getElementById('inputData').value);
    // Keep the zip name alongside the content it produced
    localStorage.setItem(ZIP_FILE_NAME_FIELD_ID, name);
    setZipFileName(name);
    parseMessages();
    generateTable();
    generateFinalOutput();
}

function parseZipFile(event) {
    const file = document.getElementById('zipInput').files[0];
    if (!file) return;
    console.log('Selected zip file:', file.name);
    file.arrayBuffer()
        .then(buffer => JSZip.loadAsync(buffer))
        .then(readZipExport)
        .then(contents => showZipExport(file.name, contents))
        .catch(error => {
            console.error('Error reading zip file:', error);
            showErrorMessages(['Could not read ' + file.name + ': ' + error.message]);
        });
}

/**
 * Extract images from zip and save to appropriate location based on OS
 * Windows: D:/data-entry
 * Mac: ~/Downloads
 */
function extractAndSaveImages(imageFiles) {
    if (imageFiles.length === 0) {
        console.log('No images found in zip file');
        return;
    }

    // Detect OS
    const isWindows = navigator.platform.indexOf('Win') > -1;
    const isMac = navigator.platform.indexOf('Mac') > -1;

    //console.log('Detected OS - Windows:', isWindows, 'Mac:', isMac);
    //console.log('Found', imageFiles.length, 'images to extract');

    // Process each image
    imageFiles.forEach(function (imageFile) {
        imageFile.zipEntry.async('blob').then(function (blob) {
            // Create a download link for the image
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Determine filename (get just the filename without path)
            const filename = imageFile.name.split('/').pop();
            link.download = filename;

            // Append to body and trigger download
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            //console.log('Downloaded image:', filename);
        });
    });

    // Inform user about image extraction
    alert(`Found ${imageFiles.length} image(s). They have been downloaded to your Downloads folder.\n\nNote: Browser cannot directly save to specific folders. Please save them to:\n${isWindows ? 'D:\\data-entry' : '~/Downloads'} manually if needed.`);
}


function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
            resolve(reader.result.split(',')[1]);
        };

        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

