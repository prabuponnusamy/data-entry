
// Create class to store the wining numbers
class WinningNumbers {
    numberMap = {};
    constructor(numberMap) {
        this.numberMap = numberMap;
    }

    setNumberMap(numberMap) {
        this.numberMap = numberMap;
    }

    get fiveD() {
        return this.numberMap["5D"] || "";
    }

    get fourD() {
        return this.numberMap["4D"] || "";
    }

    get threeD() {
        return this.numberMap["3D"] || "";
    }

    get A() {
        return this.numberMap["1D_A"] || "";
    }

    get B() {
        return this.numberMap["1D_B"] || "";
    }

    get C() {
        return this.numberMap["1D_C"] || "";
    }

    get AB() {
        return this.numberMap["2D_AB"] || "";
    }

    get AC() {
        return this.numberMap["2D_AC"] || "";
    }

    get BC() {
        return this.numberMap["2D_BC"] || "";
    }

    get numberMap() {
        return this.numberMap;
    }
}

function getSelectedWebsiteBaseUrl() {
    return document.getElementById('websiteBaseUrlInput').value;
}

function getAllowedTargets() {
    return [TARGET_1D_TKT, TARGET_2D_TKT, 
        TARGET_3D_TKT, TARGET_3D_BOX, 
        TARGET_4D_TKT, TARGET_4D_BOX, TARGET_5D_TKT];
}

function isValidTarget(target) {
    return getAllowedTargets().includes(target);
}

function getTargetUrlSuffix(target) {
    const urlSuffix = {
        [TARGET_1D_TKT]: '1dticket', [TARGET_2D_TKT]: '2dticket', [TARGET_3D_TKT]: '3dticket', [TARGET_4D_TKT]: '4dticket', [TARGET_5D_TKT]: '5dticket',
            [TARGET_3D_BOX]: '3dbox', [TARGET_4D_BOX]: '4dbox'
    };
    return urlSuffix[target] || '';
}

function buildTargetUrl(websiteBaseUrl, target) {
    var targetUrlSuffix = getTargetUrlSuffix(target);
    return websiteBaseUrl + 
        (websiteBaseUrl.substring(websiteBaseUrl.length - 1) === '/' 
        || targetUrlSuffix.startsWith('/') ? '' : '/') + 
        targetUrlSuffix;
}
