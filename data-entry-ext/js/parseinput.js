
// map to store image name and url
var imageMap = new Map();
var visionRequests = new Map();

var headerLineMatchRegex = /^(\[\s*)?\d{2}\/\d{2}\/\d{2,4},\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)\s*(\]?\s*[-~]\s*.+?:)/;
/**
 * Extracts message groups from raw WhatsApp export
 * Groups are separated by timestamp lines containing ":"
 */
function getMessageGroups() {
    const inputData = document.getElementById(INPUT_FIELD_ID).value.replace(
        /(\d+)\s*\r?\n\s*To\s*\r?\n\s*(\d+)/g,
        "$1 To $2"
    );
    const lines = inputData.split('\n').filter(line => line.trim() !== '');
    let messageGroup = [];
    let message = [];
    lines.forEach(line => {
        // Matches regex \[.*: then replace that with empty string and add --- at the end
        if (line.match(headerLineMatchRegex) || line.includes(':')) {
            if (message.length > 0) {
                messageGroup.push(message);
            }
            message = [];
        }
        message.push(line);
    });
    if (message.length > 0) {
        messageGroup.push(message);
    }
    return messageGroup;
}

function cleanupLine(line) {
    // replace all non a-z and A-Z and 0-9 which is prefix and suffix with empty string
    if (!line || line === '') return line;
    try {
        line = line.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
    } catch (e) {
        console.error(e);
        // Handle any errors that might occur during replacement
    }
    return line;
}


function parseMessages() {
    // clear map before parsing
    var groups = getMessageGroups();
    //showFailedParsing = document.getElementById('showFailedParsing').checked;

    var parsedData = [];
    var groupedOutLines = [];
    groupsUpdated = [];
    groups.forEach((msg, index) => {
        lines = [];
        replace = {};
        msg.forEach((line, index) => {
            if (line === '') return;
            line = plainTextNormalize(line);
            line.split('\n').map(l => l.trim()).forEach(l => {
                lines.push(l.trim());
            });
        });
        groupsUpdated.push(lines);
    });
    cleanedUpGrouped = [];
    groupsUpdated.forEach((groupLines, gindex) => {
        lines = [];
        groupLines.forEach((groupLine, index) => {

            groupLineUc = groupLine.trim().toUpperCase();
            if (groupLineUc == '') {
                return;
            }
            var cleanedMsg = {};
            lines.push(cleanedMsg);
            cleanedMsg['groupIndex'] = gindex;
            cleanedMsg['lineIndex'] = index;
            cleanedMsg['originalLine'] = groupLine;
            cleanedMsg['data'] = [];
            line = groupLineUc;

            line = line.replace('ATTACHED:', 'ATTACHED#');

            isMessageHeaderLine = line.match(/^(\[\s*)?\d{2}\/\d{2}\/\d{2,4},\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)\s*(\]?\s*[-~]\s*.+?:)/);
            if (isMessageHeaderLine) {
                line = line.replace(isMessageHeaderLine[0], '').trim();
            }
            // If line includes <attached: 00000047-PHOTO-2026-01-21-15-03-02.jpg> get image name
            if (line.includes('<ATTACHED#')) {
                const imageNameMatch = line.match(/<ATTACHED#\s*(.*?)>/);
                if (imageNameMatch) {
                    cleanedMsg['image'] = imageNameMatch[1];
                }
                return;
            }
            const imgMatch = line.includes(' (FILE ATTACHED)');
            if (imgMatch) {
                cleanedMsg['image'] = line.replace(' (FILE ATTACHED)', ' ').trim();
                return;
            }
            fixWords(line);

            replacements.forEach(item => {
                line = line.replace(item, "");
            });
            line = replaceUnwantedChars(line);
            line = splitTextAndNumbers(line);
            line = line.replace(/\bX\b/, '-');
            cleanedMsg['cleanedLine'] = line;
            const tokens = line.toUpperCase().match(/\b(?:ABAC|ABBC|ACBC|ABC|ALL|AB|AC|BC|A|B|C)\b/g);
            if (tokens) {
                const uniqueTokens = [...new Set(tokens)];
                // replace the tokens from line with empty using word boundary to avoid partial match and trim the line
                uniqueTokens.forEach(token => {
                    line = line.replace(new RegExp('\\b' + token + '\\b', 'g'), '').trim();
                });

                if (uniqueTokens.includes('ALL') && uniqueTokens.length > 1) {
                    // If ALL is present along with other tokens, remove ALL
                    const index = uniqueTokens.indexOf('ALL');
                    if (index > -1) {
                        uniqueTokens.splice(index, 1);
                    }
                }
                uniqueTokens.sort();
                const joinedTokens = uniqueTokens.join('-');
                targetVal = joinedTokens;
                if (joinedTokens === 'AB-AC-BC' || joinedTokens === 'A-B-C' || joinedTokens === 'ABC') {
                    targetVal = 'ALL';
                } else {
                    targetVal = targetVal.replace("ABAC", "AB-AC");
                    targetVal = targetVal.replace("ABBC", "AB-BC");
                    targetVal = targetVal.replace("ACBC", "AC-BC");
                }
                cleanedMsg['target'] = targetVal;
                if (line == '' && targetVal != '') {
                    lastTarget = targetVal;
                }
            }
            if (line == '') {
                return;
            }
            var cuttingWords = ['CUTTING', 'CUT'];
            for (i = 0; i < cuttingWords.length; i++) {
                if (line.includes(cuttingWords[i])) {
                    cleanedMsg['cut'] = true;
                    line = line.replace(cuttingWords[i], '').trim();
                }
            }
            if (line.includes('BOX')) {
                cleanedMsg['isBox'] = true;
                line = line.replace('BOX', ' ').trim();
            }
            if (line.includes('OFF')) {
                line = line.replace('OFF', ' ');
                line = line.trim();
                cleanedMsg['isOff'] = true;
            }
            if (line.includes('FULL') || line.includes('FULLL')) {
                cleanedMsg['isFull'] = true;
                line = line.replace('FULLL', ' ').replace('FULL', ' ').trim();
            }
            line = cleanupLine(line.replace(/[^A-Z0-9#]+/g, '~')).trim();
            // If line matches RS.30 or RS30 or RS 30, replace space and hyphen with empty string
            const rsMatch = line.match(/\b(?:RS[^A-Za-z0-9]*(\d+))\b/i);
            if (rsMatch) {
                cleanedMsg['amount'] = rsMatch[1];
                line = line.replace(rsMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            } else {
                const rsSuffixMatch = line.match(/\b(\d+)[^A-Za-z0-9]*RS\b/i);
                if (rsSuffixMatch) {
                    cleanedMsg['amount'] = rsSuffixMatch[1];
                    line = line.replace(rsSuffixMatch[0], ' ').trim();
                    if (line === '') {
                        return;
                    }
                }
            }

            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            setMatch = line.match(/(EACH|ECH|ETC|E)+[^A-Za-z0-9]*(\d{1,5})[^A-Za-z0-9]*(SET|SETS|SAT|SAF|ST|CH|CHANCE|E|S|P)+/);
            if (setMatch) {
                cleanedMsg['qty'] = setMatch[2];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }

            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            setMatch = line.match(/(EACH|ECH|ETC|SET|E|S)+[^A-Za-z0-9]*(\d{1,5})[^A-Za-z0-9]*/);
            if (setMatch) {
                cleanedMsg['qty'] = setMatch[2];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }
            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            setMatch = line.match(/(\d{1,5})[^A-Za-z0-9]*(SET|SETS|SAT|SAF|ST|CH|CHANCE|E|S|P)+/);
            if (setMatch) {
                cleanedMsg['qty'] = setMatch[1];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }
            setMatch = line.match(/(\d{1,5})[^A-Za-z0-9]*(EACH|ECH|ETC|E|S)+/);
            if (setMatch) {
                cleanedMsg['qty'] = setMatch[1];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }
            if (cleanedMsg['qty']) {
                cleanedMsg['qtyVal'] = cleanedMsg['qty'];
            }

            line = cleanupLine(line);
            if (line == '') {
                return;
            }
            // If line matches 30-TO-50
            const toMatch = line.match(/^(\d{1,5})~?TO~?(\d{1,5})$/);
            if (toMatch) {
                //cleanedMsg['data'].push({ from: toMatch[1], to: toMatch[2] });
                vlen = toMatch[1].length;
                from = parseInt(toMatch[1]);
                to = parseInt(toMatch[2]);
                // format as vlen digit number with leading zeros
                const formatNumber = (num, length) => {
                    return num.toString().padStart(length, '0');
                };
                if (to - from < 10) {
                    // Increment 1 by 1 inclusive
                    for (let i = from; i <= to; i++) {
                        cleanedMsg['data'].push({ number: formatNumber(i, vlen) });
                    }
                } else if (to - from < 100) {
                    // Increment 5 by 5 inclusive
                    if ((to - from) % 10 === 0) {
                        for (let i = from; i <= to; i += 10) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen) });
                        }
                    } else {
                        for (let i = from; i <= to; i += 11) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen) });
                        }
                    }
                } else if (to - from < 1000) {
                    // Increment 100 by 100 inclusive
                    if ((to - from) % 100 === 0) {
                        for (let i = from; i <= to; i += 100) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen) });
                        }
                    } else {
                        for (let i = from; i <= to; i += 111) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen) });
                        }
                    }
                } else if (to - from < 10000) {
                    // Increment 100 by 100 inclusive
                    if ((to - from) % 1000 === 0) {
                        for (let i = from; i <= to; i += 1000) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen) });
                        }
                    } else {
                        for (let i = from; i <= to; i += 1111) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen) });
                        }
                    }
                }
                return;
            }
            // Check line matches AC-80-10
            var values = line.split('~');
            // check and values are numbers
            var allNumbers = values.every(val => /^\d+$/.test(val));
            //for (const match of line.matchAll(/\d+/g)) {                
            // cleanedMsg['data'].push({ number: match[0], qty: cleanedMsg['qty'] ? cleanedMsg['qty'] : null, target: cleanedMsg['target'] ? cleanedMsg['target'] : null });
            if (allNumbers && values.length > 0) {
                if (values.length == 2) {
                    if (cleanedMsg['qty'] && cleanedMsg['qty'] != '') {
                        cleanedMsg['data'].push({ number: values[0], qty: cleanedMsg['qty'], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        cleanedMsg['data'].push({ number: values[1], qty: cleanedMsg['qty'], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                    } else {
                        if (values[1].length != values[0].length) {
                            // If there are 2 values and length is different then consider first value as number and second value as qty
                            cleanedMsg['data'].push({ number: values[0], qty: values[1], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        } else if (values[1].length > 2) {
                            cleanedMsg['data'].push({ number: values[0], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                            cleanedMsg['data'].push({ number: values[1], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        } else {
                            cleanedMsg['data'].push({ number: values[0], qty: values[1], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    }
                } else {
                    // If all values are same length other than last one then last one as qty and all previous values as number
                    isAllValuesSameLength = values.every(val => val.length === values[0].length);
                    isAllValuesSameLengthOtherThanLast = values.slice(0, values.length - 1).every(val => val.length === values[0].length);
                    if (isAllValuesSameLength) {
                        values.forEach(value => {
                            cleanedMsg['data'].push({ number: value, qty: cleanedMsg['qty'] ? cleanedMsg['qty'] : null, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        });
                    } else if (isAllValuesSameLengthOtherThanLast) {
                        for (let i = 0; i < values.length - 1; i++) {
                            cleanedMsg['data'].push({ number: values[i], qty: values[values.length - 1], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    } else {
                        var skipNext = false;
                        for (let i = 0; i < values.length; i++) {
                            if (skipNext) {
                                skipNext = false;
                                continue;
                            }
                            if (values[i + 1] && values[i + 1].length === values[i].length) {
                                cleanedMsg['data'].push({ number: values[i], qty: cleanedMsg['qty'] ? cleanedMsg['qty'] : null, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                            } else {
                                skipNext = true;
                                cleanedMsg['data'].push({ number: values[i], qty: values[i + 1], target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                            }
                        }
                    }

                }
                if (cleanedMsg['qty']) {
                    cleanedMsg['qty'] = null; // reset qty after using for first number in the line
                }

                cleanedMsg['amount'] = null; // reset amount after using for first number in the line
                return;
            }

            // If could not parse the line
            cleanedMsg['nparsed'] = true;
        });
        //console.log(JSON.stringify(lines, null, 2));

        // Group data lines
        var cleanedUpGroupedLinesFirstLevel = groupCleanedUpDataFirstLevel(lines);
        var cleanedUpGroupedLines = groupCleanedUpDataSecondLevel(cleanedUpGroupedLinesFirstLevel);
        //console.log(JSON.stringify(cleanedUpGroupedLines, null, 2));
        //cleanedUpGrouped.push(cleanedUpGroupedLines);
        var outLines = [];
        cleanedUpGroupedLines.forEach((subgroup, sgIndex) => {
            var qty, isBox, isCut, isOff, amt, targetValue, attachment, nparsed;
            if (subgroup['beforeData'] && subgroup['beforeData'].length > 0) {
                subgroup['beforeData'].forEach(line => {
                    if (line['qty'] && line['qty'] != '') {
                        qty = line['qty'];
                    } if (line['isBox']) {
                        isBox = true;
                    } if (line['cut']) {
                        isCut = true;
                    } if (line['isOff']) {
                        isOff = true;
                    } if (line['amount']) {
                        amt = line['amount'];
                    } if (line['target']) {
                        targetValue = line['target'];
                    }
                    if (line['image']) {
                        attachment = line['image'];
                    }
                    if (line['nparsed']) {
                        nparsed = line;
                    }
                });
            }
            if (subgroup['afterData'] && subgroup['afterData'].length > 0) {
                subgroup['afterData'].forEach(line => {
                    if (line['qty'] && line['qty'] != '') {
                        qty = line['qty'];
                    } if (line['isBox']) {
                        isBox = true;
                    } if (line['cut']) {
                        isCut = true;
                    } if (line['isOff']) {
                        isOff = true;
                    } if (line['amount']) {
                        amt = line['amount'];
                    } if (line['target']) {
                        targetValue = line['target'];
                    }
                    if (line['image']) {
                        attachment = line['image'];
                    }
                    if (line['nparsed']) {
                        nparsed = line;
                    }
                });
            }
            if (attachment && attachment != '') {
                outLines.push(`attachment:${attachment}`);
                return;
            }
            if (nparsed) {
                outLines.push(`${FAILED_TO_PARSE}: ${nparsed['cleanedLine'] ? nparsed['cleanedLine'] : nparsed['originalLine']}`);
            }
            if (subgroup['data'].length == 0) {
                outLines.push(`${FAILED_TO_PARSE}`);
            }
            subgroup['data'].forEach(line => {
                if (line['data'] && line['data'].length > 0) {
                    line['data'].forEach(d => {
                        let qtyValueLocal = d['qty'] ? d['qty'] : (qty ? qty : '');
                        let amtValueLocal = (d['amount'] ? d['amount'] : (amt ? amt : '')) + (isOff || line['isOff'] ? ' OFF' : '');
                        let targetValueLocal = d['target'] ? d['target'] : (targetValue ? targetValue : '');
                        let finalBoxStatus = isBox || line['isBox'] ? true : false;
                        let finalCutStatus = isCut || line['cut'] ? true : false;
                        var dataLen = subgroup['dataLen'];
                        var n = d['number'];
                        if (dataLen == 1) {
                            if (targetValueLocal == 'ABC' || targetValueLocal == 'ALL') {
                                targetValueLocal = 'ALL';
                            } else {
                                // Take each char from targetValue and seperate by hyphen
                                targetValueLocal = targetValueLocal ? targetValueLocal.split('').filter(c => c !== '-').sort().join('-') : '';
                            }
                            /*if (finalBoxStatus) {
                                outLines.push(`1DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            } else */
                            if (finalCutStatus) {
                                outLines.push(`1DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            } else {
                                outLines.push(`1DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            }
                        } else if (dataLen == 2) {
                            if (targetValueLocal == 'ABC') {
                                targetValueLocal = 'ALL';
                            }
                            /*if (finalBoxStatus) {
                                outLines.push(`2DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            } else */
                            if (finalCutStatus) {
                                outLines.push(`2DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            } else {
                                outLines.push(`2DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            }
                        } else if (dataLen == 3) {
                            if (finalBoxStatus) {
                                outLines.push(`3DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else if (finalCutStatus) {
                                outLines.push(`3DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else {
                                outLines.push(`3DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            }
                        } else if (dataLen == 4) {
                            if (finalBoxStatus) {
                                outLines.push(`4DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else if (finalCutStatus) {
                                outLines.push(`4DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else {
                                outLines.push(`4DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            }
                        } else if (dataLen == 5) {
                            if (finalBoxStatus) {
                                outLines.push(`5DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else if (finalCutStatus) {
                                outLines.push(`5DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else {
                                outLines.push(`5DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            }
                        }
                    });
                }
            });

        });
        groupedOutLines.push(outLines.length > 0 ? outLines.join('\n') : '\n' + FAILED_TO_PARSE + '\n');
    });
    //console.log(JSON.stringify(parsedData, null, 2));
    document.getElementById('outputData').value = groupedOutLines.join('\n=-#-#-=\n');
    return groupedOutLines;
}

function groupCleanedUpDataFirstLevel(lines) {
    var cleanedUpGroupedLines = [];
    group = { "data": [], "beforeData": [], "afterData": [], "dataLen": 0 };
    cleanedUpGroupedLines.push(group);
    lines.forEach(line => {
        if (line.data && line.data.length > 0) {
            dataLen = (line['data'][0]['number']).length;
            if (group['dataLen'] > 0 && dataLen != group['dataLen']) {
                group = { "data": [], "beforeData": [], "afterData": [], "dataLen": dataLen };
                cleanedUpGroupedLines.push(group);
            }
            group['dataLen'] = dataLen;
            group['data'].push(line);
        } else if (group['data'].length == 0) {
            group['beforeData'].push(line);
        } else {
            // New array from group['afterData'] and assign to group['beforeData']
            group = { "data": [], "beforeData": [], "afterData": [], "dataLen": 0 };
            cleanedUpGroupedLines.push(group);
            group['beforeData'].push(line);
        }
    });
    return cleanedUpGroupedLines;
}

function groupCleanedUpDataSecondLevel(cleanedUpGroupedLinesFirstLevel) {
    var prevGroup;
    var cleanedUpGroupedLines = [];
    cleanedUpGroupedLinesFirstLevel.forEach(group => {
        if (prevGroup) {
            const isPrevGroupHasQty = prevGroup['beforeData'].some(line => line['qty'] && line['qty'] != '') || prevGroup['afterData'].some(line => line['qty'] && line['qty'] != '');
            if (group['data'].length == 0) {
                prevGroup['afterData'] = prevGroup['beforeData'].concat(group['beforeData']);
            } else {
                if (group['beforeData'].length > 0) {
                    var beforeData = [];
                    group['beforeData'].forEach(groupEntry => {
                        if ((groupEntry['qty'] && groupEntry['qty'] != '' && !isPrevGroupHasQty) || (groupEntry['isBox'] && group['dataLen'] && group['dataLen'] < 3)) {
                            prevGroup['afterData'].push(groupEntry);
                        } else if (groupEntry['isBox'] && group['dataLen'] && group['dataLen'] < 3) {
                            prevGroup['afterData'].push(groupEntry);
                        } else {
                            beforeData.push(groupEntry);
                        }
                    });
                    group['beforeData'] = beforeData;
                }
                cleanedUpGroupedLines.push(group);
            }
        } else {
            cleanedUpGroupedLines.push(group);
        }
        prevGroup = group;
    });
    cleanedUpGroupedLines.forEach(group => {
        var groupQty;
        if (group['beforeData'] && group['beforeData'].length > 0) {
            group['beforeData'].forEach(line => {
                if (line['qty'] && line['qty'] != '') {
                    groupQty = line['qty'];
                }
            });
        }
        if (group['afterData'] && group['afterData'].length > 0) {
            group['afterData'].forEach(line => {
                if (line['qty'] && line['qty'] != '') {
                    groupQty = line['qty'];
                }
            });
        }
        if (groupQty && groupQty != '') {
            group['data'].forEach(dataLine => {
                if (dataLine['data'] && dataLine['data'].length == 1) {
                    var firstDataLine = dataLine['data'][0];
                    if (firstDataLine['qty'] && firstDataLine['qty'].length == firstDataLine['number'].length) {
                        dataLine['data'].push({ number: firstDataLine['qty'], qty: groupQty, target: firstDataLine['target'] ? firstDataLine['target'] : null, amount: firstDataLine['amount'] ? firstDataLine['amount'] : null });
                        firstDataLine['qty'] = groupQty;
                    } else {
                        //dataLine['data'][0]['qty'] = groupQty;
                    }
                }
            });
        }
    });
    return cleanedUpGroupedLines;
}

/**
 * Generates final CSV output from parsed data
 */
function generateOutput(lines, groupedOutLines, isBox) {
    let outLines = [];
    let targetValue = '';
    let amountValue = '';
    let qtyValue = null;

    lines.forEach((line) => {
        if (line.image) {
            outLines.push(`attachment:${line.image}`);
            return;
        }

        if (line.amount) amountValue = line.amount;
        if (line.target) targetValue = line.target;
        if (line.qty) qtyValue = line.qty;

        if (line.data && line.data.length > 0) {
            line.data.forEach(item => {
                const num = item.number || '';
                const qty = item.qty || qtyValue || '1';
                const target = item.target || targetValue || '';
                const amount = line.amount || amountValue || '';

                if (!num) return;

                const ticketType = getTicketType(num.length, isBox, line.cut);
                outLines.push(`${ticketType},${num},${qty},${amount},${target}`);
            });
        }
    });

    groupedOutLines.push(outLines.length > 0 ? outLines.join('\n') : `\n${FAILED_TO_PARSE}\n`);
}

/**
 * Determines ticket type based on number length
 */
function getTicketType(numLen, isBox, isCut) {
    const type = ['', '1D', '2D', '3D', '4D', '5D'][numLen] || '1D';
    const suffix = isBox ? 'Box' : (isCut ? 'Cut' : 'Tkt');
    return type + suffix;
}


function extractWords(page) {
    const words = [];
    page.blocks.forEach(block => {
        block.paragraphs.forEach(p => {
            p.words.forEach(w => {
                const text = w.symbols.map(s => s.text).join('');
                const x = w.boundingBox.vertices[0].x || 0;
                const y = w.boundingBox.vertices[0].y || 0;
                words.push({ text, x, y });
            });
        });
    });
    words.sort((a, b) => a.x - b.x);

    const columns = [];
    const threshold = 100; // tweak

    words.forEach(w => {
        let col = columns.find(c =>
            Math.abs(c.x - w.x) < threshold);

        if (!col) {
            col = { x: w.x, items: [] };
            columns.push(col);
        }

        col.items.push(w);
    });
    var values = [];
    columns.forEach(col => {

        col.items.sort((a, b) => a.y - b.y);

        //console.log("COLUMN");
        col.items.forEach(i => values.push(i.text));
    });


    return values;
}
