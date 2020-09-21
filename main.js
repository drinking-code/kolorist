const {loadWASM, OnigScanner} = require('onigasm')

let kolorist = {};

kolorist.init = async function (grammar) {
    switch (grammar.toLowerCase()) {
        case 'javascript':
            grammar = 'https://cdn.jsdelivr.net/gh/textmate/javascript.tmbundle@master/Syntaxes/JavaScript.plist'
    }

    // initiate oniguruma engine
    await loadWASM('https://cdn.jsdelivr.net/npm/onigasm@2.2.4/lib/onigasm.wasm')

    return new Promise((resolve, reject) => {
        let xmlHttp = new XMLHttpRequest(), plist;
        xmlHttp.onreadystatechange = () => {
            if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
                plist = xmlHttp.response;
                plist = plist.replace(/(?:\s|\t)#[\S\s]+?(?=\n)/g, '').replace(/[\n\t]/g, '')
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
            console.log(grammar)
            resolve(grammar)
        })
    }

    // sort pattern contents into usable arrays
    function makeKoloristGrammars(json) {
        // function to shorten code
        function transferCaptures(captures, object) {
            if (captures) {
                object = {}
                for (let i in captures) {
                    if (!captures.hasOwnProperty(i)) continue
                    if (!captures[i].name) continue
                    object[i.toString()] = captures[i].name.replace(/\./g, '-').replace(/-[^-]+$/g, '')
                }
            }
            return object
        }

        return new Promise(resolve => {
            let patterns = [], names = [], endPatterns = {}, patternsPatterns = {}
            json.patterns.forEach((pattern, index) => {
                let namesCaptures = {
                    name: (pattern.name) ? pattern.name.replace(/\./g, '-').replace(/-[^-]+$/g, '') : undefined
                }
                // standard patterns
                if (pattern.match) {
                    patterns.push(pattern.match.replace(/\s/g, ''))
                    namesCaptures.captures = transferCaptures(pattern.captures, namesCaptures.captures)
                } else if (pattern.begin && pattern.end) { // begin/end patterns
                    patterns.push(pattern.begin.replace(/\s/g, ''))
                    namesCaptures.beginCaptures = transferCaptures(pattern.beginCaptures, namesCaptures.beginCaptures)
                    namesCaptures.endCaptures = transferCaptures(pattern.endCaptures, namesCaptures.endCaptures)
                    endPatterns[index] = pattern.end
                    if (pattern.patterns) {
                        // todo (same as include +specifically defined patterns)
                    }
                } else if (pattern.include) {
                    // todo
                }
                if (pattern.match || (pattern.begin && pattern.end))
                    names.push(namesCaptures)
            })
            resolve({patterns, names, endPatterns, patternsPatterns})
        })
    }

    /** parsed grammar:
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
    const scanner = new OnigScanner(grammar.patterns)
    let tokens = []

    console.log(grammar)

    function scanForMatch(pos) {
        // find next match (from pos)
        let match = scanner.findNextMatchSync(code, pos)
        if (!match) {
            tokens.push({
                content: [code.substring(pos, code.length)]
            })
            return
        }
        // write everything not matched (from pos to match.start) to array as plain text
        if (match.captureIndices[0].start !== pos)
            tokens.push({
                content: [code.substring(pos, match.captureIndices[0].start)]
            })

        let end = match.captureIndices[0].end;
        // check if enclosed pattern ("begin", not "match" keyword)
        //   -> recursive function call (with in grammar defined #include patterns) and "extend" match
        if (grammar.endPatterns.hasOwnProperty(match.index)) {
            let endMatch = scanInside(match.captureIndices[0].end, match.index)
            end = endMatch.captureIndices[0].end
        }
        // write match
        let content = [], captureNames = [], lastEnd = match.captureIndices[0].start
        if (grammar.names[match.index].captures || grammar.names[match.index].beginCaptures) {
            match.captureIndices.forEach((capture, index) => {
                if (index === 0) return
                if (capture.length === 0) return
                if (capture.start !== lastEnd) {
                    content.push(code.substring(lastEnd, capture.start))
                    captureNames.push(undefined)
                }
                content.push(code.substring(capture.start, capture.end))
                if (grammar.names[match.index].captures)
                    captureNames.push(grammar.names[match.index].captures[index])
                else // todo: also get end-captures
                    captureNames.push(grammar.names[match.index].beginCaptures[index])
                lastEnd = capture.end
            })
            if (end > lastEnd){
                content.push(code.substring(lastEnd, end))
                captureNames.push(undefined)
            }
        }
        tokens.push({
            content: (content.length === 0) ? [code.substring(match.captureIndices[0].start, end)] : content,
            name: grammar.names[match.index].name,
            captureNames,
            match
        })
        scanForMatch(end)
    }

    scanForMatch(0)

    function scanInside(pos, index) {
        const endScanner = new OnigScanner([grammar.endPatterns[index]])
        let match = endScanner.findNextMatchSync(code, pos)
        return match
    }

    console.log(tokens)

    let html = '<pre><div>';

    tokens.forEach(token => {
        const className = token.name ? token.name : 'plain';
        let content = '';
        if (token.captureNames && token.captureNames.length !== 0) {
            token.captureNames.forEach((capture, index) => {
                const code = token.content[index]
                    .replace(/</g, '&lt;')
                    .replace(/\n/g, '</div><div>')
                if (capture === undefined)
                    content += code
                else
                    content += `<span class="${capture}">${code}</span>`
            })
        } else
            content = token.content[0]
                .replace(/</g, '&lt;')
                .replace(/\n/g, '</div><div>')

        html += `<span class="${className}">${content}</span>`
    })

    html += '</div></pre>';

    return html
}

global.kolorist = kolorist
