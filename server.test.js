// Futtatás: node --test
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { createServer } = require("./server");

const listen = srv => new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv.address().port)));
const post = (port, path, body) => fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

// hamis Gemini: rögzíti a kérést, és előre megadott választ ad
function fakeGemini(reply) {
  const seen = [];
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", c => b += c);
    req.on("end", () => { seen.push({ url: req.url, key: req.headers["x-goog-api-key"], body: JSON.parse(b) }); res.writeHead(reply.status || 200, { "Content-Type": "application/json" }); res.end(JSON.stringify(reply.json)); });
  });
  return { srv, seen };
}

test("kulcs nélkül 503, status szerint nincs AI", async () => {
  const s = createServer({ usageFile: null, apiKey: "" }); const p = await listen(s);
  assert.deepStrictEqual(await (await fetch(`http://127.0.0.1:${p}/api/status`)).json(), { ai: false, provider: "gemini" });
  assert.strictEqual((await post(p, "/api/analyze", { prompt: "x" })).status, 503);
  s.closeAllConnections(); s.close();
});

test("a prompt eljut a Geminihez, a kulcs fejlécben megy, a válasz visszajön", async () => {
  const g = fakeGemini({ json: { candidates: [{ content: { parts: [{ text: "## Mi történt?\nJó lépés." }] }, finishReason: "STOP" }] } });
  const gp = await listen(g.srv);
  const s = createServer({ usageFile: null, apiKey: "TESZT-KULCS", baseUrl: `http://127.0.0.1:${gp}/v1beta` }); const p = await listen(s);
  const r = await post(p, "/api/analyze", { prompt: "Elemezd: 1. e4" });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { text: "## Mi történt?\nJó lépés.", truncated: false, usage: { prompt: 0, output: 0, total: 0, cost: 0 } });
  assert.strictEqual(g.seen[0].key, "TESZT-KULCS");
  assert.ok(!g.seen[0].url.includes("TESZT-KULCS"), "a kulcs nem lehet az URL-ben");
  assert.strictEqual(g.seen[0].body.contents[0].parts[0].text, "Elemezd: 1. e4");
  s.closeAllConnections(); s.close(); g.srv.closeAllConnections(); g.srv.close();
});

test("MAX_TOKENS esetén truncated=true", async () => {
  const g = fakeGemini({ json: { candidates: [{ content: { parts: [{ text: "fél" }] }, finishReason: "MAX_TOKENS" }] } });
  const gp = await listen(g.srv);
  const s = createServer({ usageFile: null, apiKey: "k", baseUrl: `http://127.0.0.1:${gp}/v1beta` }); const p = await listen(s);
  assert.strictEqual((await (await post(p, "/api/analyze", { prompt: "x" })).json()).truncated, true);
  s.closeAllConnections(); s.close(); g.srv.closeAllConnections(); g.srv.close();
});

test("hibás bemenet 400, túl nagy 413, Gemini-hiba nem szivárogtat kulcsot", async () => {
  const g = fakeGemini({ status: 500, json: { error: "belső hiba TESZT-KULCS" } });
  const gp = await listen(g.srv);
  const s = createServer({ usageFile: null, apiKey: "TESZT-KULCS", baseUrl: `http://127.0.0.1:${gp}/v1beta` }); const p = await listen(s);
  assert.strictEqual((await post(p, "/api/analyze", "nem json")).status, 400);
  assert.strictEqual((await post(p, "/api/analyze", { prompt: "" })).status, 400);
  assert.strictEqual((await post(p, "/api/analyze", { prompt: "a".repeat(170000) })).status, 413);
  const r = await post(p, "/api/analyze", { prompt: "x" });
  assert.strictEqual(r.status, 502);
  assert.ok(!(await r.text()).includes("TESZT-KULCS"));
  s.closeAllConnections(); s.close(); g.srv.closeAllConnections(); g.srv.close();
});

test("settings.properties: típusos beolvasás, /api/settings, a modell és a paraméterek a fájlból jönnek", async () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const { parseProperties } = require("./server");
  assert.deepStrictEqual(parseProperties("# megjegyzés\na.b=3\nc=true\nd = szöveg \n\nbad\n"), { "a.b": 3, c: true, d: "szöveg" });

  const file = path.join(os.tmpdir(), `sakk-settings-${process.pid}.properties`);
  fs.writeFileSync(file, "ai.model=teszt-modell\nai.temperature=0.2\nai.maxOutputTokens=77\nai.thinkingBudget=0\nreplay.stepSeconds=5\n");
  const g = fakeGemini({ json: { candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] } });
  const gp = await listen(g.srv);
  const s = createServer({ usageFile: null, apiKey: "k", baseUrl: `http://127.0.0.1:${gp}/v1beta`, settingsFile: file }); const p = await listen(s);
  assert.strictEqual((await (await fetch(`http://127.0.0.1:${p}/api/settings`)).json())["replay.stepSeconds"], 5);
  await post(p, "/api/analyze", { prompt: "x" });
  assert.ok(g.seen[0].url.includes("/models/teszt-modell:generateContent"));
  assert.strictEqual(g.seen[0].body.generationConfig.temperature, 0.2);
  assert.strictEqual(g.seen[0].body.generationConfig.maxOutputTokens, 77);
  s.closeAllConnections(); s.close(); g.srv.closeAllConnections(); g.srv.close(); fs.unlinkSync(file);
});

test("könyvtár: mappa beolvasása, lista, játszma lekérése, útvonal-bejárás tiltva", async () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sakk-lib-"));
  fs.writeFileSync(path.join(dir, "larsen.pgn"), '[Event "Linares"]\n[Date "1975.03.02"]\n[White "Larsen, Bent"]\n[Black "Portisch, Lajos"]\n[Result "1-0"]\n\n{Comment} 1. b3 e5 2. Bb2 Nc6 3. e3 d5 1-0\n\n[Event "Másik"]\n[White "A"]\n[Black "B"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *\n');
  fs.writeFileSync(path.join(dir, "latin1.pgn"), Buffer.from('[Event "Pol\xe1r"]\n[White "Pol\xe1r"]\n[Black "X"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *\n', "latin1"));
  fs.writeFileSync(path.join(dir, "nem-pgn.txt"), "kihagyandó");
  const s = createServer({ usageFile: null, gamesDir: dir }); const p = await listen(s);
  const lib = await (await fetch(`http://127.0.0.1:${p}/api/library`)).json();
  assert.strictEqual(lib.files, 2);
  assert.strictEqual(lib.games.length, 3);
  const larsen = lib.games.find(g => g.white === "Larsen, Bent");
  assert.strictEqual(larsen.year, "1975"); assert.strictEqual(larsen.event, "Linares");
  assert.ok(lib.games.some(g => g.white === "Polár"), "a Latin-1 fájl ékezete jó");
  assert.ok(!JSON.stringify(lib).includes(dir), "a szerver abszolút útvonala nem szivárog");
  const g = await (await fetch(`http://127.0.0.1:${p}/api/library/game?f=larsen.pgn&n=0`)).json();
  assert.ok(g.pgn.includes("1. b3 e5"));
  for (const bad of ["../server.js&n=0", "larsen.pgn&n=9", "larsen.pgn&n=-1", "%2e%2e%2fserver.js&n=0"]) {
    assert.strictEqual((await fetch(`http://127.0.0.1:${p}/api/library/game?f=${bad}`)).status, 404, bad);
  }
  s.closeAllConnections(); s.close(); fs.rmSync(dir, { recursive: true });
});

test("fordítás: csak az új szöveg kerül tokenbe, gyorsítótár, hibás bemenet és rossz válasz kezelése", async () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const cacheFile = path.join(os.tmpdir(), `sakk-tr-${process.pid}.json`);
  const g = fakeGemini({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(["Fordítva: egy", "Fordítva: kettő"]) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 } } });
  const gp = await listen(g.srv);
  const s = createServer({ apiKey: "k", baseUrl: `http://127.0.0.1:${gp}/v1beta`, usageFile: null, translateCache: cacheFile }); const p = await listen(s);
  const r1 = await (await post(p, "/api/translate", { texts: ["one", "two"] })).json();
  assert.deepStrictEqual(r1.translations, ["Fordítva: egy", "Fordítva: kettő"]);
  assert.strictEqual(r1.translated, 2); assert.strictEqual(r1.usage.total, 150);
  assert.ok(g.seen[0].body.generationConfig.responseSchema, "JSON-séma kérve");
  assert.ok(g.seen[0].body.contents[0].parts[0].text.includes('["one","two"]'));
  // második kérés ugyanarra: gyorsítótárból, nincs új Gemini-hívás
  const r2 = await (await post(p, "/api/translate", { texts: ["two", "one"] })).json();
  assert.deepStrictEqual(r2.translations, ["Fordítva: kettő", "Fordítva: egy"]);
  assert.strictEqual(r2.translated, 0); assert.strictEqual(g.seen.length, 1);
  // hibás bemenetek
  assert.strictEqual((await post(p, "/api/translate", { texts: [] })).status, 400);
  assert.strictEqual((await post(p, "/api/translate", { texts: [1] })).status, 400);
  assert.strictEqual((await post(p, "/api/translate", { texts: ["x".repeat(4001)] })).status, 400);
  // rossz darabszámú válasz: 502, és nem kerül a gyorsítótárba
  const bad = fakeGemini({ json: { candidates: [{ content: { parts: [{ text: '["csak egy"]' }] }, finishReason: "STOP" }] } });
  const bp = await listen(bad.srv);
  const s2 = createServer({ apiKey: "k", baseUrl: `http://127.0.0.1:${bp}/v1beta`, usageFile: null, translateCache: null }); const p2 = await listen(s2);
  assert.strictEqual((await post(p2, "/api/translate", { texts: ["a", "b"] })).status, 502);
  for (const x of [s, s2, g.srv, bad.srv]) { x.closeAllConnections(); x.close(); }
  try { fs.unlinkSync(cacheFile); } catch {}
});
