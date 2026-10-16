// Online keresés és letöltés: Lichess-tanulmányok (nyilvános keresőoldal + hivatalos PGN-export).
// Csak azokat a játszmákat tartjuk meg, amelyekben van emberi kommentár ({...}, a [%clk]-féle gépi jelölések nem számítanak).
"use strict";

const HOST = "https://lichess.org"; // csak ez a gazda érhető el innen (a böngészőből jövő adat soha nem lehet URL)
const ID_RE = /^[A-Za-z0-9]{8}$/;

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length >= 2);

// Egy PGN-szöveg szétvágása játszmákra: minden „[Event ” kezdetű sor új játszma
function splitGames(pgn) {
  const parts = String(pgn).replace(/\r\n/g, "\n").split(/\n(?=\[Event ")/);
  return parts.map(p => p.trim()).filter(p => p.startsWith("[Event "));
}
function header(game, key) { const m = game.match(new RegExp(`^\\[${key} "([^"]*)"\\]`, "m")); return m ? m[1] : ""; }
// Emberi kommentárok száma: a {...} blokkok, amelyekben a gépi [%...] jelölések kivétele után is marad szöveg
function commentTexts(game) {
  const body = game.replace(/^\[.*\]$/gm, ""), out = [];
  for (const m of body.matchAll(/\{([^}]*)\}/g)) { const t = m[1].replace(/\[%[^\]]*\]/g, "").replace(/\s+/g, " ").trim(); if (t.length >= 3) out.push(t); }
  return out;
}
const commentCount = game => commentTexts(game).length;
// Alsó küszöb játszmánként (alapból: legalább 1 komment); a settings.properties-ből állítható: online.minComments, online.minChars
function enough(game, lim = {}) {
  const t = commentTexts(game);
  return t.length >= Math.max(1, Number(lim.minComments) || 1) && t.reduce((n, x) => n + x.length, 0) >= (Number(lim.minChars) || 0);
}
const commentedGames = (pgn, lim) => splitGames(pgn).filter(g => enough(g, lim));

// Relevancia: hány megadott játékos-/helyszínszó és az évszám szerepel a játszma fejlécében
// Helyettesítő karakterek a keresőmezőkben: * = bármennyi karakter, ? = pontosan 1 karakter (a Lichess ezt nem ismeri, ezért helyben értékeljük)
const hasWild = t => /[*?]/.test(t);
function wildRegex(t) { // a mintát a normalizált fejlécszövegben bárhol keresi
  const src = [...norm(t)].map(c => c === "*" ? "[a-z0-9.\-]*" : c === "?" ? "[a-z0-9.\-]" : c.replace(/[.+^${}()|[\]\\-]/g, "\$&")).join("");
  return new RegExp(src);
}
// A Lichessnek küldött szó: a helyettesítő karakter előtti rész (a Lichess az előtagot is megtalálja); ha nincs ilyen, a mező kimarad
const lichessTerm = t => hasWild(t) ? (t.split(/[*?]/)[0].trim().length >= 2 ? t.split(/[*?]/)[0].trim() : "") : t;

// Relevancia: hány megadott játékos-/helyszínszó és az évszám szerepel a játszma fejlécében
function score(game, { players = [], place = "", date = "" }) {
  const hay = norm(["White", "Black", "Event", "Site", "Date"].map(k => header(game, k)).join(" "));
  let s = 0;
  for (const p of players) { // a vezetéknév (az utolsó szó) számít
    const w = hasWild(p) ? p.trim().split(/\s+/).pop() : words(p).pop();
    if (w && (hasWild(w) ? wildRegex(w).test(hay) : hay.includes(norm(w)))) s += 3;
  }
  for (const w of String(place).trim().split(/\s+/).filter(x => x.replace(/[*?]/g, ""))) if (hasWild(w) ? wildRegex(w).test(hay) : hay.includes(norm(w))) s += 2;
  const d = String(date).trim();
  if (hasWild(d)) { if (d.replace(/[*?]/g, "") && wildRegex(d).test(hay)) s += 2; }
  else { const y = d.match(/\d{4}/)?.[0]; if (y && hay.includes(y)) s += 2; }
  return s;
}

// A keresőoldal HTML-jéből a tanulmányok azonosítója és neve
function parseSearch(html) {
  const out = [], seen = new Set();
  for (const m of String(html).matchAll(/href="\/study\/([A-Za-z0-9]{8})"\s+title="([^"]*)"/g)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    out.push({ id: m[1], name: m[2].replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"') });
  }
  return out;
}

async function getText(fetchImpl, url, signal) {
  const r = await fetchImpl(url, { signal: signal || AbortSignal.timeout(15000), headers: { "User-Agent": "MagyarSakkelemzo (helyi, felhasznaloi keres)" } });
  if (!r.ok) throw Object.assign(new Error("upstream"), { status: r.status === 429 ? 429 : 502 });
  return r.text();
}
const fetchStudy = (fetchImpl, id, signal) => getText(fetchImpl, `${HOST}/api/study/${id}.pgn?comments=true&variations=true`, signal);

// Keresés: a megadott adatokból keresőszöveg, a legjobb találatok letöltése, csak a kommentárosak maradnak
async function search({ players = [], date = "", place = "" }, { fetchImpl = fetch, max = 8, signal, limits } = {}) {
  const given = [...players, date, place].map(s => String(s || "").trim()).filter(Boolean); // üresen hagyott mező kimarad
  // A Lichess minden szót megkövetel, ezért csak a teljes szavak mennek neki; ha nincs ilyen, a helyettesítős szavak leghosszabb előtagja (min. 3 betű).
  // A „*” és „?” pontos kiértékelése helyben, a letöltött játszmák fejlécén történik (relevancia-pontszám).
  let q = given.filter(t => !hasWild(t)).join(" ");
  if (!q) q = given.map(lichessTerm).filter(t => t.length >= 3).sort((x, y) => y.length - x.length)[0] || "";
  if (!given.some(t => t.replace(/[*?]/g, "")) || !q) throw Object.assign(new Error("empty"), { status: 400 });
  const cands = parseSearch(await getText(fetchImpl, `${HOST}/study/search?q=${encodeURIComponent(q)}`, signal)).slice(0, max);
  const results = [];
  for (const c of cands) { // egymás után, udvariasan (nem párhuzamosan) kérjük le
    let pgn; try { pgn = await fetchStudy(fetchImpl, c.id, signal); } catch { results.push({ id: c.id, name: c.name, url: `${HOST}/study/${c.id}`, hasComments: null, games: 0, commented: 0, comments: 0, chars: 0, score: 0, excerpts: [], sample: {} }); continue; } // hibás letöltés: „nem ellenőrizhető”
    const all = splitGames(pgn), good = commentedGames(pgn, limits), pool = good.length ? good : all;
    if (!pool.length) continue; // üres tanulmány
    const g0 = pool.reduce((a, g) => (commentCount(g) > commentCount(a) ? g : a)); // a legtöbb kommentet tartalmazó játszma mintája
    const sc = Math.max(...pool.map(g => score(g, { players, place, date })));
    results.push({
      id: c.id, name: c.name, url: `${HOST}/study/${c.id}`, games: all.length, commented: good.length,
      hasComments: good.length > 0, // minden találat kiírja: tartalmaz kommenteket, vagy nincs benne (elég) komment
      comments: good.reduce((n, g) => n + commentCount(g), 0), score: sc,
      chars: good.reduce((n, g) => n + commentTexts(g).join("").length, 0), // az ellenőrzés a letöltés ELŐTT történik: ezt látja a felhasználó a találatnál
      excerpts: commentTexts(g0).slice(0, 2).map(t => t.length > 160 ? t.slice(0, 157) + "…" : t),
      sample: { white: header(g0, "White"), black: header(g0, "Black"), event: header(g0, "Event"), site: header(g0, "Site"), date: header(g0, "Date") }
    });
  }
  results.sort((a, b) => (b.hasComments === true) - (a.hasComments === true) || b.score - a.score || b.comments - a.comments); // a kommentáros találatok elöl
  return { query: q, results, checked: cands.length, wildcards: given.some(hasWild) };
}

// Letöltés: a tanulmány kommentárral rendelkező játszmái, forrásmegjelöléssel a fájl elején
async function download(id, { fetchImpl = fetch, signal, limits } = {}) {
  if (!ID_RE.test(id)) throw Object.assign(new Error("bad_id"), { status: 400 });
  const pgn = await fetchStudy(fetchImpl, id, signal);
  const good = commentedGames(pgn, limits);
  if (!good.length) throw Object.assign(new Error("no_comments"), { status: 422 });
  const src = `${HOST}/study/${id}`; // forrásmegjelölés minden játszma fejlécében (az elején álló megjegyzéssorból üres „játszma” lenne)
  const text = good.map(g => /^\[Source /m.test(g) ? g : g.replace(/^(\[Event "[^"]*"\]\n)/, `$1[Source "${src}"]\n`)).join("\n\n") + "\n";
  return { file: `lichess_${id}.pgn`, text, games: good.length };
}

module.exports = { wildRegex, lichessTerm, search, download, splitGames, commentCount, commentedGames, parseSearch, score, ID_RE };
