
/*
    Controller for ocr-test.html - a bench for the local (Tesseract.js) OCR
    path. Load real ticket images (file, drag/drop, paste or straight out of a
    WhatsApp export zip), tune the zoom/binarize settings live, and see exactly
    what Tesseract read, with per-word confidence and boxes drawn over the
    processed image.

    Nothing here is used by the extension itself - it exists so the settings in
    js/ocr/image-preprocess.js can be tuned against real tickets.
*/

const ocrTestState = {
    images: [],       // { name, url, img }
    selected: -1,
    result: null,
    running: false
};

function el(id) {
    return document.getElementById(id);
}

function setStatus(message, isError) {
    const box = el('status');
    box.textContent = message;
    box.className = isError ? 'status error' : 'status';
}

/* ---------------------------------------------------------------- settings */

function readPreprocessSettings() {
    return {
        scale: Number(el('scale').value),
        minHeight: Number(el('minHeight').value),
        grayscale: true,
        contrast: el('contrast').checked,
        contrastClip: Number(el('contrastClip').value),
        sharpen: el('sharpen').checked,
        sharpenAmount: Number(el('sharpenAmount').value),
        binarize: el('binarize').value,
        sauvolaWindow: Number(el('sauvolaWindow').value),
        sauvolaK: Number(el('sauvolaK').value),
        autoInvert: el('autoInvert').checked,
        padding: Number(el('padding').value)
    };
}

function readOcrSettings() {
    return {
        psm: el('psm').value,
        whitelist: el('whitelist').value,
        autoRetry: el('autoRetry').checked,
        minConfidence: Number(el('minConfidence').value),
        preprocess: readPreprocessSettings()
    };
}

function applyWhitelistPreset() {
    const preset = el('whitelistPreset').value;
    if (preset === 'digits') el('whitelist').value = OCR_WHITELIST_DIGITS;
    else if (preset === 'numeric') el('whitelist').value = OCR_WHITELIST_NUMERIC;
    else if (preset === 'all') el('whitelist').value = OCR_WHITELIST_ALL;
}

// Settings survive a reload so a tuning session isn't lost.
const OCR_TEST_SETTINGS_KEY = 'ocrTestSettings';
const OCR_TEST_FIELDS = ['scale', 'minHeight', 'contrast', 'contrastClip', 'sharpen', 'sharpenAmount',
    'binarize', 'sauvolaWindow', 'sauvolaK', 'autoInvert', 'padding', 'psm', 'whitelistPreset',
    'whitelist', 'autoRetry', 'minConfidence', 'showBoxes', 'viewZoom'];

function saveSettings() {
    const values = {};
    OCR_TEST_FIELDS.forEach(id => {
        const field = el(id);
        if (field) values[id] = field.type === 'checkbox' ? field.checked : field.value;
    });
    localStorage.setItem(OCR_TEST_SETTINGS_KEY, JSON.stringify(values));
}

function restoreSettings() {
    let values;
    try {
        values = JSON.parse(localStorage.getItem(OCR_TEST_SETTINGS_KEY) || '{}');
    } catch (err) {
        values = {};
    }
    Object.keys(values).forEach(id => {
        const field = el(id);
        if (!field) return;
        if (field.type === 'checkbox') field.checked = values[id];
        else field.value = values[id];
    });
}

/* ------------------------------------------------------------ image inputs */

function addImage(name, url) {
    ocrTestState.images.push({ name, url });
    renderThumbs();
    if (ocrTestState.selected < 0) selectImage(ocrTestState.images.length - 1);
}

function renderThumbs() {
    const box = el('thumbs');
    box.innerHTML = '';
    ocrTestState.images.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'thumb' + (index === ocrTestState.selected ? ' selected' : '');
        div.innerHTML = `<img src="${item.url}" alt="${item.name}"><span title="${item.name}">${item.name}</span>`;
        div.addEventListener('click', () => selectImage(index));
        box.appendChild(div);
    });
    el('imageCount').textContent = ocrTestState.images.length
        ? `${ocrTestState.images.length} image(s) loaded`
        : 'No images loaded';
}

async function selectImage(index) {
    ocrTestState.selected = index;
    ocrTestState.result = null;
    renderThumbs();
    await renderPreview();
}

function loadFiles(files) {
    Array.from(files).forEach((file) => {
        if (/\.zip$/i.test(file.name)) {
            loadZip(file);
        } else if (file.type.startsWith('image/')) {
            addImage(file.name, URL.createObjectURL(file));
        }
    });
}

function loadZip(file) {
    setStatus(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (e) => {
        JSZip.loadAsync(e.target.result).then((zip) => {
            const jobs = [];
            zip.forEach((path, entry) => {
                if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(entry.name)) {
                    jobs.push(entry.async('blob').then((blob) => {
                        addImage(entry.name.split('/').pop(), URL.createObjectURL(blob));
                    }));
                }
            });
            Promise.all(jobs).then(() => setStatus(`Loaded ${jobs.length} image(s) from ${file.name}`));
        }).catch(err => setStatus('Could not read zip: ' + err.message, true));
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Draws a synthetic ticket - small, noisy, unevenly lit - so the pipeline can
 * be exercised without loading real customer photos.
 */
function generateSampleImage() {
    const rows = [
        ['1D', '7', '30', 'A'],
        ['2D', '48', '120', 'AB'],
        ['3D', '905', '250', 'BOX'],
        ['4D', '3271', '400', 'TKT'],
        ['5D', '58104', '650', 'CUT'],
        ['3D', '460', '100', 'CUT'],
        ['2D', '19', '80', 'BC']
    ];

    const canvas = document.createElement('canvas');
    canvas.width = 260;
    canvas.height = 190;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.font = '13px Menlo, monospace';
    rows.forEach((row, i) => {
        const y = 24 + i * 22;
        ctx.fillText(row[0], 12, y);
        ctx.fillText(row[1], 60, y);
        ctx.fillText(row[2], 140, y);
        ctx.fillText(row[3], 200, y);
    });

    // Uneven lighting plus sensor noise, the way a phone photo of a slip looks.
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
            const i = (y * canvas.width + x) * 4;
            const shade = 1 - 0.35 * (x / canvas.width) - 0.15 * (y / canvas.height);
            const noise = (Math.random() - 0.5) * 26;
            for (let c = 0; c < 3; c += 1) {
                data[i + c] = Math.max(0, Math.min(255, data[i + c] * shade + noise));
            }
        }
    }
    ctx.putImageData(image, 0, 0);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            addImage(`sample-${ocrTestState.images.length + 1}.png`, URL.createObjectURL(blob));
            resolve();
        });
    });
}

/* ---------------------------------------------------------------- rendering */

async function currentImageElement() {
    const item = ocrTestState.images[ocrTestState.selected];
    if (!item) return null;
    if (!item.img) item.img = await loadImageElement(item.url);
    return item.img;
}

/**
 * Paints the processed canvas at the chosen view zoom, optionally with the
 * recognised word boxes on top (green = confident, orange/red = not).
 */
async function renderPreview(processed) {
    const img = await currentImageElement();
    const wrap = el('canvasWrap');
    if (!img) {
        wrap.innerHTML = '<p class="hint" style="padding:12px">Load an image to start.</p>';
        el('meta').textContent = '';
        return;
    }

    const prep = processed || preprocessImageForOcr(img, readPreprocessSettings());
    const viewZoom = Number(el('viewZoom').value);

    const view = document.createElement('canvas');
    view.width = Math.round(prep.canvas.width * viewZoom);
    view.height = Math.round(prep.canvas.height * viewZoom);
    const ctx = view.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(prep.canvas, 0, 0, view.width, view.height);

    if (el('showBoxes').checked && ocrTestState.result) {
        ctx.lineWidth = Math.max(1, viewZoom);
        ctx.font = `${Math.max(10, 11 * viewZoom)}px sans-serif`;
        ocrTestState.result.words.forEach((w) => {
            const box = w.box;
            ctx.strokeStyle = w.confidence >= 85 ? '#1a9850' : (w.confidence >= 70 ? '#f39c12' : '#e74c3c');
            ctx.strokeRect(box.x0 * viewZoom, box.y0 * viewZoom,
                (box.x1 - box.x0) * viewZoom, (box.y1 - box.y0) * viewZoom);
        });
    }

    wrap.innerHTML = '';
    wrap.appendChild(view);

    el('meta').innerHTML = `<span>source <b>${img.naturalWidth}x${img.naturalHeight}</b></span>
        <span>processed <b>${prep.canvas.width}x${prep.canvas.height}</b></span>
        <span>steps <b>${prep.steps.join(' -> ')}</b></span>
        <span>view zoom <b>${viewZoom}x</b></span>`;
    return prep;
}

function renderResult(result) {
    el('outputText').value = result.text;
    el('columnText').value = groupWordsIntoColumns(result.words).join('\n');

    const low = result.words.filter(w => w.confidence < 85).length;
    const attempts = (result.attempts || [])
        .map(a => `x${a.scale.toFixed(2)}: ${a.confidence.toFixed(1)}% / ${a.words}w / ${a.durationMs}ms`)
        .join(' | ');
    el('stats').innerHTML = `<span>confidence <b>${result.confidence.toFixed(1)}%</b></span>
        <span>words <b>${result.words.length}</b></span>
        <span>below 85% <b>${low}</b></span>
        <span>zoom used <b>x${result.preprocess.scale.toFixed(2)}</b></span>
        <span>time <b>${result.durationMs}ms</b></span>
        <span>passes <b>${attempts || 'n/a'}</b></span>`;

    const rows = result.words.map(w => {
        const cls = w.confidence < 70 ? 'bad-conf' : (w.confidence < 85 ? 'low-conf' : '');
        return `<tr class="${cls}"><td class="num">${w.text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
            <td class="num">${w.confidence.toFixed(1)}</td>
            <td class="num">${w.x}, ${w.y}</td></tr>`;
    }).join('');
    el('wordTable').innerHTML = `<table class="words"><thead><tr><th>word</th><th>conf</th><th>x, y</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
}

/* ------------------------------------------------------------------ actions */

function progressLogger(m) {
    if (!m || !m.status) return;
    const pct = typeof m.progress === 'number' ? ` ${(m.progress * 100).toFixed(0)}%` : '';
    setStatus(`${m.status}${pct}`);
}

async function runOcr() {
    const img = await currentImageElement();
    if (!img) {
        setStatus('Load an image first.', true);
        return;
    }
    if (ocrTestState.running) return;
    ocrTestState.running = true;
    el('runBtn').disabled = true;
    setStatus('Recognising...');

    try {
        const result = await runLocalOcr(img, readOcrSettings(), progressLogger);
        ocrTestState.result = result;
        renderResult(result);
        await renderPreview(result.preprocess);
        setStatus(`Done - ${result.words.length} words at ${result.confidence.toFixed(1)}% confidence`);
    } catch (err) {
        console.error(err);
        setStatus('OCR failed: ' + (err && err.message ? err.message : err), true);
    } finally {
        ocrTestState.running = false;
        el('runBtn').disabled = false;
    }
}

async function runOcrOnAll() {
    if (!ocrTestState.images.length) {
        setStatus('Load images first.', true);
        return;
    }
    const settings = readOcrSettings();
    const lines = [];
    el('runAllBtn').disabled = true;
    try {
        for (let i = 0; i < ocrTestState.images.length; i += 1) {
            const item = ocrTestState.images[i];
            setStatus(`Recognising ${i + 1}/${ocrTestState.images.length}: ${item.name}`);
            if (!item.img) item.img = await loadImageElement(item.url); // eslint-disable-line no-await-in-loop
            const result = await runLocalOcr(item.img, settings, progressLogger); // eslint-disable-line no-await-in-loop
            lines.push(`--- ${item.name} (${result.confidence.toFixed(1)}%) ---\n${result.text}`);
        }
        el('outputText').value = lines.join('\n\n');
        setStatus(`Recognised ${ocrTestState.images.length} image(s)`);
    } catch (err) {
        setStatus('Batch OCR failed: ' + (err && err.message ? err.message : err), true);
    } finally {
        el('runAllBtn').disabled = false;
    }
}

/* -------------------------------------------------------------------- setup */

function wireUp() {
    restoreSettings();

    el('fileInput').addEventListener('change', (e) => loadFiles(e.target.files));
    el('sampleBtn').addEventListener('click', () => generateSampleImage().then(() => setStatus('Sample ticket generated')));
    el('clearBtn').addEventListener('click', () => {
        ocrTestState.images.forEach(i => URL.revokeObjectURL(i.url));
        ocrTestState.images = [];
        ocrTestState.selected = -1;
        ocrTestState.result = null;
        renderThumbs();
        renderPreview();
        setStatus('Cleared');
    });
    el('runBtn').addEventListener('click', runOcr);
    el('runAllBtn').addEventListener('click', runOcrOnAll);
    el('previewBtn').addEventListener('click', () => {
        ocrTestState.result = null;
        renderPreview();
    });
    el('resetBtn').addEventListener('click', () => {
        localStorage.removeItem(OCR_TEST_SETTINGS_KEY);
        window.location.reload();
    });
    el('terminateBtn').addEventListener('click', async () => {
        await terminateLocalOcrWorker();
        setStatus('OCR worker terminated - next run reloads it');
    });
    el('whitelistPreset').addEventListener('change', () => {
        applyWhitelistPreset();
        saveSettings();
    });

    OCR_TEST_FIELDS.forEach(id => {
        const field = el(id);
        if (!field) return;
        field.addEventListener('change', () => {
            saveSettings();
            const shown = el(id + 'Value');
            if (shown) shown.textContent = field.value;
            if (id === 'viewZoom' || id === 'showBoxes') {
                renderPreview(ocrTestState.result ? ocrTestState.result.preprocess : undefined);
            }
        });
        field.addEventListener('input', () => {
            const shown = el(id + 'Value');
            if (shown) shown.textContent = field.value;
        });
        const shown = el(id + 'Value');
        if (shown) shown.textContent = field.value;
    });

    const drop = el('dropZone');
    ['dragenter', 'dragover'].forEach(evt => drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(evt => drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.remove('dragover');
    }));
    drop.addEventListener('drop', (e) => loadFiles(e.dataTransfer.files));

    document.addEventListener('paste', (e) => {
        const items = Array.from(e.clipboardData?.items || []);
        items.filter(i => i.type.startsWith('image/')).forEach((item) => {
            const blob = item.getAsFile();
            if (blob) addImage(`pasted-${Date.now()}.png`, URL.createObjectURL(blob));
        });
    });

    renderThumbs();
    renderPreview();
    setStatus('Ready - load an image, or press "Sample ticket" to try the pipeline.');

    if (new URLSearchParams(window.location.search).has('selftest')) {
        runSelfTest();
    }
}

/**
 * Headless check (`ocr-test.html?selftest=1`): builds the sample ticket, OCRs
 * it and reports whether the known digits came back. Result lands in
 * #selftest-result and in the page title so a headless run can read it.
 */
async function runSelfTest() {
    const expected = ['7', '48', '905', '3271', '58104', '460', '19'];
    document.title = 'selftest: running';
    try {
        await generateSampleImage();
        await selectImage(ocrTestState.images.length - 1);
        const result = await runLocalOcr(await currentImageElement(), readOcrSettings(), progressLogger);
        ocrTestState.result = result;
        renderResult(result);
        await renderPreview(result.preprocess);
        const found = expected.filter(v => result.text.replace(/\s+/g, ' ').includes(v));
        const summary = {
            confidence: Number(result.confidence.toFixed(1)),
            durationMs: result.durationMs,
            scale: Number(result.preprocess.scale.toFixed(2)),
            found: found.length,
            expected: expected.length,
            missing: expected.filter(v => !found.includes(v)),
            text: result.text
        };
        document.title = `selftest: ${found.length}/${expected.length}`;
        el('selftest-result').textContent = JSON.stringify(summary, null, 2);
    } catch (err) {
        document.title = 'selftest: error';
        el('selftest-result').textContent = 'ERROR ' + (err && err.stack ? err.stack : err);
    }
}

document.addEventListener('DOMContentLoaded', wireUp);
