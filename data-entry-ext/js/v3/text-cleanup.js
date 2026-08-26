
function cleanupLine(line) {
    // replace all non a-z and A-Z and 0-9 which is prefix and suffix with empty string
    if (!line || line === '') return line;
    try {
        line = line.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
    } catch (e) {
        console.error(e);
        // Handle any errors that might occur during replacement
    }
    return line;
}

// Collapses any run of non-alphanumeric (non '#') characters into a single '~'
// separator, then trims stray separators from the ends.
function tildeNormalize(line) {
    return cleanupLine(line.replace(/[^A-Z0-9#]+/g, '~')).trim();
}

function uniqueSpecialChars(line) {
    // Replace any run of non-alphanumeric characters with a single instance of that character
    const matchedChars = line.match(/[^A-Z0-9#]/g);

    // 2. Filter out duplicates using a Set, and filter out nulls
    const chars = matchedChars ? [...new Set(matchedChars)] : [];

    return chars
}
