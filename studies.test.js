// Online keresés/letöltés tesztje hamis hálózattal (node --test)
const test = require("node:test"), assert = require("node:assert");
const st = require("./studies");

const PGN = `[Event "A"]\n[White "Fischer, R"]\n[Black "Spassky, B"]\n[Site "Reykjavik"]\n[Date "1972.07.11"]\n\n1. e4 { Jó nyitás, a centrum miatt. } e5 2. Nf3 { [%clk 0:10:00] } 1-0\n\n[Event "B"]\n\n1. d4 { [%clk 0:10:00] } d5 1/2-1/2\n`;
const fake = async url => String(url).includes("/study/search")
  ? { ok: true, text: async () => '<a href="/study/AbCdEfGh" title="Fischer - Spassky 1972">x</a>' }
  : { ok: true, text: async () => PGN };

test("csak az emberi kommentárral rendelkező játszma marad (a [%clk] nem számít)", () => {
  assert.strictEqual(st.commentedGames(PGN).length, 1);
});
test("keresés: kommentáros találatok, relevancia-pontszámmal", async () => {
  const r = await st.search({ players: ["Fischer", "Spassky"], date: "1972", place: "Reykjavik" }, { fetchImpl: fake });
  assert.strictEqual(r.results.length, 1);
  assert.strictEqual(r.results[0].commented, 1);
  assert.ok(r.results[0].score >= 8);
});
test("letöltés: forrás a fejlécben; érvénytelen azonosító elutasítva", async () => {
  const d = await st.download("AbCdEfGh", { fetchImpl: fake });
  assert.match(d.text, /\[Source "https:\/\/lichess\.org\/study\/AbCdEfGh"\]/);
  await assert.rejects(st.download("../etc", { fetchImpl: fake }), /bad_id/);
});

test("helyettesítő karakterek: * és ? helyben, a Lichessnek az előtag megy", () => {
  assert.strictEqual(st.lichessTerm("Fisch*"), "Fisch");
  assert.strictEqual(st.lichessTerm("*"), "");
  assert.strictEqual(st.lichessTerm("Sp?ssky"), "Sp");
  assert.ok(st.wildRegex("Sp?ssky").test("boris spassky"));
  assert.ok(!st.wildRegex("Sp?ssky").test("boris spaassky"));
  assert.ok(st.wildRegex("Fisch*").test("robert fischer"));
  assert.ok(st.score('[Event "x"]\n[White "Fischer, R"]\n[Black "Spassky, B"]\n[Date "1972.07.11"]\n\n1. e4 *', { players: ["Fisch*", "Sp?ssky"], date: "197?" }) >= 8);
});
