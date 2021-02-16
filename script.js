// TODO
// Add a key mechanism (in the label or other)
// Add more modular key-adding structure that uses a dict to store rule regexs with the functions
// https://renenyffenegger.ch/notes/index.html

// Graphviz tools https://renenyffenegger.ch/notes/tools/Graphviz/examples/index
// SOCIAL NETWORK GENERATION
let seed;
let dot;
let dot_fragments = [];
let text_lines = [];
let arrow = '->'
let regex_alphanum = /^[A-Za-z0-9]+$/

let cycleRule = /cycle\((.*?),(.*?),(.*?),(.*?)\)/  // cycle(,,,,) with no white spaces for params
let lockKeyRule = /keylock\((.*?),(.*?),(.*?)\)/    // keylock(keylocation, start, end)
let tweenRule = /insert\((.*?),(.*?),(.*?)\)/        // tween(start, middle, end)

let keyLocks = {}     // key: key area, value: [door area, locked area]
let lockedEdges = {}; // key: door area, value: [locked area, key area]

let social_edges = {};  // Looks like { srcname: {dst:[...], label: [...]}, ... }

function setup() {
    numCols = select("#asciiBox").attribute("rows") | 0; // iot grab html element named asciiBox.
    numRows = select("#asciiBox").attribute("cols") | 0; // 'select()' grabs an html element
    // select("#reseedButton").mousePressed(reseed);
    select("#asciiBox").input(parseTextForm);
    fillGrid();
    parseTextForm()
}

function reseed() {
    seed = (seed | 0) + 1109;
    noiseSeed(seed);
    randomSeed(seed);
    select("#seedReport").html("seed " + seed);
}

let sampleText = '\
Hero -> Village : Sidle back\n\
Dragon -> Treasure : Guards\n\
cycle(Hero, Cave, Dragon, Basement)\n\
keylock(Basement, Hero, Treasure)\ninsert(Hero, Rival Encounter, Cave)\
';
function fillGrid(
    text = ""
) {
    select("#asciiBox").value(text = sampleText);
    text_lines.push(text)
}

function parseTextForm() {
    text_lines = splitByNewline(select("#asciiBox").value());
    text_lines.forEach(line => { generateDot(line) });
    render();
}

function checkIsArrow(line) {
    let re = new RegExp(arrow)
    if (re.test(line)) {
        let lenCheckArr = line.split(arrow)
        return lenCheckArr[0].trim() != "" && lenCheckArr[1].trim() != ""
    }
}

function splitByNewline(str) {
    let lines = str.split("\n");
    return lines;
}

function generateDot(line) {
    let src, dst, label = "";
    if (line && line[0] == '#') return;
    if (checkIsArrow(line)) {
        // GET SRC & DST (->)
        let arr = (line.split(arrow, 2))
        arr[0] = arr[0].replace(/[^0-9A-Za-z ]/, '').trim() ;  // remove non alphanumeric
        arr[1] = arr[1].split(':', 1)[0].replace(/[^0-9A-Za-z ]/, '').trim();  // surroundig quotes for multi word
        // GET LABEL (:)
        if (/:/.test(line)) {
            label = " " + line.split(':', 2)[1].trim();
        }
        src = arr[0], dst = arr[1];
        addEdge(social_edges, src, dst, label);
    }
    else if (cycleRule.test(line)) {
        let c = 4;
        let n = line.split(',',c)
        n[0] = parseParamHead(n[0]);
        n[1] = parseParamBody(n[1]);
        n[2] = parseParamBody(n[2]);
        n[3] = parseParamTail(n[3]);
        if (!n.includes("")) {
            for(let src = 0; src < c; ++src) {
                addEdge(social_edges, n[src][0], n[(src+1) % 4][0], n[src][1]);
            }
        }
    }
    else if (lockKeyRule.test(line)) {
        let c = 3;
        let n = line.split(',',c)
        n[0] = parseParamHead(n[0])
        n[1] = parseParamBody(n[1])
        n[2] = parseParamTail(n[2])
        if (!n.includes("")) {
            keyLocks[n[0][0]] = [n[1][0], n[2][0]]
            lockedEdges[n[1][0]] = [n[2][0], n[0][0]];
            addEdge(social_edges, n[0][0], n[1][0], n[0][1]);
            addEdge(social_edges, n[1][0], n[2][0], n[1][1]); // make this one transparent ofr now
        }
    }
    else if (tweenRule.test(line)) {
        let c = 3;
        let n = line.split(',',c)
        n[0] = parseParamHead(n[0])
        n[1] = parseParamBody(n[1])
        n[2] = parseParamTail(n[2])

        let start = n[0][0]
        let end = n[2][0]
        removeEdge(social_edges, start, end)
        let middle = n[1][0]
        if (!n.includes("")) {
            addEdge(social_edges, start, middle, n[0][1]);
            addEdge(social_edges, middle, end, n[1][1]); // make this one transparent ofr now
        }
    }
}

function removeEdge(dict, src, dst) {
    let dict_val = dict[src]
    let lookup_arr = dict_val["dst"]
    if(dict_val && lookup_arr.indexOf(dst) != -1) {  // Check if edge is in given location
        let idx = lookup_arr.indexOf(dst)
        lookup_arr.splice(idx, 1);
        let label_arr = dict_val["label"]
        label_arr.splice(idx, 1);
        if(lookup_arr.length < 1) delete dict_val
        // TODO remove from keyLocks
    } 
}

function addEdge(dict, src, dst, label) {
    if(!dict[src]) {  // CHECk IF DICT KEY-VAL PAIR IS OPEN
        dict[src] = {  
            dst: [dst],
            label: [label]
        };
    }
    else { 
        let idx = dict[src]["dst"].indexOf(dst)
        if (idx == -1) { // PREVENT DUPLICATE EDGES, ALLOW REWRITES
            dict[src]["dst"].push(dst) ;
            dict[src]["label"].push(label);
        }
        else {
            dict[src]["dst"][idx] = dst;
            dict[src]["label"][idx] = label;
        }
    }
}

// These parse functions return n, where n[0] is the node name and n[1] is the label/verb
function parseParamHead(n) {
    n = n.substring(n.lastIndexOf('('), n.length).replace(/[^0-9A-Za-z ]/, '').split(':', 2);
    if (!n[1]) n[1] = ""
    return [n[0].trim(), n[1].trim()];
}

function parseParamBody(n) {
    n = n.split(':', 2);
    if (!n[1]) n[1] = ""
    return [n[0].replace(/[^0-9A-Za-z ]/, '').trim(), n[1].replace(/[^0-9A-Za-z ]/, '').trim()];
}

function parseParamTail(n) {
    n = n.substring(0, n.indexOf(')')).replace(/[^0-9A-Za-z ]/, '').split(':', 2);
    if (!n[1]) n[1] = ""
    return [n[0].trim(), n[1].trim()];
}

function render() {
    for (let src in social_edges) {
        for(let edge = 0; edge < social_edges[src]["dst"].length; edge++) {
            let keyUni = '\u26B7 ' // more http://www.unicode.org/charts/PDF/U2600.pdf
            let dst = social_edges[src]["dst"][edge]
            let edgecol = ""
            let keycol = ""

            let label = social_edges[src]["label"][edge]

            let ks = ''; if (src in keyLocks) { ks = keyUni; keycol = hashStringToColor(src);}  // If this src has a key
            let kd = ''; if (dst in keyLocks) { kd = keyUni; }

            let sty = ""
            if (src in lockedEdges && dst == lockedEdges[src][0])  // If this edge is a key-lock edge
                { sty = "dashed"; edgecol = hashStringToColor(lockedEdges[src][1]);}

            dot_fragments.push(` "${ks}${src}" -> "${kd}${dst}" [label="${label}" style="${sty}" color="#${edgecol}"]`);
            if (ks != '') {
                dot_fragments.push(` "${ks}${src}" [ fillcolor="#${keycol}"   style=filled                  ]`);
            }
        }
    }

    dot = "digraph {\n" + (dot_fragments.join("\n")) + "\n}\n";

    // Asynchronous call to layout
    hpccWasm.graphviz.layout(dot, "svg", "dot").then(svg => {
        const div = document.getElementById("canvasContainer");
        div.innerHTML = svg;
    });

    // RESETTI
    social_edges = {}
    dot_fragments = []
    for (let prop in keyLocks) {
        delete keyLocks[prop];
    }
    for (let prop in lockedEdges) {
        delete lockedEdges[prop];
    }

    // hpccWasm.graphvizSync().then(graphviz => {
    //     const div = document.getElementById("placeholder2");
    //     // Synchronous call to layout
    //     div.innerHTML = graphviz.layout(dot, "svg", "dot");
    // });
}

// For converting string to color https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
function hashStringToColor(str) { 
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
       hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    function intToRGB(i){
        var c = (i & 0x00FFFFFF)
            .toString(16)
            .toUpperCase();

        return "00000".substring(0, 6 - c.length) + c;
    }

    return intToRGB(hash);
}
