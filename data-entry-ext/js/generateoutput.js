
function renderFinalOutput(messageGroup, message, hasError) {
    // wait for 100 ms to render the table one by one
    // Read keys from messageGroup and generate final output - sort keys first
    const sortedKeys = Object.keys(messageGroup).sort();
    // Create table and insert textarea into table column - print lines of table
    imagePath = message.toUpperCase().replace('ATTACHMENT:', '').trim();
    const imageUrl = imageMap.get(imagePath);
    //console.log('Looking for image with key:', imagePath);
    //console.log('Available images in map:', Array.from(imageMap.keys()));
    //console.log('Found image URL:', imageUrl);

    // Build image HTML with fallback if image not found
    const imgHtml = imageUrl ? `<img src="${imageUrl}" alt="${message}" style="max-width: 200px; margin-top: 10px;">` : `<div style="color: #999; padding: 10px; background: #f5f5f5; border-radius: 4px; max-width: 200px; margin-top: 10px;">Image not found</div>`;
    var table = `<h3>${message}</h3>${imgHtml}<table>
            <tbody><tr>`;
    var idx = 0;
    var allowedListSize = 40;
   
    sortedKeys.forEach(function (key, index) {
        const values = messageGroup[key];
        let output = '';
        var lists = [];
        // first value 
        const firstValue = values[0] || '';
        firstValueSplits = firstValue.split(',');
        var isOneD, isTwoD, isThreeD, isFourD, isFiveD;
        if (firstValueSplits[0].length == 1) {
            allowedListSize = parseInt(document.getElementById('1dRecordLimit').value) || 50;
            isOneD = true;
        } else if (firstValueSplits[0].length == 2) {
            allowedListSize = parseInt(document.getElementById('2dRecordLimit').value) || 50;
            isTwoD = true;
        } else if (firstValueSplits[0].length == 3) {
            allowedListSize = parseInt(document.getElementById('3dRecordLimit').value) || 100;
            isThreeD = true;
        } else if (firstValueSplits[0].length == 4) {
            allowedListSize = parseInt(document.getElementById('4dRecordLimit').value) || 40;
            isFourD = true;
        } else if (firstValueSplits[0].length == 5) {
            allowedListSize = parseInt(document.getElementById('5dRecordLimit').value) || 40;
            isFiveD = true;
        }
        for (var slIdx = 0; slIdx < values.length; slIdx += allowedListSize) {
            lists.push(values.slice(slIdx, slIdx + allowedListSize));
        }
        lists.forEach((sublist, sublistIdx) => {
            idx++;
            if (idx % 6 === 0 && idx !== 0) {
                table += `</tr><tr>`;
            }
            //🎉 ${match.join(', ')} 🎉
            var match = [];
            sublist.forEach(line => {
                var matches = getWinningNumberMatchFromOutputLine(key.substring(0, 5), line);
                if (matches.length > 0) {
                    match.push(...matches);
                }
            });
            // create new text area dont show buttons if has error 
            table += `<td>
                    <div class="info-text">${key} - ${sublistIdx + 1}) ${sublist.length}/${values.length} entries</div>
                    ${match.length > 0 ? match.map(m => `<span class="lottery-winning-number">🎉 ${m} 🎉</span><br/>`).join('') : ''}
                    <div>
                        ${hasError ? '' : `<button class="fill-btn" data-action="fill" data-target="${key.substring(0, 5)}" style="margin-bottom: 5px; padding: 4px 8px; font-size: 12px;">Fill</button>
                        <button class="copy-btn" data-action="copy" style="margin-bottom: 5px; padding: 4px 8px; font-size: 12px;">Copy</button>`}
                        <textarea name="formatted-output" class="output-textarea" placeholder="Formatted output..." rows="20">${sublist.join('\n')}</textarea>
                    </div>
                    </td>`;
        });
    });
    table += `</tr></tbody></table>`;
    // Append to finalOutputContent div
    document.getElementById('finalOutputContent').innerHTML += table;
}


function getWinningNumberMatchFromOutputLine(key, value) {
    const values = value.split(',');
    if (values.length >= 3) {
        var val = values[0].trim();
        var target = values[2].trim();
        //{ "1D_A": A, "1D_B": B, "1D_C": C, "2D_AB": AB, "2D_AC": AC, "2D_BC": BC, "3D": last3, "4D": last4, "5D": last5 };
        return getWinningNumberMatch(key, val, target);
    }
    return [];
}

function generateFinalOutput() {
    const formattedMessages = document.querySelectorAll('.formatted-msg');
    // checkbox selected or not
    // empty the div tag finalOutputContent
    document.getElementById('finalOutputContent').innerHTML = '';

    amountMappingTxt = document.getElementById('amountMapping').value;
    amountMappingLines = amountMappingTxt.split(',').filter(line => line.trim() !== '');
    const amountMapping = new Object();
    amountMappingLines.forEach(line => {
        splits = line.split('=');
        if (splits.length >= 2) {
            key = splits[0].trim();
            value = splits[1].trim();
            amountMapping[key] = value;
        }
    });
    messageGroup = new Object();
    label = 'First';

    errorMessages = [];
    var totalRecords = 0;
    var keys = [];
    formattedMessages.forEach((textarea, index) => {
        const content = textarea.value.trim();
        // split content by new line and store
        values = content.split('\n').filter(line => line.replaceAll('"', '').trim() !== '');
        totalRecords += values.length;
        values.forEach(line => {
            if (line.includes(FAILED_TO_PARSE)) {
                errorMessages.push('Failed to parse: ' + line + ', <a href="#original-msg-' + (index) + '" class="error-link">Go to message #' + (index + 1) + '</a>');
                // set color to red for textarea
                textarea.classList.add('error-output');
                // Add a attribute data-error to textarea
                textarea.setAttribute('data-error', 'true');
                return;
            }
            valueSplits = line.split(',');
            // when value 1 is not number
            if (valueSplits.length < 3) {
                Object.keys(messageGroup).forEach(key => keys.push(key));
                renderFinalOutput(messageGroup, label, errorMessages.length > 0);
                label = line;
                messageGroup = new Object();
                return;
            }


            if (valueSplits.length < 5) {
                //alert('Each line must have exactly 4 commas: ' + line);
                return;
            }

            targetValue = valueSplits[4]; // number as value
            if (targetValue == 'AB-AC-BC' || targetValue == 'A-B-C' || targetValue == 'ALL' || targetValue == 'ABC') {
                targetValue = 'ALL';
            }

            key = valueSplits[0] + valueSplits[3]; // number as key
            if (amountMapping[key]) {
                key = amountMapping[key];
            }
            switch (valueSplits[0].charAt(0)) {
                case '1':
                    if (valueSplits[1].length != 1) {
                        errorMessages.push('1D Ticket number length should be 1 digit only: ' + valueSplits[1] + ', <a href="#original-msg-' + (index) + '">Go to message #' + (index + 1) + '</a>');
                        // set color to red for textarea
                        textarea.classList.add('error-output');
                        // Add a attribute data-error to textarea
                        textarea.setAttribute('data-error', 'true');
                        // Set id to textarea
                    }
                    if (valueSplits[4] == '') {
                        errorMessages.push('Target (Last value) must not be empty for: ' + line + ', <a href="#original-msg-' + (index) + '">Go to message #' + (index + 1) + '</a>');
                        // set color to red for textarea
                        textarea.classList.add('error-output');
                        // Add a attribute data-error to textarea
                        textarea.setAttribute('data-error', 'true');
                        // Set id to textarea
                    }
                    break;
                case '2':
                    if (valueSplits[1].length != 2) {
                        errorMessages.push('2D Ticket number length should be 2 digits only: ' + valueSplits[1] + ', <a href="#original-msg-' + (index) + '">Go to message #' + (index + 1) + '</a>');
                        // set color to red for textarea
                        textarea.classList.add('error-output');
                        // Add a attribute data-error to textarea
                        textarea.setAttribute('data-error', 'true');
                        // Set id to textarea
                    }
                    if (valueSplits[4] == '') {
                        errorMessages.push('Target (Last value) must not be empty for: ' + line + ', <a href="#original-msg-' + (index) + '">Go to message #' + (index + 1) + '</a>');
                        // set color to red for textarea
                        textarea.classList.add('error-output');
                        // Add a attribute data-error to textarea
                        textarea.setAttribute('data-error', 'true');
                        // Set id to textarea
                    }
                    break;
                case '3':
                    if (valueSplits[1].length != 3) {
                        errorMessages.push('3D Ticket number length should be 3 digits only: ' + valueSplits[1] + ', <a href="#original-msg-' + (index) + '">Go to message #' + (index + 1) + '</a>');
                        // set color to red for textarea
                        textarea.classList.add('error-output');
                        // Add a attribute data-error to textarea
                        textarea.setAttribute('data-error', 'true');
                    }
                    break;
                case '4':
                    if (valueSplits[1].length != 4) {
                        errorMessages.push('4D Ticket number length should be 4 digits only: ' + valueSplits[1] + ', <a href="#original-msg-' + (index) + '">Go to message #' + (index + 1) + '</a>');
                        // set color to red for textarea
                        textarea.classList.add('error-output');
                        // Add a attribute data-error to textarea
                        textarea.setAttribute('data-error', 'true');
                    }
                    break;
                case '5':
                    if (valueSplits[1].length != 5) {
                        errorMessages.push('5D Ticket number length should be 5 digits only: ' + valueSplits[1] + ', <a href="#original-msg-' + (index) + '">Go to message #' + (index + 1) + '</a>');
                        // set color to red for textarea
                        textarea.classList.add('error-output');
                        // Add a attribute data-error to textarea
                        textarea.setAttribute('data-error', 'true');
                    }
                    break;
            }

            if (valueSplits[2] === '') {
                //alert('Quantity is missing for line: ' + line);
                errorMessages.push('Quantity is missing for line: ' + line);
                // set color to red for textarea
                textarea.classList.add('error-output');
                // Add a attribute data-error to textarea
                textarea.setAttribute('data-error', 'true');
            }

            l = valueSplits[1] + ',' + valueSplits[2] + ',' + targetValue;
            if (messageGroup[key]) {
                messageGroup[key].push(l);
            } else {
                messageGroup[key] = [l];
            }
        });
    });
    Object.keys(messageGroup).forEach(key => keys.push(key));
    renderFinalOutput(messageGroup, label, errorMessages.length > 0);
    // remove duplicate keys from keys array
    keys = [...new Set(keys)];
    keys.sort();
    document.getElementById('available-amount-keys').innerHTML = '<b>Available keys for amount mapping: </b><i>' + keys.join(' , ') + '</i>';
    if (errorMessages.length > 0) {
        // Add total records as first message
        errorMessages.unshift('Total records: ' + totalRecords + '. Please fix the following errors:');
        showErrorMessages(errorMessages);
    } else {
        showSuccessMessages(['Total records: ' + totalRecords + '. Final output generated successfully!']);
    }

}
