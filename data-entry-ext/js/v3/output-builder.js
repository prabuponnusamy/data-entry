
/**
 * Builds the CSV-style output lines for one message's grouped data.
 */
function buildOutputLines(cleanedUpGroupedLines) {
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
                        if (targetValueLocal == 'A-B-C') {
                            targetValueLocal = 'ALL';
                        }
                        if (targetValueLocal == 'A-B') {
                            targetValueLocal = 'AB';
                        }
                        if (targetValueLocal == 'A-C') {
                            targetValueLocal = 'AC';
                        }
                        if (targetValueLocal == 'B-C') {
                            targetValueLocal = 'BC';
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
    return outLines;
}
