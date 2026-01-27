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
- ✓ Zero external dependencies

## Installation

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extension folder

## Usage

The extension activates only when you're on one of the allowed websites. A status indicator in the popup shows whether the extension is active.

## File Structure

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Popup logic and status checking
- `content-script.js` - Page injection script
- `styles.css` - Extension styling
- `assets/` - Icon files

## Development

No build process is required. Edit HTML, CSS, and JavaScript files directly.

To reload the extension after making changes:
1. Go to `chrome://extensions/`
2. Click the reload icon on the extension card
