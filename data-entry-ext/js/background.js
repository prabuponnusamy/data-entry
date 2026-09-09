// Fill All settings. The queue and the finished run are the only two things
// the worker keeps between page loads, each under one session-storage key.
const QUEUE_KEY = 'fillQueue';
const SUMMARY_KEY = 'fillSummary';

/** Redirects allowed per block before a run that cannot reach its page is dropped. */
const MAX_NAVIGATIONS = 3;

/** Time for the page's own scripts to settle before the boxes are counted. */
const SUBMIT_DELAY_MS = 1500;

/** How long a banner stays up before the page reloads or submits. */
const RELOAD_DELAY_MS = 4000;

/** No summary.html ships with the extension yet; the last block's banner reports the run. */
const OPEN_SUMMARY_TAB = false;

/** Where a site sends you once the session has gone. */
const LOGIN_PATH = /(^|\/)(login|signin|sign-in|auth)(\/|$)/i;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openAndFill") {
        
        chrome.tabs.create({
            url: message.url
        }, function(tab) {

            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: fillData,
                        args: [
                            message.payload, 
                            message.target, 
                            message.supplierValueLabel, 
                            message.targetTkt, 
                            message.autoSubmit ? true : false
                        ]
                    });
                }
            });
        });
    }

    // Asked when a site is picked, so a dead session shows up then rather than
    // at the start of a run. The worker answers because it owns the check.
    if (message?.action === 'checkSignIn') {
        isSignedIn(message.url).then((signedIn) => sendResponse({ signedIn }));
        return true;
    }

    if (message?.action === 'fillAll') {
        // The reply waits for the sign-in check, so the page hears why a run
        // never started rather than watching a tab open and do nothing.
        startQueue(message.blocks ?? [], message.supplierValueLabel ?? '', {
            autoSubmit: message.autoSubmit === true,
            dryRun: message.dryRun === true,
            showFillBanner: message.showFillBanner !== false,
        }).then(sendResponse);
        return true;
    }

});

function fillData(data, target, supplierValueLabel, targetTkt, autoSubmit) {
    const rows = data.split("\n");
    console.log("Data received in content script for target: " + target + "\nData:\n" + data + "\nSupplier: " + supplierValueLabel + "\nTarget Tkt: " + targetTkt + "\nAuto Submit: " + autoSubmit);
    /*
        var cfm = confirm("Do you want to proceed with filling the data?");
        if (!cfm) {
            alert("Data filling cancelled by user.");
            return;
        }
    */
    //alert(targetTkt);
    insertDataIntoFields(rows, target, false, supplierValueLabel, targetTkt, autoSubmit);
}

/**
 * Open a tab and work through the blocks, one per page load.
 *
 * The queue lives in session storage rather than a variable: the service
 * worker is torn down when idle and would otherwise lose its place between
 * one page load and the next.
 */
async function startQueue(blocks, supplierId, { autoSubmit, dryRun, showFillBanner }) {
    if (blocks.length === 0) return { ok: false, error: 'Nothing to fill.' };

    // Every block shares one origin, so the first page answers for the run.
    if (!(await isSignedIn(blocks[0].url))) {
        return {
            ok: false,
            error:
                `Not signed in to ${new URL(blocks[0].url).origin}.\n\n` +
                'Open the site, log in, then start the fill again.',
        };
    }

    const tab = await chrome.tabs.create({ url: blocks[0].url });
    await save({
        tabId: tab.id,
        blocks,
        supplierId,
        autoSubmit,
        dryRun,
        showFillBanner,
        index: 0,
        navigations: 0,
        startedAt: Date.now(),
        filled: [],
    });
    return { ok: true };
}

/**
 * Is the session still good for this URL?
 *
 * The site is asked rather than the cookie jar: a session cookie is handed to
 * logged-out visitors too, so only the server can say whether the session
 * behind it still counts. Cookies ride along because the host is in
 * host_permissions.
 *
 * A network error is not a logged-out session — the run is allowed through, to
 * fail visibly on the page rather than be blocked from here on a guess.
 */
async function isSignedIn(url) {
    try {
        const response = await fetch(url, { credentials: 'include', redirect: 'follow' });
        if (isLoginPage(response.url)) return false;
        // Some sites serve the login form in place rather than redirecting to it.
        return !/<input[^>]+type=["']?password/i.test(await response.text());
    } catch (err) {
        console.warn('[data-entry] sign-in check could not be made', err);
        return true;
    }
}

function isLoginPage(url) {
    try {
        return LOGIN_PATH.test(new URL(url).pathname);
    } catch {
        return false;
    }
}


/**
 * Every completed load in the queue's tab consumes one block.
 *
 * The block's own URL decides what happens: if the tab is already on that page
 * the block is filled, and if it is not — because the next block is a
 * different ticket type, or because submitting left us on a results page — the
 * tab is sent there first and the load that follows does the filling.
 */
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (info.status !== 'complete') return;

    const state = (await chrome.storage.session.get(QUEUE_KEY))[QUEUE_KEY];
    if (!state || tabId !== state.tabId) return;

    // A session that drops mid-run looks like an unreachable page, and the
    // redirect budget would be spent bouncing off the login form. Say so and
    // stop, leaving the page on the login form for whoever is watching.
    if (isLoginPage(tab.url)) {
        await chrome.storage.session.remove(QUEUE_KEY);
        await notify(tabId, `Signed out — log in and start the fill again. Stopped after ${state.index} of ${state.blocks.length} block(s).`);
        return;
    }

    if (state.index >= state.blocks.length) {
        await finish(state);
        return;
    }

    const block = state.blocks[state.index];

    if (!isSamePage(tab.url, block.url)) {
        if (state.navigations >= MAX_NAVIGATIONS) {
            await chrome.storage.session.remove(QUEUE_KEY);
            await notify(tabId, `Could not reach ${block.url}. Stopped after ${state.index} block(s).`);
            return;
        }
        await save({ ...state, navigations: state.navigations + 1 });
        await chrome.tabs.update(tabId, { url: block.url });
        return;
    }

    // Advance before injecting: if the fill throws, the next load moves on
    // instead of filling the same block again.
    const filled = [
        ...state.filled,
        {
            target: block.target,
            rows: block.text.split('\n').filter((line) => line.trim()).length,
            url: block.url,
        },
    ];
    await save({ ...state, index: state.index + 1, navigations: 0, filled });

    await chrome.scripting.executeScript({
        target: { tabId },
        func: fillPage,
        args: [
            block.text,
            block.target,
            block.targetTkt,
            state.supplierId,
            state.index + 1,
            state.blocks.length,
            state.autoSubmit === true,
            state.dryRun === true,
            state.showFillBanner !== false,
            SUBMIT_DELAY_MS,
            RELOAD_DELAY_MS,
        ],
    });

    // The last block has just gone in, so nothing further will load in this
    // tab. Report the run now rather than waiting for an event that will not
    // come.
    if (state.index + 1 >= state.blocks.length) {
        await finish({ ...state, filled });
    }
});

/** Put the run where the summary page can read it, and open that page. */
async function finish(state) {
    await chrome.storage.session.set({
        [SUMMARY_KEY]: {
            filled: state.filled,
            supplierId: state.supplierId,
            autoSubmit: state.autoSubmit === true,
            dryRun: state.dryRun === true,
            startedAt: state.startedAt,
            finishedAt: Date.now(),
        },
    });
    await chrome.storage.session.remove(QUEUE_KEY);
    if (OPEN_SUMMARY_TAB) await chrome.tabs.create({ url: chrome.runtime.getURL('summary.html') });
}

/** Stop the queue when its tab is closed. */
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const state = (await chrome.storage.session.get(QUEUE_KEY))[QUEUE_KEY];
    if (state && state.tabId === tabId) await chrome.storage.session.remove(QUEUE_KEY);
});

const save = (state) => chrome.storage.session.set({ [QUEUE_KEY]: state });

/** Compare origin and path only; the site adds query strings of its own. */
function isSamePage(a, b) {
    try {
        const left = new URL(a);
        const right = new URL(b);
        return (
            left.origin === right.origin && trimSlash(left.pathname) === trimSlash(right.pathname)
        );
    } catch {
        return false;
    }
}

const trimSlash = (path) => path.replace(/\/+$/, '');

/** A banner rather than an alert: nothing in a run should wait to be dismissed. */
function notify(tabId, text) {
    return chrome.scripting
        .executeScript({
            target: { tabId },
            func: (msg) => {
                const el = document.createElement('div');
                el.style.cssText =
                    'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:10px 14px;' +
                    'background:#ffebee;border-bottom:4px solid #c62828;color:#8c1d1d;' +
                    'font:600 13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif';
                el.textContent = msg;
                document.body.prepend(el);
            },
            args: [text],
        })
        .catch(() => console.warn('[data-entry]', text));
}

/**
 * Runs in the target page, in the same isolated world as the content script —
 * which is where `insertDataIntoFields` comes from. The content script is
 * registered in the manifest for these hosts, so by the time the tab reports
 * `complete` the function is there.
 */
function fillPage(
    payload,
    target,
    targetTkt,
    supplierId,
    position,
    total,
    autoSubmit,
    dryRun,
    showFillBanner,
    SUBMIT_DELAY_MS,
    RELOAD_DELAY_MS,
) {
    const rows = payload.split('\n').filter((line) => line.trim());

    console.log(`[data-entry] filling ${position}/${total}`, { target, targetTkt, supplierId, rows });

    if (typeof insertDataIntoFields !== 'function') {
        console.error('[data-entry] content script not loaded on this page');
        showBanner(
            { block: `${position} of ${total}` },
            'STOPPED — the extension is not active on this page.',
            'alert',
        );
        return;
    }

    // The fill script reports bad data with alert(), which blocks until it is
    // dismissed and would stall an unattended run. Collect them instead: they
    // are shown in the banner, and any one of them stops the run.
    const complaints = [];
    const realAlert = window.alert;
    window.alert = (msg) => complaints.push(String(msg));
    try {
        insertDataIntoFields(rows, target, false, supplierId, targetTkt, false);
    } catch (err) {
        complaints.push(String(err && err.message ? err.message : err));
    } finally {
        window.alert = realAlert;
    }

    if (complaints.length > 0) {
        console.error('[data-entry] fill reported problems', complaints);
        showBanner(
            { block: `${position} of ${total}` },
            `AUTO-SUBMIT CANCELLED for this page — the fill reported:\n` +
                `• ${complaints.join('\n• ')}\n` +
                `Check the form and click Save yourself. The next block fills when you do.`,
            'alert',
        );
        return;
    }

    if (!autoSubmit) return;

    // Save is clicked only once the page agrees with what was sent: the button
    // is there and every box landed. On any mismatch the run stops with the
    // findings on screen rather than filing something wrong.
    setTimeout(() => {
        const check = inspectSubmit(rows, position, total);
        console.log('[data-entry] submit check', check);

        if (!check.wouldSubmit) {
            showBanner(
                check,
                'AUTO-SUBMIT CANCELLED for this page — the checks above did not agree. ' +
                    'Check the form and click Save yourself. The next block fills when you do.',
                'alert',
            );
            
            return;
        }

        if (dryRun) {
            // Every page reloads, the last one included. On earlier blocks the
            // reload is what brings up the next; on the last there is nothing
            // to bring up, but it still carries the numbers away so a stray
            // click on Save cannot file a form the run only meant to check.
            const next =
                position < total
                    ? `bring up block ${position + 1} of ${total}`
                    : 'clear this form — last block, the queue ends here';
            showBanner(
                check,
                `DRY RUN — nothing is being submitted. Reloading in ${RELOAD_DELAY_MS / 1000}s to ${next}.`,
                'alert',
                true,
            );
            setTimeout(() => location.reload(), RELOAD_DELAY_MS);
            return;
        }

        // No banner on a good submit — the page is about to go anyway, and a
        // flash on every block is noise. Dry runs and stops still show one.
        if (position < total) {
            console.log(`[data-entry] submitting block ${position} of ${total}`);
            check.button.click();
            return;
        }

        // The last block is the exception: nothing follows it, so this page is
        // where the run is reported. Say what is about to happen and hold the
        // click long enough to read it, then submit as normal.
        showBanner(
            check,
            `LAST BLOCK — checks passed. Submitting in ${RELOAD_DELAY_MS / 1000}s, ` +
                'then this page goes wherever Save sends it.',
            'live',
            true,
        );
        setTimeout(() => {
            console.log(`[data-entry] submitting block ${position} of ${total}`);
            check.button.click();
        }, RELOAD_DELAY_MS);
    }, SUBMIT_DELAY_MS);

    /**
     * How many number boxes a row fills. A 3D/4D/5D row has one; a 1D or 2D row
     * has one per position it names, so `35,10,ALL` fills ab, ac and bc.
     */
    function fieldsForRow(row) {
        const target = (row.split(',')[2] ?? '').trim().toUpperCase();
        if (!target) return 1;
        return target === 'ALL' ? 3 : target.split('-').filter(Boolean).length;
    }

    /** What the real submit would look at before clicking. */
    function inspectSubmit(sentRows, at, of) {
        const expectedRows = sentRows.length;
        const expectedFields = sentRows.reduce((sum, row) => sum + fieldsForRow(row), 0);
        const form = document.querySelector('form[action*="store"]') ?? document.querySelector('form');
        const button =
            form?.querySelector('button[type="submit"][name="save"]') ??
            form?.querySelector('button[type="submit"]') ??
            null;

        // The number fields the content script fills; the qty fields sit
        // beside them and are counted separately.
        const named = (match) =>
            [...(form?.querySelectorAll('input[name$="[]"]') ?? [])].filter((el) =>
                match(el.name.toLowerCase()),
            );
        const numberFields = named((name) => !name.includes('qty'));
        const filled = numberFields.filter((el) => el.value.trim() !== '').length;

        const supplier = form?.querySelector('select[name="supplierID"], select[name="supplier"]');
        console.log('[data-entry] submit inspection', {
            expectedRows,
            expectedFields,
            filledFields: filled,
            rowsMatch: filled === expectedFields,
            button,
            submitButton: button ? button.textContent.trim() : '(not found)',
            formAction: form?.getAttribute('action') ?? '(no form)',
            supplierChosen: supplier ? supplier.value || '(none)' : '(no supplier field)',
            wouldSubmit: !!button && filled === expectedFields,
        });

        return {
            block: `${at} of ${of}`,
            expectedRows,
            expectedFields,
            filledFields: filled,
            rowsMatch: filled === expectedFields,
            button,
            submitButton: button ? button.textContent.trim() : '(not found)',
            formAction: form?.getAttribute('action') ?? '(no form)',
            supplierChosen: supplier ? supplier.value || '(none)' : '(no supplier field)',
            wouldSubmit: !!button && filled === expectedFields,
        };
    }

    /**
     * `tone` is 'live' when the page is really being submitted, else 'alert',
     * which is the red one. `force` shows the banner even on a silent run: for
     * every page of a dry run, so the mode is never in doubt, and for the last
     * block, which is the only end-of-run report now that the summary tab is
     * off.
     */
    function showBanner(info, verdict, tone, force) {
        console.log(`[data-entry] ${verdict}`, info);
        if (!showFillBanner && !force) return;

        document.getElementById('data-entry-banner')?.remove();

        const banner = document.createElement('div');
        banner.id = 'data-entry-banner';
        banner.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
            'padding:10px 14px', 'font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif',
            `background:${tone === 'live' ? '#e8f5e9' : '#ffebee'}`,
            `border-bottom:4px solid ${tone === 'live' ? '#2e7d32' : '#c62828'}`,
            `color:${tone === 'live' ? '#222' : '#8c1d1d'}`,
            'font-weight:600', 'white-space:pre-wrap',
        ].join(';');

        const lines = [`Block ${info.block}`];
        if (info.expectedFields !== undefined) {
            lines[0] +=
                ` · ${info.expectedRows} row(s) → ${info.expectedFields} box(es) expected, ` +
                `${info.filledFields} filled ${info.rowsMatch ? '(match)' : '(MISMATCH)'}`;
            lines.push(`Submit button: ${info.submitButton} · supplier: ${info.supplierChosen}`);
        }
        lines.push(verdict);
        banner.textContent = lines.join('\n');

        const close = document.createElement('button');
        close.textContent = 'Dismiss';
        close.style.cssText = 'margin-left:12px;padding:2px 10px;cursor:pointer';
        close.onclick = () => banner.remove();
        banner.appendChild(close);

        document.body.prepend(banner);
    }
}
