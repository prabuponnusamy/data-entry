
/*
    Local OCR with Tesseract.js - no API key, no network, nothing leaves the
    machine (ticket photos are customer data, so that matters).

    Everything is vendored under js/vendor/tesseract: MV3 blocks remote scripts,
    so the worker, the wasm core and the language data all have to be served
    from inside the extension. `workerBlobURL: false` is required for the same
    reason - a blob-URL worker is blocked by the page CSP.

    Images are zoomed and re-inked by js/ocr/image-preprocess.js first; word
    boxes come back mapped to *original* image coordinates so callers can keep
    using their own column/line grouping.
*/

const OCR_WHITELIST_DIGITS = '0123456789';
const OCR_WHITELIST_NUMERIC = '0123456789.,-/*=xX ';
const OCR_WHITELIST_ALL = '';

const LOCAL_OCR_DEFAULTS = {
    lang: 'eng',
    workerPath: 'js/vendor/tesseract/worker.min.js',
    corePath: 'js/vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
    langPath: 'js/vendor/tesseract/lang',
    psm: '6',                       // uniform block of text - ticket lists read best this way
    whitelist: OCR_WHITELIST_NUMERIC,
    dpi: 300,                       // stops Tesseract guessing a silly DPI after we zoom
    autoRetry: true,                // retry at a bigger zoom when confidence is poor
    minConfidence: 78,
    retryScaleStep: 1.5,
    maxRetries: 2,
    preprocess: {}
};

// One worker, reused across images - spinning one up costs a few seconds.
let localOcrWorkerPromise = null;
let localOcrWorkerKey = '';
let localOcrLastParams = '';

function localOcrSettings(overrides) {
    const settings = { ...LOCAL_OCR_DEFAULTS, ...(overrides || {}) };
    settings.preprocess = { ...OCR_PREPROCESS_DEFAULTS, ...(overrides && overrides.preprocess) };
    return settings;
}

/**
 * Creates (or reuses) the Tesseract worker. `logger` gets the raw progress
 * events so callers can show a status line.
 */
function ensureLocalOcrWorker(settings, logger) {
    if (typeof Tesseract === 'undefined') {
        return Promise.reject(new Error('Tesseract.js is not loaded - include js/vendor/tesseract/tesseract.min.js'));
    }
    const key = [settings.lang, settings.corePath, settings.langPath].join('|');
    if (localOcrWorkerPromise && localOcrWorkerKey === key) {
        return localOcrWorkerPromise;
    }
    if (localOcrWorkerPromise) {
        terminateLocalOcrWorker();
    }
    localOcrWorkerKey = key;
    localOcrLastParams = '';
    localOcrWorkerPromise = Tesseract.createWorker(settings.lang, 1 /* OEM.LSTM_ONLY */, {
        workerPath: settings.workerPath,
        corePath: settings.corePath,
        langPath: settings.langPath,
        workerBlobURL: false,
        gzip: true,
        logger: (m) => { if (logger) logger(m); }
    }).catch((err) => {
        localOcrWorkerPromise = null;
        localOcrWorkerKey = '';
        throw err;
    });
    return localOcrWorkerPromise;
}

async function terminateLocalOcrWorker() {
    const pending = localOcrWorkerPromise;
    localOcrWorkerPromise = null;
    localOcrWorkerKey = '';
    localOcrLastParams = '';
    if (!pending) return;
    try {
        const worker = await pending;
        await worker.terminate();
    } catch (err) {
        console.warn('Could not terminate OCR worker:', err);
    }
}

/** Only pushes parameters when they actually changed - setParameters is not free. */
async function applyOcrParameters(worker, settings) {
    const params = {
        tessedit_pageseg_mode: String(settings.psm),
        tessedit_char_whitelist: settings.whitelist || '',
        user_defined_dpi: String(settings.dpi),
        preserve_interword_spaces: '1'
    };
    const key = JSON.stringify(params);
    if (key === localOcrLastParams) return;
    await worker.setParameters(params);
    localOcrLastParams = key;
}

/** Walks the recognize() block tree into a flat word list. */
function flattenOcrWords(data) {
    const words = [];
    (data.blocks || []).forEach((block) => {
        (block.paragraphs || []).forEach((paragraph) => {
            (paragraph.lines || []).forEach((line) => {
                (line.words || []).forEach((word) => {
                    const box = word.bbox || {};
                    words.push({
                        text: word.text || '',
                        confidence: typeof word.confidence === 'number' ? word.confidence : 0,
                        x0: box.x0 || 0,
                        y0: box.y0 || 0,
                        x1: box.x1 || 0,
                        y1: box.y1 || 0,
                        lineText: line.text ? line.text.trim() : ''
                    });
                });
            });
        });
    });
    return words.filter(w => w.text.trim() !== '');
}

/** Maps boxes from the zoomed+padded canvas back onto the original image. */
function mapWordsToSourceCoords(words, scale, padding) {
    return words.map((w) => {
        const x = (w.x0 - padding) / scale;
        const y = (w.y0 - padding) / scale;
        return {
            text: w.text,
            confidence: w.confidence,
            lineText: w.lineText,
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round((w.x1 - w.x0) / scale),
            height: Math.round((w.y1 - w.y0) / scale),
            box: { x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 }
        };
    });
}

/** Mean confidence over the words we actually kept. */
function meanWordConfidence(words) {
    if (!words.length) return 0;
    return words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
}

/**
 * Runs one recognition pass at a fixed zoom.
 * `source` may be a URL/blob URL/data URL, an <img>, or a canvas.
 */
async function runLocalOcrPass(source, settings, logger) {
    const image = typeof source === 'string' ? await loadImageElement(source) : source;
    const prep = preprocessImageForOcr(image, settings.preprocess);

    const worker = await ensureLocalOcrWorker(settings, logger);
    await applyOcrParameters(worker, settings);

    const started = Date.now();
    const { data } = await worker.recognize(prep.canvas, {}, { text: true, blocks: true });
    const words = flattenOcrWords(data);

    return {
        text: (data.text || '').trim(),
        words: mapWordsToSourceCoords(words, prep.scale, prep.padding),
        confidence: words.length ? meanWordConfidence(words) : (data.confidence || 0),
        durationMs: Date.now() - started,
        canvas: prep.canvas,
        preprocess: prep,
        image
    };
}

/**
 * Full run: recognise, and if the result looks shaky, zoom in further and try
 * again, keeping whichever pass scored best. Small blurry digits are exactly
 * the case where one extra zoom step flips a wrong read into a right one.
 */
async function runLocalOcr(source, overrides, logger) {
    const settings = localOcrSettings(overrides);
    const image = typeof source === 'string' ? await loadImageElement(source) : source;

    const attempts = [];
    let best = null;
    let scale = settings.preprocess.scale;
    const maxAttempts = settings.autoRetry ? 1 + Math.max(0, settings.maxRetries) : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const passSettings = { ...settings, preprocess: { ...settings.preprocess, scale } };
        /* eslint-disable no-await-in-loop */
        const result = await runLocalOcrPass(image, passSettings, logger);
        /* eslint-enable no-await-in-loop */
        attempts.push({
            scale: result.preprocess.scale,
            confidence: result.confidence,
            words: result.words.length,
            durationMs: result.durationMs
        });
        if (!best || result.confidence > best.confidence) {
            best = result;
        }
        if (result.confidence >= settings.minConfidence && result.words.length) {
            break;
        }
        // resolveOcrScale may have capped the zoom - no point retrying the same size.
        const nextScale = scale * settings.retryScaleStep;
        if (resolveOcrScale(image.naturalWidth || image.width, image.naturalHeight || image.height,
            { ...settings.preprocess, scale: nextScale }) <= result.preprocess.scale + 0.01) {
            break;
        }
        scale = nextScale;
    }

    best.attempts = attempts;
    best.settings = settings;
    return best;
}

/** Convenience: just the text, for callers that don't care about boxes. */
async function imageUrlToText(url, overrides, logger) {
    const result = await runLocalOcr(url, overrides, logger);
    return result.text;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LOCAL_OCR_DEFAULTS,
        OCR_WHITELIST_DIGITS,
        OCR_WHITELIST_NUMERIC,
        OCR_WHITELIST_ALL,
        flattenOcrWords,
        mapWordsToSourceCoords,
        meanWordConfidence
    };
}
