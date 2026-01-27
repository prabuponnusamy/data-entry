/**
   * WhatsApp Data Extract & Format - v1
   * Parses WhatsApp lottery/betting messages and formats them into structured CSV format
   * 
   * Format: type,number,qty,amount,category (exactly 5 fields)
   * Example output: 3DTkt,456,2,60,
   */

const FAILED_TO_PARSE = 'FAILED TO PARSE';

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
            // replace board ''
            const replacements = [
                "DR.1",
                "DIAR",
                "DEAR 6PM",
                "DEAR6PM",
                "DEAR6",
                "DEAR 6",
                "DEAR 1 PM",
                "DEAR1",
                "DEAR-1",
                "DR=1",
                //8
                "DEAR 8PM",
                "DEAR1PM",
                "DEAR8PM",
                "DEAR8",
                "1.PM",
                "1PM",
                "DEAR",
                "BOARD",
                "KL"
            ];
            replacements.forEach(item => {
                line = line.replace(item, "");
            });
            line = line.trim();

            // If line contains ':'
            if (line.includes(':')) {
                line = line.substring(line.lastIndexOf(':') + 1).trim();
            }
            // Replace double .. with single .
            // replace double ,, or spaces with single space
            line = line.replace(/\.{2,}/g, '.').trim();
            line = line.replace(/,{2,}/g, ',').trim();
            line = line.replace(/\s{2,}/g, ' ').trim();
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
            line = line.replace("AB AC", "AB-AC");
            line = line.replace("AC AB", "AC-AB");
            line = line.replace("BC AB", "BC-AB");
            line = line.replace("AB BC", "AB-BC");
            line = line.replace("AC BC", "AC-BC");
            line = line.replace("BC AC", "BC-AC");
            line = line.replace("ABC", "ALL");
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
            line = line.replace("A-B-C", "ALL");
            line = line.replace("A B C", "ALL");
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

            // If line matches RS.30 or RS30 or RS 30, replace space and hyphen with empty string
            const rsMatch = line.replace(/[\s\-=]/g, '').match(/^RS[\.\s\,]?[\s\.]?(\d+)$/);
            if (rsMatch) {
                cleandMsg['amount'] = rsMatch[1];
                return;
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
            const partRsMatch = line.replace(/[\s\-]/g, '').match(/RS[\.\s\,]?(\d+)/);
            if (partRsMatch) {
                cleandMsg['amount'] = partRsMatch[1];
                line = cleanupLine(line.replace(partRsMatch[0], ' '));
            }
            // Replace all the non (A-Z and 0-9) {1,} between the valid values to single -
            line = line.replace(/[^A-Z0-9]+/g, '-').trim();

            // Check line matches 813..2set then get 813 and 2 - 557. 2SET
            const setMatch = line.match(/^(\d{1,5})[\.\s\+]+(\d{1,5})(SET|SETS)?$/);
            if (setMatch) {
                cleandMsg['data'].push({ number: setMatch[1], qty: setMatch[2] });
                return;
            }

            // Support for 555-9set or 555-9SET
            const dashSetMatch = line.match(/^(\d{1,5})-+(\d{1,5})(-SET|-SETS| SET| SETS|SET|SETS)?$/i);
            if (dashSetMatch) {
                cleandMsg['data'].push({ number: dashSetMatch[1], qty: dashSetMatch[2] });
                return;
            }
            line = cleanupLine(line);
            // Check line matches AC*80*10
            const starMatch = line.match(/^(AB|AC|BC)\*(\d{1,5})\*(\d{1,5})$/);
            if (starMatch) {
                cleandMsg['data'].push({ target: starMatch[1], number: starMatch[2], qty: starMatch[3] });
                return;
            }

            // All-50set
            const allSetMatch = line.replace(/[\s\-\,\.]/g, '').match(/^(ALL)(\d{1,5})(SET|SETS)$/);
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
            const eachMatch = line.replace(/[\s\-\,\.=]/g, '').match(/^EACH?(\d{1,5})SET(S)?$/);
            if (eachMatch) {
                cleandMsg['qty'] = eachMatch[1];
                return;
            }

            // If matches 10SET
            const qsetMatch = line.replace(/[\s\-\,\.]/g, '').match(/^(\d{1,5})(-SET|-SETS|SET|SETS)$/);
            if (qsetMatch) {
                cleandMsg['qty'] = qsetMatch[1];
                return;
            }

            // If matches EACH EACH10
            const echMatch = line.replace(/[\s\-\,\.=]/g, '').match(/^EACH?(\d{1,5})$/);
            if (echMatch) {
                cleandMsg['qty'] = echMatch[1];
                return;
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

            // If line matches 30 TO 50
            const toMatch = line.match(/^(\d{1,5})\s*TO\s*(\d{1,5})$/);
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

            // matches 07,70+75E consider as numbers separated by , and + numberE as qty
            if (line.includes(',') || line.includes('+')) {
                values = line.split('+');
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
            // Only . special chars
            if (line.includes('.') && line.match(/^\d+(\.\d+)*$/)) {
                const parts = line.split('.').map(part => part.trim()).filter(part => part !== '');
                cleanedParts = parts.filter(part => part.trim() !== '');
                if (cleanedParts.length == 2) {
                    cleanedParts.forEach(part => {
                        // If part is number only
                        const partNumMatch = part.match(/^(\d{1,5})$/);
                        if (partNumMatch) {
                            cleandMsg['data'].push({ number: partNumMatch[1], qty: allQtySet && allQtySet != '' ? allQtySet : null });
                            return;
                        }
                    });
                }
            }
            // match 266.556.590
            if (line.match(/^\d+(?:\.\d+)+$/)) {
                const parts = line.split('.').map(part => part.trim()).filter(part => part !== '');
                cleanedParts = parts.filter(part => part.trim() !== '');
                if (cleanedParts.length > 2) {
                    cleanedParts.forEach(part => {
                        // If part is number only
                        const partNumMatch = part.match(/^(\d{1,5})$/);
                        if (partNumMatch) {
                            cleandMsg['data'].push({ number: partNumMatch[1], qty: allQtySet && allQtySet != '' ? allQtySet : null });
                            return;
                        }
                    });
                }
            }
            // match 266+556+590
            if (line.match(/^\d+(?:\+\d+)+$/)) {
                const parts = line.split('+').map(part => part.trim()).filter(part => part !== '');
                cleanedParts = parts.filter(part => part.trim() !== '');
                if (cleanedParts.length > 2) {
                    cleanedParts.forEach(part => {
                        // If part is number only
                        const partNumMatch = part.match(/^(\d{1,5})$/);
                        if (partNumMatch) {
                            cleandMsg['data'].push({ number: partNumMatch[1], qty: allQtySet && allQtySet != '' ? allQtySet : null });
                            return;
                        }
                    });
                }
            }
            // match 266+556+590
            if (line.match(/^\d+(?:\*\d+)+$/)) {
                const parts = line.split('*').map(part => part.trim()).filter(part => part !== '');
                cleanedParts = parts.filter(part => part.trim() !== '');
                if (cleanedParts.length > 2) {
                    cleanedParts.forEach(part => {
                        // If part is number only
                        const partNumMatch = part.match(/^(\d{1,5})$/);
                        if (partNumMatch) {
                            cleandMsg['data'].push({ number: partNumMatch[1], qty: allQtySet && allQtySet != '' ? allQtySet : null });
                            return;
                        }
                    });
                }
            }
            // If value matches \d/\d
            const slashMatch = line.match(/^(\d{1,5})\/(\d{1,5})$/);
            if (slashMatch) {
                cleandMsg['data'].push({ number: slashMatch[1], qty: slashMatch[2] });
                return;
            }

            // If line matches 75-1
            const hyphenMatch = line.replace(/\s/g, '').match(/^(\d{1,5})[\-\s](\d{1,5})$/);
            if (hyphenMatch) {
                cleandMsg['data'].push({ number: hyphenMatch[1], qty: hyphenMatch[2] });
                return;
            }

            // If line matches 026=3 or 16=1set or 16 = 3t
            const equalMatch = line
                .replace(' ', '')
                .match(/^(\d{1,5})=(\d{1,5})(?:SET|SETS|T)?$/i);

            if (equalMatch) {
                cleandMsg['data'].push({
                    number: equalMatch[1], // 026 or 16
                    qty: equalMatch[2]     // 3 or 1
                });
                return;
            }

            // If line matches AC-60-20set or Bc. 25.5.set
            const dashMatch = line.match(/^(A|B|C|ALL|AB|AC|BC|ABC)[\.\s\-]+(\d{1,5})[\.\s\-]+(\d{1,5})(.SET|.SETS|SET|SETS|.)?$/);
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

            // If matches Bc.69-96.10set add Target BC and number 69 and 96 with qty 10
            const multiDashMatch = line.replace(/\s/g, '').match(/^(A|B|C|ALL|AB|AC|BC|ABC)\.(\d{1,5})\-(\d{1,5})\.(\d{1,5})(SET|SETS|.)?$/);
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

            // AC-10SET or Bc-10SET or AB-10SET or A-10 or Ac bc-35set
            targetQtyRegex = /(?:\b(AC|BC|AB)\b(?:\s*[/\s]\s*(AC|BC|AB))*)\s*-?\s*(\d+)/i;
            const targetQtyMatch = line.match(targetQtyRegex);
            if (targetQtyMatch) {
                let targets = targetQtyMatch[1].toUpperCase();
                let qty = targetQtyMatch[3];
            }

            //Bc. 25.5.set
            const dotSetMatch = line.replace(/\s/g, '').match(/^(A|B|C|ALL|AB|AC|BC)\.(\d{1,5})\.(\d{1,5})(SET|SETS)+$/);
            if (dotSetMatch) {
                cleandMsg['data'].push({ target: dotSetMatch[1], number: dotSetMatch[2], qty: dotSetMatch[3] });
                return;
            }



            // Check value matches A 3/45
            const targetSlashMatch = line.replace(/\s/g, '').match(/^(A|B|C|ALL|AB|AC|BC)(\d{1,5})\/(\d{1,5})$/);
            if (targetSlashMatch) {
                cleandMsg['data'].push({ target: targetSlashMatch[1], number: targetSlashMatch[2], qty: targetSlashMatch[3] });
                cleandMsg['target'] = targetSlashMatch[1];
                return;
            }

            //When value matches Bc88.5
            const dotMatch = line.match(/^(A|B|C|ALL|AB|AC|BC)(\d{1,5})\.(\d{1,5})$/);
            if (dotMatch) {
                cleandMsg['data'].push({ target: dotMatch[1], number: dotMatch[2], qty: dotMatch[3] });
                return;
            }

            const isValid = /^\d+(?:[-]\d+)(SET|SETS)?$/.test(line.trim());
            if (isValid) {
                const numbers = line.match(/\d+/g).map(Number);
                numbers.forEach(num => {
                    cleandMsg['data'].push({ number: num.toString() });
                });
                return;
            }

            // Support for 45*2 as number=45, qty=2
            const starQtyMatch = line.replace(/ /g, "").match(/^(\d{1,5})\*(\d{1,5})$/);
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
            const targetNumberMatch = line.match(/^(ALL|ABC|AB|AC|BC|A|B|C)\s*(\d{1,5})$/i);
            if (targetNumberMatch) {
                cleandMsg['data'].push({ target: targetNumberMatch[1], number: targetNumberMatch[2] });
                cleandMsg['target'] = targetNumberMatch[1];
                return;
            }

            const doubleHyphenMatch = line.replace(/ /g, "").match(/^(\d+)-+(\d+)(ST|T|CH|SET)?$/);
            if (doubleHyphenMatch) {
                cleandMsg['data'].push({ number: doubleHyphenMatch[1], qty: doubleHyphenMatch[2] });
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
        linesGrouping = [];
        linesGroupLines = [];
        linesGrouping.push(linesGroupLines);
        groupMemory = {};
        lines.forEach((line, idx) => {
            if (line['data'] && line['data'].length > 0) {
                hasData = true;

            }
            if (line['isBox']) {
                isBox = line['isBox'];
            }
            if (line['isOff']) {
                isOff = line['isOff'];
            }
            if (line['cut']) {
                isCut = line['cut'];
            }
            if (line['qty']) {
                qty.push(line['qty']);
                if (idx > 0) {
                    // sublist
                    lines.slice(lastQtyUpdatedIndex, idx).forEach((subline) => {
                        if (!subline['qty']) {
                            subline['qty'] = line['qty'];
                        }
                    });
                    lastQtyUpdatedIndex = idx + 1;
                }
            }
            if (line['target'] && line['target'] != '') {
                targetValue = line['target'];

            }
            if (line['amount'] && line['amount'] != '') {
                amt = line['amount'];
                groupMemory['amtExists'] = true;
            }
            linesGroupLines.push(line);
        });
        linesGrouping = [];
        linesGroupLines = [];
        linesGrouping.push(linesGroupLines);
        groupMemory = {};
        lines.forEach((line, idx) => {
            if (line['data'] && line['data'].length > 0) {
                hasData = true;
                if (line['data'].length > 0) {
                    dataSize = line['data'][0]['number'].length;
                    if (groupMemory['dataSize']) {
                        if (groupMemory['dataSize'] != dataSize) {
                            groupMemory['dataSizeMismatch'] = true;
                            linesGroupLines = [];
                            linesGrouping.push(linesGroupLines);
                        }
                    } else {
                        groupMemory['dataSize'] = dataSize;
                    }

                }
            }

            if (line['target'] && line['target'] != '') {
                targetValue = line['target'];
                if (groupMemory['target'] && groupMemory['target'] != targetValue) {
                    linesGroupLines = [];
                    linesGrouping.push(linesGroupLines);
                }
                groupMemory['target'] = targetValue;
            }
            if (line['amount'] && line['amount'] != '') {
                amt = line['amount'];
                groupMemory['amtExists'] = true;
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
                        let amtValueLocal = amt;
                        let targetValueLocal = targetValue;

                        if (d['qty'] && d['qty'] != '') {
                            qtyValueLocal = d['qty'];
                        }
                        if (line['amount'] && line['amount'] != '') {
                            amtValueLocal = line['amount'] ? line['amount'] : amt;
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
                            if (n.length == 1) {
                                if (isBox) {
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
                                if (isBox) {
                                    outLines.push(`2DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else if (isCut) {
                                    outLines.push(`2DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                } else {
                                    outLines.push(`2DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},,${targetValueLocal}`);
                                }
                            } else if (n.length == 3) {
                                if (isBox) {
                                    outLines.push(`3DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else if (isCut) {
                                    outLines.push(`3DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else {
                                    outLines.push(`3DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                }
                            } else if (n.length == 4) {
                                if (isBox) {
                                    outLines.push(`4DBox,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else if (isCut) {
                                    outLines.push(`4DCut,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                } else {
                                    outLines.push(`4DTkt,${n},${qtyValueLocal ? qtyValueLocal : '1'},${amtValueLocal},`);
                                }
                            } else if (n.length == 5) {
                                if (isBox) {
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

        tableHTML += `<tr style="display:${show ? 'table-row' : 'none'}"><td>${i + 1}</td>
            <td><textarea class="original-msg" rows="${inputGroups[i]?.length || 1}">${inputMsg}</textarea></td>
            <td><textarea class="formatted-msg" rows="${outGroups[i]?.length || 1}">${outputMsg}</textarea></td></tr>`;
    }

    tableHTML += `</tbody></table>`;
    document.getElementById('tableContainer').innerHTML = tableHTML;

    // when changes done in original-msg, update inputData
    const originalMsgTextareas = document.querySelectorAll('.original-msg');
    originalMsgTextareas.forEach((ta, index) => {
        // After input change and focus out, update inputData
        ta.addEventListener('blur', () => {
            copyInputEditedData();
            parseMessages();
            generateTable();
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

function copyInputEditedData() {
    const msgs = document.querySelectorAll('.original-msg');
    let value = '';
    msgs.forEach(ta => value += ta.value + '\n');
    document.getElementById('inputData').value = value;
    // Save the input in the local storage
    localStorage.setItem('inputData', value);
}


function renderFinalOutput(messageGroup, message) {
    // Read keys from messageGroup and generate final output - sort keys first
    const sortedKeys = Object.keys(messageGroup).sort();
    // Create table and insert textarea into table column - print lines of table
    var table = `<h3>${message}</h3><img src="images/${message}" alt="${message}" style="max-width: 200px; margin-top: 10px;"><table>
            <tbody><tr>`;
    sortedKeys.forEach(function (key, index) {
        const values = messageGroup[key];
        let output = '';
        // Print key as header
        // print the values of that key in new lines in text area in finalOutputContent
        //output = key + '\n';
        values.forEach(value => {
            output += value + '\n';
        });
        if (index % 6 === 0 && index !== 0) {
            table += `</tr><tr>`;
        }
        // create new text area 
        table += `<td><h3>${key}</h3><button class="copy-btn" onclick="copyTextarea(this)" style="margin-bottom: 5px; padding: 4px 8px; font-size: 12px;">Copy</button><textarea class="output-textarea" placeholder="Formatted output..." rows="${values.length ? (values.length > 30 ? 30 : values.length + 1) : 1}">${output}</textarea></td>`;
        // Append to finalOutputContent div
        output = '';
    });
    table += `</tr></tbody></table>`;
    // Append to finalOutputContent div
    document.getElementById('finalOutputContent').innerHTML += table;
}

function generateFinalOutput() {
    const formattedMessages = document.querySelectorAll('.formatted-msg');
    const leaveImagesCheckbox = document.getElementById('leaveImages');
    // checkbox selected or not
    const leaveImages = leaveImagesCheckbox.checked;
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

    formattedMessages.forEach((textarea, index) => {
        const content = textarea.value.trim();
        // split content by new line and store
        values = content.split('\n').filter(line => line.replaceAll('"', '').trim() !== '');
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
                alert('Each line must have exactly 4 commas: ' + line);
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
                        alert('1D Ticket number length should be 1 digit only: ' + valueSplits[1]);
                    }
                    if (valueSplits[4] == '') {
                        alert('Target (Last value) must not be empty for: ' + line);
                    }
                    break;
                case '2':
                    if (valueSplits[1].length != 2) {
                        alert('2D Ticket number length should be 2 digits only: ' + valueSplits[1]);
                    }
                    if (valueSplits[4] == '') {
                        alert('Target (Last value) must not be empty for: ' + line);
                    }
                    break;
                case '3':
                    if (valueSplits[1].length != 3) {
                        alert('3D Ticket number length should be 3 digits only: ' + valueSplits[1]);
                    }
                    break;
                case '4':
                    if (valueSplits[1].length != 4) {
                        alert('4D Ticket number length should be 4 digits only: ' + valueSplits[1]);
                    }
                    break;
                case '5':
                    if (valueSplits[1].length != 5) {
                        alert('5D Ticket number length should be 5 digits only: ' + valueSplits[1]);
                    }
                    break;
            }

            if (valueSplits[2] === '') {
                alert('Quantity is missing for line: ' + line);
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
}

// Parse Data functionality
document.addEventListener('DOMContentLoaded', () => {

    // ============================================================================
    // SECTION 5: EVENT LISTENERS
    // ============================================================================

    document.getElementById('parseInputBtn')?.addEventListener('click', () => {
        parseMessages();
        generateTable();
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

    // Generate final output
    document.getElementById('generateFinalOutputBtn').addEventListener('click', function () {
        generateFinalOutput();
    });

    // When input data loose focus, update table
    document.getElementById('inputData')?.addEventListener('blur', () => {
        // Save the input in the local storage
        localStorage.setItem('inputData', document.getElementById('inputData').value);
        parseMessages();
        generateTable();
    });
});
