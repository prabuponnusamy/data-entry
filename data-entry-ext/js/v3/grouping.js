
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

// True if a line carries a usable (non-empty) value for prop.
function lineHasProp(line, prop) {
    return line[prop] && line[prop] != '' ? true : false;
}

// True if any of the given lines already carries a non-empty value for prop.
function linesHaveProp(lines, prop) {
    return lines ? lines.some(line => lineHasProp(line, prop)) : false;
}

/**
 * Decides who owns the lines sitting between two data groups - a lone "RS 30",
 * "2 SET" or "BC" line.
 *
 * A target line (AB/AC/BC/ALL) heads the numbers that follow it, so it always
 * stays with the current group:
 *   12 / 34 / BC / 09 / 89  -> BC is for 09 and 89
 * Everything else trails the numbers above it, so it goes up to the previous
 * group whenever that group is still missing what the line carries and wants
 * it at least as much as the current group does:
 *   659 / RS30 / 123        -> 30 is for 659 (nothing above claimed an amount)
 *   RS60 / 659 / RS30 / 123 -> 30 is for 123 (659 already has 60)
 */
function moveBeforeDataToPrevGroup(prevGroup, group, propsMap) {
    const prevGroupProps = propsMap[prevGroup['dataLen']];
    const groupProps = propsMap[group['dataLen']];
    if (!prevGroupProps || !groupProps) {
        return;
    }

    var prevGroupAfterData = prevGroup['afterData'] ? prevGroup['afterData'].slice() : [];
    var groupBeforeData = [];
    group['beforeData'].forEach(line => {
        // Props of this line the prev group has no value for yet - those it can still claim.
        const prevGroupNeeds = prevGroupProps.filter(prop => lineHasProp(line, prop)
            && !linesHaveProp(prevGroup['beforeData'], prop)
            && !linesHaveProp(prevGroupAfterData, prop)).length;
        const groupUses = groupProps.filter(prop => lineHasProp(line, prop)).length;
        const isHeaderLine = lineHasProp(line, 'target');
        if (!isHeaderLine && prevGroupNeeds > 0 && prevGroupNeeds >= groupUses) {
            prevGroupAfterData.push(line);
        } else {
            groupBeforeData.push(line);
        }
    });
    prevGroup['afterData'] = prevGroupAfterData;
    group['beforeData'] = groupBeforeData;
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
            if (group['beforeData'] && group['beforeData'].length > 0
                && prevGroup['dataLen'] > 0 && group['dataLen'] > 0) {
                moveBeforeDataToPrevGroup(prevGroup, group, propsMap);
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
