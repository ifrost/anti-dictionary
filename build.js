/**
 * Creates static page with the dictionary
 */

const fs = require("fs");

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

const MAX_ENTRIES = 1000;

const MAX_RANDOM_ENTRIES = 100;

const MAX_MEANINGS = 5;

const MUST_HAVE_WORDS = ["dictionary"];

let dictionaryOriginalMeaning;
let dictionaryNewWord;

function getStopWords() {
    const raw = fs.readFileSync(`./stopwords.txt`, { encoding: "utf-8" });
    const lines = raw.split(/\n/).map(line => line.trim());
    return lines;
}

function getMostCommonWords() {
    const raw = fs.readFileSync(`./google-10000-english.txt`, { encoding: "utf-8" });
    const lines = raw.split(/\n/).map(line => line.trim());
    return lines;
}

function getEntries() {
    console.log("Getting entries");
    const all = [];
    ALPHABET.forEach(letter => {
        const raw = fs.readFileSync(`./data/${letter}.json`, { encoding: "utf-8" });
        const json = JSON.parse(raw);
        for (let word in json) {
            if (!json[word].meanings) {
                continue;
            }
            if (word === "dictionary") {
                dictionaryOriginalMeaning = json[word].meanings[0].def;
            }
            all.push({
                word: json[word].word,
                meanings: json[word].meanings.map(({ def, example, speech_part }) => {
                    return { def, example, speech_part, word };
                })
            });
        }
    });
    return all;
}

function whitelistEntries(entries) {
    console.log("Whitelisting entries");
    const stopWords = getStopWords();
    const commonWords = getMostCommonWords();
    const filtered = entries.filter(entry => !stopWords.includes(entry.word) && entry.word.length >= 3);
    const sorted = filtered;
    sorted.sort((a, b) => {
        let aValue = commonWords.indexOf(a.word);
        let bValue = commonWords.indexOf(b.word);
        aValue = aValue === -1 ? Number.MAX_VALUE : aValue;
        bValue = bValue === -1 ? Number.MAX_VALUE : bValue;
        return aValue - bValue;
    });
    let whitelisted = [];
    sorted.forEach(entry => {
       if (whitelisted.length < MAX_ENTRIES || MUST_HAVE_WORDS.includes(entry.word) || (whitelisted.length < MAX_ENTRIES + MAX_RANDOM_ENTRIES && Math.random() < 0.05)) {
           while (entry.meanings.length > MAX_MEANINGS) {
               entry.meanings.splice(Math.floor(Math.random() * entry.meanings.length), 1);
           }
           whitelisted.push(entry);
       }
    });
    return whitelisted;
}

function pick(list) {
    const index = Math.floor(Math.random() * list.length);
    return list.splice(index, 1)[0];
}

function shuffleMeanings(entries) {
    const meanings = {};

    entries.forEach(entry => {
        entry.meanings.forEach(meaning => {
            meanings[meaning.speech_part] = meanings[meaning.speech_part] || [];
            meanings[meaning.speech_part].push({ def: meaning.def, example: meaning.example, word: meaning.word });
        });
    });

    entries.forEach(entry => {
        entry.meanings.forEach(meaning => {
            let otherMeaning = pick(meanings[meaning.speech_part]);
            meaning.def = otherMeaning.def;
            if (meaning.def === dictionaryOriginalMeaning) {
                dictionaryNewWord = entry.word;
            }
            if (otherMeaning.example) {
                meaning.example = otherMeaning.example.replace(new RegExp(otherMeaning.word, "g"), meaning.word);
            } else {
                delete meaning.example;
            }
            meaning.word = otherMeaning.word;
        });
    });
}

function saveDictionary(entries, name) {
    console.log(`Saving ${entries.length} entries`);
    fs.writeFileSync(`./${name}.json`, JSON.stringify(entries, "", 2), { encoding: "utf-8" });
}

function generateHtml(entries) {
    let date = `generated on ${(new Date()).toISOString().split("T")[0]}`;
    let html = `<html><head><title>anti-dictionary / ${dictionaryNewWord}</title><link rel="stylesheet" href="style.css" /></head>`;
    html += `<body><div class="container"><h1>${dictionaryNewWord.toUpperCase()}</h1><p class="info">${date} • <a href="https://github.com/ifrost/anti-dictionary/blob/master/README.md">whaaaat?</a></p>`;

    html += `<p class="letters">`;
    for (let code=97; code<=122; code++) {
        html += `<a href="#${String.fromCharCode(code)}">${String.fromCharCode(code)}</a>`;
        if (code !== 122) {
            html += " | ";
        }
    }
    html += "</p>";

    let lastLetter = null;

    html += entries.map(entry => {
        let letter = "";
        if (entry.word[0] !== lastLetter) {
            lastLetter = entry.word[0];
            letter = `<h2 id="${lastLetter}">${lastLetter.toUpperCase()}</h2>`;
        }

        let htmlEntry = `<p class="entry"><span class="word">${entry.word}</span>`;
        htmlEntry += entry.meanings.map(meaning => {
            let meaningHtml = `<span class="speech-part">(${meaning.speech_part})</span> ${meaning.def}`;
            if (meaning.example) {
                meaningHtml += `  <span class="example">(${meaning.example})</span>`;
            }
            meaningHtml += `<span class="ref" title="${meaning.word}"> ※ </span>`;
            return meaningHtml;
        }).join("");
        htmlEntry += "</p>";
        return letter + htmlEntry;
    }).join("\n");

    let footer = `</div></body></html>`;

    html += footer;
    return html;
}

function saveHtml(content) {
    fs.writeFileSync(`./index.html`, content, { encoding: "utf-8" });
}


function main() {
    const entries = whitelistEntries(getEntries());
    shuffleMeanings(entries);
    entries.sort((a,b) => a.word.localeCompare(b.word));
    saveDictionary(entries, "anti-dictionary");
    const page = generateHtml(entries);
    saveHtml(page);
}

main();