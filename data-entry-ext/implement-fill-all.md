Here's the whole flow. One clarification up front: it isn't localStorage — it's chrome.storage.session, the extension's own in-memory store, keyed by fillQueue (background.js:8). That distinction matters, because localStorage is per-origin and the service worker and the target site don't share one; chrome.storage.session is visible to every part of the extension and is wiped when the browser closes.

1. Data leaves the app page

src/app.tsx:395 builds an array of blocks ({ target, url, text }) and calls fillAll, which does a single chrome.runtime.sendMessage(message) (src/lib/messaging.ts:42). No tab is involved yet — the message goes to the service worker.

2. The worker opens a tab and writes the queue

background.js:35 picks up action: 'fillAll' and calls startQueue (background.js:54):

const tab = await chrome.tabs.create({ url: blocks[0].url });
await save({ tabId: tab.id, blocks, supplierId, ..., index: 0, navigations: 0, filled: [] });

save (background.js:163, the line you selected) is just chrome.storage.session.set({ fillQueue: state }) — the entire cursor is one object under one key: which tab owns the run, the full block list, where we are (index), how many redirect attempts we've spent (navigations), and what's been filled so far.

The comment at background.js:49-52 gives the reason for storing it rather than holding it in a variable: the service worker is torn down when idle. Between one page load and the next, the worker may be killed entirely; a module-level let queue = ... would be gone. Session storage survives that, so on every wake-up the worker re-reads its place.

3. Read one at a time, per page load

chrome.tabs.onUpdated (background.js:80) is the pump. Every completed load fires it:

if (info.status !== 'complete') return;
const state = (await chrome.storage.session.get(QUEUE_KEY))[QUEUE_KEY];
if (!state || tabId !== state.tabId) return;      // not our tab — ignore
if (state.index >= state.blocks.length) return finish(state);
const block = state.blocks[state.index];          // exactly one block

So the load event is the clock, and state.index is the read cursor. One load → one block.

4. The URL comparison and the redirect

This is the part you asked about (background.js:93-102):

if (!isSamePage(tab.url, block.url)) {
    if (state.navigations >= MAX_NAVIGATIONS) { /* give up, banner, clear queue */ }
    await save({ ...state, navigations: state.navigations + 1 });
    await chrome.tabs.update(tabId, { url: block.url });
    return;                                        // note: index NOT advanced
}

isSamePage (background.js:166) compares origin + path only, trailing slash trimmed — query strings are ignored because the site appends its own.

If the tab isn't where the block belongs, nothing is filled. The tab is navigated and the function returns with index untouched. That navigation triggers another complete event, onUpdated runs again, re-reads the same block, and this time the URL matches, so the fill happens. Two reasons the tab drifts: the next block is a different ticket type (different URL), or the previous Save left you on a results page.

navigations is the loop guard. It increments on each redirect attempt and resets to 0 on a successful fill (background.js:114). If a page keeps redirecting away, after MAX_NAVIGATIONS (3) the queue is deleted and a red banner explains where it stopped — without it, worker and page would ping-pong forever.

5. Fill, advance, repeat

On a match, the state is written back before injecting (background.js:104-114):

await save({ ...state, index: state.index + 1, navigations: 0, filled });
await chrome.scripting.executeScript({ target: { tabId }, func: fillPage, args: [...] });

The comment says why the order is deliberate: if fillPage throws, the cursor has already moved, so the next load takes the next block instead of retrying the same one forever.

fillPage runs in the page's isolated world, calls the content script's insertDataIntoFields, verifies the boxes, and clicks Save. That submit navigates the tab → complete fires → onUpdated reads fillQueue again at the new index. That's the loop: storage is the only thing carrying state between iterations.

6. Termination

Three exits, all of which remove(QUEUE_KEY):
- Last block filled — background.js:136 calls finish immediately rather than waiting for a load that will never come, writing fillSummary for summary.js to read.
- Redirect budget exhausted — background.js:95.
- Tab closed — chrome.tabs.onRemoved at background.js:158, guarded by state.tabId === tabId so closing an unrelated tab doesn't kill the run.

The tab-id guard appears in both listeners; it's what keeps a queue bound to its own tab while you keep browsing in others.

✻ Crunched for 37s · done 6:45 PM

─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ why is navigations reset to 0 after a fill
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agent