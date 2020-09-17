function init(grammar) {
    switch (grammar.toLowerCase()) {
        case 'javascript':
            grammar = 'https://cdn.jsdelivr.net/gh/textmate/javascript.tmbundle@master/Syntaxes/JavaScript.plist'
    }

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
            translate(plistParsed)
        }
    };
    xmlHttp.open("GET", grammar);
    xmlHttp.send();

    function translate(xml) {
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

        console.log(generateProperties(xml.querySelector('dict')))
    }
}

init('javascript')
