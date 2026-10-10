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

// settings.properties: kulcs=érték sorok, # megjegyzés; a true/false és a számok típusosan jönnek vissza
function parseProperties(txt) {
  const o = {};
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t[0] === "#" || t[0] === "!") continue;
    const i = t.search(/[=:]/);
    if (i < 1) continue;
    const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
    if (/^(true|false)$/i.test(v)) v = v.toLowerCase() === "true";
    else if (v !== "" && !isNaN(Number(v))) v = Number(v);
    o[k] = v;
  }
  return o;
}
function loadSettings(file) { try { return parseProperties(fs.readFileSync(file, "utf8")); } catch { return {}; } }

// Költség USD-ben: tokenek × ár / 1 millió (az árak a settings.properties-ben állíthatók; ingyenes szinten 0)
function costOf(u, st) {
  const pi = Number(st["ai.price.inputPerMTok"]) || 0, po = Number(st["ai.price.outputPerMTok"]) || 0;
  return ((u.prompt || 0) * pi + (u.output || 0) * po) / 1e6;
}
function logUsage(file, rec) { if (file) try { fs.appendFileSync(file, JSON.stringify(rec) + "\n"); } catch { /* a napló nem kritikus */ } }
function totalUsage(file) {
  const t = { calls: 0, prompt: 0, output: 0, cost: 0, since: null };
  if (!file) return t;
  let txt = ""; try { txt = fs.readFileSync(file, "utf8"); } catch { return t; }
  for (const line of txt.split(/\r?\n/)) {
    if (!line) continue;
    try { const r = JSON.parse(line); t.calls++; t.prompt += r.prompt; t.output += r.output; t.cost += r.cost; t.since ??= r.ts; } catch { /* sérült sor kihagyva */ }
  }
  return t;
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
async function askGemini(prompt, { apiKey, model, baseUrl, fetchImpl, signal, temperature = 0.7, maxOutputTokens = 1024, thinkingBudget = 0 }) {
  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, // fejlécben, nem az URL-ben
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // thinkingBudget 0: a „gondolkodás” ne egye el a válasz tokenkeretét (gemini-2.5-flash)
      generationConfig: { temperature, maxOutputTokens, thinkingConfig: { thinkingBudget } }
    }),
    signal
  });
  if (!r.ok) throw Object.assign(new Error("upstream"), { status: r.status === 429 ? 429 : 502 });
  const data = await r.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || "").join("");
  if (!text) throw Object.assign(new Error("empty"), { status: 502 });
  const u = data.usageMetadata || {};
  const output = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0); // a gondolkodási token is kimenetként számít
  return { text, truncated: cand.finishReason === "MAX_TOKENS", usage: { prompt: u.promptTokenCount || 0, output, total: u.totalTokenCount || 0 } };
}

function createServer(opts = {}) {
  const cfg = {
    apiKey: opts.apiKey ?? process.env.GEMINI_API_KEY,
    model: opts.model, // ha nincs megadva: GEMINI_MODEL env, majd settings.properties
    baseUrl: opts.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
    fetchImpl: opts.fetchImpl ?? fetch
  };
  const indexHtml = path.join(__dirname, "index.html");
  const usageFile = opts.usageFile === undefined ? path.join(__dirname, "usage.jsonl") : opts.usageFile; // null = nincs napló
  const settingsFile = opts.settingsFile ?? path.join(__dirname, "settings.properties");

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return fs.createReadStream(indexHtml).pipe(res);
      }
      if (req.method === "GET" && url.pathname === "/api/settings") {
        return send(res, 200, loadSettings(settingsFile)); // nem titkos beállítások a böngészőnek
      }
      if (req.method === "GET" && url.pathname === "/api/usage") return send(res, 200, totalUsage(usageFile));
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
        const st = loadSettings(settingsFile);
        const out = await askGemini(prompt, {
          ...cfg, signal: ctl.signal,
          model: cfg.model ?? process.env.GEMINI_MODEL ?? st["ai.model"] ?? "gemini-2.5-flash",
          temperature: st["ai.temperature"], maxOutputTokens: st["ai.maxOutputTokens"], thinkingBudget: st["ai.thinkingBudget"]
        });
        out.usage.cost = costOf(out.usage, st);
        logUsage(usageFile, { ts: new Date().toISOString(), model: cfg.model ?? process.env.GEMINI_MODEL ?? st["ai.model"] ?? "gemini-2.5-flash", ...out.usage });
        return send(res, 200, out);
      }
      send(res, 404, { error: "not_found" });
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { error: e.message === "upstream" ? "upstream" : "server_error" }); // a részletek (kulcs!) nem szivárognak
    }
  });
}

module.exports = { createServer, askGemini, loadEnv, parseProperties };

if (require.main === module) {
  loadEnv();
  const port = Number(process.env.PORT) || 3000;
  const srv = createServer();
  // csak localhoston hallgat: kulcsos proxy ne legyen kiengedve a hálózatra
  srv.listen(port, "127.0.0.1", () => {
    console.log(`http://localhost:${port}  (Gemini: ${process.env.GEMINI_API_KEY ? "kulcs beállítva" : "NINCS kulcs, az AI-gomb rejtve marad"})`);
  });
}
