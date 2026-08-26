
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
