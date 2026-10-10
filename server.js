// Kis proxy: kiszolgálja az index.html-t, és a /api/analyze hívást továbbítja a Gemini API-nak.
// A kulcs csak a szerveren él (GEMINI_API_KEY környezeti változó vagy .env), a böngésző sosem látja.
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const MAX_BODY = 64 * 1024; // a prompt egy állás kontextusa, ennél nagyobb nem kell

// .env beolvasása (KEY=VALUE sorok), függőség nélkül; a már beállított env nem íródik felül
function loadEnv(file = path.join(__dirname, ".env")) {
  let txt;
  try { txt = fs.readFileSync(file, "utf8"); } catch { return; }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) { over = true; chunks.length = 0; return; } // a maradékot eldobjuk, de a választ még el tudjuk küldeni
      chunks.push(c);
    });
    req.on("end", () => over ? reject(Object.assign(new Error("too_large"), { status: 413 })) : resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

// Gemini generateContent hívás; a fetch és az URL injektálható a teszthez
async function askGemini(prompt, { apiKey, model, baseUrl, fetchImpl, signal }) {
  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, // fejlécben, nem az URL-ben
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // thinkingBudget 0: a „gondolkodás” ne egye el a válasz tokenkeretét (gemini-2.5-flash)
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
    }),
    signal
  });
  if (!r.ok) throw Object.assign(new Error("upstream"), { status: r.status === 429 ? 429 : 502 });
  const data = await r.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || "").join("");
  if (!text) throw Object.assign(new Error("empty"), { status: 502 });
  const u = data.usageMetadata || {};
  return { text, truncated: cand.finishReason === "MAX_TOKENS", usage: { prompt: u.promptTokenCount, output: u.candidatesTokenCount, total: u.totalTokenCount } };
}

function createServer(opts = {}) {
  const cfg = {
    apiKey: opts.apiKey ?? process.env.GEMINI_API_KEY,
    model: opts.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    baseUrl: opts.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
    fetchImpl: opts.fetchImpl ?? fetch
  };
  const indexHtml = path.join(__dirname, "index.html");

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return fs.createReadStream(indexHtml).pipe(res);
      }
      if (req.method === "GET" && url.pathname === "/api/status") {
        return send(res, 200, { ai: Boolean(cfg.apiKey), provider: "gemini" });
      }
      if (req.method === "POST" && url.pathname === "/api/analyze") {
        if (!cfg.apiKey) return send(res, 503, { error: "no_key" });
        let prompt;
        try { prompt = JSON.parse(await readBody(req)).prompt; } catch (e) {
          return send(res, e.status || 400, { error: e.status === 413 ? "too_large" : "bad_json" });
        }
        if (typeof prompt !== "string" || !prompt.trim()) return send(res, 400, { error: "bad_prompt" });
        const ctl = new AbortController();
        res.on("close", () => { if (!res.writableEnded) ctl.abort(); }); // a kliens megszakította
        const out = await askGemini(prompt, { ...cfg, signal: ctl.signal });
        return send(res, 200, out);
      }
      send(res, 404, { error: "not_found" });
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { error: e.message === "upstream" ? "upstream" : "server_error" }); // a részletek (kulcs!) nem szivárognak
    }
  });
}

module.exports = { createServer, askGemini, loadEnv };

if (require.main === module) {
  loadEnv();
  const port = Number(process.env.PORT) || 3000;
  const srv = createServer();
  // csak localhoston hallgat: kulcsos proxy ne legyen kiengedve a hálózatra
  srv.listen(port, "127.0.0.1", () => {
    console.log(`http://localhost:${port}  (Gemini: ${process.env.GEMINI_API_KEY ? "kulcs beállítva" : "NINCS kulcs, az AI-gomb rejtve marad"})`);
  });
}
