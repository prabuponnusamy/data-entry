
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
