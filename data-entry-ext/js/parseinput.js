
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
    var english_words = ["TICKET", "BOARD", "EACH", "DEAR", "SET", "BOX", "ALL", "CH"].sort((a, b) => b.length - a.length);

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
            // Fix spell mistakes in line
            var foundMatch = false;
            line.split(' ').forEach(word => {
                foundMatch = false;
                english_words.forEach(engWord => {
                    if (foundMatch) return;
                    if (engWord == word) {
                        foundMatch = true;
                        return;
                    }
                    if (engWord.length == word.length) {
                        var engWordChars = engWord.split('');
                        var wordChars = word.split('');
                        // Check the number of matching characters in any order
                        var matchCount = 0;
                        engWordChars.forEach(char => {
                            if (wordChars.includes(char)) {
                                matchCount++;
                            }
                        });
                    }
                    var matchScore = matchCount / engWord.length;
                    if (matchScore > 0.5) {
                        line = line.replace(word, engWord.toUpperCase());
                        foundMatch = true;
                        // break the loop if match found
                        return;
                    }
                });
            });
            // Fix spell mistakes in line
            line.split(' ').forEach(word => {
                foundMatch = false;
                english_words.forEach(engWord => {
                    if (foundMatch) return;
                    if (engWord == word) {
                        foundMatch = true;
                        return;
                    }
                    var engWordChars = engWord.split('');
                    var wordChars = word.split('');
                    // Check the number of matching characters in any order
                    var matchCount = 0;
                    engWordChars.forEach(char => {
                        if (wordChars.includes(char)) {
                            matchCount++;
                        }
                    });

                    var matchScore = matchCount / engWord.length;
                    if (matchScore > 0.5) {
                        line = line.replace(word, engWord.toUpperCase());
                        foundMatch = true;
                        // break the loop if match found
                        return;
                    }
                });
            });
            cleanedMsg['cleanedLine'] = line;
            line = line.replace("ABACBC", 'ALL').trim();
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
                qty = cleanedMsg['qty'] ? cleanedMsg['qty'] : null;
                // format as vlen digit number with leading zeros
                const formatNumber = (num, length) => {
                    return num.toString().padStart(length, '0');
                };
                if (to - from < 10) {
                    // Increment 1 by 1 inclusive
                    for (let i = from; i <= to; i++) {
                        cleanedMsg['data'].push({ number: formatNumber(i, vlen), qty: qty, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                    }
                } else if (to - from < 100) {
                    // Increment 5 by 5 inclusive
                    if ((to - from) % 10 === 0) {
                        for (let i = from; i <= to; i += 10) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen), qty: qty, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    } else {
                        for (let i = from; i <= to; i += 11) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen), qty: qty, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    }
                } else if (to - from < 1000) {
                    // Increment 100 by 100 inclusive
                    if ((to - from) % 100 === 0) {
                        for (let i = from; i <= to; i += 100) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen), qty: qty, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    } else {
                        for (let i = from; i <= to; i += 111) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen), qty: qty, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    }
                } else if (to - from < 10000) {
                    // Increment 100 by 100 inclusive
                    if ((to - from) % 1000 === 0) {
                        for (let i = from; i <= to; i += 1000) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen), qty: qty, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    } else {
                        for (let i = from; i <= to; i += 1111) {
                            cleanedMsg['data'].push({ number: formatNumber(i, vlen), qty: qty, target: cleanedMsg['target'] ? cleanedMsg['target'] : null, amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null });
                        }
                    }
                }
                return;
            }
            // replace complete line if matching below words
            const wordsToReplace = ['TICKETS', "TICKET", "BOARD", "EACH", "DEAR", "SET", "BOX", "ALL", "CH"];
            if (wordsToReplace.some(word => line == word)) {
                line = '';
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
                                outLines.push(`${TARGET_1D_CUT},${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            } else {
                                outLines.push(`${TARGET_1D_TKT},${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            }
                        } else if (dataLen == 2) {
                            if (targetValueLocal == 'ABC') {
                                targetValueLocal = 'ALL';
                            }
                            /*if (finalBoxStatus) {
                                outLines.push(`2DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            } else */
                            if (finalCutStatus) {
                                outLines.push(`${TARGET_2D_CUT},${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            } else {
                                outLines.push(`${TARGET_2D_TKT},${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                            }
                        } else if (dataLen == 3) {
                            if (finalBoxStatus) {
                                outLines.push(`${TARGET_3D_BOX},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else if (finalCutStatus) {
                                outLines.push(`${TARGET_3D_CUT},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else {
                                outLines.push(`${TARGET_3D_TKT},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            }
                        } else if (dataLen == 4) {
                            if (finalBoxStatus) {
                                outLines.push(`${TARGET_4D_BOX},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else if (finalCutStatus) {
                                outLines.push(`${TARGET_4D_CUT},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else {
                                outLines.push(`${TARGET_4D_TKT},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            }
                        } else if (dataLen == 5) {
                            if (finalBoxStatus) {
                                outLines.push(`${TARGET_5D_BOX},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else if (finalCutStatus) {
                                outLines.push(`${TARGET_5D_CUT},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                            } else {
                                outLines.push(`${TARGET_5D_TKT},${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
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
    var prevLine;
    lines.forEach(line => {
        var prevLineBkup = prevLine;
        prevLine = line;
        if (line.data && line.data.length > 0) {
            dataLen = (line['data'][0]['number']).length;
            if (group['dataLen'] > 0 && dataLen != group['dataLen']) {
                group = { "data": [], "beforeData": [], "afterData": [], "dataLen": dataLen };
                cleanedUpGroupedLines.push(group);
            } else if (group['dataLen'] > 2 && prevLineBkup && prevLineBkup['isBox'] != line['isBox']) {
                group = { "data": [], "beforeData": [], "afterData": [], "dataLen": dataLen };
                cleanedUpGroupedLines.push(group);
            }

            group['dataLen'] = dataLen;
            group['data'].push(line);
        } else if (group['data'].length == 0) {
            group['beforeData'].push(line);
        } else {
            // New array from group['afterData'] and assign to group['beforeData']
            if (line['qty'] && line['qty'] != '' && !group['beforeData'].some(b => b['qty'] && b['qty'] != '')) {
                group['afterData'].push(line);
                group = { "data": [], "beforeData": [], "afterData": [], "dataLen": 0 };
                cleanedUpGroupedLines.push(group);
            } else {
                group = { "data": [], "beforeData": [], "afterData": [], "dataLen": 0 };
                cleanedUpGroupedLines.push(group);
                group['beforeData'].push(line);
            }
        }
    });
    if (group['data'].length == 0 && cleanedUpGroupedLines.length > 1) {
        cleanedUpGroupedLines[cleanedUpGroupedLines.length - 2]['afterData'] = cleanedUpGroupedLines[cleanedUpGroupedLines.length - 2]['afterData'].concat(group['beforeData']);
        cleanedUpGroupedLines.pop();
    }
    return cleanedUpGroupedLines;
}

function groupCleanedUpDataSecondLevel(cleanedUpGroupedLinesFirstLevel) {

    var cleanedUpGroupedLines = [];
    var propsMap = {
        1: ['target', 'qty'],
        2: ['target', 'qty'],
        3: ['qty', 'isBox', 'cut', 'isOff', 'amount'],
        4: ['qty', 'isBox', 'cut', 'isOff', 'amount'],
        5: ['qty', 'isBox', 'cut', 'isOff', 'amount']
    };

    cleanedUpGroupedLinesFirstLevel = cleanupDuplicateDataInGroupedLines(cleanedUpGroupedLinesFirstLevel, propsMap);
    var prevGroup;
    cleanedUpGroupedLinesFirstLevel.forEach(group => {
        if (prevGroup) {
            // Compare prevGroup and group for properties in propsMap based on group['dataLen'] and find which has many match.
            // If prevGroup has more match then move the beforeData to prev group
            if (group['beforeData'] && group['beforeData'].length > 0) {
                var prevGroupDataLen = prevGroup['dataLen'] ? prevGroup['dataLen'] : 0;
                var groupDataLen = group['dataLen'] ? group['dataLen'] : 0;

                if (groupDataLen > 0 && propsMap[groupDataLen] && prevGroupDataLen > 0 && propsMap[prevGroupDataLen]) {
                    var prevGroupProps = propsMap[prevGroupDataLen];
                    var prevGroupMatchCount = 0;
                    var groupProps = propsMap[groupDataLen];
                    var groupMatchCount = 0;
                    var updatedPrevGroupAfterData = prevGroup['afterData'] ? prevGroup['afterData'].slice() : [];
                    var updatedGroupBeforeData = group['beforeData'] ? group['beforeData'].slice() : [];
                    group['beforeData'].forEach(line => {
                        prevGroupProps.forEach(prop => {
                            if (line[prop] && line[prop] != '') {
                                prevGroupMatchCount++;
                            }
                        });
                        groupProps.forEach(prop => {
                            if (line[prop] && line[prop] != '') {
                                groupMatchCount++;
                            }
                        });
                        if (prevGroupMatchCount > groupMatchCount) {
                            // Move group['beforeData'] to prevGroup['afterData'] and clear group['beforeData']
                            updatedPrevGroupAfterData.push(line);
                            updatedGroupBeforeData = updatedGroupBeforeData.filter(l => l !== line);
                        }
                    });
                    prevGroup['afterData'] = updatedPrevGroupAfterData;
                    group['beforeData'] = updatedGroupBeforeData;
                }
            }

            if (group['data'].length == 0) {
                prevGroup['afterData'] = prevGroup['afterData'].concat(group['beforeData']);
            } else {
                cleanedUpGroupedLines.push(group);
            }
        } else {
            cleanedUpGroupedLines.push(group);
        }
        prevGroup = group;
    });
    cleanedUpGroupedLinesFirstLevel = cleanupDuplicateDataInGroupedLines(cleanedUpGroupedLinesFirstLevel, propsMap);

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

function cleanupDuplicateDataInGroupedLines(cleanedUpGroupedLinesFirstLevel, propsMap) {
    for (let i = cleanedUpGroupedLinesFirstLevel.length - 1; i >= 0; i--) {
        const group = cleanedUpGroupedLinesFirstLevel[i];
        if (i > 0) {
            const prevGroup = cleanedUpGroupedLinesFirstLevel[i - 1];
            groupLen = group['dataLen'] ? group['dataLen'] : 0;
            prevGroupLen = prevGroup['dataLen'] ? prevGroup['dataLen'] : 0;

            //properties in after data of group
            afterDataProps = {};
            if (group['afterData'] && group['afterData'].length > 0 && propsMap[groupLen]) {

                group['afterData'].forEach(line => {
                    propsMap[groupLen].forEach(prop => {
                        if (line[prop] && line[prop] != '') {
                            if (!afterDataProps[prop]) {
                                afterDataProps[prop] = [];
                            }
                            if (!afterDataProps[prop].includes(line[prop])) {
                                afterDataProps[prop].push(line[prop]);
                            }
                        }
                    });
                });
            }
            // Iterate propertis in before data of group
            // If same property in after data found then move the line to prev group after data and remove from current group
            if (group['beforeData'] && group['beforeData'].length > 0 && propsMap[prevGroupLen]) {
                var updatedPrevGroupAfterData = prevGroup['afterData'] ? prevGroup['afterData'].slice() : [];
                var updatedGroupBeforeData = group['beforeData'] ? group['beforeData'].slice() : [];
                group['beforeData'].forEach(line => {
                    propsMap[prevGroupLen].forEach(prop => {
                        if (line[prop] && line[prop] != '' && afterDataProps[prop] && afterDataProps[prop] != '') {
                            // Move line to prev group after data and remove from current group before data
                            updatedPrevGroupAfterData.push(line);
                            updatedGroupBeforeData = updatedGroupBeforeData.filter(l => l !== line);
                        }
                    });
                });
                prevGroup['afterData'] = updatedPrevGroupAfterData;
                group['beforeData'] = updatedGroupBeforeData;
            }
        }
    }
    return cleanedUpGroupedLinesFirstLevel;
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

function winningNumberChangeListener() {
    getWinningNumbers();
    if (winningNumbers) {
        document.getElementById('1dAWinningNumbers').value = winningNumbers.numberMap['1D_A'] || '';
        document.getElementById('1dBWinningNumbers').value = winningNumbers.numberMap['1D_B'] || '';
        document.getElementById('1dCWinningNumbers').value = winningNumbers.numberMap['1D_C'] || '';
        document.getElementById('2dABWinningNumbers').value = winningNumbers.numberMap['2D_AB'] || '';
        document.getElementById('2dACWinningNumbers').value = winningNumbers.numberMap['2D_AC'] || '';
        document.getElementById('2dBCWinningNumbers').value = winningNumbers.numberMap['2D_BC'] || '';
        document.getElementById('3dWinningNumbers').value = winningNumbers.numberMap['3D'] || '';
        document.getElementById('4dWinningNumbers').value = winningNumbers.numberMap['4D'] || '';
        document.getElementById('5dWinningNumbers').value = winningNumbers.numberMap['5D'] || '';
    }
    processInput();
}

function getWinningNumbers() {
    // Get the winning number value 
    const winningNumberValue = document.getElementById('lotteryWinningNumber').value;
    localStorage.setItem('winningNumberValue', winningNumberValue);
    winningNumbers.setNumberMap({});
    // Store in local storage
    if (!winningNumberValue || winningNumberValue.trim().length < 4) {
        return null;
    }
    let winningNumber = '     ' + (winningNumberValue.replace(/\D/g, ''));

    if (winningNumber.length > 0 && winningNumber.length < 5) {
        console.error("Winning number must be at least 5 digits");
    }

    // Extract from right side
    const last5 = winningNumber.length >= 5 ? winningNumber.slice(-5) : "";
    const last4 = winningNumber.length >= 4 ? winningNumber.slice(-4) : "";
    const last3 = winningNumber.length >= 3 ? winningNumber.slice(-3) : "";

    // ABC from last 3 digits
    const A = last3[0] || "";
    const B = last3[1] || "";
    const C = last3[2] || "";

    // 2D combinations
    const AB = A + B;
    const AC = A + C;
    const BC = B + C;

    const numberMap = { "1D_A": A, "1D_B": B, "1D_C": C, "2D_AB": AB, "2D_AC": AC, "2D_BC": BC, "3D": last3, "4D": last4, "5D": last5 };
    winningNumbers.setNumberMap(numberMap);
    return numberMap;
}
