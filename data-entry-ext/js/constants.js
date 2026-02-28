// Chrome web javascript extension parse-data-v1.js
const FAILED_TO_PARSE = 'FAILED TO PARSE';

const INPUT_FIELD_ID = 'inputData';

//1DCut 1DTkt 2DCut 2DTkt  3DBox 3DCut 3DTkt 4DBox 4DCut 4DTkt 5DBox 5DCut 5DTkt
const TARGET_1D_TKT = '1DTkt';
const TARGET_1D_CUT = '1DCut';
const TARGET_2D_TKT = '2DTkt';
const TARGET_2D_CUT = '2DCut';
const TARGET_3D_TKT = '3DTkt';
const TARGET_3D_CUT = '3DCut';
const TARGET_3D_BOX = '3DBox';
const TARGET_4D_TKT = '4DTkt';
const TARGET_4D_CUT = '4DCut';
const TARGET_4D_BOX = '4DBox';
const TARGET_5D_TKT = '5DTkt';
const TARGET_5D_CUT = '5DCut';
const TARGET_5D_BOX = '5DBox';

const dict = {
    al: "ALL",
    sct: "SET",
    chnce: "SET",
    ech: "EACH",
    ch: "SET",
    st: "SET",
    chance: "SET",
    seat: "SET",
    bored: "BOARD"
};
// replace board ''
const replacements = [
    "3DIGIT",
    "FOUR DIGIT",
    "KERALA 3 PM",
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
    "PORT",
    "DEAR----8",
    "DEAR.8",
    "8MANI",
    '6MANI',
    "3MANI",
    "DEAR 8PM",
    "DEAR1PM",
    "DEAR 1PM",
    "DEAR 1 PM",
    "DEAR8PM",
    "DEAR 8 PM",
    "DEAR-8",
    "DEAR 8",
    "DEAR8",
    "DEAR-1-00PM",
    "DEAR----1",
    "DEAR----2",
    "DEAR----3",
    "DEAR----4",
    "DEAR----5",
    "DEAR----6",
    "DEAR----7",
    "DEAR----8",
    "DEAR.1",
    "DR.8",
    "1.PM",
    "D1",
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
    "CLOSING",
    "3PM",
    "DEAR",
    "DR 1",
    "DR 6",
    "DEAR-6",
    "DEAR-6PM",
    "DR 8",
    "DR 3",
    "DR",
    "BOARD",
    "4D",
    "3D",
    "2D",
    "PM",
    "BORED",
    "BORD"
].sort((a, b) => b.length - a.length);
