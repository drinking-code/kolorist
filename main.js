const {loadWASM, OnigScanner} = require('onigasm')

let kolorist = {};

kolorist.init = async function (grammar) { // todo: init multiple grammars
    switch (grammar.toLowerCase()) {
        case 'javascript':
            grammar = 'https://cdn.jsdelivr.net/gh/textmate/javascript.tmbundle@master/Syntaxes/JavaScript.plist'
    }

    return new Promise((resolve, reject) => {
        let xmlHttp = new XMLHttpRequest(), plist;
        xmlHttp.onreadystatechange = () => {
            if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
                plist = xmlHttp.response;
                plist = plist.replace(/(?:\t)#[\S\s]+?(?=\n)/g, '').replace(/[\n\t]/g, '')
                let parser, plistParsed;
                if (window.DOMParser) {
                    parser = new DOMParser();
                    plistParsed = parser.parseFromString(plist, "text/xml");
                } else // Internet Explorer
                {
                    plistParsed = new ActiveXObject("Microsoft.XMLDOM");
                    plistParsed.async = false;
                    plistParsed.loadXML(plist);
                }

                console.log(plistParsed)
                translate(plistParsed)
                    .then(j => makeKoloristGrammars(j))
                    .then(g => resolve(g))

            } else if (xmlHttp.readyState === 4) {
                reject()
            }
        };
        xmlHttp.open("GET", grammar);
        xmlHttp.send();

    })

    // translate from plist xml to json
    function translate(xml) {
        return new Promise(resolve => {
            function generateProperties(xml) {
                let json = {};
                // iterate every given child
                for (let i = 0; i < xml.children.length; i++) {
                    const elm = xml.children[i];
                    if (elm.tagName !== 'key') continue // iterate only <key> elements (and their associated sibling)
                    // if sibling is an array
                    if (elm.nextSibling.tagName === 'array') {
                        let array = []
                        for (let i = 0; i < elm.nextSibling.children.length; i++) {
                            const item = elm.nextSibling.children[i]
                            // if item has children (<dict>)
                            if (item.children.length !== 0)
                                array.push(generateProperties(item))
                            else // if item has no children (<string>)
                                array.push(item.textContent)
                        }
                        json[elm.textContent] = array;
                    } else if (elm.nextSibling.children.length !== 0) // if sibling has children but is not an array
                        json[elm.textContent] = generateProperties(elm.nextSibling)
                    else // if sibling has no children
                        json[elm.textContent] = elm.nextSibling.textContent;
                }
                return json
            }

            const grammar = generateProperties(xml.querySelector('dict'))
            resolve(grammar)
        })
    }

    // sort pattern contents into usable arrays
    function makeKoloristGrammars(json) {
        return new Promise(resolve => {
            let patterns = [], names = [], endPatterns = {}, patternsPatterns = {}
            json.patterns.forEach((pattern, index) => {
                let namesCaptures = {
                    name: (pattern.name) ? pattern.name : undefined
                }
                if (pattern.match) {
                    patterns.push(pattern.match.replace(/\s/g, ''))
                    if (pattern.captures) {
                        namesCaptures.captures = {}
                        for (let i in pattern.captures) {
                            if (!pattern.captures.hasOwnProperty(i)) continue
                            namesCaptures.captures[i.toString()] = pattern.captures[i].name
                        }
                    }
                } else if (pattern.begin && pattern.end) {
                patterns.push(pattern.begin.replace(/\s/g, ''))
                    if (pattern.beginCaptures) {
                        namesCaptures.beginCaptures = {}
                        for (let i in pattern.beginCaptures) {
                            if (!pattern.beginCaptures.hasOwnProperty(i)) continue
                            namesCaptures.beginCaptures[i.toString()] = pattern.beginCaptures[i].name
                        }
                    }
                    if (pattern.endCaptures) {
                        namesCaptures.endCaptures = {}
                        for (let i in pattern.endCaptures) {
                            if (!pattern.endCaptures.hasOwnProperty(i)) continue
                            namesCaptures.endCaptures[i.toString()] = pattern.endCaptures[i].name
                        }
                    }
                    endPatterns[index] = pattern.end
                    if (pattern.patterns) {
                        // todo (same as include +specifically defined patterns)
                    }
                } else if (pattern.include) {
                    // todo
                }
                names.push(namesCaptures)
            })
            resolve({patterns, names, endPatterns, patternsPatterns})
        })
    }

    /* parsed grammar:
    * 2 arrays and 2 objects
    * - array: all patterns
    *       (with #include patterns, begin/end only begin)
    * - array: all names for the pattern
    *       (every item is an object with 2 keys: name <name of pattern or undefined>, and captures <defined captures>)
    * - object: all end patterns (key: index of begin/end pattern in first array <end pattern>)
    * - object: all names for end patterns (key: index of end pattern in first array <name>)
    * - object: all patterns of begin/end patterns todo: is good? maybe repo lookup table?
    *       (key: index of begin/end pattern in first array <object of all included patterns>)*/

}

kolorist.highlight = async function (code, grammar) {
    // initiate oniguruma engine
    await loadWASM('./node_modules/onigasm/lib/onigasm.wasm')

    const scanner = new OnigScanner(grammar.patterns)
    let html = []

    console.log(grammar.patterns[4])

    function scanForMatch(pos) {
        // find next match (from pos)
        let match = scanner.findNextMatch(code, pos, (error, match) => {
            if (error) console.error(error)
            console.log(match)
        })
        /*if (!match) return
        console.log(match)
        scanForMatch(match.end)*/
        // write everything not matched (from pos to match.start) to array as plain text
        // check if enclosed pattern ("begin", not "match" keyword)
        // ->   recursive function call (with in grammar defined #include patterns)
        // then write match with
    }

    scanForMatch(0)

    function scanInside(pos, index) {

    }

    return html
}

global.kolorist = kolorist
