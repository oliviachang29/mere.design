(function() {

var FuzzySet = function(arr, useLevenshtein, gramSizeLower, gramSizeUpper) {
    var fuzzyset = {
        version: '0.0.1'
    };

    // default options
    arr = arr || [];
    fuzzyset.gramSizeLower = gramSizeLower || 1;
    fuzzyset.gramSizeUpper = gramSizeUpper || 3;
    fuzzyset.useLevenshtein = (typeof useLevenshtein !== 'boolean') ? true : useLevenshtein;

    // define all the object functions and attributes
    fuzzyset.exactSet = {};
    fuzzyset.matchDict = {};
    fuzzyset.items = {};

    // helper functions
    var levenshtein = function(str1, str2) {
        var current = [], prev, value;

        for (var i = 0; i <= str2.length; i++)
            for (var j = 0; j <= str1.length; j++) {
            if (i && j)
                if (str1.charAt(j - 1) === str2.charAt(i - 1))
                value = prev;
                else
                value = Math.min(current[j], current[j - 1], prev) + 1;
            else
                value = i + j;

            prev = current[j];
            current[j] = value;
            }

        return current.pop();
    };

    // return an edit distance from 0 to 1
    var _distance = function(str1, str2) {
        if (str1 === null && str2 === null) throw 'Trying to compare two null values';
        if (str1 === null || str2 === null) return 0;
        str1 = String(str1); str2 = String(str2);

        var distance = levenshtein(str1, str2);
        if (str1.length > str2.length) {
            return 1 - distance / str1.length;
        } else {
            return 1 - distance / str2.length;
        }
    };
    var _nonWordRe = /[^\w, ]+/;

    var _iterateGrams = function(value, gramSize) {
        gramSize = gramSize || 2;
        var simplified = '-' + value.toLowerCase().replace(_nonWordRe, '') + '-',
            lenDiff = gramSize - simplified.length,
            results = [];
        if (lenDiff > 0) {
            for (var i = 0; i < lenDiff; ++i) {
                value += '-';
            }
        }
        for (var i = 0; i < simplified.length - gramSize + 1; ++i) {
            results.push(simplified.slice(i, i + gramSize));
        }
        return results;
    };

    var _gramCounter = function(value, gramSize) {
        // return an object where key=gram, value=number of occurrences
        gramSize = gramSize || 2;
        var result = {},
            grams = _iterateGrams(value, gramSize),
            i = 0;
        for (i; i < grams.length; ++i) {
            if (grams[i] in result) {
                result[grams[i]] += 1;
            } else {
                result[grams[i]] = 1;
            }
        }
        return result;
    };

    // the main functions
    fuzzyset.get = function(value, defaultValue) {
        // check for value in set, returning defaultValue or null if none found
        var result = this._get(value);
        if (!result && typeof defaultValue !== 'undefined') {
            return defaultValue;
        }
        return result;
    };

    fuzzyset._get = function(value) {
        var normalizedValue = this._normalizeStr(value),
            result = this.exactSet[normalizedValue];
        if (result) {
            return [[1, result]];
        }

        var results = [];
        // start with high gram size and if there are no results, go to lower gram sizes
        for (var gramSize = this.gramSizeUpper; gramSize >= this.gramSizeLower; --gramSize) {
            results = this.__get(value, gramSize);
            if (results) {
                return results;
            }
        }
        return null;
    };

    fuzzyset.__get = function(value, gramSize) {
        var normalizedValue = this._normalizeStr(value),
            matches = {},
            gramCounts = _gramCounter(normalizedValue, gramSize),
            items = this.items[gramSize],
            sumOfSquareGramCounts = 0,
            gram,
            gramCount,
            i,
            index,
            otherGramCount;

        for (gram in gramCounts) {
            gramCount = gramCounts[gram];
            sumOfSquareGramCounts += Math.pow(gramCount, 2);
            if (gram in this.matchDict) {
                for (i = 0; i < this.matchDict[gram].length; ++i) {
                    index = this.matchDict[gram][i][0];
                    otherGramCount = this.matchDict[gram][i][1];
                    if (index in matches) {
                        matches[index] += gramCount * otherGramCount;
                    } else {
                        matches[index] = gramCount * otherGramCount;
                    }
                }
            }
        }

        function isEmptyObject(obj) {
            for(var prop in obj) {
                if(obj.hasOwnProperty(prop))
                    return false;
            }
            return true;
        }

        if (isEmptyObject(matches)) {
            return null;
        }

        var vectorNormal = Math.sqrt(sumOfSquareGramCounts),
            results = [],
            matchScore;
        // build a results list of [score, str]
        for (var matchIndex in matches) {
            matchScore = matches[matchIndex];
            results.push([matchScore / (vectorNormal * items[matchIndex][0]), items[matchIndex][1]]);
        }
        var sortDescending = function(a, b) {
            if (a[0] < b[0]) {
                return 1;
            } else if (a[0] > b[0]) {
                return -1;
            } else {
                return 0;
            }
        };

        results.sort(sortDescending);
        if (this.useLevenshtein) {
            var newResults = [],
                endIndex = Math.min(50, results.length);
            // truncate somewhat arbitrarily to 50
            for (var i = 0; i < endIndex; ++i) {
                newResults.push([_distance(results[i][1], normalizedValue), results[i][1]]);
            }
            results = newResults;
            results.sort(sortDescending);
        }

        return results;
        // var newResults = [];
        // for (var i = 0; i < results.length; ++i) {
        //     if (results[i][0] == results[0][0]) {
        //         newResults.push([results[i][0], this.exactSet[results[i][1]]]);
        //     }
        // }
        // return newResults;
    };

    fuzzyset.add = function(value) {
        var normalizedValue = this._normalizeStr(value);
        if (normalizedValue in this.exactSet) {
            return false;
        }

        var i = this.gramSizeLower;
        for (i; i < this.gramSizeUpper + 1; ++i) {
            this._add(value, i);
        }
    };

    fuzzyset._add = function(value, gramSize) {
        var normalizedValue = this._normalizeStr(value),
            items = this.items[gramSize] || [],
            index = items.length;

        items.push(0);
        var gramCounts = _gramCounter(normalizedValue, gramSize),
            sumOfSquareGramCounts = 0,
            gram, gramCount;
        for (gram in gramCounts) {
            gramCount = gramCounts[gram];
            sumOfSquareGramCounts += Math.pow(gramCount, 2);
            if (gram in this.matchDict) {
                this.matchDict[gram].push([index, gramCount]);
            } else {
                this.matchDict[gram] = [[index, gramCount]];
            }
        }
        var vectorNormal = Math.sqrt(sumOfSquareGramCounts);
        items[index] = [vectorNormal, normalizedValue];
        this.items[gramSize] = items;
        this.exactSet[normalizedValue] = value;
    };

    fuzzyset._normalizeStr = function(str) {
        if (Object.prototype.toString.call(str) !== '[object String]') throw 'Must use a string as argument to FuzzySet functions';
        return str.toLowerCase();
    };

    // return length of items in set
    fuzzyset.length = function() {
        var count = 0,
            prop;
        for (prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                count += 1;
            }
        }
        return count;
    };

    // return is set is empty
    fuzzyset.isEmpty = function() {
        for (var prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                return false;
            }
        }
        return true;
    };

    // return list of values loaded into set
    fuzzyset.values = function() {
        var values = [],
            prop;
        for (prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                values.push(this.exactSet[prop]);
            }
        }
        return values;
    };


    // initialization
    var i = fuzzyset.gramSizeLower;
    for (i; i < fuzzyset.gramSizeUpper + 1; ++i) {
        fuzzyset.items[i] = [];
    }
    // add all the items to the set
    for (i = 0; i < arr.length; ++i) {
        fuzzyset.add(arr[i]);
    }

    return fuzzyset;
};

var root = this;
// Export the fuzzyset object for **CommonJS**, with backwards-compatibility
// for the old `require()` API. If we're not in CommonJS, add `_` to the
// global object.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FuzzySet;
    root.FuzzySet = FuzzySet;
} else {
    root.FuzzySet = FuzzySet;
}

})();


// search functionality
(function($, window, document, undefined) {
    'use strict';

    var tagsId = {
        '404 error': 254,
        'about': 89,
        'accordion': 122,
        'account': 123,
        'profile': 123,
        'dashboard': 123,
        'settings': 123,
        'animation': 126,
        'badge': 181,
        'blockquot': 244,
        'breadcrumb': 129,
        'button': 177,
        'calendar': 242,
        'call to action': 130,
        'cards': 252,
        'career': 111,
        'jobs': 111,
        'carousel': 255,
        'chooser': 185,
        'clients': 219,
        'parteners': 219,
        'comments': 93,
        'contact': 132,
        'detail': 110,
        'projects': 110,
        'products': 110,
        'case study': 110,
        'dropdown': 134,
        'events': 246,
        'faqs': 136,
        'features': 137,
        'benefits': 137,
        'filters': 168,
        'footer': 84,
        'form': 85,
        'gallery': 239,
        'galleries': 239,
        'portfolio': 239,
        'our work': 239,
        'header': 83,
        'hero': 83,
        'homepage': 83,
        'hover': 180,
        'rollover': 180,
        'caption': 180,
        'legal': 257,
        'privacy': 257,
        'terms of service': 257,
        'terms of use': 257,
        'lists': 95,
        'loading': 142,
        'loader': 142,
        'progress': 142,
        'login': 143,
        'sign in': 143,
        'map': 96,
        'media player': 144,
        'video player': 144,
        'audio player': 144,
        'menu': 88,
        'navigation': 88,
        'notification': 97,
        'pagination': 146,
        'popup': 116,
        'modal': 116,
        'post': 245,
        'blog': 245,
        'article': 245,
        'pricing': 148,
        'search': 175,
        'shopping cart': 169,
        'checkout': 169,
        'cart': 169,
        'sidebar': 153,
        'side nav': 153,
        'sign up': 101,
        'register': 101,
        'slider': 87,
        'social media': 155,
        'share': 155,
        'statistics': 253,
        'stats': 253,
        'counter': 253,
        'countdown': 253,
        'chart': 253,
        'subscribe': 225,
        'table': 157,
        'tabs': 86,
        'tags': 158,
        'team': 159,
        'testimonials': 160,
        'timelines': 171,
        'tooltips': 162,
        'typography': 220,
        'validation': 256,
        'errorr': 256,
        'wizard': 119,
    };

    var popularTags = [
        '404 error',
        'about',
        'button',
        'form',
        'header',
        'login',
        'menu',
        'register',
        'typography',
    ];

    var fuzzy = FuzzySet(Object.keys(tagsId));

    var wrap = $('.header-menu-search-wrap');
    var ul = $('.header-menu-search-results');
    var input = $('#header-menu-search-input');
    var title = $('.header-menu-search-results-title');

    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    var myEfficientFn = debounce(openWrap, 250);

    function openWrap() {
        ul.children('.header-menu-search-results-tags').remove();

        wrap.removeClass('header-menu-search-wrap-open');

        var val = input.val();

        var result = fuzzy.get(val);

        if (val.length === 0) {
            title.text('POPULAR PATTERNS');
            wrap.addClass('header-menu-search-wrap-open');

            popularTags.forEach(function(el, index) {
                ul.append('<li class="header-menu-search-results-tags"><a href="/tags/' + tagsId[el] + '">' + el + '</a></li>');
            });

            return;
        } else {
            title.text('RELEVANT PATTERNS');
        }

        if (!result) {
            return;
        }

        var found = false;

        result.forEach(function(el, index) {
            if (Math.ceil(el[0] * 100) > 30 && index < 10) {
                // ul.append('<li class="header-menu-search-results-tags"><a href="/tags/' + tagsId[el[1]] + '">' + el[1] + ' - ' + el[0] + '</a></li>');
                ul.append('<li class="header-menu-search-results-tags"><a href="/tags/' + tagsId[el[1]] + '">' + el[1] + '</a></li>');
                found = true;
            }
        });

        if (found) {
            wrap.addClass('header-menu-search-wrap-open');
        }
    }

    var stopFocusOut = true;
    wrap.on('mousedown', function(event) {
        stopFocusOut = false;
    });

    input.on('focusout', function() {
        if (stopFocusOut) {
            wrap.removeClass('header-menu-search-wrap-open');
            ul.children('.header-menu-search-results-tags').remove();
        }
    });

    input.on('focusin', function() {
        stopFocusOut = true;
        openWrap();
    });

    input.on('input', myEfficientFn);
})(jQuery, window, document);
