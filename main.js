const {loadWASM, OnigScanner} = require('onigasm');

let kolorist = {
    cache: {},
    utils: {
        database: {
            db: null,
            get: function (table, object, value) {
                const tx = this.db.transaction(table, 'readonly')
                tx.onerror = e => console.error(e.target.error)
                const req = tx.objectStore(table).get(object)
                return new Promise(r => {
                    req.onsuccess = e => {
                        if (e.target.result)
                            r(e.target.result[value])
                        else
                            r(null)
                    }
                })
            },
            saveGrammar: async function (name, grammar, force) {
                const tx = this.db.transaction('grammars', 'readwrite')
                tx.onerror = e => console.error(e.target.error)

                if (force) {
                    let delReq = tx.objectStore("grammars").delete(name)
                    delReq.onsuccess = e =>
                        tx.objectStore('grammars').add({grammar, name})
                } else
                    tx.objectStore('grammars').add({grammar, name})
            },
            getGrammar: function (name) {
                return kolorist.utils.database.get('grammars', name, 'grammar')
            },
            addToCache: function (language, content) {
                const tx = this.db.transaction('cache', 'readwrite')
                tx.onerror = e => console.error(e.target.error)
                const req = tx.objectStore('cache').add({
                    content, name: language
                })
            },
            readFromCache: function (language) {
                return kolorist.utils.database.get('cache', language, 'content')
            },
        },
        newGrammarFrom: function (languageGrammar, oldGrammar, index) {
            // create an index
            const newID = oldGrammar.id ? oldGrammar.id + '_' + index.toString() : index.toString(),
                cached = kolorist.cache[languageGrammar.scope][newID]
            if (cached) return cached // returned cached grammar if exists
            let masterGrammar = languageGrammar,
                grammar = oldGrammar,
                newGrammar = {
                    patterns: [],
                    endPatterns: {},
                    names: [],
                    patternsPatterns: {}
                }
            const patternsGrammar = grammar.patternsPatterns[index];
            if (patternsGrammar) {
                patternsGrammar.patterns.forEach((pattern, index) => {
                    if (pattern === '$self' || pattern.startsWith('#')) {
                        let repo = masterGrammar;
                        if (pattern.startsWith('#')) {
                            let tagName = pattern.replace('#', '')
                            repo = masterGrammar.repository[tagName]
                            if (!repo) return
                        }
                        newGrammar.patterns = newGrammar.patterns.concat(repo.patterns)
                        newGrammar.names = newGrammar.names.concat(repo.names)
                        for (let i in repo.endPatterns) {
                            if (!repo.endPatterns.hasOwnProperty(i)) continue
                            newGrammar.endPatterns[i + index] = repo.endPatterns[i]
                        }
                        for (let i in repo.patternsPatterns) {
                            if (!repo.patternsPatterns.hasOwnProperty(i)) continue
                            newGrammar.patternsPatterns[i + index] = repo.patternsPatterns[i]
                        }
                    } else {
                        newGrammar.patterns.push(pattern)
                        newGrammar.names.push(patternsGrammar.names[index])
                        if (patternsGrammar.endPatterns[index])
                            newGrammar.endPatterns[index] = patternsGrammar.endPatterns[index]
                        if (patternsGrammar.patternsPatterns[index])
                            newGrammar.patternsPatterns[index] = patternsGrammar.patternsPatterns[index]
                    }
                })
            }
            newGrammar.patterns.push(grammar.endPatterns[index])
            newGrammar.names.push(grammar.names[index])
            newGrammar.id = newID
            kolorist.cache[masterGrammar.scope][newID] = newGrammar
            return newGrammar
        }
    },
    grammarLinks: {
        ruby: 'https://cdn.jsdelivr.net/gh/textmate/ruby.tmbundle@master/Syntaxes/Ruby.plist',
        javascript: 'https://cdn.jsdelivr.net/gh/textmate/javascript.tmbundle@master/Syntaxes/JavaScript.plist',
        markdown: 'https://cdn.jsdelivr.net/gh/textmate/markdown.tmbundle@master/Syntaxes/Markdown.tmLanguage',
        python: 'https://cdn.jsdelivr.net/gh/textmate/python.tmbundle@master/Syntaxes/Python.tmLanguage',
        fortran: 'https://cdn.jsdelivr.net/gh/textmate/fortran.tmbundle@master/Syntaxes/Fortran%20-%20Modern.tmLanguage',
        fortranModern: 'https://cdn.jsdelivr.net/gh/textmate/fortran.tmbundle@master/Syntaxes/Fortran%20-%20Modern.tmLanguage',
        fortranPunchcard: 'https://cdn.jsdelivr.net/gh/textmate/fortran.tmbundle@master/Syntaxes/Fortran%20-%20Punchcard.tmLanguage',
        tex: 'https://cdn.jsdelivr.net/gh/textmate/latex.tmbundle@master/Syntaxes/TeX.plist',
        latex: 'https://cdn.jsdelivr.net/gh/textmate/latex.tmbundle@master/Syntaxes/LaTeX.plist',
        php: 'https://cdn.jsdelivr.net/gh/textmate/php.tmbundle@master/Syntaxes/PHP.plist',
        html: 'https://cdn.jsdelivr.net/gh/textmate/html.tmbundle@master/Syntaxes/HTML.plist',
        css: 'https://cdn.jsdelivr.net/gh/textmate/css.tmbundle@master/Syntaxes/CSS.plist',
        groovy: 'https://cdn.jsdelivr.net/gh/textmate/groovy.tmbundle@master/Syntaxes/Groovy.tmLanguage',
        c: 'https://cdn.jsdelivr.net/gh/textmate/c.tmbundle@master/Syntaxes/C.plist',
        cpp: 'https://cdn.jsdelivr.net/gh/textmate/c.tmbundle@master/Syntaxes/C++.plist',
        json: 'https://cdn.jsdelivr.net/gh/textmate/json.tmbundle@master/Syntaxes/JSON.tmLanguage',
        swift: 'https://cdn.jsdelivr.net/gh/textmate/swift.tmbundle@master/Syntaxes/Swift.tmLanguage',
        java: 'https://cdn.jsdelivr.net/gh/textmate/java.tmbundle@master/Syntaxes/Java.plist',
        lua: 'https://cdn.jsdelivr.net/gh/textmate/lua.tmbundle@master/Syntaxes/Lua.plist',
        shellscript: 'https://cdn.jsdelivr.net/gh/textmate/shellscript.tmbundle@master/Syntaxes/Shell-Unix-Bash.tmLanguage',
        shell: 'https://cdn.jsdelivr.net/gh/textmate/shellscript.tmbundle@master/Syntaxes/Shell-Unix-Bash.tmLanguage',
        bash: 'https://cdn.jsdelivr.net/gh/textmate/shellscript.tmbundle@master/Syntaxes/Shell-Unix-Bash.tmLanguage',
        haskell: 'https://cdn.jsdelivr.net/gh/textmate/haskell.tmbundle@master/Syntaxes/Haskell.plist',
        perl: 'https://cdn.jsdelivr.net/gh/textmate/perl.tmbundle@master/Syntaxes/Perl.plist',
        perl6: 'https://cdn.jsdelivr.net/gh/textmate/perl.tmbundle@master/Syntaxes/Perl%206.tmLanguage',
        rubyHaml: 'https://cdn.jsdelivr.net/gh/textmate/ruby-haml.tmbundle@master/Syntaxes/Ruby%20Haml.tmLanguage',
        rest: 'https://cdn.jsdelivr.net/gh/textmate/restructuredtext.tmbundle@master/Syntaxes/reStructuredText.plist',
        make: 'https://cdn.jsdelivr.net/gh/textmate/make.tmbundle@master/Syntaxes/Makefile.plist',
        erlang: 'https://cdn.jsdelivr.net/gh/textmate/erlang.tmbundle@master/Syntaxes/Erlang.plist',
        lexFlex: 'https://cdn.jsdelivr.net/gh/textmate/lex-flex.tmbundle@master/Syntaxes/Lex:Flex.tmLanguage',
        matlab: 'https://cdn.jsdelivr.net/gh/textmate/matlab.tmbundle@master/Syntaxes/M.tmLanguage',
        objC: 'https://cdn.jsdelivr.net/gh/textmate/objective-c.tmbundle@master/Syntaxes/Objective-C.tmLanguage',
        objCpp: 'https://cdn.jsdelivr.net/gh/textmate/objective-c.tmbundle@master/Syntaxes/Objective-C++.tmLanguage',
        yaml: 'https://cdn.jsdelivr.net/gh/textmate/yaml.tmbundle@master/Syntaxes/YAML.tmLanguage',
        processing: 'https://cdn.jsdelivr.net/gh/textmate/processing.tmbundle@master/Syntaxes/Processing.plist',
        diff: 'https://cdn.jsdelivr.net/gh/textmate/diff.tmbundle@master/Syntaxes/Diff.plist',
        markdownGH: 'https://cdn.jsdelivr.net/gh/textmate/GitHub-Markdown.tmbundle@master/Syntaxes/Markdown%20(GitHub).tmLanguage',
        cmakeCache: 'https://cdn.jsdelivr.net/gh/textmate/cmake.tmbundle@master/Syntaxes/CMake%20Cache.tmLanguage',
        cmake: 'https://cdn.jsdelivr.net/gh/textmate/cmake.tmbundle@master/Syntaxes/CMake%20Listfile.tmLanguage',
        r: 'https://cdn.jsdelivr.net/gh/textmate/r.tmbundle@master/Syntaxes/R.plist',
        d: 'https://cdn.jsdelivr.net/gh/textmate/d.tmbundle@master/Syntaxes/D.tmLanguage',
        asp: 'https://cdn.jsdelivr.net/gh/textmate/asp.tmbundle@master/Syntaxes/ASP.plist',
        ocaml: 'https://cdn.jsdelivr.net/gh/textmate/ocaml.tmbundle@master/Syntaxes/OCaml.plist',
        coldfusion: 'https://cdn.jsdelivr.net/gh/textmate/coldfusion.tmbundle@master/Syntaxes/ColdFusion.tmLanguage',
        xml: 'https://cdn.jsdelivr.net/gh/textmate/xml.tmbundle@master/Syntaxes/XML.plist',
        xsl: 'https://cdn.jsdelivr.net/gh/textmate/xsl.tmbundle@master/Syntaxes/XSL.plist',
    }
};

kolorist.init = async function (grammar, rebuild) {
    // initiate oniguruma engine
    await loadWASM('https://cdn.jsdelivr.net/npm/onigasm@2.2.4/lib/onigasm.wasm')

    // connect to indexedDB
    await (function () {
        const request = indexedDB.open('kolorist', 1)
        let db = kolorist.utils.database.db

        return new Promise((rs, rj) => {

            request.onupgradeneeded = e => {
                db = e.target.result
                db.createObjectStore('grammars', {keyPath: 'name'})
                db.createObjectStore('cache', {keyPath: 'name'})
                kolorist.utils.database.db = db
            }

            request.onsuccess = e => {
                kolorist.utils.database.db = e.target.result
                rs()
            }

            request.onerror = e => {
                console.error(e.target.error)
                rj()
            }
        })
    })()

    if (grammar.startsWith('<')) {
        let plistParsed;
        try {
            plistParsed = parseXML(grammar)
        } catch (e) {
            throw new Error('error while parsing grammar')
        }
        return new Promise(resolve => {
        translate(plistParsed)
            .then(async j => resolve(await main(j)))
        })
    } else if (grammar.startsWith('http')) {
        //
    } else {
        // otherwise get grammar from textmate on github
        if (kolorist.grammarLinks[grammar.toLowerCase()])
            grammar = kolorist.grammarLinks[grammar.toLowerCase()]
        else
            throw new Error(`"${grammar}" is not listed in kolorist. Please use a listed name, a URL to a TextMate grammar, or a TextMate grammar (as a string)`)
    }

    async function main(json) {
        const grammarName = json.name.toLowerCase()
        // return stored if if has already been built previously
        if (!rebuild) { // rebuild => switch to build grammar regardless of previous "builds"
            let savedGrammar
            try {
                savedGrammar = await kolorist.utils.database.getGrammar(grammarName)
            } catch (e) {
                savedGrammar = null
            }
            if (savedGrammar)
                return savedGrammar
        }
        return await makeKoloristGrammars(json)
    }

    function parseXML(xml) {
        let plist = xml;
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
        return plistParsed
    }

    return new Promise((resolve, reject) => {
        let xmlHttp = new XMLHttpRequest(), plist;
        xmlHttp.onreadystatechange = () => {
            if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
                plist = xmlHttp.response;
                translate(parseXML(plist))
                    .then(async j => resolve(await main(j)))

            } else if (xmlHttp.readyState === 4) {
                reject(xmlHttp.response || null)
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
            // console.log(grammar)
            resolve(grammar)
        })
    }

    // sort pattern contents into usable arrays
    function makeKoloristGrammars(json) {
        const grammarName = json.name.toLowerCase()
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
                } else if (pattern.include) {
                    // $self references are constructed later when needed
                    if (pattern.include === '$self' || pattern.include === '$base' || pattern.include === json.scopeName) {
                        patterns.push('$self')
                        names.push('')
                        return
                    }
                    if (!pattern.include.startsWith('#')) return // todo: add importing other grammars
                    /* "makeRepo" -> executing loosely when making the repository list because
                        some tags are referenced before transferred to the list
                        an infinite reference loop might occur
                    */
                    if (makeRepo && pattern.include.startsWith('#')) {
                        patterns.push(pattern.include)
                        names.push('')
                        return
                    }
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

        return new Promise(async resolve => {
            // parse repo
            let repo = {} // todo: repo inside repo
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
            grammar.scope = grammarName
            kolorist.utils.database.saveGrammar(grammarName, grammar, true);

            const cached = await kolorist.utils.database.readFromCache(grammarName);
            kolorist.cache[grammarName] = cached ? cached : {}
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

kolorist.highlight = async function (code, grammar) {
    const masterGrammar = grammar
    delete(grammar)
    let tokens = []

    // console.log(masterGrammar)

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
        tokens.push({
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
        // generate grammar for this pattern's pattern
        let newGrammar = kolorist.utils.newGrammarFrom(masterGrammar, grammar, index)
        return scanForMatch(pos, newGrammar)
    }

    // console.log(tokens)

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

// save cache to db
window.addEventListener('beforeunload', () => {
    for (let lang in kolorist.cache) {
        if (!kolorist.cache.hasOwnProperty(lang)) continue
        kolorist.utils.database.addToCache(lang, kolorist.cache[lang])
    }
})

global.kolorist = kolorist
