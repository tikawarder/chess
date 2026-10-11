// Futtatás: node --test
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const PGN = require("./pgn");

const SAMPLE = `[Event "Linares"]
[Site "Linares ESP"]
[Date "1975.03.02"]
[White "Larsen, Bent"]
[Black "Portisch, Lajos"]
[Result "1-0"]

{Larsen opens with a flank move.} 1. b3 e5 2. Bb2 Nc6 3. e3 d5 4. Bb5 $1 {A pin, aiming at the knight. [%eval 0.3] [%clk 0:10:00]}
(4. Nf3 e4 5. Nd4 {Another way.}) 4... Bd6 5. f4!? exf4 6. exf4 Nge7 1-0

[Event "Másik"]
[White "Teszt, A"]
[Black "Teszt, B"]
[Result "*"]

1.e4 e5 2.Nf3 ; sorvégi kommentár
Nc6 *
`;

test("splitPgn: több játszma szétvágása", () => {
  const games = PGN.splitPgn(SAMPLE);
  assert.strictEqual(games.length, 2);
  assert.ok(games[0].head[0].includes("Linares"));
});

test("parseGame: fejléc, kommentárok, minősítés, változat, jelölők kiszűrése", () => {
  const g = PGN.parseGame(PGN.splitPgn(SAMPLE)[0]);
  assert.strictEqual(g.h.White, "Larsen, Bent");
  assert.strictEqual(g.intro, "Larsen opens with a flank move.");
  assert.deepStrictEqual(g.plies.map(p => p.san), ["b3", "e5", "Bb2", "Nc6", "e3", "d5", "Bb5", "Bd6", "f4", "exf4", "exf4", "Nge7"]);
  const bb5 = g.plies[6];
  assert.strictEqual(bb5.nag, "!");                                          // $1
  assert.strictEqual(bb5.comment, "A pin, aiming at the knight.");           // [%eval], [%clk] nélkül
  assert.strictEqual(bb5.vars.length, 1);                                    // változat a 4. lépésre
  assert.deepStrictEqual(bb5.vars[0].map(p => p.san), ["Nf3", "e4", "Nd4"]);
  assert.strictEqual(bb5.vars[0][2].comment, "Another way.");
  assert.strictEqual(g.plies[8].nag, "!?");                                  // f4!? a lépéshez tapadva
  assert.strictEqual(g.result, "1-0");
});

test("parseGame: összeírt lépésszám, sorvégi kommentár, fejléc nélküli lépések", () => {
  const g = PGN.parseGame(PGN.splitPgn(SAMPLE)[1]);
  assert.deepStrictEqual(g.plies.map(p => p.san), ["e4", "e5", "Nf3", "Nc6"]);
  assert.strictEqual(g.plies[2].comment, "sorvégi kommentár");
  const bare = PGN.splitPgn("1. d4 d5 2. c4 *");
  assert.strictEqual(bare.length, 1);
  assert.deepStrictEqual(PGN.parseGame(bare[0]).plies.map(p => p.san), ["d4", "d5", "c4"]);
});

test("needsTranslation: angol igen, magyar és csak-lépés nem", () => {
  assert.strictEqual(PGN.needsTranslation("White opens with a flank move and prepares the long diagonal."), true);
  assert.strictEqual(PGN.needsTranslation("Világos a király oldali támadás miatt áldozza a futót, és ez az állás nem könnyű."), false);
  assert.strictEqual(PGN.needsTranslation("Nf3 Nc6 Bb5 +- !"), false);
  assert.strictEqual(PGN.needsTranslation("Réti was surprised by the reply and had to find a defence."), true); // egyetlen ékezetes név nem teszi magyarrá
  assert.strictEqual(PGN.needsTranslation("Byrne elfogadja a vezért."), false);                                  // rövid magyar mondat
  assert.strictEqual(PGN.needsTranslation("Felfedett sakk a malom elején."), false);
  assert.strictEqual(PGN.needsTranslation("Sötét elfogadja a cselt."), false);
  assert.strictEqual(PGN.needsTranslation("Black accepts the gambit and grabs the pawn."), true);
  assert.strictEqual(PGN.needsTranslation("Polgár played the move quickly and White had no time to react."), true);
});

test("beépített klasszikusok: games/beepitett/klasszikusok.pgn – 5 játszma, minden kommentárral és bevezetővel", () => {
  const fs = require("node:fs"), path = require("node:path");
  const games = PGN.splitPgn(fs.readFileSync(path.join(__dirname, "games/beepitett/klasszikusok.pgn"), "utf8")).map(PGN.parseGame);
  assert.deepStrictEqual(games.map(g => g.h.Title), ["Az Operajátszma", "Réti csapdája", "A Halhatatlan játszma", "Az Örökzöld játszma", "Az évszázad játszmája"]);
  assert.deepStrictEqual(games.map(g => g.plies.length), [33, 21, 45, 47, 82]);
  assert.deepStrictEqual(games.map(g => g.plies.filter(p => p.comment).length), [33, 21, 22, 13, 14]);
  assert.ok(games.every(g => g.intro), "mindegyiknek van bevezetője");
});
