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
  assert.strictEqual((await post(p, "/api/analyze", { prompt: "a".repeat(70000) })).status, 413);
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
