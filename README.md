# Kolorist

### What is Kolorist?
Kolorist is a fully customisable front-end syntax highlighter using TextMate grammars. That not only means that it supports most languages but also that you can use your custom grammar for e.g. your own languages.

> **Note**: Code may not parse correctly, yet, and some grammars may not be able to be parsed at all. This is a known bug and will be fixed shortly.  
> _The package is not yet ready for production use._

- [Usage](#usage)
  - [Link](#links-quickstart)
  - [`kolorist.init(language | grammar[, rebuild])`](#koloristinitlanguage--grammar-rebuild)
  - [`kolorist.hightlight(code, grammar)`](#koloristhightlightcode-grammar)
  - [Example](#example)
  - [CSS](#css)
- [Performance](#performance)
- [Supported Languages](#supported-languages)
- [Contributing](#contributing)

## Usage
### Links (Quickstart)
Add the following line before your kolorist usage:
```html
<script src="https://cdn.jsdelivr.net/npm/kolorist-highlighter@1.0.0-alpha/bundle.js"></script>
```
And this for colours in your html header:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/kolorist-highlighter@1.0.0-alpha/css/jetbrains.css">
```

### `kolorist.init(language | grammar[, rebuild])`
This function returns a promise with a ready-to-use grammar for kolorist. You can feed this grammar into the highlighter function.  
**Parameters**:
- `language`:string -> name of the language you want to highlight
- `grammar`:string -> can be either a URL to the `.plist` grammar file, or the grammar as a string  
  _When using a URL please note that `raw.githubusercontent.com`-URLs will not work as they don't return the correct `Content-Type` header. Please use [`jsdelivr.net`](https://jsdelivr.net) or similar._
- `rebuid`:boolean -> if set to `true` the initiate function overrides the kolorist cache; defaults to `false`

### `kolorist.hightlight(code, grammar)`
This function returns a big `<pre>` with highlighted code. Every line is wrapped in a `<div>` and every highlighted segment in a `<span>` with an appropriate class attribute (more in [CSS](#css)).  
**Parameters**:
- `code`:string -> your code that you want to be highlighted
- `grammar`:object -> whatever you got from the init function

### Example
```javascript
const code = `function myFunction(p1, p2) {
    // The function returns the product of p1 and p2
    return p1 * p2;
}`
kolorist.init('javascript')
    .then(g => kolorist.highlight(code, g))
    .then(html => document.body.innerHTML += html)
```

### CSS
For highlights to show up you need a CSS file with defined colors and font-styles. You can either make your own by selecting individual code segments, copying their respective class name, and styling them individually, or you can use a pre-made css file (linked [above](#links-quickstart)) as is, or set custom colours with css variables:
```css
pre.kolorist {
    --kolorist-color1: #CC7822;
    ...
    --kolorist-color6: #808080;
}
```
More such CSS are to come and maybe support for TextMate themes.

## Performance
As it runs completely front-end with the WebAssembly Oniguruma regex engine [`onigasm`](https://github.com/NeekSandhu/onigasm) at its core it isn't super fast but that will change with future optimisations. Currently, only the grammar translation from TextMate's xml grammars to kolorist's jsons is optimised using on-device caching.  
These are the times for parsing 45 lines of JavaScript:

|                          | Safari | Chrome | Firefox | Edge |
|--------------------------|--------|--------|---------|------|
| first load (no cache)    | 3595   | 1603   | 3850    | 2390 |
| second load (with cache) | 1893   | 1108   | 1436    | 2039 |

Time in milliseconds  
Tests conducted on macOS 10.15.6 with:
- Safari 14.0  
- Chrome 81.0.4044.122  
- Firefox 80.0  
- Edge 85.0.564.63  

## Supported Languages
Kolorist supports all languages that have a TextMate grammar. You can find all official ones on the [TextMate GitHub page](https://github.com/textmate). For all languages listed down below you can also just use the language name (and not search for a URL). 

- asp
- bash
- c
- cmake
- cmakeCache
- coldfusion
- cpp
- css
- d
- diff
- erlang
- fortran
- fortranModern
- fortranPunchcard
- groovy
- haskell
- html
- java
- javascript
- json
- latex
- lexFlex
- lua
- make
- markdown
- markdownGH
- matlab
- objC
- objCpp
- ocaml
- perl
- perl6
- php
- processing
- python
- r
- rest
- ruby
- rubyHaml
- shell
- shellscript
- swift
- tex
- xml
- xsl
- yaml

## Contributing
I don't know what to write here. Please do contribute; The code is commented, and it's a great project. Contributing guidelines coming soon, I guess.  
After making your changes, before a pull request make sure to run `npm run build-min`.
