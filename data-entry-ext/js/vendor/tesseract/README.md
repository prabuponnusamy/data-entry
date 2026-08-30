# Vendored Tesseract.js

Checked in because the extension has no build step and MV3 blocks remote scripts,
so everything OCR needs has to ship inside the extension.

| File | Source | Version |
| --- | --- | --- |
| `tesseract.min.js` | npm `tesseract.js` (`dist/`) | 7.0.0 |
| `worker.min.js` | npm `tesseract.js` (`dist/`) | 7.0.0 |
| `tesseract-core-simd-lstm.wasm.js` | npm `tesseract.js-core` | 7.0.0 |
| `lang/eng.traineddata.gz` | `@tesseract.js-data/eng/4.0.0_best_int` | 4.0.0 best-int |

The core file is pinned to the SIMD + LSTM build (wasm embedded as base64, so no
second fetch). `js/ocr/tesseract-ocr.js` points `corePath`/`workerPath`/`langPath`
at these files and sets `workerBlobURL: false` - a blob-URL worker is blocked by
the MV3 page CSP.

To upgrade:

    npm pack tesseract.js@<v> tesseract.js-core@<v>
    # copy dist/tesseract.min.js, dist/worker.min.js and
    # tesseract-core-simd-lstm.wasm.js into this folder
    curl -L -o lang/eng.traineddata.gz \
      https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz
