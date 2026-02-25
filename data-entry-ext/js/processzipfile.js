
/*
    Read the zip file from input element and parse the data
    Once read clean local dir.
    extract zip file to chrome extension local dir
    Identify all txt files in the extracted dir
    Read each txt file and place in the inputData textarea
    Extract images and save them to appropriate location based on OS
*/
function parseZipFile(event) {
    imageMap.clear();
    const file = document.getElementById('zipInput').files[0];
    // Show extension dir name
    console.log('Selected zip file:', file.name);
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            JSZip.loadAsync(arrayBuffer).then(function (zip) {
                let allTextPromises = [];
                let imageFiles = [];

                zip.forEach(function (relativePath, zipEntry) {
                    if (zipEntry.name.endsWith('.txt')) {
                        const textPromise = zipEntry.async('string').then(function (fileData) {
                            return fileData;
                        });
                        allTextPromises.push(textPromise);
                    } else if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(zipEntry.name)) {
                        // Collect image files
                        imageFiles.push({
                            name: zipEntry.name,
                            zipEntry: zipEntry
                        });
                        const imagePromise = zipEntry.async("blob").then(function (blob) {
                            const url = URL.createObjectURL(blob);
                            imageMap.set(zipEntry.name.toUpperCase(), url);

                            // convert for OCR
                            blobToBase64(blob).then(function (base64) {
                                visionRequests.set(zipEntry.name.toUpperCase(), {
                                    image: { content: base64 },
                                    features: [{ type: "TEXT_DETECTION" }]
                                });
                                // requestMeta.push(zipEntry.name);
                            }).catch(function (error) {
                                console.error('Error converting blob to base64:', error);
                            });
                        });
                        allTextPromises.push(imagePromise);
                    }
                });

                // Extract and save images
                //extractAndSaveImages(imageFiles);

                Promise.all(allTextPromises).then(function (allTexts) {
                    //imageToTextRequest();
                    document.getElementById('inputData').value = allTexts.join('\n');
                    // Save the input in the local storage
                    localStorage.setItem('inputData', document.getElementById('inputData').value);
                    //localStorage.setItem('imageMap', JSON.stringify(Array.from(imageMap.entries())));
                    //localStorage.setItem('visionRequests', JSON.stringify(Array.from(visionRequests.entries())));
                    parseMessages();
                    generateTable();
                    generateFinalOutput();
                });
            });
        };
        reader.readAsArrayBuffer(file);
    }
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

