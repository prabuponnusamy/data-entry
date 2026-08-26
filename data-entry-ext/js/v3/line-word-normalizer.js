
var english_words = ["TICKET", "BOARD", "EACH", "DEAR", "SET", "BOX", "ALL", "CH"].sort((a, b) => b.length - a.length);

// First spell-correction pass: only scores a candidate word when its length
// matches the dictionary word's length.
function correctSpellingMistakesPass1(line) {
    line.split(' ').forEach(word => {
        var foundMatch = false;
        english_words.forEach(engWord => {
            if (foundMatch) return;
            if (engWord == word) {
                foundMatch = true;
                return;
            }
            if (engWord.length == word.length) {
                var engWordChars = engWord.split('');
                var wordChars = word.split('');
                // Check the number of matching characters in any order
                var matchCount = 0;
                engWordChars.forEach(char => {
                    if (wordChars.includes(char)) {
                        matchCount++;
                    }
                });
            }
            var matchScore = matchCount / engWord.length;
            if (matchScore > 0.5) {
                line = line.replace(word, engWord.toUpperCase());
                foundMatch = true;
                // break the loop if match found
                return;
            }
        });
    });
    return line;
}

// Second spell-correction pass: scores every candidate word regardless of length.
function correctSpellingMistakesPass2(line) {
    line.split(' ').forEach(word => {
        var foundMatch = false;
        english_words.forEach(engWord => {
            if (foundMatch) return;
            if (engWord == word) {
                foundMatch = true;
                return;
            }
            var engWordChars = engWord.split('');
            var wordChars = word.split('');
            // Check the number of matching characters in any order
            var matchCount = 0;
            engWordChars.forEach(char => {
                if (wordChars.includes(char)) {
                    matchCount++;
                }
            });

            var matchScore = matchCount / engWord.length;
            if (matchScore > 0.5) {
                line = line.replace(word, engWord.toUpperCase());
                foundMatch = true;
                // break the loop if match found
                return;
            }
        });
    });
    return line;
}

// Runs the full word-level normalization pipeline used before target/qty/amount
// extraction: known-word stripping, char cleanup, spell correction (x2), then
// a final known-word/cleanup pass.
function normalizeLineWords(line) {
    line = fixWords(line);

    replacements.forEach(item => {
        line = line.replace(item, "");
    });
    line = replaceUnwantedChars(line);
    line = splitTextAndNumbers(line);
    // Again now that joined words are split apart ("1times" -> "1 TIMES"), so
    // the dictionary gets a shot before spell correction guesses at the word.
    line = fixWords(line);
    line = line.replace(/\bX\b/, '-');

    line = correctSpellingMistakesPass1(line);
    line = correctSpellingMistakesPass2(line);

    replacements.forEach(item => {
        line = line.replace(item, "");
    });
    line = replaceUnwantedChars(line);

    return line;
}
