const {loadWASM, OnigRegExp} = require('onigasm')

let kolorist = {};

kolorist.init = async function (grammar) {
    switch (grammar.toLowerCase()) {
        case 'javascript':
            grammar = 'https://cdn.jsdelivr.net/gh/textmate/javascript.tmbundle@master/Syntaxes/JavaScript.plist'
    }

    new Promise((resolve, reject) => {

        let xmlHttp = new XMLHttpRequest(), plist;
        xmlHttp.onreadystatechange = () => {
            if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
                plist = xmlHttp.response;
                plist = plist.replace(/\n/g, '').replace(/\t/g, '')
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
                translate(plistParsed, resolve)
            } else if (xmlHttp.readyState === 4) {
                reject()
            }
        };
        xmlHttp.open("GET", grammar);
        xmlHttp.send();

    })

    function translate(xml, resolve) {
        // console.log(xml)
        function generateProperties(xml) {
            let json = {};
            // console.log(xml)
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

        kolorist.grammar = generateProperties(xml.querySelector('dict'))
        resolve()
    }
}

kolorist.highlight = async function (code) {
    // initiate oniguruma engine
    await loadWASM('./node_modules/onigasm/lib/onigasm.wasm')
    // splice for strings -> inserting strings into lines
    String.prototype.splice = function (idx, rem, str) {
        return this.slice(0, idx) + str + this.slice(idx + Math.abs(rem));
    };
    // split code into lines
    code = code.split('\n')
    let html = '<pre>';
    code.forEach((line, i) => {
        // if (i !== 9) return
        // replace < character to prevent creating tags when writing to the document later
        line = line.replace('<', '&lt;')
        // iterate every grammar rule (pattern)
        let matches = [];
        for (let i = 0; i < kolorist.grammar.patterns.length; i++) {
            const pattern = kolorist.grammar.patterns[i];
            if (pattern.match) { // simple matches
                const regex = new OnigRegExp(pattern.match)
                // match all in line
                let match = regex.searchSync(line)
                if (match) {
                    matches.push({match, name: pattern.name})
                    // console.log(match, pattern.name, pattern.comment, pattern.match, line)
                }
            } // enclosing matches (with begin and end)
            // including patterns in grammar's repository
        }
        // add classes to every match
        console.log(matches)
        for (let i = 0; i < matches.length; i++) {
            // console.log(line);
            const match = matches[i],
                capture = match.match[0],
                tag = `<span class="${(match.name) ? match.name.replace('.', '-') : 'undefined-code'}">`
            line = line.splice(capture.end, 0, `</span>`)
            line = line.splice(capture.start, 0, tag)
            if (matches.length - 1 === i) continue
            for (let j = i; j < matches.length; j++) {
                matches[j].match.forEach(thisCapture => {
                    if (thisCapture.start > capture.start) {
                        const tagLength = tag.length
                        if (thisCapture.start > capture.start + capture.length)
                            thisCapture.start += tagLength + 7
                        else
                            thisCapture.start += tagLength
                        thisCapture.end += tagLength + 7
                    } else if (thisCapture.start === capture.start) {
                        thisCapture.end += tag.length + capture.length + 7
                    }
                })
            }
        }

        html += `<div>${line}</div>`
        // console.log(line)
    })
    html += '</pre>'
    return html
}

global.kolorist = kolorist
