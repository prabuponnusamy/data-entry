
/*
    Canvas pre-processing for OCR.

    Ticket photos come out of WhatsApp small, compressed and unevenly lit, and
    Tesseract reads digits much better when the strokes are big and solid black
    on white. So before recognising anything we zoom the image up, flatten the
    lighting and re-ink the strokes ("improve the marking"):

        zoom -> grayscale + contrast stretch -> sharpen -> binarize -> pad

    Everything here is plain canvas work, no dependencies, and every step can be
    switched off from ocr-test.html so settings can be compared on real tickets.
*/

const OCR_PREPROCESS_DEFAULTS = {
    scale: 3,              // zoom factor; small digits need 3-4x
    minHeight: 800,        // bump scale up until the image is at least this tall
    maxPixels: 12e6,       // ...but never blow past this many pixels
    grayscale: true,
    contrast: true,        // percentile contrast stretch
    contrastClip: 0.02,    // ignore the darkest/lightest 2% when stretching
    sharpen: true,
    sharpenAmount: 0.6,
    binarize: 'sauvola',   // 'sauvola' | 'otsu' | 'none'
    sauvolaWindow: 25,     // odd-ish window in *output* pixels
    sauvolaK: 0.28,        // lower = more ink kept, higher = cleaner but thinner
    autoInvert: true,      // flip light-on-dark tickets to dark-on-light
    padding: 24            // white margin; Tesseract dislikes text at the edge
};

/**
 * Works out the zoom factor to use: the requested scale, raised if the image is
 * tiny, capped so we never allocate an absurd canvas.
 */
function resolveOcrScale(width, height, options) {
    const opts = { ...OCR_PREPROCESS_DEFAULTS, ...(options || {}) };
    let scale = Number(opts.scale) || 1;
    if (opts.minHeight && height * scale < opts.minHeight) {
        scale = opts.minHeight / height;
    }
    if (opts.maxPixels && width * height * scale * scale > opts.maxPixels) {
        scale = Math.sqrt(opts.maxPixels / (width * height));
    }
    return Math.max(1, Math.min(scale, 10));
}

/**
 * Draws the source zoomed onto a fresh canvas with the browser's best
 * resampling. Returns the canvas plus the scale actually used, which callers
 * need to map word boxes back onto the original image.
 */
function zoomImageToCanvas(source, options) {
    const opts = { ...OCR_PREPROCESS_DEFAULTS, ...(options || {}) };
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    const scale = resolveOcrScale(width, height, opts);
    const pad = Math.max(0, Math.round(opts.padding || 0));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    // Padding is applied after binarizing, not here: a white margin sitting
    // next to darker paper pulls the local threshold up and rings the whole
    // image in black.
    return { canvas, ctx, scale, padding: pad, sourceWidth: width, sourceHeight: height };
}

/** Luminance in place: every channel gets the same grey value. */
function toGrayscale(data) {
    for (let i = 0; i < data.length; i += 4) {
        const g = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
        data[i] = g;
        data[i + 1] = g;
        data[i + 2] = g;
    }
}

/**
 * Stretches the grey range so the palest ink goes black and the paper goes
 * white. Percentile-clipped so one dark shadow or a flash highlight doesn't
 * eat the whole range.
 */
function stretchContrast(data, clip) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) hist[data[i]] += 1;

    const total = data.length / 4;
    const cut = Math.floor(total * (clip || 0));
    let low = 0;
    let high = 255;
    let seen = 0;
    for (let v = 0; v < 256; v += 1) {
        seen += hist[v];
        if (seen > cut) { low = v; break; }
    }
    seen = 0;
    for (let v = 255; v >= 0; v -= 1) {
        seen += hist[v];
        if (seen > cut) { high = v; break; }
    }
    if (high - low < 16) return; // near-flat image, stretching would just amplify noise

    const range = 255 / (high - low);
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v += 1) {
        lut[v] = Math.max(0, Math.min(255, Math.round((v - low) * range)));
    }
    for (let i = 0; i < data.length; i += 4) {
        const g = lut[data[i]];
        data[i] = g;
        data[i + 1] = g;
        data[i + 2] = g;
    }
}

/**
 * Unsharp mask on the grey channel - puts the edges back that the zoom's
 * smoothing rounded off.
 */
function sharpenGray(data, width, height, amount) {
    const src = new Uint8ClampedArray(width * height);
    for (let p = 0, i = 0; i < data.length; i += 4, p += 1) src[p] = data[i];

    const k = amount;
    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            const p = y * width + x;
            const blur = (
                src[p - width - 1] + src[p - width] + src[p - width + 1]
                + src[p - 1] + src[p] + src[p + 1]
                + src[p + width - 1] + src[p + width] + src[p + width + 1]
            ) / 9;
            const v = src[p] + (src[p] - blur) * k;
            const g = v < 0 ? 0 : (v > 255 ? 255 : v | 0);
            const i = p * 4;
            data[i] = g;
            data[i + 1] = g;
            data[i + 2] = g;
        }
    }
}

/** Otsu's global threshold over the grey histogram. */
function otsuThreshold(data) {
    const hist = new Uint32Array(256);
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) hist[data[i]] += 1;

    let sum = 0;
    for (let v = 0; v < 256; v += 1) sum += v * hist[v];

    let sumB = 0;
    let wB = 0;
    let best = 0;
    let firstBest = 127;
    let lastBest = 127;
    for (let v = 0; v < 256; v += 1) {
        wB += hist[v];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += v * hist[v];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) {
            best = between;
            firstBest = v;
            lastBest = v;
        } else if (between === best) {
            lastBest = v;
        }
    }
    // On a clean image every level between the two peaks scores the same; sit
    // in the middle of that run rather than hugging the dark peak, which would
    // thin the strokes out.
    return Math.round((firstBest + lastBest) / 2);
}

function applyGlobalThreshold(data, threshold) {
    for (let i = 0; i < data.length; i += 4) {
        const g = data[i] > threshold ? 255 : 0;
        data[i] = g;
        data[i + 1] = g;
        data[i + 2] = g;
    }
}

/**
 * Sauvola local thresholding via integral images: each pixel is compared with
 * the mean and standard deviation of its own neighbourhood, so a ticket that is
 * bright on one side and shadowed on the other still binarizes cleanly - which
 * a single global cut-off cannot do.
 */
function applySauvolaThreshold(data, width, height, window, k) {
    const w = Math.max(3, Math.round(window) | 1);
    const r = (w - 1) / 2;
    const stride = width + 1;

    // Float64 sums: width*height*255^2 overflows 32-bit ints on big canvases.
    const sum = new Float64Array(stride * (height + 1));
    const sumSq = new Float64Array(stride * (height + 1));
    for (let y = 0; y < height; y += 1) {
        let rowSum = 0;
        let rowSumSq = 0;
        for (let x = 0; x < width; x += 1) {
            const g = data[(y * width + x) * 4];
            rowSum += g;
            rowSumSq += g * g;
            const idx = (y + 1) * stride + (x + 1);
            sum[idx] = sum[idx - stride] + rowSum;
            sumSq[idx] = sumSq[idx - stride] + rowSumSq;
        }
    }

    for (let y = 0; y < height; y += 1) {
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(height - 1, y + r);
        for (let x = 0; x < width; x += 1) {
            const x0 = Math.max(0, x - r);
            const x1 = Math.min(width - 1, x + r);
            const area = (y1 - y0 + 1) * (x1 - x0 + 1);

            const a = y0 * stride + x0;
            const b = y0 * stride + (x1 + 1);
            const c = (y1 + 1) * stride + x0;
            const d = (y1 + 1) * stride + (x1 + 1);

            const mean = (sum[d] - sum[b] - sum[c] + sum[a]) / area;
            const meanSq = (sumSq[d] - sumSq[b] - sumSq[c] + sumSq[a]) / area;
            const variance = Math.max(0, meanSq - mean * mean);
            const std = Math.sqrt(variance);
            // R = 128, the standard dynamic range of the deviation for 8-bit input.
            const threshold = mean * (1 + k * (std / 128 - 1));

            const i = (y * width + x) * 4;
            const g = data[i] > threshold ? 255 : 0;
            data[i] = g;
            data[i + 1] = g;
            data[i + 2] = g;
        }
    }
}

/** Share of black pixels - used to spot a light-on-dark (inverted) ticket. */
function blackRatio(data) {
    let dark = 0;
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 128) dark += 1;
    }
    return dark / total;
}

function invert(data) {
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
    }
}

/**
 * Runs the whole pipeline over an <img>/<canvas>/ImageBitmap.
 * Returns the processed canvas plus the scale/padding needed to translate OCR
 * boxes back to original-image coordinates.
 */
function preprocessImageForOcr(source, options) {
    const opts = { ...OCR_PREPROCESS_DEFAULTS, ...(options || {}) };
    const { canvas, ctx, scale, padding, sourceWidth, sourceHeight } = zoomImageToCanvas(source, opts);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const steps = [`zoom x${scale.toFixed(2)}`];

    if (opts.grayscale || opts.contrast || opts.sharpen || opts.binarize !== 'none') {
        toGrayscale(data);
        steps.push('grayscale');
    }
    if (opts.contrast) {
        stretchContrast(data, opts.contrastClip);
        steps.push('contrast');
    }
    if (opts.sharpen) {
        sharpenGray(data, canvas.width, canvas.height, opts.sharpenAmount);
        steps.push('sharpen');
    }

    if (opts.binarize === 'otsu') {
        const t = otsuThreshold(data);
        applyGlobalThreshold(data, t);
        steps.push(`otsu(${t})`);
    } else if (opts.binarize === 'sauvola') {
        // The window is defined against the zoomed image, so scale it with the zoom.
        const window = Math.max(3, Math.round(opts.sauvolaWindow * (scale / 3)) | 1);
        applySauvolaThreshold(data, canvas.width, canvas.height, window, opts.sauvolaK);
        steps.push(`sauvola(w=${window}, k=${opts.sauvolaK})`);
    }

    let inverted = false;
    if (opts.autoInvert && opts.binarize !== 'none' && blackRatio(data) > 0.5) {
        invert(data);
        inverted = true;
        steps.push('inverted');
    }

    ctx.putImageData(image, 0, 0);

    const padded = padCanvas(canvas, padding);
    if (padding > 0) steps.push(`pad ${padding}px`);

    return {
        canvas: padded,
        scale,
        padding,
        inverted,
        steps,
        sourceWidth,
        sourceHeight,
        width: padded.width,
        height: padded.height
    };
}

/** Puts a white quiet zone around the finished image - Tesseract dislikes text that runs to the edge. */
function padCanvas(canvas, padding) {
    if (!padding) return canvas;
    const padded = document.createElement('canvas');
    padded.width = canvas.width + padding * 2;
    padded.height = canvas.height + padding * 2;
    const ctx = padded.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, padded.width, padded.height);
    ctx.drawImage(canvas, padding, padding);
    return padded;
}

/** Loads a URL/blob URL/data URL into a decoded <img>. */
function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not load image: ' + src));
        img.src = src;
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OCR_PREPROCESS_DEFAULTS,
        resolveOcrScale,
        zoomImageToCanvas,
        padCanvas,
        otsuThreshold,
        preprocessImageForOcr,
        loadImageElement
    };
}
