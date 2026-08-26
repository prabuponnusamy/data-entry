# Data Entry Extension

A Chrome extension designed for secure data entry and verification on authorized websites.

## Supported Websites

- orangepblw.com/user
- rajasree.org/user
- sameeraa.com/user
- klpoorna.com/user
- akshayajackpot.com/user
- anushuya.com/employee/login
- abidear.com/employee/login
- chandhni.com/employee/login

## Features

- ✓ Manifest V3 compliant
- ✓ Site-specific activation
- ✓ Secure content script injection
- ✓ Chrome storage API support
- ✓ Responsive popup UI
- ✓ Offline OCR for ticket images (Tesseract.js, bundled - no API key, no upload)

## Installation

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extension folder

## Usage

The extension activates only when you're on one of the allowed websites. A status indicator in the popup shows whether the extension is active.

## Common amount

An amount typed once at the top of a message (`Rs. 30`) only reaches the block
of numbers it sits next to - a `box`/`tkt` flip or a change of digit length
starts a new block that has no amount of its own.

The **Common amount for all entries** field on the Parse Data page covers the
case where one amount is meant for the whole message:

- *Only where the amount is missing* (default) - fills the entries that ended
  up blank, so an `RS 60` typed against one block still wins.
- *Override every entry* - every 3D/4D/5D entry gets the common amount.

Leave the field blank and nothing changes. 1D/2D rows are never touched - they
carry a target, not an amount.

## OCR (image to text)

Ticket photos that come out of a WhatsApp export are read in the browser - the
images never leave the machine.

- **Engine picker** on the Parse Data page: *Local - Tesseract.js* (default, no
  key) or *Google Vision* (needs the API key field).
- Before recognition each image is **zoomed 3-4x, contrast-stretched, sharpened
  and binarized** (Sauvola local thresholding), which is what makes small,
  unevenly lit digits readable. If confidence still comes back low, it
  automatically retries at a bigger zoom and keeps the best pass.
- Recognition is tuned for digits: a numeric character whitelist and
  single-block page segmentation.

### Test bench

Open `ocr-test.html` to load real ticket images - file, drag/drop, paste, or straight out of a WhatsApp
`.zip` - and tune every setting live: zoom, binarize mode, Sauvola window/k,
sharpening, character whitelist, page segmentation. It shows the processed
image with word boxes drawn on it, per-word confidence, and the same
column-ordered output the extension produces, so settings can be compared on
real tickets before changing the defaults in `js/ocr/image-preprocess.js`.

`ocr-test.html?selftest=1` runs the whole pipeline against a generated sample
ticket and reports what it read - handy as a smoke test after upgrading the
vendored Tesseract build.

It has to be served over `http://`, not opened as a `file://` path: Chrome
blocks the Web Worker Tesseract runs in on `file://`. Either open it from the
loaded extension (`chrome-extension://<id>/ocr-test.html`, or the *test bench*
link next to the OCR engine picker), or start the bundled dev server:

    npm start     # http://localhost:8777/ocr-test.html
    npm stop

    PORT=9000 ./scripts/start-server.sh    # any other port
    PORT=9000 ./scripts/stop-server.sh

The server serves the extension folder and nothing else; it writes its pid and
log to `.server-<port>.pid` / `.server-<port>.log` (both git-ignored).

## File Structure

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Popup logic and status checking
- `content-script.js` - Page injection script
- `parse-data.html` - Parse/verify page for WhatsApp ticket messages
- `ocr-test.html` - OCR test bench (tuning the local OCR settings)
- `styles.css` - Extension styling
- `js/ocr/` - Image pre-processing and the Tesseract.js wrapper
- `js/vendor/tesseract/` - Bundled Tesseract.js, wasm core and English data
- `scripts/` - Start/stop the local dev server
- `assets/` - Icon files

## Development

No build process is required. Edit HTML, CSS, and JavaScript files directly.
`npm test` runs the parser and OCR-helper tests with `node --test`.

To reload the extension after making changes:
1. Go to `chrome://extensions/`
2. Click the reload icon on the extension card
