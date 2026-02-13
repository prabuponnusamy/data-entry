var valid_word_list = [];
var normalized_word_list = [];
var word_length_buckets = Object.create(null);
var score_cache = Object.create(null);

function set_valid_word_list(word_list){
    var list = Array.isArray(word_list) ? word_list : [];

    valid_word_list = list.slice(0);
    normalized_word_list = [];
    word_length_buckets = Object.create(null);
    score_cache = Object.create(null);

    for(var i = 0; i < valid_word_list.length; i++){
        var normalized = normalize_word(valid_word_list[i]);
        normalized_word_list.push(normalized);

        var length_key = normalized.length;
        if(!word_length_buckets[length_key]){
            word_length_buckets[length_key] = [];
        }
        word_length_buckets[length_key].push(i);
    }
}

function get_valid_word(word) {
    var normalized = normalize_word(word);
    if (normalized.length <2) {
        return normalized;
    }
    rlist = find_similar(normalized, 0.8);
    if (rlist[0].length > 0) {
        return rlist[0][0];
    }
    return normalized;
}

function find_similar(word, score_thresh){
    var max_size = 10;
    var top_words = [];
    var top_scores = [];

    if(!valid_word_list || valid_word_list.length === 0){
        return [top_words, top_scores];
    }

    var target = normalize_word(word);
    if(target.length === 0){
        return [top_words, top_scores];
    }

    var threshold = clamp_number(score_thresh, 0, 1);
    var candidate_indexes = get_candidate_indexes(target.length);
    var used_words = Object.create(null);

    for(var j = 0; j < candidate_indexes.length; j++){
        var i = candidate_indexes[j];
        var normalized_candidate = normalized_word_list[i];
        if(!normalized_candidate || used_words[normalized_candidate]){
            continue;
        }

        var temp_score = cached_score(target, i);
        if(temp_score > threshold){
            used_words[normalized_candidate] = true;

            var index = getListIndex(top_scores, temp_score);
            if(index < max_size){
                top_words.splice(index, 0, valid_word_list[i]);
                top_scores.splice(index, 0, temp_score);

                if(top_words.length > max_size){
                    top_words.pop();
                    top_scores.pop();
                }
            }
        }
    }
    return [top_words, top_scores];
}

function get_candidate_indexes(target_length){
    var indexes = [];
    var min_length = Math.max(0, target_length - 4);
    var max_length = target_length + 4;

    for(var length_key = min_length; length_key <= max_length; length_key++){
        var bucket = word_length_buckets[length_key];
        if(bucket && bucket.length > 0){
            for(var i = 0; i < bucket.length; i++){
                indexes.push(bucket[i]);
            }
        }
    }

    if(indexes.length > 0){
        return indexes;
    }

    for(var fallback_index = 0; fallback_index < valid_word_list.length; fallback_index++){
        indexes.push(fallback_index);
    }
    return indexes;
}

function getListIndex(scores, x){
    for(var i = 0; i < scores.length; i++){
        if(x > scores[i]) return i;
    }
    return scores.length;
}

function cached_score(target, word_index){
    var cache_key = target + "|" + word_index;
    if(score_cache[cache_key] === undefined){
        score_cache[cache_key] = score(target, normalized_word_list[word_index]);
    }
    return score_cache[cache_key];
}

function score(x, y){
    var length_weight = 0.2;
    var match_weight = 0.25;
    var shift_weight = 0.15;
    var edit_weight = 0.4;

    return length_weight * length_score(x, y)
         + match_weight * match_score(x, y)
         + shift_weight * shift_score(x, y)
         + edit_weight * edit_score(x, y);
}

function length_score(x, y){
    var longest = Math.max(x.length, y.length);
    if(longest === 0) return 1.0;

    var diff = Math.abs(x.length - y.length);
    return Math.max(1.0 - diff / longest, 0);
}

function match_score(x, y){
    var length = Math.min(x.length, y.length);
    if(length <= 0) return 0.0;

    var total = 0;
    for(var i = 0; i < length; i++){
        if(x.charAt(i) === y.charAt(i)) total++;
    }
    return total / length;
}

function shift_score(x, y){
    var l2 = match_score(x.substring(2), y);
    var l1 = match_score(x.substring(1), y);
    var c = match_score(x, y);
    var r1 = match_score(x, y.substring(1));
    var r2 = match_score(x, y.substring(2));

    return Math.max(l2, l1, c, r1, r2);
}

function edit_score(x, y){
    var longest = Math.max(x.length, y.length);
    if(longest === 0) return 1.0;

    var distance = levenshtein_distance(x, y);
    return Math.max(1.0 - distance / longest, 0);
}

function levenshtein_distance(x, y){
    var x_length = x.length;
    var y_length = y.length;

    if(x_length === 0) return y_length;
    if(y_length === 0) return x_length;

    var previous = [];
    var current = [];

    for(var i = 0; i <= y_length; i++){
        previous[i] = i;
    }

    for(var x_index = 1; x_index <= x_length; x_index++){
        current[0] = x_index;

        for(var y_index = 1; y_index <= y_length; y_index++){
            var cost = x.charAt(x_index - 1) === y.charAt(y_index - 1) ? 0 : 1;
            var insert_cost = current[y_index - 1] + 1;
            var delete_cost = previous[y_index] + 1;
            var replace_cost = previous[y_index - 1] + cost;

            current[y_index] = Math.min(insert_cost, delete_cost, replace_cost);
        }

        var temp = previous;
        previous = current;
        current = temp;
    }

    return previous[y_length];
}

function normalize_word(word){
    if(word === null || word === undefined) return "";
    return ("" + word).toLowerCase().trim();
}

function clamp_number(value, min, max){
    var number = typeof value === "number" ? value : 0;
    if(number < min) return min;
    if(number > max) return max;
    return number;
}

// Generated by Michael Wehar
var english_words = "dear|all|box|board|ticket|each|set|ch";
var english_word_list = english_words.split("|").map(word => word.trim().toUpperCase()).filter(word => word !== '');

set_valid_word_list(english_word_list);
