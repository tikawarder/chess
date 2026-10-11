// Játszmakönyvtár: egy mappa (és legfeljebb 2 szint almappa) .pgn fájljainak beolvasása és indexelése.
// Az index csak fejléc-adatot tart (játékosok, év, esemény…); a játszma szövege betöltéskor kerül elő.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const PGN = require("./pgn");

// A régi PGN-fájlok (pl. PGN Mentor) gyakran Latin-1 kódolásúak: ha az UTF-8 olvasás hibás karaktert ad, újraolvassuk Latin-1-ként
function readText(file) {
  const buf = fs.readFileSync(file);
  const t = buf.toString("utf8");
  return t.includes("�") ? buf.toString("latin1") : t;
}

function listPgn(dir, depth = 0) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth < 2) out = out.concat(listPgn(p, depth + 1));
    else if (e.isFile() && /\.pgn$/i.test(e.name)) out.push(p);
  }
  return out;
}

const clean = v => (v && v !== "?" && v !== "-" ? v : "");

function createLibrary() {
  const cache = new Map(); // abszolút fájl → { mtime, games: [{head, body}], rows }
  let current = { dir: null, rel: new Map() }; // rel: relatív fájlnév → abszolút fájl

  function scan(dir) {
    const res = { games: [], files: 0, errors: [], missing: false };
    let files = [];
    try { files = listPgn(dir); } catch { res.missing = true; return res; }
    const rel = new Map();
    for (const abs of files) {
      const name = path.relative(dir, abs).split(path.sep).join("/");
      rel.set(name, abs);
      try {
        const mtime = fs.statSync(abs).mtimeMs;
        let c = cache.get(abs);
        if (!c || c.mtime !== mtime) { // csak a megváltozott fájlt olvassuk újra
          const games = PGN.splitPgn(readText(abs));
          const rows = games.map((g, n) => {
            const h = PGN.parseHeaders(g.head);
            return {
              id: name + "#" + n, f: name, n,
              title: clean(h.Title), white: clean(h.White), black: clean(h.Black), year: clean((h.Date || "").slice(0, 4).replace(/\?/g, "")),
              event: clean(h.Event), site: clean(h.Site), round: clean(h.Round), result: clean(h.Result), eco: clean(h.ECO),
              moves: g.body.join(" ").length > 20
            };
          });
          c = { mtime, games, rows }; cache.set(abs, c);
        }
        res.files++;
        res.games.push(...c.rows.filter(r => r.moves).map(({ moves, ...r }) => r));
      } catch (e) { res.errors.push(name + ": " + (e.code || "olvasási hiba")); }
    }
    current = { dir, rel };
    return res;
  }

  // Egy játszma nyers PGN-je. Csak a legutóbbi beolvasásban szereplő fájl és érvényes sorszám fogadható el (útvonal-bejárás nem lehetséges).
  function rawGame(name, n) {
    const abs = current.rel.get(name);
    const c = abs && cache.get(abs);
    if (!c || !Number.isInteger(n) || n < 0 || n >= c.games.length) return null;
    const g = c.games[n];
    return [...g.head, "", ...g.body].join("\n").trim();
  }

  return { scan, rawGame };
}

module.exports = { createLibrary };
