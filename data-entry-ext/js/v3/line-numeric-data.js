
// If line matches 30-TO-50, expands it into individual number entries on
// cleanedMsg['data'] and returns true (line fully handled).
function expandNumberRange(line, cleanedMsg) {
    const toMatch = line.match(/^(\d{1,5})~?TO~?(\d{1,5})$/);
    if (!toMatch) {
        return false;
    }

    const vlen = toMatch[1].length;
    const from = parseInt(toMatch[1]);
    const to = parseInt(toMatch[2]);
    const qty = cleanedMsg['qty'] ? cleanedMsg['qty'] : null;
    // format as vlen digit number with leading zeros
    const formatNumber = (num, length) => num.toString().padStart(length, '0');
    const pushEntry = (i) => {
        cleanedMsg['data'].push({
            number: formatNumber(i, vlen),
            qty: qty,
            target: cleanedMsg['target'] ? cleanedMsg['target'] : null,
            amount: cleanedMsg['amount'] ? cleanedMsg['amount'] : null
        });
    };

    if (to - from < 10) {
        // Increment 1 by 1 inclusive
        for (let i = from; i <= to; i++) {
            pushEntry(i);
        }
    } else if (to - from < 100) {
        // Increment 10 by 10 inclusive (or 11 if not evenly divisible)
        if ((to - from) % 10 === 0) {
            for (let i = from; i <= to; i += 10) {
                pushEntry(i);
            }
        } else {
            for (let i = from; i <= to; i += 11) {
                pushEntry(i);
            }
        }
    } else if (to - from < 1000) {
        // Increment 100 by 100 inclusive (or 111 if not evenly divisible)
        if ((to - from) % 100 === 0) {
            for (let i = from; i <= to; i += 100) {
                pushEntry(i);
            }
        } else {
            for (let i = from; i <= to; i += 111) {
                pushEntry(i);
            }
        }
    } else if (to - from < 10000) {
        // Increment 1000 by 1000 inclusive (or 1111 if not evenly divisible)
        if ((to - from) % 1000 === 0) {
            for (let i = from; i <= to; i += 1000) {
                pushEntry(i);
            }
        } else {
            for (let i = from; i <= to; i += 1111) {
                pushEntry(i);
            }
        }
    }
    return true;
}

// Lines that are just a leftover known word (BOARD, EACH, ALL, ...) carry no
// data and should be dropped rather than treated as unparsed.
function isNoiseWordLine(line) {
    const wordsToReplace = ['TICKETS', "TICKET", "BOARD", "EACH", "DEAR", "SET", "BOX", "ALL", "CH", "RS"];
    return wordsToReplace.some(word => line == word);
}

// Check line matches AC-80-10 style tilde-separated numbers and pushes the
// resulting number/qty pairs onto cleanedMsg['data']. Returns true if the
// line was recognized as pure numeric tokens and handled.
function parseNumberTokens(line, cleanedMsg) {
    var values = line.split('~');
    var allNumbers = values.every(val => /^\d+$/.test(val));
    if (!(allNumbers && values.length > 0)) {
        return false;
    }

    const push = (entry) => cleanedMsg['data'].push(entry);
    const withTarget = () => cleanedMsg['target'] ? cleanedMsg['target'] : null;
    const withAmount = () => cleanedMsg['amount'] ? cleanedMsg['amount'] : null;

    if (values.length == 2) {
        if (cleanedMsg['qty'] && cleanedMsg['qty'] != '') {
            push({ number: values[0], qty: cleanedMsg['qty'], target: withTarget(), amount: withAmount() });
            push({ number: values[1], qty: cleanedMsg['qty'], target: withTarget(), amount: withAmount() });
        } else {
            if (values[1].length != values[0].length) {
                // If there are 2 values and length is different then consider first value as number and second value as qty
                push({ number: values[0], qty: values[1], target: withTarget(), amount: withAmount() });
            } else if (values[1].length > 2) {
                push({ number: values[0], target: withTarget(), amount: withAmount() });
                push({ number: values[1], target: withTarget(), amount: withAmount() });
            } else {
                push({ number: values[0], qty: values[1], target: withTarget(), amount: withAmount() });
            }
        }
    } else {
        // If all values are same length other than last one then last one as qty and all previous values as number
        var isAllValuesSameLength = values.every(val => val.length === values[0].length);
        var isAllValuesSameLengthOtherThanLast = values.slice(0, values.length - 1).every(val => val.length === values[0].length);
        if (isAllValuesSameLength) {
            values.forEach(value => {
                push({ number: value, qty: cleanedMsg['qty'] ? cleanedMsg['qty'] : null, target: withTarget(), amount: withAmount() });
            });
        } else if (isAllValuesSameLengthOtherThanLast) {
            for (let i = 0; i < values.length - 1; i++) {
                push({ number: values[i], qty: values[values.length - 1], target: withTarget(), amount: withAmount() });
            }
        } else {
            var skipNext = false;
            for (let i = 0; i < values.length; i++) {
                if (skipNext) {
                    skipNext = false;
                    continue;
                }
                if (values[i + 1] && values[i + 1].length === values[i].length) {
                    push({ number: values[i], qty: cleanedMsg['qty'] ? cleanedMsg['qty'] : null, target: withTarget(), amount: withAmount() });
                } else {
                    skipNext = true;
                    push({ number: values[i], qty: values[i + 1], target: withTarget(), amount: withAmount() });
                }
            }
        }
    }

    if (cleanedMsg['qty']) {
        cleanedMsg['qty'] = null; // reset qty after using for first number in the line
    }
    cleanedMsg['amount'] = null; // reset amount after using for first number in the line
    return true;
}
