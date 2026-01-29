/**
   * WhatsApp Data Extract & Format - v1
   * Parses WhatsApp lottery/betting messages and formats them into structured CSV format
   * 
   * Format: type,number,qty,amount,category (exactly 5 fields)
   * Example output: 3DTkt,456,2,60,
   */
// Chrome web javascript extension parse-data-v1.js
const FAILED_TO_PARSE = 'FAILED TO PARSE';

var lastFocusedTextareaIdx = 0;

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
    console.log('Cleaning line: ' + line);
    return line.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
}

function parseMessages() {
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

            // replace board ''
            const replacements = [
                "KL",
                "KERALA",
                "PM.3",
                "DR.1",
                "DIAR",
                "DEAR 6PM",
                "DEAR6PM",
                "DEAR6",
                "DEAR 6",
                "DEAR 1 PM",
                "DEAR1",
                "DEAR-1",
                "DEER",
                "DIAR",
                "DR",
                //8
                "DEAR 8PM",
                "DEAR1PM",
                "DEAR8PM",
                "DEAR-8",
                "DEAR8",
                "1.PM",
                "1 PM",
                "1PM",
                "8PM",
                "6PM",
                "3.PM",
                "3 PM",
                "6.PM",
                "3PM",
                "DEAR",
                "BOARD",
                "BORD",
                "KL"
            ];
            replacements.forEach(item => {
                line = line.replace(item, "");
            });

            // If line contains only date like 
            // Replace double .. with single .
            // replace double ,, or spaces with single space
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
            /*
            line = line.replace('ACBCAB', 'ALL'); // replace multiple spaces with single space
            line = line.replace('ABBCAC', 'ALL'); // replace multiple spaces with single space
            line = line.replace('BCABAC', 'ALL'); // replace multiple spaces with single space
            line = line.replace('BCACAB', 'ALL'); // replace multiple spaces with single space
            line = line.replace('ACABBC', 'ALL'); // replace multiple spaces with single space
            line = line.replace('ACBCAB', 'ALL'); // replace multiple spaces with single space
            line = line.replace("ABAC", "AB-AC"); // replace multiple spaces with single space
            line = line.replace("ACAB", "AC-AB"); // replace multiple spaces with single space
            line = line.replace("BCAB", "BC-AB"); // replace multiple spaces with single space
            line = line.replace("ABBC", "AB-BC"); // replace multiple spaces with single space
            line = line.replace("ACBC", "AC-BC"); // replace multiple spaces with single space
            line = line.replace("BCAC", "BC-AC"); // replace multiple spaces with single space
            // Ab.ac.bc
            line = line.replace("AB.AC.BC", "ALL"); // replace multiple spaces with single space
            line = line.replace("AC.AB.BC", "ALL");
            line = line.replace("BC.AB.AC", "ALL");
            line = line.replace("AB.BC.AC", "ALL");
            line = line.replace("AC.BC.AB", "ALL");
            line = line.replace("BC.AC.AB", "ALL");
            // Ab.ac
            line = line.replace("AB.AC", "AB-AC");
            line = line.replace("AC.AB", "AC-AB");
            line = line.replace("BC.AB", "BC-AB");
            line = line.replace("AB.BC", "AB-BC");
            line = line.replace("AC.BC", "AC-BC");
            line = line.replace("BC.AC", "BC-AC");
            //A.B
            line = line.replace("A.B", "A-B");
            line = line.replace("B.A", "B-A");
            line = line.replace("A.C", "A-C");
            line = line.replace("C.A", "C-A");
            line = line.replace("B.C", "B-C");
            line = line.replace("C.B", "C-B");
            line = line.replace("AB,AC,BC", "ALL");

            line = line.replace("AB AC BC", "ALL");
            line = line.replace("AC AB BC", "ALL");
            line = line.replace("BC AB AC", "ALL");
            line = line.replace("AB BC AC", "ALL");
            line = line.replace("AC BC AB", "ALL");
            line = line.replace("BC AC AB", "ALL");
            line = line.replace("AB-BC-AC", "ALL");
            line = line.replace("AC-BC-AB", "ALL");
            line = line.replace("BC-AC-AB", "ALL");
            line = line.replace("BC-AB-AC", "ALL");

            line = line.replace("AB AC", "AB-AC");
            line = line.replace("AC AB", "AC-AB");
            line = line.replace("BC AB", "BC-AB");
            line = line.replace("AB BC", "AB-BC");
            line = line.replace("AC BC", "AC-BC");
            line = line.replace("BC AC", "BC-AC");
            line = line.replace("ABC", "ALL");
            line = line.replace("A-B-C", "ALL");
            line = line.replace("A B C", "ALL");
            line = line.replace("B A C", "ALL");
            line = line.replace("C A B", "ALL");
            line = line.replace("B C A", "ALL");
            line = line.replace("C B A", "ALL");
            line = line.replace("A B", "A-B");
            line = line.replace("B A", "B-A");
            line = line.replace("A C", "A-C");
            line = line.replace("C A", "C-A");
            line = line.replace("B C", "B-C");
            line = line.replace("C B", "C-B");
            */
            line = line.replaceAll('CHANCE', 'SET');
            //line = line.replaceAll('CH', 'SET');
            line = line.replace("ABBCAC", "ALL"); // replace multiple spaces with single space
            line = line.replaceAll('ECH', 'EACH'); // replace multiple spaces with single space
            line = cleanupLine(line);
            targetRegexMatch = line.match(/\b(?:AB|AC|BC)\b(?:[.,=\s]+\b(?:AB|AC|BC)\b)*/gi)
            if (targetRegexMatch) {
                matchedVal = targetRegexMatch[0].toUpperCase().replace(/[\.,=\s]+/g, '-');
                // split the matche value by any special character
                const parts = matchedVal.split('-');
                // sort parts alphabetically
                parts.sort();
                joinedParts = parts.join('-');
                // If joined parts are AB-AC-BC | A-B-C | ABC then replace with ALL
                if (joinedParts === 'AB-AC-BC' || joinedParts === 'A-B-C' || joinedParts === 'ABC') {
                    line = line.replace(targetRegexMatch[0], 'ALL').trim();
                } else {
                    line = line.replace(targetRegexMatch[0], joinedParts).trim();
                }
            }
            // If value matches AB BC AC with any combination or any special characters between them replace with ALL
            // If matches AB,AC,BC,ALL,AB-BC,AC-BC,BC-AC,BC-AB
            const categoryMatch = line.replace(' ', '').match(/^(AB|BC|AC|A|B|C|AB-AC-BC|AB-BC-AC|BC-AB-AC|BC-AB-AC|AC-AB-BC|AC-BC-AB|AB-BC|AB-AC|AC-AB|AC-BC|BC-AC|BC-AB|ALL|A-B-C|ABC|AB AC|AB BC|AC BC|AB AC BC|AB BC AC|AC AB BC|AC BC AB|BC AB AC|BC AC AB|ABAC|ABBC|BCAB|BCAC)$/);
            if (categoryMatch) {
                cleandMsg['target'] = categoryMatch[1];
                lastTarget = categoryMatch[1];
                line = line.replace(categoryMatch[1], '')
                return;
            } else if (lastTarget != '') {
                cleandMsg['target'] = lastTarget;
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
                cleandMsg['CUT'] = true;
                line = line.replace('CUT', ' ').trim();
                if (line === '')
                    return;
            }

            // If line matches RS.30 or RS30 or RS 30, replace space and hyphen with empty string
            const rsMatch = line.match(/^RS[\.\s=\/_,]*([\d]+)[\s\.]*/i);
            if (rsMatch) {
                cleandMsg['amount'] = rsMatch[1];
                line = line.replace(rsMatch[0], ' ').trim();
                if (line === '') {
                    return;
                }
            }

            // If line matches 30 RS or 30RS
            const endrsMatch = line.replace(/[\s\-]/g, '').match(/^(\d+)[\.\s\,]?RS$/);
            if (endrsMatch) {
                cleandMsg['amount'] = endrsMatch[1];
                return;
            }

            // If line matchs ₹30 or ₹.30
            const inrMatch = line.replace(/[\s\-]/g, '').match(/^₹[\.\s\,]?(\d+)$/);
            if (inrMatch) {
                cleandMsg['amount'] = inrMatch[1];
                return;
            }

            // If rs30 matches with part of line
            const partRsMatch = line.match(/RS[\s.,-]?(\d+)/);
            if (partRsMatch) {
                cleandMsg['amount'] = partRsMatch[1];
                line = cleanupLine(line.replace(partRsMatch[0], ' '));
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
            line = cleanupLine(line.replace(/[^A-Z0-9]+/g, '~')).trim();

            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            const setMatch = line.match(/^(\d{1,5})[~]+(\d{1,5})(SET|SETS)?$/);
            if (setMatch) {
                cleandMsg['data'].push({ number: setMatch[1], qty: setMatch[2] });
                return;
            }

            // Support for 555-9set or 555-9SET
            const dashSetMatch = line.match(/^(\d{1,5})~(\d{1,5})~?(SET|SETS|ST)?$/i);
            if (dashSetMatch) {
                cleandMsg['data'].push({ number: dashSetMatch[1], qty: dashSetMatch[2] });
                return;
            }
            line = cleanupLine(line);
            // Check line matches AC-80-10
            const starMatch = line.match(/^(AB|AC|BC|ABC|ALL|AB-AC|AB-BC|AC-BC|A|B|C)~(\d{1,5})~(\d{1,5})~?(SET|SETS|ST|CH|CHANCE|E)?$/);
            if (starMatch) {
                cleandMsg['data'].push({ target: starMatch[1], number: starMatch[2], qty: starMatch[3] });
                return;
            }

            // Check line matches ALL-50set or ALL~50set or ALL~50~SET
            const targetAndQtyMatch = line.match(/^(AB|AC|BC|ABC|ALL|AB-AC|AB-BC|AC-BC|A|B|C)~?(\d{1,5})~?(SET|SETS|ST|CH|CHANCE|E)$/);
            if (targetAndQtyMatch) {
                cleandMsg['target'] = targetAndQtyMatch[1];
                cleandMsg['qty'] = targetAndQtyMatch[2];
                return;
            }

            // Check line matches ALL-50set or ALL~50set or ALL~50~SET
            const targetAndNumberMatch = line.match(/^(AB|AC|BC|ABC|ALL|AB-AC|AB-BC|AC-BC|A|B|C)~?(\d{1,5})~?$/);
            if (targetAndNumberMatch) {
                cleandMsg['data'].push({ target: targetAndNumberMatch[1], number: targetAndNumberMatch[2] });
                return;
            }

            // All-50set
            const allSetMatch = line.match(/^(ALL)~(\d{1,5})(SET|SETS)$/);
            if (allSetMatch) {
                allQtySet = allSetMatch[2];
                return;
            }

            // If line matches 20E or 25E
            const eMatch = line.match(/^(\d{1,5})E$/);
            if (eMatch) {
                cleandMsg['qty'] = eMatch[1];
                return;
            }

            // If line matches 20E or 25E
            const stMatch = line.match(/^(\d{1,5})ST$/);
            if (stMatch) {
                cleandMsg['qty'] = stMatch[1];
                return;
            }
            // If matches EACH 10SET
            const eachMatch = cleanupLine(line.replaceAll("~", "").match(/^EACH?(\d{1,5})(SET|SETS|CH|CHANCE)$/));
            if (eachMatch) {
                cleandMsg['qty'] = eachMatch[1];
                return;
            }

            // If matches 10SET
            const qsetMatch = line.replaceAll("~", "").match(/^(\d{1,5})(SET|SETS|CH|CHANCE)$/);
            if (qsetMatch) {
                cleandMsg['qty'] = qsetMatch[1];
                return;
            }

            // If matches EACH EACH10
            const echMatch = line.replaceAll("~", "").match(/^EACH?(\d{1,5})$/);
            if (echMatch) {
                cleandMsg['qty'] = echMatch[1];
                return;
            }
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

            // If line match number only
            const numMatch = line.match(/^(\d{1,5})$/);
            if (numMatch) {
                cleandMsg['data'].push({ number: numMatch[1], qty: allQtySet && allQtySet != '' ? allQtySet : null });
                return;
            }

            // matches 07,70-75E consider as numbers separated by , and - numberE as qty
            if (line.includes('~') && line.endsWith('E')) {
                values = line.split('~');
                if (values.length > 1) {
                    lastPart = values[values.length - 1];
                    const qtyMatch = lastPart.match(/^(\d{1,5})E$/);
                    if (qtyMatch) {
                        cleandMsg['qty'] = qtyMatch[1];
                        values = values.slice(0, values.length - 1);
                    }
                }
                firstPart = values[0];
                if (firstPart.includes(',')) {
                    nums = firstPart.split(',');
                    nums.forEach(num => {
                        num = num.trim();
                        const partNumMatch = num.match(/^(\d{1,5})$/);
                        if (partNumMatch) {
                            cleandMsg['data'].push({ number: partNumMatch[1] });
                        }
                    });
                    return;
                }
            }

            // If value matches \d~\d
            const slashMatch = line.match(/^(\d{1,5})~(\d{1,5})$/);
            if (slashMatch) {
                number1 = slashMatch[1];
                number2 = slashMatch[2];
                if (number1.length > 2 && number2.length == number1.length) {
                    // pad the number2 with leading zeros
                    cleandMsg['data'].push({ number: slashMatch[1] });
                    cleandMsg['data'].push({ number: slashMatch[2] });
                } else {
                    cleandMsg['data'].push({ number: slashMatch[1], qty: slashMatch[2] });
                }
                return;
            }

            // If line matches 026-3 or 16-1set or 16-3t
            const equalMatch = line
                .replace(' ', '')
                .match(/^(\d{1,5})~(\d{1,5})(?:SET|SETS|T)?$/i);

            if (equalMatch) {
                cleandMsg['data'].push({
                    number: equalMatch[1], // 026 or 16
                    qty: equalMatch[2]     // 3 or 1
                });
                return;
            }

            // If line matches AC-60-20set or Bc. 25.5.set
            const dashMatch = line.match(/^(A|B|C|ALL|AB|AC|BC|ABC)-?(\d{1,5})[~]+(\d{1,5})~?(SET|SETS|ST|CH|E|.)?$/);
            if (dashMatch) {
                let numberPart = dashMatch[2];
                let qtyPart = dashMatch[3];
                if (dashMatch[1]) {
                    cleandMsg['data'].push({ target: dashMatch[1], number: numberPart, qty: qtyPart });
                    cleandMsg['target'] = dashMatch[1];
                } else {
                    cleandMsg['data'].push({ number: numberPart, qty: qtyPart });
                }
                return;
            }

            // If matches BC-69-96-10SET add Target BC and numbers 69 and 96 with qty 10
            const multiDashMatch = line.replace(/\s/g, '').match(/^(A|B|C|ALL|AB|AC|BC|ABC)~(\d{1,5})~(\d{1,5})~(\d{1,5})(SET|SETS)?$/);
            if (multiDashMatch) {
                let numberPart1 = multiDashMatch[2];
                let numberPart2 = multiDashMatch[3];
                let qtyPart = multiDashMatch[4];
                if (multiDashMatch[1]) {
                    cleandMsg['data'].push({ target: multiDashMatch[1], number: numberPart1, qty: qtyPart });
                    cleandMsg['data'].push({ target: multiDashMatch[1], number: numberPart2, qty: qtyPart });
                    cleandMsg['target'] = multiDashMatch[1];
                } else {
                    cleandMsg['data'].push({ number: numberPart1, qty: qtyPart });
                    cleandMsg['data'].push({ number: numberPart2, qty: qtyPart });
                }
                return;
            }

            // AC-10SET or BC-10SET or AB-10SET or A-10 or AC-BC-35SET
            targetQtyRegex = /(?:\b(AC|BC|AB)\b(?:~+(AC|BC|AB))*)~+(\d+)/i;
            const targetQtyMatch = line.match(targetQtyRegex);
            if (targetQtyMatch) {
                let targets = targetQtyMatch[1].toUpperCase();
                let qty = targetQtyMatch[3];
            }

            // BC-25-5-SET
            const dotSetMatch = line.replace(/\s/g, '').match(/^(A|B|C|ALL|AB|AC|BC)~(\d{1,5})~(\d{1,5})(SET|SETS)+$/);
            if (dotSetMatch) {
                cleandMsg['data'].push({ target: dotSetMatch[1], number: dotSetMatch[2], qty: dotSetMatch[3] });
                return;
            }

            // Check value matches A 3/45
            const targetSlashMatch = line.match(/^(A|B|C|ALL|AB|AC|BC)~(\d{1,5})\/(\d{1,5})$/);
            if (targetSlashMatch) {
                cleandMsg['data'].push({ target: targetSlashMatch[1], number: targetSlashMatch[2], qty: targetSlashMatch[3] });
                cleandMsg['target'] = targetSlashMatch[1];
                return;
            }

            //When value matches Bc88-5
            const dotMatch = line.match(/^(A|B|C|ALL|AB|AC|BC)(\d{1,5})~(\d{1,5})$/);
            if (dotMatch) {
                cleandMsg['data'].push({ target: dotMatch[1], number: dotMatch[2], qty: dotMatch[3] });
                return;
            }

            const isValid = /^\d+(?:[~]\d+)(SET|SETS)?$/.test(line.trim());
            if (isValid) {
                const numbers = line.match(/\d+/g).map(Number);
                numbers.forEach(num => {
                    cleandMsg['data'].push({ number: num.toString() });
                });
                return;
            }

            // Support for 45*2 as number=45, qty=2
            const starQtyMatch = line.replace(/ /g, "").match(/^(\d{1,5})~(\d{1,5})$/);
            if (starQtyMatch) {
                cleandMsg['data'].push({ number: starQtyMatch[1], qty: starQtyMatch[2] });
                return;
            }

            //A3x5
            const xMatch = line.replace(/ /g, "").match(/^(A|B|C|ALL|AB|AC|BC)?(\d{1,5})X(\d{1,5})$/);
            if (xMatch) {
                cleandMsg['data'].push({ target: xMatch[1], number: xMatch[2], qty: xMatch[3] });
                return;
            }

            // Target and number match ALL 50 or AC 90
            const targetNumberMatch = line.match(/^(ALL|ABC|AB|AC|BC|A|B|C)~(\d{1,5})$/i);
            if (targetNumberMatch) {
                cleandMsg['data'].push({ target: targetNumberMatch[1], number: targetNumberMatch[2] });
                cleandMsg['target'] = targetNumberMatch[1];
                return;
            }

            //^\d+(?:~\d+)+$
            const multiNumberMatch = line.replace(/ /g, "").match(/^(\d{1,5})(~(\d{1,5}))+$/);
            if (multiNumberMatch) {
                const nums = line.split('~');
                var lastNumLen = 0;
                var skipNext = false;
                for (let i = 0; i < nums.length; i++) {
                    part = nums[i];
                    if (skipNext) {
                        skipNext = false;
                        continue;
                    }
                    if (lastNumLen == 0) {
                        lastNumLen = part.length;
                    }
                    if (part.length == lastNumLen) {
                        var qty = null;
                        if (i + 1 < nums.length) {
                            const nextPart = nums[i + 1];
                            if (nextPart.length != lastNumLen) {
                                // consider as qty for last number
                                qty = nextPart;
                                skipNext = true;
                            }
                        }
                        cleandMsg['data'].push({ number: part, qty: qty });
                    } else {
                        // consider as qty for last number
                        if (cleandMsg['data'].length > 0) {
                            cleandMsg['data'][cleandMsg['data'].length - 1]['qty'] = part;
                        }
                    }
                }
                return;
            }

            // If line matches 123-4ST or 123-4T or 123-4CH or 123-4SET

            const doubleHyphenMatch = line.match(/^(\d+)~(\d+)(ST|T|CH|SET)?$/);
            if (doubleHyphenMatch) {
                cleandMsg['data'].push({ number: doubleHyphenMatch[1], qty: doubleHyphenMatch[2] });
            }

            const splitByHyphen = line.split('~');
            if (splitByHyphen.length > 1) {
                // for loop through all parts
                // Last part type 
                numberLen = 0;
                lastTarget = '';
                for (let i = 0; i < splitByHyphen.length; i++) {
                    part = splitByHyphen[i];
                    if (part.length <= 5 && /^\d{1,5}$/.test(part)) {
                        if (part.length == numberLen || numberLen == 0) {
                            if ((part.length == 1 || part.length == 2) && lastTarget.length == part.length) {
                                cleandMsg['target'] = lastTarget;
                            }
                            cleandMsg['data'].push({ number: part });
                            numberLen = part.length;
                            continue;
                        } else {
                            // consider as qty for last number
                            if (cleandMsg['data'].length > 0) {
                                cleandMsg['data'][cleandMsg['data'].length - 1]['qty'] = part;
                            }
                        }
                    } else {
                        // If matches AB AC BC ALL 
                        const targetMatch = part.match(/^(ALL|ABC|AB|AC|BC|A|B|C)$/i);
                        if (targetMatch) {
                            cleandMsg['target'] = targetMatch[1];
                            lastTarget = targetMatch[1];
                            numberLen = lastTarget.length;
                            continue;
                        }
                    }
                }
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
        }

        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            idx = i;

            if (line['data'] && line['data'].length > 0) {
                hasData = true;
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
                                d['qty'] = messageQty;
                                line['data'].push({ number: lastQty, qty: messageQty });
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
                                        d['qty'] = messageQty;
                                        line['data'].push({ number: lastQty, qty: messageQty });
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
            /*
            if (line['qty']) {
                qty.push(line['qty']);
                if (idx > 0) {
                    // sublist
                    lines.slice(lastQtyUpdatedIndex, idx).forEach((subline) => {
                        if (subline['data'].length == 1) {
                            origQty = subline['data'][0]['qty'];
                            subline['qty'] = line['qty'];
                            subline['data'][0]['qty'] = line['qty'];
                            if (origQty && origQty != '') {
                                subline['data'].push({ number: origQty, qty: line['qty'] });
                            }
                        }
                    });
                    lastQtyUpdatedIndex = idx + 1;
                }
            }
                */
            if (line['target'] && line['target'] != '') {
                targetValue = line['target'];

            }
            if (line['amount'] && line['amount'] != '') {
                amt = line['amount'];
            }
            if (line['amount'] && line['amount'] != '') {
                lastAmt = line['amount'];
            }
            if (line['data'] && line['data'].length > 0) {
                line['data'].forEach((d) => {
                    // If number value digits length is 3 or more and amount is missing then assign amt
                    if (d['number'] && d['number'].length >= 3 && (!d['amount'] || d['amount'] == '')) {
                        d['amount'] = amt;
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
                                if (finalBoxStatus) {
                                    outLines.push(`1DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else if (isCut) {
                                    outLines.push(`1DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else {
                                    outLines.push(`1DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                }
                            } else if (n.length == 2) {
                                if (targetValueLocal == 'ABC') {
                                    targetValueLocal = 'ALL';
                                }
                                if (finalBoxStatus) {
                                    outLines.push(`2DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else if (isCut) {
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
        // How to set focus on textarea after generating table - set focus on first textarea only
        tableHTML += `<tr style="display:${show ? 'table-row' : 'none'}"><td>${i + 1}</td>
            <td><textarea class="original-msg" data-idx="${i}" rows="${inputGroups[i]?.length || 1}">${inputMsg}</textarea></td>
            <td><textarea class="formatted-msg" rows="${outGroups[i]?.length || 1}">${outputMsg}</textarea></td></tr>`;
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

    navigator.clipboard.writeText(textarea.value).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#28a745';

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 1500);
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
    // Read keys from messageGroup and generate final output - sort keys first
    const sortedKeys = Object.keys(messageGroup).sort();
    // Create table and insert textarea into table column - print lines of table
    var table = `<h3>${message}</h3><img src="${message.replace('attachment:', '')}" alt="${message}" style="max-width: 200px; margin-top: 10px;"><table>
            <tbody><tr>`;
    var idx = 0;
    var allowedListSize = 40;
    sortedKeys.forEach(function (key, index) {
        const values = messageGroup[key];
        let output = '';
        var lists = [];
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
                    <button class="copy-btn" onclick="copyTextarea(this)" style="margin-bottom: 5px; padding: 4px 8px; font-size: 12px;">Copy</button>
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
    formattedMessages.forEach((textarea, index) => {
        const content = textarea.value.trim();
        // split content by new line and store
        values = content.split('\n').filter(line => line.replaceAll('"', '').trim() !== '');
        totalRecords += values.length;
        values.forEach(line => {
            valueSplits = line.split(',');
            // when value 1 is not number
            if (valueSplits.length < 3) {
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
                        errorMessages.push('1D Ticket number length should be 1 digit only: ' + valueSplits[1]);
                    }
                    if (valueSplits[4] == '') {
                        errorMessages.push('Target (Last value) must not be empty for: ' + line);
                    }
                    break;
                case '2':
                    if (valueSplits[1].length != 2) {
                        errorMessages.push('2D Ticket number length should be 2 digits only: ' + valueSplits[1]);
                    }
                    if (valueSplits[4] == '') {
                        errorMessages.push('Target (Last value) must not be empty for: ' + line);
                    }
                    break;
                case '3':
                    if (valueSplits[1].length != 3) {
                        errorMessages.push('3D Ticket number length should be 3 digits only: ' + valueSplits[1]);
                    }
                    break;
                case '4':
                    if (valueSplits[1].length != 4) {
                        errorMessages.push('4D Ticket number length should be 4 digits only: ' + valueSplits[1]);
                    }
                    break;
                case '5':
                    if (valueSplits[1].length != 5) {
                        errorMessages.push('5D Ticket number length should be 5 digits only: ' + valueSplits[1]);
                    }
                    break;
            }

            if (valueSplits[2] === '') {
                //alert('Quantity is missing for line: ' + line);
                errorMessages.push('Quantity is missing for line: ' + line);
            }

            l = valueSplits[1] + ',' + valueSplits[2] + ',' + targetValue;
            if (messageGroup[key]) {
                messageGroup[key].push(l);
            } else {
                messageGroup[key] = [l];
            }
        });
    });
    renderFinalOutput(messageGroup, label);
    if (errorMessages.length > 0) {
        // Add total records as first message
        errorMessages.unshift('Total records: ' + totalRecords + '. Please fix the following errors:');
        showErrorMessages(errorMessages);
    } else {
        showSuccessMessages(['Total records: ' + totalRecords + '. Final output generated successfully!']);
    }
}

/*
    Read the zip file from input element and parse the data
    Once read clean local dir.
    extract zip file to chrome extension local dir
    Identify all txt files in the extracted dir
    Read each txt file and place in the inputData textarea
*/
function parseZipFile(event) {
    const file = document.getElementById('zipInput').files[0];
    // Show extension dir name
    console.log('Selected zip file:', file.name);
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            JSZip.loadAsync(arrayBuffer).then(function (zip) {
                let allTextPromises = [];
                zip.forEach(function (relativePath, zipEntry) {
                    if (zipEntry.name.endsWith('.txt')) {
                        const textPromise = zipEntry.async('string').then(function (fileData) {
                            return fileData;
                        });
                        allTextPromises.push(textPromise);
                    } else {

                    }
                });
                Promise.all(allTextPromises).then(function (allTexts) {
                    document.getElementById('inputData').value = allTexts.join('\n');
                    // Save the input in the local storage
                    localStorage.setItem('inputData', document.getElementById('inputData').value);
                    parseMessages();
                    generateTable();
                    generateFinalOutput();
                });
            });
        };
        reader.readAsArrayBuffer(file);
    }
}

// Parse Data functionality
document.addEventListener('DOMContentLoaded', () => {

    // ============================================================================
    // SECTION 5: EVENT LISTENERS
    // ============================================================================

    // Initialize tab functionality
    initializeTabs();

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
});
