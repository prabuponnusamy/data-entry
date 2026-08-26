
// User supplied clean-up rules applied to the raw input before it is parsed.
//
// #deleteText: one snippet per line, every occurrence is removed.
// #replaceText: comma separated `actual=replacement` pairs, e.g. `O=0,l=1`.
// Both are matched literally and case-insensitively.

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Snippets to delete, one per line, longest first so a longer snippet is not
// broken up by a shorter one that it contains.
function getDeleteRules() {
    const value = document.getElementById(DELETE_TEXT_FIELD_ID)?.value || '';
    return value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '')
        .sort((a, b) => b.length - a.length);
}

// `actual=replacement` pairs. Only the first '=' splits, so a replacement may
// itself contain '='. An empty `actual` is skipped.
function getReplaceRules() {
    const value = document.getElementById(REPLACE_TEXT_FIELD_ID)?.value || '';
    return value
        .split(',')
        .map(pair => {
            const separatorIndex = pair.indexOf('=');
            if (separatorIndex < 0) return null;
            const actual = pair.substring(0, separatorIndex).trim();
            if (actual === '') return null;
            return { actual: actual, replacement: pair.substring(separatorIndex + 1).trim() };
        })
        .filter(rule => rule !== null);
}

// Deletes first, then replaces - so a replacement value is never deleted again.
function applyTextSubstitutions(text) {
    if (!text) return text;
    getDeleteRules().forEach(snippet => {
        text = text.replace(new RegExp(escapeRegExp(snippet), 'gi'), '');
    });
    getReplaceRules().forEach(rule => {
        text = text.replace(new RegExp(escapeRegExp(rule.actual), 'gi'), rule.replacement);
    });
    return text;
}
