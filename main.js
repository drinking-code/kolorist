const {loadWASM, OnigScanner} = require('onigasm')

let kolorist = {utils:{}};

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
                // remove all comments (from patterns) and remove all tabs and new-lines
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
                            // if item has children (-> <dict>)
                            if (item.children.length !== 0)
                                array.push(generateProperties(item))
                            else // if item has no children (e.g. <string>)
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
                // for every written capture group
                for (let i in captures) {
                    if (!captures.hasOwnProperty(i)) continue
                    // only if capture has a name (excluding capture groups with patterns)
                    if (!captures[i].name) continue
                    // transfer name replacing all "." with "-" and removing the last (e.g. "-js")
                    object[i.toString()] = captures[i].name.replace(/\./g, '-').replace(/-[^-]+$/g, '')
                }
            }
            return object
        }

        function makeList(plistJSON, repo, makeRepo) {
            let patterns = [], names = [], endPatterns = {}, patternsPatterns = {}, addToIndex = 0
            plistJSON.patterns.forEach((pattern, index) => {
                // store the original index
                const origIndex = index;
                // correct the index to match indices across all above defined arrays and objects
                index += addToIndex;
                let namesCaptures = {
                    // replacing all "." with "-" and removing the last (e.g. "-js")
                    name: (pattern.name) ? pattern.name.replace(/\./g, '-').replace(/-[^-]+$/g, '') : undefined
                }
                // standard patterns
                if (pattern.match) {
                    // remove all leftover spaces
                    patterns.push(pattern.match.replace(/\s/g, ''))
                    namesCaptures.captures = transferCaptures(pattern.captures, namesCaptures.captures)
                } else if (pattern.begin && pattern.end) { // begin/end patterns >- $self patterns
                    // remove all leftover spaces
                    patterns.push(pattern.begin.replace(/\s/g, ''))
                    namesCaptures.beginCaptures = transferCaptures(pattern.beginCaptures, namesCaptures.beginCaptures)
                    namesCaptures.endCaptures = transferCaptures(pattern.endCaptures, namesCaptures.endCaptures)
                    // write the end pattern to endPatterns with the corrected index as key
                    endPatterns[index] = pattern.end
                    if (pattern.patterns) {
                        // make a nested grammar list of the patterns
                        patternsPatterns[index] = makeList(pattern, repo, makeRepo)
                    }
                } else if (pattern.include && !makeRepo) {
                    /* "makeRepo" -> not executing when making the repository list because
                        some tags are referenced before transferred to the list
                        an infinite reference loop might occur
                    */
                    // $self references are constructed later when needed
                    if (pattern.include === '$self' || pattern.include === '$base' || pattern.include === json.scopeName) {
                        patterns.push('$self')
                        names.push('')
                        return
                    }
                    if (!pattern.include.startsWith('#')) return // todo: add importing other grammars
                    // pull tag reference from repo
                    const group = repo[pattern.include.replace('#', '')]
                    // iterate every pattern in pulled tag
                    group.patterns.forEach((repoPattern, repoIndex) => {
                        // correct index inside loop
                        index = origIndex + addToIndex;
                        patterns.push(repoPattern)
                        names.push(group.names[repoIndex])
                        if (group.endPatterns[repoIndex])
                            endPatterns[index] = group.endPatterns[repoIndex]
                        if (group.patternsPatterns[repoIndex])
                            patternsPatterns[index] = group.patternsPatterns[repoIndex]
                        // correct index for continuation outside the loop
                        addToIndex += 1
                    })
                    addToIndex -= 1
                } else {
                    addToIndex -= 1
                }
                // "namesCaptures" only as to be pushed for match and begin/end patterns
                if (pattern.match || (pattern.begin && pattern.end))
                    names.push(namesCaptures)
            })
            return {patterns, names, endPatterns, patternsPatterns}
        }

        return new Promise(resolve => {
            // parse repo
            let repo = {} // todo: repo in repo and repo calls (include #) in repo patterns
            for (let tag in json.repository) {
                if (!json.repository.hasOwnProperty(tag)) continue
                repo[tag] = makeList(
                    (json.repository[tag].patterns) ? json.repository[tag] : {patterns: json.repository[tag]},
                    repo,
                    true
                )
            }
            // make grammar
            let grammar = makeList(json, repo)
            grammar.repository = repo
            resolve(grammar)
        })
    }

    /** parsed grammar:
     * 2 arrays and 2 objects
     * - array: all patterns
     *       (with #include patterns, begin/end only begin)
     * - array: all names for the pattern
     *       (every item is an object with 2 keys: name <name of pattern or undefined>, and captures <defined captures>)
     * - object: all end patterns (key: index of begin/end pattern in first array <end pattern>)
     * - object: all names for end patterns (key: index of end pattern in first array <name>) todo
     * - object: all patterns of begin/end patterns
     *       (key: index of begin/end pattern in first array <object of all included patterns>)*/

}

kolorist.highlight = async function (code, masterGrammar) {
    let tokens = []

    console.log(masterGrammar)

    function scanForMatch(pos, grammar) {
        let scanner = new OnigScanner(grammar.patterns)
        // find next match (from pos)
        let match = scanner.findNextMatchSync(code, pos)
        if (!match) {
            tokens.push({
                content: [code.substring(pos, code.length)]
            })
            return null
        }

        // write everything not matched (from pos to match.start) to array as plain text
        if (match.captureIndices[0].start !== pos)
            tokens.push({
                content: [code.substring(pos, match.captureIndices[0].start)]
            })

        // end => absolute end of match (including end pattern)
        let end = match.captureIndices[0].end;
        // write match with capture groups
        let content = [], captureNames = [], lastEnd = match.captureIndices[0].start // lastEnd => end of last capture group
        if (grammar.names[match.index].captures || grammar.names[match.index].beginCaptures) {
            match.captureIndices.forEach((capture, index) => {
                if (index === 0) return
                // exclude not matched capture groups
                if (capture.start === 4294967295 || capture.end === 4294967295) return
                // write everything before capture to "content"
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
            // write everything remaining in match to "content"
            if (end > lastEnd) {
                content.push(code.substring(lastEnd, end))
                captureNames.push(undefined)
            }
        }
        tokens.push({ // todo put BEFORE scanInside() call
            content: (content.length === 0) ? [code.substring(match.captureIndices[0].start, end)] : content,
            name: grammar.names[match.index].name,
            captureNames,
            match
        })

        // check if enclosed pattern ("begin", not "match" keyword)
        //   -> recursive function call (with in grammar defined #include patterns) and "extend" match
        if (grammar.endPatterns.hasOwnProperty(match.index)) {
            end = scanInside(match.captureIndices[0].end, grammar, match.index)
        }

        return end
    }

    let position = 0;
    while (position < code.length && position !== null) {
        position = scanForMatch(position, masterGrammar)
    }

    function scanInside(pos, grammar, index) {
        // generate pattern grammar
        let newGrammar = {
            patterns: [grammar.endPatterns[index]],
            endPatterns: {},
            names: [grammar.names[index]],
            patternsPatterns: {}
        }
        const patternsGrammar = grammar.patternsPatterns[index];
        if (patternsGrammar) {
            patternsGrammar.patterns.forEach((pattern, index) => {
                if (pattern === '$self') {
                    newGrammar.patterns = patternsGrammar.patterns.concat(grammar.patterns)
                    newGrammar.names = patternsGrammar.names.concat(grammar.names)
                    for (let i in patternsGrammar.endPatterns) {
                        if (!patternsGrammar.endPatterns.hasOwnProperty(i)) continue
                        newGrammar.endPatterns[i + 1 + index] = patternsGrammar.endPatterns[i]
                    }

                } else {
                    newGrammar.patterns.push(pattern)
                    newGrammar.names.push(patternsGrammar.names[index])
                    if (patternsGrammar.endPatterns[index])
                        newGrammar.endPatterns[1 + index] = patternsGrammar.endPatterns[index]
                    if (patternsGrammar.patternsPatterns[index])
                        newGrammar.patternsPatterns[1 + index] = patternsGrammar.patternsPatterns[index]
                }
            })
        }
        return scanForMatch(pos, newGrammar)
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
