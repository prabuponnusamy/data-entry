// Covers the zip-of-zips batch: how a zip finds its target URL in the map, how
// a URL changed in the table is written back, and which zips are pulled out of
// an upload.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const JSZip = require('../js/jszip.min.js');

const EXT_DIR = path.join(__dirname, '..');

function load() {
    const context = vm.createContext({ console, JSZip, URL, Blob });
    ['js/constants.js', 'js/processzipfile.js', 'js/zipbatch.js'].forEach((file) => {
        const source = fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
        new vm.Script(source, { filename: file }).runInContext(context);
    });
    return context;
}

// Values out of the VM carry its prototypes, which deepStrictEqual rejects.
const plain = (value) => JSON.parse(JSON.stringify(value));

function zipOf(files) {
    const zip = new JSZip();
    Object.entries(files).forEach(([name, content]) => zip.file(name, content));
    return zip.generateAsync({ type: 'uint8array' });
}

test('the map is read one "zip name=url" line at a time', () => {
    const ctx = load();
    const entries = ctx.parseZipTargetUrlMap(
        'Anushuya Draw1.zip = https://anushuya.com/employee/drawOne/\n' +
        '\n' +
        'no separator here\n' +
        'Empty url=\n' +
        'Abidear=https://abidear.com/employee/drawOne/?a=b'
    );
    assert.deepStrictEqual(plain(entries), [
        { key: 'Anushuya Draw1', url: 'https://anushuya.com/employee/drawOne/' },
        { key: 'Abidear', url: 'https://abidear.com/employee/drawOne/?a=b' }
    ]);
});

test('a zip takes the longest map name found in its file name', () => {
    const ctx = load();
    const entries = ctx.parseZipTargetUrlMap(
        'draw1=https://generic.example/\n' +
        'Anushuya Draw1=https://anushuya.com/employee/drawOne/'
    );
    assert.strictEqual(
        ctx.findZipTargetUrl('exports/WhatsApp Chat with ANUSHUYA DRAW1.zip', entries),
        'https://anushuya.com/employee/drawOne/'
    );
    assert.strictEqual(ctx.findZipTargetUrl('Other Draw1.zip', entries), 'https://generic.example/');
    assert.strictEqual(ctx.findZipTargetUrl('Prksha.zip', entries), '');
});

test('a URL set from the table replaces that zip\'s own line in place', () => {
    const ctx = load();
    const text = 'First=https://a.example/\nAnushuya Draw1=https://old.example/\nLast=https://c.example/';
    assert.strictEqual(
        ctx.setZipTargetUrl(text, 'nested/anushuya draw1.zip', 'https://anushuya.com/employee/drawOne/'),
        'First=https://a.example/\nanushuya draw1=https://anushuya.com/employee/drawOne/\nLast=https://c.example/'
    );
});

test('a URL for a zip with no line of its own is added at the end', () => {
    const ctx = load();
    assert.strictEqual(
        ctx.setZipTargetUrl('Anushuya=https://a.example/\n\n', 'Anushuya Draw2.zip', 'https://b.example/'),
        'Anushuya=https://a.example/\nAnushuya Draw2=https://b.example/'
    );
    assert.strictEqual(ctx.setZipTargetUrl('', 'Solo.zip', 'https://s.example/'), 'Solo=https://s.example/');
});

test('clearing a URL in the table removes that zip\'s line', () => {
    const ctx = load();
    assert.strictEqual(
        ctx.setZipTargetUrl('A=https://a.example/\nB=https://b.example/', 'B.zip', '  '),
        'A=https://a.example/'
    );
});

test('Mac resource forks are not zip entries', () => {
    const ctx = load();
    assert.strictEqual(ctx.isJunkZipEntry('__MACOSX/chats/._Draw1.zip'), true);
    assert.strictEqual(ctx.isJunkZipEntry('chats/._Draw1.zip'), true);
    assert.strictEqual(ctx.isJunkZipEntry('chats/Draw1.zip'), false);
});

test('every export zip in the upload is read, nested ones included', async () => {
    const ctx = load();
    const draw1 = await zipOf({ 'WhatsApp Chat.txt': 'chat one', 'IMG-0001.jpg': 'jpeg bytes' });
    const draw2 = await zipOf({ 'WhatsApp Chat.txt': 'chat two' });
    const draw3 = await zipOf({ 'WhatsApp Chat.txt': 'chat three' });
    const holder = await zipOf({ 'Draw3.zip': draw3 });

    const upload = new JSZip();
    upload.file('Draw1.zip', draw1);
    upload.file('site b/Draw2.zip', draw2);
    upload.file('More.zip', holder);
    upload.file('__MACOSX/._Draw1.zip', 'resource fork');
    upload.file('readme.txt', 'not a zip');
    upload.file('Broken.zip', 'not really a zip');

    const zips = await ctx.collectInnerZips(await JSZip.loadAsync(await upload.generateAsync({ type: 'uint8array' })));
    const byPath = Object.fromEntries(Array.from(zips).map((zip) => [zip.path, zip]));

    assert.deepStrictEqual(Object.keys(byPath).sort(), ['Broken.zip', 'Draw1.zip', 'More.zip/Draw3.zip', 'site b/Draw2.zip']);
    assert.deepStrictEqual(plain(byPath['Draw1.zip'].texts), ['chat one']);
    assert.strictEqual(byPath['Draw1.zip'].images.length, 1);
    assert.strictEqual(byPath['Draw1.zip'].images[0].name, 'IMG-0001.JPG');
    assert.deepStrictEqual(plain(byPath['More.zip/Draw3.zip'].texts), ['chat three']);
    assert.ok(byPath['Broken.zip'].error, 'a zip that cannot be opened carries its error');
    assert.strictEqual(byPath['Draw1.zip'].error, undefined);
});
