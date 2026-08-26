
/**
 * Detects whether a raw line is a chat-header/attachment line rather than
 * ticket data, and if so extracts the attached image name.
 * Returns { line, isImage, image }.
 */
function extractImageLine(line) {
    line = line.replace('ATTACHED:', 'ATTACHED#');

    const isMessageHeaderLine = line.match(headerLineMatchRegex);
    if (isMessageHeaderLine) {
        line = line.replace(isMessageHeaderLine[0], '').trim();
    }

    // If line includes <attached: 00000047-PHOTO-2026-01-21-15-03-02.jpg> get image name
    if (line.includes('<ATTACHED#')) {
        const imageNameMatch = line.match(/<ATTACHED#\s*(.*?)>/);
        return { line, isImage: true, image: imageNameMatch ? imageNameMatch[1] : undefined };
    }

    if (line.includes(' (FILE ATTACHED)')) {
        return { line, isImage: true, image: line.replace(' (FILE ATTACHED)', ' ').trim() };
    }

    return { line, isImage: false };
}
