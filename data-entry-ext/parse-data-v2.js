// Chrome web javascript extension parse-data-v1.js
const FAILED_TO_PARSE = 'FAILED TO PARSE';
// map to store image name and url
var imageMap = new Map();
var visionRequests = new Map();
//const requestMeta = [];
var lastFocusedTextareaIdx = 0;

const dict = {
    al: "ALL",
    sct: "SET",
    chnce: "SET",
    ech: "EACH",
    ch: "SET",
    st: "SET",
    chance: "SET"
};

// ============================================================================
// SECTION 0: TAB MANAGEMENT
// ============================================================================

/**
 * Initialize tab functionality
 */
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const targetPane = document.getElementById(tabId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}

// ============================================================================
// SECTION 1: MESSAGE GROUPING & PREPROCESSING
// ============================================================================

/**
 * Extracts message groups from raw WhatsApp export
 * Groups are separated by timestamp lines containing ":"
 */
function getMessageGroups() {
    const inputData = document.getElementById('inputData').value;
    const lines = inputData.split('\n').filter(line => line.trim() !== '');
    let messageGroup = [];
    let message = [];
    lines.forEach(line => {
        // Matches regex \[.*: then replace that with empty string and add --- at the end
        if (line.includes(":")) {
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
    showFailedParsing = document.getElementById('showFailedParsing').checked;

    var parsedData = [];
    var groupedOutLines = [];
    groupsUpdated = [];
    groups.forEach((msg, index) => {
        lines = [];
        replace = {};
        msg.forEach((line, index) => {
            if (line === '') return;
            line = plainTextNormalize(line);
            if (line.indexOf('RP') == 0) {
                line = line.replace('RP', '');
                replacevalues = line.split('##');
                if (replacevalues.length == 2) {
                    // if second value is SPACE then replace with space, if NL OR NEWLINE then replace with \n
                    if (replacevalues[1] === 'NL' || replacevalues[1] === 'NEWLINE') {
                        replace[replacevalues[0]] = '\n';
                    } else if (replacevalues[1] === 'NL' || replacevalues[1] === 'NEWLINE') {
                        replace[replacevalues[0]] = '\n';
                    } else {
                        replace[replacevalues[0]] = replacevalues[1];
                    }
                } else if (replacevalues.length == 1) {
                    replace[replacevalues[0]] = '';
                }
                return;
            }
            // Apply replacements
            for (const [key, value] of Object.entries(replace)) {
                if (line.includes(key)) {
                    // Replace all occurrences of key with value
                    line = line.split(key).join(value).trim();
                }
            }
            line.split('\n').map(l => l.trim()).forEach(l => {
                lines.push(l.trim());
            });
        });
        groupsUpdated.push(lines);
    });
    groupsUpdated.forEach((msg, index) => {
        var isBox = false
        var outLines = [];
        var target = '';
        lines = [];
        parsedData.push(lines);
        lastTarget = '';
        allQtySet = '';
        lastDataLen = 0;
        msg.forEach((line, index) => {
            var cleandMsg = {};
            lines.push(cleandMsg);
            line = line.trim().toUpperCase();
            cleandMsg['originalLine'] = line;
            cleandMsg['lineIndex'] = index;
            cleandMsg['data'] = [];
            if (line === '') return;
            line = line.replace('ATTACHED:', 'ATTACHED#').trim();

            //dearMatch = line.match(/\b(?:DEAR|KL|BOARD|D.*R)(?:[\s.,=-]*\d+(?:\s*(?:AM|PM))?)?/gi);
            line = line.trim();

            // If line contains ':' contains time or label then remove everything before last :
            // ''.match(/^(\[\s*)?\d{2}\/\d{2}\/\d{2,4},\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)\s*(\]?\s*[-~]\s*.+?:)/)
            isMessageHeaderLine = line.match(/^(\[\s*)?\d{2}\/\d{2}\/\d{2,4},\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)\s*(\]?\s*[-~]\s*.+?:)/);
            if (isMessageHeaderLine) {
                line = line.replace(isMessageHeaderLine[0], '').trim();
            }
            line = line.replace(
                /^\[\d{2}\/\d{2}\/\d{4},\s*\d{1,2}:\d{2}(?::\d{2})?[\s\u202F]*(AM|PM)\][\s\u200E]*[^:]+:\s*/i,
                ''
            ).trim();


            isInfoMessageLine = line.match(/^((\[\s*)?\d{2}\/\d{2}\/\d{2,4},\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)\D+)$/);
            if (isInfoMessageLine) {
                line = '';
                return;
            }
            // If line includes <attached: 00000047-PHOTO-2026-01-21-15-03-02.jpg> get image name
            if (line.includes('<ATTACHED#')) {
                const imageName = line.match(/<ATTACHED#\s*(.*?)>/);
                if (imageName) {
                    cleandMsg['image'] = imageName[1];
                }
                return;
            }

            // If line matches  IMG-20260120-WA0018.jpg (file attached) then get image name
            const imgMatch = line.includes(' (FILE ATTACHED)');
            if (imgMatch) {
                cleandMsg['image'] = line.replace(' (FILE ATTACHED)', ' ').trim();
                return;
            }
            line = fixWords(line);

            // replace board ''
            const replacements = [
                "KERALA 3",
                "KERALA",
                "PM.3",
                "DR.1",
                "DIAR",
                "DEAR 6PM",
                "DEAR6PM",
                "DEAR6",
                "DEAR 6",
                "DEAR 1 PM",
                "DEAR 1",
                "DEAR1",
                "DEAR-1",
                "DEER",
                "DIAR",
                //8
                "DEAR 8PM",
                "DEAR1PM",
                "DEAR8PM",
                "DEAR-8",
                "DEAR 8",
                "DEAR8",
                "DR.8",
                "1.PM",
                "1 PM",
                "1PM",
                "8PM",
                "6PM",
                "3.PM",
                "3 PM",
                "6.PM",
                "3-00 PM",
                "3.00 PM",
                "3•00 PM",
                "3PM",
                "DEAR",
                "DR 1",
                "DR 6",
                "DR 8",
                "DR 3",
                "DR",
                "BOARD",
                "BORD"
            ];
            replacements.forEach(item => {
                line = line.replace(item, "");
            });



            // If line contains only date like 
            // Replace double .. with single .
            // replace double ,, or spaces with single space
            line = line.replace(/₹/ig, 'RS');
            line = line.replace(/\$/ig, 'RS');
            line = line.replace(/ரூ./ig, 'RS');
            line = line.replace(/\d{2}-\d{2}-\d{4}/, '').trim();
            line = line.replace(/KL[^a-zA-Z0-9]*(\d+)?/g, '').trim();
            line = line.replace(/\d+[^a-zA-Z0-9]*DIGIT/g, '').trim();
            line = line.replace(/\.{2,}/g, '.').trim();
            line = line.replace(/,{2,}/g, ',').trim();
            line = line.replace(/\s{2,}/g, ' ').trim();
            line = line.replace('HALF', 'OFF');
            line = line.replace('HAFF', 'OFF');
            // If line start and end with * then remove *
            if (line.startsWith('*')) {
                line = line.slice(1).trim();
            }
            if (line.endsWith('*')) {
                line = line.slice(0, -1).trim();
            }
            line = line.replace('0FF', 'OFF');
            line = line.replace('FUII', 'FULL');
            // If line starts and ends with . then remove .
            if (line.endsWith('.')) {
                line = line.slice(0, -1).trim();
            }
            if (line.includes('=BOX')) {
                cleandMsg['isBox'] = true;
                line = line.replace('=BOX', ' ').trim();
            }
            if (line.includes('BOX')) {
                cleandMsg['isBox'] = true;
                line = line.replace('BOX', ' ').trim();
            }
            if (line.includes('OFF')) {
                line = line.replace('OFF', ' ');
                line = line.trim();
                cleandMsg['isOff'] = true;
            }
            if (line.includes('FULL') || line.includes('FULLL')) {
                cleandMsg['isFull'] = true;
                line = line.replace('FULLL', ' ').replace('FULL', ' ').trim();
            }
            // replace line ₹28 with RS28
            line = line.replace(/₹/g, 'RS');
            line = line.replaceAll('CHANCE', 'SET');
            
            line = line.replace("ABBCAC", " ALL "); // replace multiple spaces with single space
            line = line.replaceAll('ECH', ' EACH '); // replace multiple spaces with single space
            line = line.replace('ALL', ' ALL '); // add space before ALL to avoid partial match
            line = line.replace(/^\((\d+(?:\.\d+)?)\)$/g, "RS $1");

            line = cleanupLine(line);
            // If value matches AB BC AC with any combination or any special characters between them replace with ALL
            // If matches AB,AC,BC,ALL,AB-BC,AC-BC,BC-AC,BC-AB
            //line = line.replace(/([A-C])/g, ' $1 ');
            const tokens = line.toUpperCase().match(/\b(?:ABAC|ABBC|ACBC|ABC|ALL|AB|AC|BC|A|B|C)\b/g);
            if (tokens) {
                const uniqueTokens = [...new Set(tokens)];
                // replace the tokens from line with empty using word boundary to avoid partial match and trim the line
                uniqueTokens.forEach(token => {
                    line = line.replace(new RegExp('\\b' + token + '\\b', 'g'), '').trim();
                });
                uniqueTokens.sort();
                const joinedTokens = uniqueTokens.join('-');
                targetVal = joinedTokens;
                if (joinedTokens === 'AB-AC-BC' || joinedTokens === 'A-B-C' || joinedTokens === 'ABC') {
                    targetVal = 'ALL';
                }
                cleandMsg['target'] = targetVal;
                if (line == '' && targetVal != '') {
                    lastTarget = targetVal;
                }
            }

            if (line.includes('CUTTING')) {
                // consider as empty line
                cleandMsg['cut'] = true;
                line = line.replace('CUTTING', ' ').trim();
                if (line === '')
                    return;
            }

            if (line.includes('CUT')) {
                // consider as empty line
                cleandMsg['cut'] = true;
                line = line.replace('CUT', ' ').trim();
                if (line === '')
                    return;
            }
            line = cleanupLine(line.replace(/\((\d+(?:\.\d+)?)\)/g, "RS $1"));

            // If line matches RS.30 or RS30 or RS 30, replace space and hyphen with empty string
            const rsMatch = line.match(/\b(?:RS[^A-Za-z0-9]*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)[^A-Za-z0-9]*RS)\b/i);
            if (rsMatch) {
                cleandMsg['amount'] = rsMatch[1] || rsMatch[2];
                line = line.replace(rsMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }

            //DEAR 120             1747          4       ₹3450.00
            const dearMatch = line.match(/DEAR\s+(\d+)\s+(\d+)\s+(\d+)/);
            // assign 120 as amt, 1747 as number and 4 as qty
            if (dearMatch) {
                cleandMsg['amount'] = dearMatch[1];
                cleandMsg['data'].push({ number: dearMatch[2]/*, qty: dearMatch[3] */ });
                isLastDear = true;
                return;
            }
            const dear2Match = line.match(
                /DEAR2\s+(\d+)\s+(AC|BC|AB|A|B|C)\s*(\d{1,5})\s+(\d+)/i
            );

            if (dear2Match) {
                cleandMsg['amount'] = dear2Match[1]; // 12
                cleandMsg['target'] = dear2Match[2]; // BC
                cleandMsg['data'].push({
                    number: dear2Match[3], // 00
                    qty: dear2Match[4]     // 2
                });
                isLastDear = true;
                return;
            }


            // 120  -  2419  =  1
            const dearHyphenMatch = line.match(/(\d+)\s*-\s*(\d+)\s*=\s*(\d+)/);
            // assign 120 as amt, 2419 as number and 1 as qty
            if (dearHyphenMatch) {
                cleandMsg['amount'] = dearHyphenMatch[1];
                cleandMsg['data'].push({ number: dearHyphenMatch[2]/*, qty: dearHyphenMatch[3] */ });
                isLastDear = true;
                return;
            }
            // Replace all the non (A-Z and 0-9) {1,} between the valid values to single -
            if (line === '') {
                return;
            }
            line = cleanupLine(line.replace(/[^A-Z0-9#]+/g, '~')).trim();

            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            setMatch = line.match(/(EACH|ECH|ETC|E)+[^A-Za-z0-9]*(\d{1,5})[^A-Za-z0-9]*(SET|SETS|ST|CH|CHANCE|E)+/);
            if (setMatch) {
                cleandMsg['qty'] = setMatch[2];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }

            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            setMatch = line.match(/(EACH|ECH|ETC|E)+[^A-Za-z0-9]*(\d{1,5})[^A-Za-z0-9]*/);
            if (setMatch) {
                cleandMsg['qty'] = setMatch[2];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }
            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            setMatch = line.match(/(\d{1,5})[^A-Za-z0-9]*(SET|SETS|ST|CH|CHANCE)+/);
            if (setMatch) {
                cleandMsg['qty'] = setMatch[1];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }
            setMatch = line.match(/(\d{1,5})[^A-Za-z0-9]*(EACH|ECH|ETC|E)+/);
            if (setMatch) {
                cleandMsg['qty'] = setMatch[1];
                line = line.replace(setMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }

            line = cleanupLine(line);

            // If line matches 30-TO-50
            const toMatch = line.match(/^(\d{1,5})~?TO~?(\d{1,5})$/);
            if (toMatch) {
                //cleandMsg['data'].push({ from: toMatch[1], to: toMatch[2] });
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
                        cleandMsg['data'].push({ number: formatNumber(i, vlen), qty: allQtySet && allQtySet != '' ? allQtySet : null });
                    }
                } else if (to - from < 100) {
                    // Increment 5 by 5 inclusive
                    if ((to - from) % 10 === 0) {
                        for (let i = from; i <= to; i += 10) {
                            cleandMsg['data'].push({ number: formatNumber(i, vlen), qty: allQtySet && allQtySet != '' ? allQtySet : null });
                        }
                    } else {
                        for (let i = from; i <= to; i += 11) {
                            cleandMsg['data'].push({ number: formatNumber(i, vlen), qty: allQtySet && allQtySet != '' ? allQtySet : null });
                        }
                    }
                } else if (to - from < 1000) {
                    // Increment 100 by 100 inclusive
                    if ((to - from) % 100 === 0) {
                        for (let i = from; i <= to; i += 100) {
                            cleandMsg['data'].push({ number: formatNumber(i, vlen), qty: allQtySet && allQtySet != '' ? allQtySet : null });
                        }
                    } else {
                        for (let i = from; i <= to; i += 111) {
                            cleandMsg['data'].push({ number: formatNumber(i, vlen), qty: allQtySet && allQtySet != '' ? allQtySet : null });
                        }
                    }
                } else if (to - from < 10000) {
                    // Increment 100 by 100 inclusive
                    if ((to - from) % 1000 === 0) {
                        for (let i = from; i <= to; i += 1000) {
                            cleandMsg['data'].push({ number: formatNumber(i, vlen), qty: allQtySet && allQtySet != '' ? allQtySet : null });
                        }
                    } else {
                        for (let i = from; i <= to; i += 1111) {
                            cleandMsg['data'].push({ number: formatNumber(i, vlen), qty: allQtySet && allQtySet != '' ? allQtySet : null });
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
            // cleandMsg['data'].push({ number: match[0], qty: cleandMsg['qty'] ? cleandMsg['qty'] : null, target: cleandMsg['target'] ? cleandMsg['target'] : null });
            if (allNumbers && values.length > 0) {
                if (values.length == 2) {
                    if (cleandMsg['qty'] && cleandMsg['qty'] != '') {
                        cleandMsg['data'].push({ number: values[0], qty: cleandMsg['qty'], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                        cleandMsg['data'].push({ number: values[1], qty: cleandMsg['qty'], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                    } else {
                        if (values[1].length != values[0].length) {
                            // If there are 2 values and length is different then consider first value as number and second value as qty
                            cleandMsg['data'].push({ number: values[0], qty: values[1], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                        } else if (values[1].length > 2) {
                            cleandMsg['data'].push({ number: values[0], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                            cleandMsg['data'].push({ number: values[1], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                        } else {
                            cleandMsg['data'].push({ number: values[0], qty: values[1], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                        }
                    }
                } else {
                    // If all values are same length other than last one then last one as qty and all previous values as number
                    isAllValuesSameLength = values.every(val => val.length === values[0].length);
                    isAllValuesSameLengthOtherThanLast = values.slice(0, values.length - 1).every(val => val.length === values[0].length);
                    if (isAllValuesSameLength) {
                        values.forEach(value => {
                            cleandMsg['data'].push({ number: value, qty: cleandMsg['qty'] ? cleandMsg['qty'] : null, target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                        });
                    } else if (isAllValuesSameLengthOtherThanLast) {
                        for (let i = 0; i < values.length - 1; i++) {
                            cleandMsg['data'].push({ number: values[i], qty: values[values.length - 1], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                        }
                    } else {
                        var skipNext = false;
                        for (let i = 0; i < values.length; i++) {
                            if (skipNext) {
                                skipNext = false;
                                continue;
                            }
                            if (values[i + 1] && values[i + 1].length === values[i].length) {
                                cleandMsg['data'].push({ number: values[i], qty: cleandMsg['qty'] ? cleandMsg['qty'] : null, target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                            } else {
                                skipNext = true;
                                cleandMsg['data'].push({ number: values[i], qty: values[i + 1], target: cleandMsg['target'] ? cleandMsg['target'] : null, amount: cleandMsg['amount'] ? cleandMsg['amount'] : null });
                            }
                        }
                    }

                }
                if (cleandMsg['qty']) {
                    cleandMsg['qty'] = null; // reset qty after using for first number in the line
                }
                if (cleandMsg['target']) {
                    cleandMsg['target'] = null; // reset target after using for first number in the line
                }
                cleandMsg['amount'] = null; // reset amount after using for first number in the line
                return;
            }

            // If could not parse the line
            cleandMsg['nparsed'] = true;
            //console.log('Could not parse line:', line);
        });
        var hasData = false;
        var qty = [];
        var isBox = false;
        var targetValue = '';
        var amt = '';
        var isOff = false;
        var lastQtyUpdatedIndex = 0;
        var isCut = false;
        var lastAmt = '';
        // Message context
        var messageContext = {};
        var lastQtyIndex = -1;
        var lastTargetIndex = -1;
        //lines = lines.filter(line => line['data'] && line['data'].length > 0 || line['qty'] || line['target'] || line['amount'] || line['isBox'] || line['isOff'] || line['cut']);
        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            if (line['data'] && line['data'].length > 0) {
                // use javascript set data type
                line['data'].forEach(d => {
                    if (d['number']) {
                        if (!messageContext['datasize']) {
                            messageContext['datasize'] = [];
                        }
                        if (!messageContext['datasize'].includes(d['number'].length)) {
                            messageContext['datasize'].push(d['number'].length);
                        }
                    }
                })
            }
            if (line['qty']) {
                if (!messageContext['qtyContext']) {
                    messageContext['qtyContext'] = [];
                }
                messageContext['qtyContext'].push({ qty: line['qty'], fromIndex: lastQtyIndex == -1 ? 0 : lastQtyIndex + 1, toIndex: i });
                lastQtyIndex = i;
            }
            if (line['target']) {
                if (!messageContext['targetContext']) {
                    messageContext['targetContext'] = [];
                }
                messageContext['targetContext'].push({ target: line['target'], fromIndex: lastTargetIndex == -1 ? 0 : lastTargetIndex + 1, toIndex: i });
                lastTargetIndex = i;
            }
        }
        if (messageContext['qtyContext'] && messageContext['qtyContext'].length > 1) {
            var fromIndex = messageContext['qtyContext'][0]['fromIndex'];
            var toIndex = messageContext['qtyContext'][0]['toIndex'];
            dataLines = lines.slice(fromIndex, toIndex).filter(line => line['data'] && line['data'].length > 0);
            if (dataLines.length > 0) {
                // do nothing for now
            } else {
                for (i = 0; i < messageContext['qtyContext'].length; i++) {
                    var qtyCtx = messageContext['qtyContext'][i];
                    if (i < messageContext['qtyContext'].length - 1) {
                        var nextQtyCtx = messageContext['qtyContext'][i + 1];
                        qtyCtx['fromIndex'] = nextQtyCtx['fromIndex'];
                        qtyCtx['toIndex'] = nextQtyCtx['toIndex'];
                    } else {
                        qtyCtx['fromIndex'] = qtyCtx['toIndex'] + 1;
                        qtyCtx['toIndex'] = lines.length - 1;
                    }
                }
            }
        }
        const targetContext = messageContext['targetContext'];
        if (targetContext && targetContext.length > 1) {
            var fromIndex = targetContext[0]['fromIndex'];
            var toIndex = targetContext[0]['toIndex'];
            dataLines = lines.slice(fromIndex, toIndex).filter(line => line['data'] && line['data'].length > 0);
            if (dataLines.length > 0) {
                // do nothing for now
            } else {
                for (i = 0; i < targetContext.length; i++) {
                    var targetCtx = targetContext[i];
                    if (i < targetContext.length - 1) {
                        var nextTargetCtx = targetContext[i + 1];
                        targetCtx['fromIndex'] = nextTargetCtx['fromIndex'];
                        targetCtx['toIndex'] = nextTargetCtx['toIndex'];
                    } else {
                        targetCtx['fromIndex'] = targetCtx['toIndex'] + 1;
                        targetCtx['toIndex'] = lines.length - 1;
                    }
                }
            }
        }
        //console.log('Message Context:', JSON.stringify(messageContext));

        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            idx = i;

            if (line['data'] && line['data'].length > 0) {
                hasData = true;
            } else {
                hasData = false;
            }
            if (line['isBox']) {
                if (!hasData) {
                    isBox = line['isBox'];
                }
            }
            if (line['isOff']) {
                isOff = line['isOff'];
            }
            if (line['cut']) {
                isCut = line['cut'];
            }
            if (messageContext['qtyContext'] && messageContext['qtyContext'].length > 0) {
                if (messageContext['qtyContext'].length == 1) {
                    messageQty = messageContext['qtyContext'][0]['qty'];
                    if (line['data'] && line['data'].length > 0) {
                        if (line['data'].length == 1) {
                            d = line['data'][0];
                            if (!d['qty'] || d['qty'] == '') {
                                d['qty'] = messageQty;
                            } else {
                                lastQty = d['qty'];
                                if (lastQty.length == d['number'].length) {
                                    d['qty'] = messageQty;
                                    line['data'].push({ number: lastQty, qty: messageQty });
                                }
                            }
                        } else {
                            line['data'].forEach((d) => {
                                if (!d['qty'] || d['qty'] == '') {
                                    d['qty'] = messageQty;
                                }
                            });
                        }
                    }
                } else if (messageContext['qtyContext'].length > 1) {
                    messageContext['qtyContext'].forEach((qtyCtx) => {
                        if (idx >= qtyCtx['fromIndex'] && idx <= qtyCtx['toIndex']) {
                            messageQty = qtyCtx['qty'];
                            if (line['data'] && line['data'].length > 0) {
                                if (line['data'].length == 1) {
                                    d = line['data'][0];
                                    if (!d['qty'] || d['qty'] == '') {
                                        d['qty'] = messageQty;
                                    } else {
                                        lastQty = d['qty'];
                                        if (lastQty.length == d['number'].length) {
                                            d['qty'] = messageQty;
                                            line['data'].push({ number: lastQty, qty: messageQty });
                                        } else {
                                        }
                                    }
                                } else {
                                    line['data'].forEach((d) => {
                                        if (!d['qty'] || d['qty'] == '') {
                                            d['qty'] = messageQty;
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
            }
            // Target context
            if (targetContext && targetContext.length > 0) {
                if (targetContext.length == 1) {
                    messageQty = targetContext[0]['target'];
                    if (line['data'] && line['data'].length > 0) {
                        if (line['data'].length == 1) {
                            d = line['data'][0];
                            if (!d['target'] || d['target'] == '') {
                                d['target'] = messageQty;
                            } else {
                                lastQty = d['target'];
                                if (lastQty.length == d['number'].length) {
                                    d['target'] = messageQty;
                                    line['data'].push({ number: lastQty, target: messageQty });
                                }
                            }
                        } else {
                            line['data'].forEach((d) => {
                                if (!d['target'] || d['target'] == '') {
                                    d['target'] = messageQty;
                                }
                            });
                        }
                    }
                } else if (targetContext.length > 1) {
                    targetContext.forEach((targetCtxl) => {
                        if (idx >= targetCtxl['fromIndex'] && idx <= targetCtxl['toIndex']) {
                            messageQty = targetCtxl['target'];
                            if (line['data'] && line['data'].length > 0) {
                                if (line['data'].length == 1) {
                                    d = line['data'][0];
                                    if (!d['target'] || d['target'] == '') {
                                        d['target'] = messageQty;
                                    } else {
                                        lastQty = d['target'];
                                        if (lastQty.length == d['number'].length) {
                                            d['target'] = messageQty;
                                            line['data'].push({ number: lastQty, target: messageQty });
                                        } else {
                                        }
                                    }
                                } else {
                                    line['data'].forEach((d) => {
                                        if (!d['target'] || d['target'] == '') {
                                            d['target'] = messageQty;
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
            }
            if (line['target'] && line['target'] != '') {
                targetValue = line['target'];

            }
            if (line['amount'] && line['amount'] != '') {
                amt = line['amount'];
            }
            if (line['amount'] && line['amount'] != '' && (!line['data'] || line['data'].length == 0)) {
                lastAmt = line['amount'];
            }
            if (line['data'] && line['data'].length > 0) {
                line['data'].forEach((d) => {
                    // If number value digits length is 3 or more and amount is missing then assign amt
                    if (d['number'] && d['number'].length >= 3 && (!d['amount'] || d['amount'] == '')) {
                        d['amount'] = line['amount'] ? line['amount'] : lastAmt;
                    }
                });
            }
        };
        linesGrouping = [];
        linesGroupLines = [];
        linesGrouping.push(linesGroupLines);
        groupMemory = {};
        lines.forEach((line, idx) => {
            isLastAmt = groupMemory['isLastAmount'] ? groupMemory['isLastAmount'] : false;
            groupMemory['isLastAmount'] = false;
            if (line['data'] && line['data'].length > 0) {
                hasData = true;
                if (line['data'].length > 0) {
                    dataSize = line['data'][0]['number'].length;
                    if (groupMemory['dataSize']) {
                        if (groupMemory['dataSize'] != dataSize) {
                            groupMemory['dataSize'] = dataSize;
                            groupMemory['dataSizeMismatch'] = true;
                            if (!isLastAmt && linesGroupLines.length > 0) {
                                linesGroupLines = [];
                                linesGrouping.push(linesGroupLines);
                            }
                        }
                    } else {
                        groupMemory['dataSize'] = dataSize;
                    }
                }
            }

            if (line['target'] && line['target'] != '') {
                targetValue = line['target'];
                if (!groupMemory['target'] || groupMemory['target'] != targetValue) {
                    linesGroupLines = [];
                    linesGrouping.push(linesGroupLines);
                    groupMemory['isLastItemTarget'] = true;
                }
                groupMemory['target'] = targetValue;
            }
            if (line['amount'] && line['amount'] != '') {
                if (linesGroupLines.length > 0) {
                    linesGroupLines = [];
                    linesGrouping.push(linesGroupLines);
                }
                amt = line['amount'];
                groupMemory['isLastAmount'] = true;
            }
            linesGroupLines.push(line);
        });
        //console.log('Lines Grouping:', JSON.stringify(linesGrouping, null, 2));
        linesGrouping.forEach((linesGroupLinesL, lgIdx) => {
            linesGroupLinesL.forEach((line) => {
                qtyValue = qty.length > 0 ? qty[0] : null;
                if (line['image']) {
                    outLines.push(`attachment:${line['image']}`);
                    return;
                }
                if (line['data'] && line['data'].length > 0) {
                    data = line['data'];
                    lineQty = line['qty'] ? line['qty'] : null;
                    value = data.forEach(d => {
                        let qtyValueLocal = lineQty ? lineQty : (qtyValue ? qtyValue : null);
                        let amtValueLocal = d['amount'] ? d['amount'] : (line['amount'] ? line['amount'] : amt);
                        let targetValueLocal = targetValue;

                        if (d['qty'] && d['qty'] != '') {
                            qtyValueLocal = d['qty'];
                        }
                        if (isOff) {
                            amtValueLocal += 'OFF';
                        }
                        if (line['target'] && line['target'] != '') {
                            targetValueLocal = line['target'];
                        }
                        if (d['target'] && d['target'] != '') {
                            targetValueLocal = d['target'];
                        }
                        if (d['number'] && d['number'] != '') {
                            n = d['number'];
                            finalBoxStatus = isBox || line['isBox'] ? true : false;
                            if (n.length == 1) {
                                if (targetValueLocal == 'ABC' || targetValueLocal == 'ALL') {
                                    targetValueLocal = 'ALL';
                                } else {
                                    // Take each char from targetValue and seperate by hyphen
                                    targetValueLocal = targetValueLocal ? targetValueLocal.split('').filter(c => c !== '-').sort().join('-') : '';
                                }
                                /*if (finalBoxStatus) {
                                    outLines.push(`1DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else */
                                if (isCut) {
                                    outLines.push(`1DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else {
                                    outLines.push(`1DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                }
                            } else if (n.length == 2) {
                                if (targetValueLocal == 'ABC') {
                                    targetValueLocal = 'ALL';
                                }
                                /*if (finalBoxStatus) {
                                    outLines.push(`2DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else */
                                if (isCut) {
                                    outLines.push(`2DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else {
                                    outLines.push(`2DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                }
                            } else if (n.length == 3) {
                                if (finalBoxStatus) {
                                    outLines.push(`3DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else if (isCut) {
                                    outLines.push(`3DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else {
                                    outLines.push(`3DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                }
                            } else if (n.length == 4) {
                                if (finalBoxStatus) {
                                    outLines.push(`4DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else if (isCut) {
                                    outLines.push(`4DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else {
                                    outLines.push(`4DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                }
                            } else if (n.length == 5) {
                                if (finalBoxStatus) {
                                    outLines.push(`5DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else if (isCut) {
                                    outLines.push(`5DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else {
                                    outLines.push(`5DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                }
                            }
                        }
                    });
                }
            });
        });
        groupedOutLines.push(outLines.length > 0 ? outLines.join('\n') : '\n' + FAILED_TO_PARSE + '\n');
    });
    //console.log(JSON.stringify(parsedData, null, 2));
    document.getElementById('outputData').value = groupedOutLines.join('\n---\n');
    return groupedOutLines;
}

/**
 * Expands range 00 TO 99 with appropriate increments
 */
function expandRange(from, to, cleanedMsg, allQtySet) {
    const vlen = from.toString().length;
    const diff = to - from;
    const formatNumber = (num, len) => num.toString().padStart(len, '0');

    let increment = 1;
    if (diff < 10) increment = 1;
    else if (diff < 100) increment = diff % 10 === 0 ? 10 : 11;
    else if (diff < 1000) increment = diff % 100 === 0 ? 100 : 111;
    else if (diff < 10000) increment = diff % 1000 === 0 ? 1000 : 1111;

    for (let i = from; i <= to; i += increment) {
        cleanedMsg['data'].push({
            number: formatNumber(i, vlen),
            qty: allQtySet || null
        });
    }
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

// ============================================================================
// SECTION 4: TABLE GENERATION & UI
// ============================================================================

function generateTable() {
    const inputData = document.getElementById('inputData').value;
    const outputData = document.getElementById('outputData');
    const showFailedParsing = document.getElementById('showFailedParsing').checked;

    // Parse input groups
    const lines = inputData.split('\n').filter(l => l.trim());
    let inputGroups = [];
    let msg = [];
    lines.forEach(line => {
        if (line.match(/.*?:/)) {
            if (msg.length) inputGroups.push(msg);
            msg = [];
        }
        msg.push(line);
    });
    if (msg.length) inputGroups.push(msg);

    // Parse output groups
    const outLines = outputData.value.split('\n').filter(l => l.trim());
    let outGroups = [];
    let outMsg = [];
    outLines.forEach(line => {
        if (line.includes('---')) {
            if (outMsg.length) outGroups.push(outMsg);
            outMsg = [];
        } else {
            outMsg.push(line);
        }
    });
    if (outMsg.length) outGroups.push(outMsg);

    // Build table
    let tableHTML = `<table><thead><tr><th>#</th><th>Original</th><th>Formatted</th></tr></thead><tbody>`;
    const maxLen = Math.max(inputGroups.length, outGroups.length);

    for (let i = 0; i < maxLen; i++) {
        const inputMsg = inputGroups[i] ? inputGroups[i].join('\n') : '';
        const outputMsg = outGroups[i] ? outGroups[i].filter(l => l.trim() && !l.includes(FAILED_TO_PARSE)).join('\n') : '';
        const show = !showFailedParsing || outputMsg.includes(FAILED_TO_PARSE);
        imagePath = outputMsg.toUpperCase().replace('ATTACHMENT:', '').trim();
        const imageUrl = imageMap.get(imagePath);
        //console.log('Looking for image with key:', imagePath);
        //console.log('Available images in map:', Array.from(imageMap.keys()));
        //console.log('Found image URL:', imageUrl);

        // Build image HTML with fallback if image not found
        const imgHtml = imageUrl ? `<br/>
            <button class="extract-text-btn" data-image-name="${imagePath.toUpperCase()}">Extract Text</button>
            <br/>
            <img src="${imageUrl}" alt="${outputMsg}" style="max-width: 200px; margin-top: 10px;">
        ` : ``;
        // How to set focus on textarea after generating table - set focus on first textarea only
        tableHTML += `<tr style="display:${show ? 'table-row' : 'none'}"><td>${i + 1} <button class="delete-row-btn">Delete</button></td>
            <td><textarea id="original-msg-${i}" name="original-msg" class="original-msg" data-idx="${i}" rows="${inputGroups[i]?.length || 1}">${inputMsg}</textarea>${imgHtml}</td>
            <td><textarea id="formatted-msg-${i}" name="formatted-msg" class="formatted-msg" rows="${outGroups[i]?.length || 1}">${outputMsg}</textarea></td></tr>`;
    }

    tableHTML += `</tbody></table>`;
    document.getElementById('tableContainer').innerHTML = tableHTML;

    // Get element by attr data-idx and set focus
    if (lastFocusedTextareaIdx !== null) {
        const taToFocus = document.querySelector(`.original-msg[data-idx="${lastFocusedTextareaIdx}"]`);
        if (taToFocus) {
            //taToFocus.focus();
        }
    }

    // when changes done in original-msg, update inputData
    const originalMsgTextareas = document.querySelectorAll('.original-msg');
    originalMsgTextareas.forEach((ta, index) => {
        // After input change and focus out, update inputData
        ta.addEventListener("focus", e => {
            lastFocusedTextareaIdx = index;
            e.target.dataset.oldValue = e.target.value;
        });

        ta.addEventListener('blur', e => {
            if (e.target.value !== e.target.dataset.oldValue) {
                copyInputEditedData();
                parseMessages();
                generateTable();
                generateFinalOutput();
            }
        });
    });

    // Add event listener to delete row button
    const deleteRowButtons = document.querySelectorAll('.delete-row-btn');
    deleteRowButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            // Identify the row to delete
            const rowToDelete = btn.closest('tr');
            if (rowToDelete) {
                rowToDelete.remove();
                copyInputEditedData();
                parseMessages();
                generateTable();
                generateFinalOutput();
            }
        });
    });

    const extractTextButtons = document.querySelectorAll('.extract-text-btn');
    extractTextButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const imageName = btn.dataset.imageName;
            if (imageName) {
                imageToTextRequest(imageName, btn);
            } else {
                showErrorMessages(['Image not found for OCR']);
            }
        });
    });
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


function copyWhatsappInput() {
    const textarea = document.getElementById('inputData');
    if (textarea) {
        navigator.clipboard.writeText(textarea.value);
    }
}

function copyTextWithNewLine(txt) {
    navigator.clipboard.writeText('\n' + txt.trim() + '\n');
}


function copyTextarea(button) {
    const textarea = button.nextElementSibling;
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    // Change the all the textareas with class copied-now to class copied
    const copiedNowTextareas = document.querySelectorAll('.copied-now');
    copiedNowTextareas.forEach(ta => {
        ta.classList.remove('copied-now');
        ta.classList.add('copied');
    });
    // change textarea border color to green
    textarea.classList.remove('copied');
    textarea.classList.add('copied-now');
    navigator.clipboard.writeText(textarea.value).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied! @ ' + new Date().toLocaleTimeString();
        button.style.background = '#28a745';
        /*
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 1500);
        */
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });

}

function copyInputEditedData() {
    const msgs = document.querySelectorAll('.original-msg');
    let value = '';
    msgs.forEach(ta => value += ta.value + '\n');
    document.getElementById('inputData').value = value;
    // Save the input in the local storage
    localStorage.setItem('inputData', value);
}

function showInfoMessages(messages) {
    showMessages(messages, 'info');
}

function showErrorMessages(messages) {
    showMessages(messages, 'error');
}

function clearMessages() {
    const statusMessageDiv = document.getElementById('status-message');
    statusMessageDiv.className = 'status-message';
    statusMessageDiv.innerHTML = '';
}

function showSuccessMessages(messages) {
    showMessages(messages, 'success');
}

function showMessages(values, classNameValue) {
    // status-message
    const statusMessageDiv = document.getElementById('status-message');
    statusMessageDiv.className = 'status-message';
    statusMessageDiv.innerHTML = '';
    if (values.length > 0) {
        let errorHTML = '<ul>';
        values.forEach(msg => {
            errorHTML += `<li>${msg}</li>`;
        });
        errorHTML += '</ul>';
        statusMessageDiv.innerHTML = errorHTML;
        statusMessageDiv.classList.add(classNameValue);
    }
}

function renderFinalOutput(messageGroup, message) {
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
        if (firstValueSplits[0].length == 1) {
            allowedListSize = parseInt(document.getElementById('1dRecordLimit').value) || 50;
        } else if (firstValueSplits[0].length == 2) {
            allowedListSize = parseInt(document.getElementById('2dRecordLimit').value) || 50;
        } else if (firstValueSplits[0].length == 3) {
            allowedListSize = parseInt(document.getElementById('3dRecordLimit').value) || 100;
        } else if (firstValueSplits[0].length == 4) {
            allowedListSize = parseInt(document.getElementById('4dRecordLimit').value) || 40;
        } else if (firstValueSplits[0].length == 5) {
            allowedListSize = parseInt(document.getElementById('5dRecordLimit').value) || 40;
        }
        for (var slIdx = 0; slIdx < values.length; slIdx += allowedListSize) {
            lists.push(values.slice(slIdx, slIdx + allowedListSize));
        }
        lists.forEach((sublist, sublistIdx) => {
            idx++;
            if (idx % 6 === 0 && idx !== 0) {
                table += `</tr><tr>`;
            }
            // create new text area 
            table += `<td>
                    <div class="info-text">${key} - ${sublistIdx + 1}) ${sublist.length}/${values.length} entries</div>
                    <button class="copy-btn" data-action="copy" style="margin-bottom: 5px; padding: 4px 8px; font-size: 12px;">Copy</button>
                    <textarea class="output-textarea" placeholder="Formatted output..." rows="${values.length ? (values.length > 30 ? 30 : values.length + 1) : 1}">${sublist.join('\n')}</textarea>
                    </td>`;
        });
    });
    table += `</tr></tbody></table>`;
    // Append to finalOutputContent div
    document.getElementById('finalOutputContent').innerHTML += table;
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
            valueSplits = line.split(',');
            // when value 1 is not number
            if (valueSplits.length < 3) {
                Object.keys(messageGroup).forEach(key => keys.push(key));
                renderFinalOutput(messageGroup, label);
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
    renderFinalOutput(messageGroup, label);
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
    // Check the checkbox showFailedParsing is checked, if so, click #showOnlyErrorsBtn button
    if (document.getElementById('showFailedParsing').checked) {
        document.getElementById('showOnlyErrorsBtn').click();
    }
}

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

function plainTextNormalize(str) {

    function convertChar(ch) {
        const code = ch.codePointAt(0);

        // ---------- FULLWIDTH ASCII ----------
        if (code >= 0xFF01 && code <= 0xFF5E)
            return String.fromCharCode(code - 0xFEE0);

        // ---------- CIRCLED NUMBERS ----------
        if (code >= 0x2460 && code <= 0x2468)
            return String(code - 0x245F);
        if (code === 0x2469) return "10";

        // ---------- SUPERSCRIPT DIGITS ----------
        const superMap = {
            0x2070: "0", 0x00B9: "1", 0x00B2: "2", 0x00B3: "3",
            0x2074: "4", 0x2075: "5", 0x2076: "6",
            0x2077: "7", 0x2078: "8", 0x2079: "9"
        };
        if (superMap[code]) return superMap[code];

        // ---------- SUBSCRIPT DIGITS ----------
        if (code >= 0x2080 && code <= 0x2089)
            return String(code - 0x2080);

        // ---------- FANCY DIGIT RANGES ----------
        const digitRanges = [
            [0x1D7CE, 0x1D7D7], // bold
            [0x1D7D8, 0x1D7E1], // double struck
            [0x1D7E2, 0x1D7EB], // sans
            [0x1D7EC, 0x1D7F5], // sans bold
            [0x1D7F6, 0x1D7FF], // monospace
        ];
        for (const [s, e] of digitRanges)
            if (code >= s && code <= e)
                return String(code - s);

        // ---------- LETTER RANGES ----------
        const letterRanges = [
            // Bold
            [0x1D400, 0x1D419, 65], [0x1D41A, 0x1D433, 97],
            // Italic
            [0x1D434, 0x1D44D, 65], [0x1D44E, 0x1D467, 97],
            // Bold Italic
            [0x1D468, 0x1D481, 65], [0x1D482, 0x1D49B, 97],
            // Sans-serif
            [0x1D5A0, 0x1D5B9, 65], [0x1D5BA, 0x1D5D3, 97],
            // Sans-serif Bold
            [0x1D5D4, 0x1D5ED, 65], [0x1D5EE, 0x1D607, 97],
            // Monospace
            [0x1D670, 0x1D689, 65], [0x1D68A, 0x1D6A3, 97],
        ];
        for (const [s, e, b] of letterRanges)
            if (code >= s && code <= e)
                return String.fromCharCode(b + (code - s));

        // ---------- DOUBLE-STRUCK LETTERS ----------
        const specialDouble = {
            'ℂ': 'C', 'ℍ': 'H', 'ℕ': 'N', 'ℙ': 'P', 'ℚ': 'Q', 'ℝ': 'R', 'ℤ': 'Z'
        };
        if (specialDouble[ch]) return specialDouble[ch];

        if (code >= 0x1D538 && code <= 0x1D551)
            return String.fromCharCode(65 + (code - 0x1D538));

        if (code >= 0x1D552 && code <= 0x1D56B)
            return String.fromCharCode(97 + (code - 0x1D552));

        // ---------- CLEAN INVISIBLE MARKS ----------
        if (code === 0x200E || code === 0x200F)
            return "";

        return ch;
    }

    let out = [...str].map(convertChar).join('');

    // ---------- WHITESPACE CLEAN ----------
    out = out.replace(/\s+/g, ' ').trim();

    return out;
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

function fixWords(text) {
    return text.replace(/\b\w+\b/g, w =>
        dict[w.toLowerCase()] || w
    );
}

// Parse Data functionality
document.addEventListener('DOMContentLoaded', () => {

    // ============================================================================
    // SECTION 5: EVENT LISTENERS
    // ============================================================================

    // Initialize tab functionality
    initializeTabs();
    // CSP-safe delegated click handlers (replaces inline `onclick` usage)
    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (actionEl) {
            e.preventDefault();
            const action = actionEl.dataset.action;
            switch (action) {
                case 'copy':
                    copyTextarea(actionEl);
                    actionEl.textContent = 'Copied!';
                    break;
                case 'copy-with':
                    copyTextWithNewLine(actionEl.dataset.value || '');
                    break;
                case 'copy-whatsapp':
                    copyWhatsappInput();
                    actionEl.textContent = 'Copied!';
                    break;
                default:
                    // unknown data-action; do nothing
                    break;
            }
            return;
        }

        // fallback: delete row button (keeps existing class-based behavior)
        const delBtn = e.target.closest('button.delete-row-btn');
        if (delBtn) {
            const row = delBtn.closest('tr');
            if (row) {
                row.remove();
                copyInputEditedData();
                parseMessages();
                generateTable();
                generateFinalOutput();
            }
            return;
        }

        // fallback: extract text button with data-image-name
        const extractBtn = e.target.closest('button.extract-text-btn[data-image-name]');
        if (extractBtn) {
            const imageName = extractBtn.dataset.imageName;
            if (imageName) imageToTextRequest(imageName, extractBtn);
            return;
        }
    });

    document.getElementById('parseInputBtn')?.addEventListener('click', () => {
        parseMessages();
        generateTable();
        generateFinalOutput();
    });

    document.getElementById('processBtn')?.addEventListener('click', generateTable);

    document.getElementById('copyEditedInputDataBtn')?.addEventListener('click', () => {
        copyInputEditedData();
    });

    document.getElementById('copyEditedDataBtn')?.addEventListener('click', () => {
        const msgs = document.querySelectorAll('.formatted-msg');
        let value = '';
        msgs.forEach(ta => value += ta.value + '\n---\n');
        document.getElementById('outputData').value = value;
    });

    document.getElementById('processZipBtn')?.addEventListener('click', (event) => {
        parseZipFile(event);
    });

    document.getElementById('showOnlyErrorsBtn')?.addEventListener('click', () => {
        document.getElementById('validate-tab').click();
        // find elements with data-error attribute
        const formattedMessages = document.querySelectorAll('.formatted-msg');
        formattedMessages.forEach(textarea => {
            //tr>td>textarea
            const row = textarea.closest('tr');
            if (textarea.getAttribute('data-error')) {
                // show the row of the textarea
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
    document.getElementById('showAllBtn')?.addEventListener('click', () => {
        document.getElementById('validate-tab').click();
        const formattedMessages = document.querySelectorAll('.formatted-msg');
        formattedMessages.forEach(textarea => {
            const row = textarea.closest('tr');
            row.style.display = 'block';
        });
    });
    // Generate final output
    document.getElementById('generateFinalOutputBtn').addEventListener('click', function () {
        const btn = document.getElementById('generateFinalOutputBtn');
        originalText = btn.textContent;
        btn.textContent = "Button clicked ✓";
        generateFinalOutput();
        setTimeout(() => document.getElementById('generateFinalOutputBtn').textContent = 'Gen Output', 1500);
    });

    // When input data loose focus, update table
    document.getElementById('inputData')?.addEventListener('blur', () => {
        // Save the input in the local storage
        localStorage.setItem('inputData', document.getElementById('inputData').value);
        parseMessages();
        generateTable();
        generateFinalOutput();
    });

    // set default value of inputData textarea from local storage if available
    const savedInputData = localStorage.getItem('inputData');
    if (savedInputData) {
        document.getElementById('inputData').value = savedInputData;
        const savedImageMap = localStorage.getItem('imageMap');
        if (savedImageMap) {
            imageMap = new Map(JSON.parse(savedImageMap));
        }
        const savedVisionRequests = localStorage.getItem('visionRequests');
        if (savedVisionRequests) {
            visionRequests = new Map(JSON.parse(savedVisionRequests));
        }
        parseMessages();
        generateTable();
        generateFinalOutput();
    }

    // Save button saveInputDataBtn
    document.getElementById('saveInputDataBtn')?.addEventListener('click', () => {
        copyInputEditedData();
        // Allow to download the input data as txt file
        // give save as button functionality to download the input data as txt file
        const inputData = document.getElementById('inputData').value;
        if (!inputData || inputData.trim() === '') {
            alert('Input data is empty. Please enter some data to save.');
            return;
        }
        const blob = new Blob([inputData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.textContent = 'Download input data';
        a.download = 'input_data.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    window.addEventListener('beforeunload', function (event) {
        event.preventDefault(); // Prevent the default action
        event.returnValue = ''; // Display a confirmation dialog
    });
});
