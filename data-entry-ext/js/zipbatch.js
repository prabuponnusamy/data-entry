/*
    Zip of zips: one upload holding several WhatsApp export zips, each filed to
    its own site. Every inner zip is read and parsed up front so the table shows
    what is in each; Load puts one zip through the page with the target URL the
    map gives it.
*/
const ZIP_TARGET_URL_MAP_FIELD_ID = 'zipTargetUrlMap';

// The batch on screen: the uploaded zip's name, the zips inside it, and which
// of them is on the page.
var zipBatch = { name: '', zips: [], activeIndex: -1 };

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// A zip's name as the map knows it: the file name alone, without ".zip".
function zipBaseName(path) {
    return path.split('/').pop().trim().replace(/\.zip$/i, '').trim();
}

/**
 * The map text as entries, one per "zip name=url" line. The line is split at
 * its first "=", and lines missing either side are skipped.
 */
function parseZipTargetUrlMap(text) {
    return (text || '').split('\n').map(line => {
        const at = line.indexOf('=');
        if (at === -1) return null;
        return { key: zipBaseName(line.slice(0, at)), url: line.slice(at + 1).trim() };
    }).filter(entry => entry && entry.key && entry.url);
}

/**
 * The URL for a zip: the entry whose name appears in the zip's name, ignoring
 * case. The longest name wins, so an exact entry beats a shorter one that also
 * fits.
 */
function findZipTargetUrl(zipPath, entries) {
    const name = zipBaseName(zipPath).toLowerCase();
    let best = null;
    entries.forEach(entry => {
        const key = entry.key.toLowerCase();
        if (name.includes(key) && (!best || key.length > best.key.length)) best = entry;
    });
    return best ? best.url : '';
}

/**
 * The map text with this zip's own entry set to `url`: replaced where it is,
 * or added at the end. An empty url removes the entry. Other lines are left
 * as they were.
 */
function setZipTargetUrl(text, zipPath, url) {
    const key = zipBaseName(zipPath);
    const lines = (text || '').split('\n');
    const at = lines.findIndex(line => {
        const split = line.indexOf('=');
        return split !== -1 && zipBaseName(line.slice(0, split)).toLowerCase() === key.toLowerCase();
    });
    const value = (url || '').trim();
    if (!value) {
        if (at !== -1) lines.splice(at, 1);
    } else if (at !== -1) {
        lines[at] = key + '=' + value;
    } else {
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
        lines.push(key + '=' + value);
    }
    return lines.join('\n').replace(/^\n+|\n+$/g, '');
}

/**
 * Every zip inside `zip`, however deep, read into its chat text and images.
 * A zip holding only zips is opened but not listed itself. One that cannot be
 * opened is listed with its error, so the rest of the upload still loads.
 */
async function collectInnerZips(zip) {
    const entries = [];
    zip.forEach((relativePath, entry) => {
        if (!entry.dir && !isJunkZipEntry(relativePath) && /\.zip$/i.test(relativePath)) {
            entries.push(entry);
        }
    });

    const found = [];
    for (const entry of entries) {
        try {
            const inner = await JSZip.loadAsync(await entry.async('arraybuffer'));
            const contents = await readZipExport(inner);
            if (contents.texts.length > 0 || contents.images.length > 0) {
                found.push({ path: entry.name, texts: contents.texts, images: contents.images });
            }
            (await collectInnerZips(inner)).forEach(nested => {
                nested.path = entry.name + '/' + nested.path;
                found.push(nested);
            });
        } catch (error) {
            found.push({ path: entry.name, texts: [], images: [], error: error.message || String(error) });
        }
    }
    return found;
}

// What parsing a zip produced, counted off the page it was just rendered to.
function readParseStats() {
    const rows = Array.from(document.querySelectorAll('#finalOutputContent textarea[name="formatted-output"]'))
        .reduce((sum, textarea) => sum + textarea.value.split('\n').filter(line => line.trim()).length, 0);
    return {
        messages: document.querySelectorAll('.formatted-msg').length,
        rows: rows,
        errors: document.querySelectorAll('.formatted-msg[data-error="true"]').length,
        date: pickEntryDate(document.getElementById('inputData').value).date
    };
}

// The name the page shows for a zip from the batch, and saves as the zip name.
function batchZipLabel(zip) {
    return zipBatch.name + ' › ' + zip.path;
}

// True while the page still holds this zip's content, not a zip loaded since.
function isBatchZipOnPage(zip) {
    return localStorage.getItem(ZIP_FILE_NAME_FIELD_ID) === batchZipLabel(zip);
}

function readZipTargetUrlMap() {
    return parseZipTargetUrlMap(document.getElementById(ZIP_TARGET_URL_MAP_FIELD_ID)?.value);
}

async function parseZipOfZips() {
    const file = document.getElementById('zipOfZipsInput').files[0];
    if (!file) {
        alert('Please choose a zip of zips first.');
        return;
    }
    const button = document.getElementById('processZipOfZipsBtn');
    button.disabled = true;
    showInfoMessages('Reading ' + escapeHtml(file.name) + '…');
    try {
        const zips = await collectInnerZips(await JSZip.loadAsync(await file.arrayBuffer()));
        zips.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
        const firstLoadable = zips.findIndex(zip => !zip.error);
        if (firstLoadable === -1) {
            showErrorMessages(zips.length === 0
                ? 'No zip files with chat text or images inside ' + escapeHtml(file.name) + '. Use Process Zip for a single export.'
                : 'None of the zips inside ' + escapeHtml(file.name) + ' could be opened.');
            return;
        }

        // The previous batch's images are about to be replaced on the page.
        zipBatch.zips.forEach(zip => zip.images.forEach(image => URL.revokeObjectURL(image.url)));
        zipBatch = { name: file.name, zips: zips, activeIndex: -1 };

        // Parse each zip once so the table can show what is in it. The page
        // ends up on the first one, loaded properly below.
        zips.forEach(zip => {
            if (zip.error) return;
            document.getElementById('inputData').value = zip.texts.join('\n');
            parseMessages();
            generateTable();
            generateFinalOutput();
            zip.stats = readParseStats();
        });

        loadBatchZip(firstLoadable);
        document.getElementById('zipbatch-tab').click();
    } catch (error) {
        console.error('Error reading zip of zips:', error);
        showErrorMessages('Could not read ' + escapeHtml(file.name) + ': ' + escapeHtml(error.message || error));
    } finally {
        button.disabled = false;
    }
}

/**
 * Puts one zip from the batch on the page, the same way Process Zip does, and
 * points the page at the site the map gives it.
 */
function loadBatchZip(index) {
    const zip = zipBatch.zips[index];
    if (!zip || zip.error) return;

    // Keep fixes made to the zip that is on the page, so coming back to it
    // later does not undo them.
    const current = zipBatch.zips[zipBatch.activeIndex];
    if (current && isBatchZipOnPage(current)) {
        current.texts = [document.getElementById('inputData').value];
    }

    zipBatch.activeIndex = index;
    showZipExport(batchZipLabel(zip), zip);
    zip.stats = readParseStats();
    applyZipTargetUrl(findZipTargetUrl(zip.path, readZipTargetUrlMap()));
    renderZipBatch();
}

// Sets the page's base URL as picking it from the site list does: supplier
// list and sign-in status follow it.
function applyZipTargetUrl(url) {
    const input = document.getElementById('websiteBaseUrlInput');
    if (input.value === url) return;

    input.value = url;
    const select = document.getElementById('websiteBaseUrlSelect');
    select.value = url;
    if (select.value !== url) select.selectedIndex = 0;

    if (url) {
        getAllFields();
    } else {
        document.getElementById('target-page-input').innerHTML = '';
    }
    reportSignInStatus();
}

function renderZipBatch() {
    const container = document.getElementById('zipBatchContainer');
    const summary = document.getElementById('zipBatchSummary');
    if (!container) return;
    if (zipBatch.zips.length === 0) {
        container.innerHTML = '';
        return;
    }

    const entries = readZipTargetUrlMap();
    const urls = zipBatch.zips.map(zip => findZipTargetUrl(zip.path, entries));
    const unmapped = urls.filter(url => !url).length;
    summary.textContent = `${zipBatch.name}: ${zipBatch.zips.length} zip(s)` +
        (unmapped > 0 ? `, ${unmapped} without a target URL` : ', all mapped to a target URL');

    // The site list is the one place the known sites are kept.
    const options = Array.from(document.querySelectorAll('#websiteBaseUrlSelect option'))
        .filter(option => option.value)
        .map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.textContent)}</option>`)
        .join('');

    const rows = zipBatch.zips.map((zip, index) => {
        const active = index === zipBatch.activeIndex;
        const stats = zip.stats || {};
        return `<tr class="${active ? 'active-zip' : ''}">
            <td>${index + 1}</td>
            <td class="zip-name">${escapeHtml(zip.path)}</td>
            <td><input type="text" class="zip-target-url ${urls[index] ? '' : 'missing'}" list="zipTargetUrlOptions"
                data-index="${index}" value="${escapeHtml(urls[index])}" placeholder="Pick or type the site's base URL"></td>
            <td>${zip.error ? '' : stats.messages}</td>
            <td>${zip.error ? '' : stats.rows}</td>
            <td>${zip.error ? '' : escapeHtml(stats.date || '')}</td>
            <td class="${zip.error || stats.errors ? 'zip-errors' : ''}">${zip.error ? escapeHtml(zip.error) : stats.errors}</td>
            <td><button class="btn btn-primary btn-sm" data-action="load-zip" data-index="${index}" ${zip.error ? 'disabled' : ''}>${active ? 'Reload' : 'Load'}</button></td>
        </tr>`;
    }).join('');

    container.innerHTML = `<datalist id="zipTargetUrlOptions">${options}</datalist>
        <table class="zip-batch-table">
            <thead><tr><th>#</th><th>Zip file</th><th>Target URL</th><th>Messages</th><th>Rows</th><th>Date</th><th>Errors</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// A URL typed or picked in the table is saved to the map under that zip's name.
function onZipBatchUrlChange(event) {
    const input = event.target.closest('input.zip-target-url');
    if (!input) return;
    const zip = zipBatch.zips[Number(input.dataset.index)];
    if (!zip) return;
    const field = document.getElementById(ZIP_TARGET_URL_MAP_FIELD_ID);
    field.value = setZipTargetUrl(field.value, zip.path, input.value);
    localStorage.setItem(ZIP_TARGET_URL_MAP_FIELD_ID, field.value);
    zipTargetUrlMapChanged();
}

// Re-resolves every row, and the URL of the zip on the page with them.
function zipTargetUrlMapChanged() {
    renderZipBatch();
    const active = zipBatch.zips[zipBatch.activeIndex];
    if (active && isBatchZipOnPage(active)) {
        applyZipTargetUrl(findZipTargetUrl(active.path, readZipTargetUrlMap()));
    }
}
