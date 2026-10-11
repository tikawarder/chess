// PGN-feldolgozó: több játszma, kommentárok ({…} és ;), minősítések (NAG), változatok. Függőségmentes, böngészőben és Node-ban is fut.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PGN = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // NAG (numerikus jelölés) → jel
  const NAG_SYM = { 1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!", 10: "=", 13: "∞", 14: "⩲", 15: "⩱", 16: "±", 17: "∓", 18: "+−", 19: "−+" };
  const cleanComment = t => t.replace(/\[%[^\]]*\]/g, " ").replace(/\s+/g, " ").trim(); // a [%eval], [%clk], [%cal] jelölők kiszűrése
  const joinC = (a, b) => [a, b].filter(Boolean).join(" ");

  // Egy játszma mozgásszövege → { plies: [{ san, comment, nag, vars: [plies[]] }], intro, result }
  function parseMoveText(s) {
    let i = 0, result = "";
    const n = s.length;
    const line = () => {
      const plies = []; let intro = "";
      while (i < n) {
        const ch = s[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === "{" || ch === ";") { // kommentár: a megelőző lépéshez tartozik, a legelső pedig a játszma bevezetője
          const end = ch === "{" ? s.indexOf("}", i) : s.indexOf("\n", i);
          const t = cleanComment(s.slice(i + 1, end < 0 ? n : end)); i = end < 0 ? n : end + 1;
          if (plies.length) plies[plies.length - 1].comment = joinC(plies[plies.length - 1].comment, t); else intro = joinC(intro, t);
          continue;
        }
        if (ch === "(") { i++; const v = line(); if (plies.length) plies[plies.length - 1].vars.push(v.plies); continue; } // változat
        if (ch === ")") { i++; return { plies, intro }; }
        let j = i; while (j < n && !/[\s{}();]/.test(s[j])) j++;
        const tok = s.slice(i, j); i = j;
        if (/^\$\d+$/.test(tok)) { if (plies.length) plies[plies.length - 1].nag = NAG_SYM[+tok.slice(1)] || plies[plies.length - 1].nag; }
        else if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) result = tok;
        else if (/^\d*\.+$/.test(tok)) { /* lépésszám: 12. vagy 12... */ }
        else if (/^[!?]{1,2}$/.test(tok)) { if (plies.length) plies[plies.length - 1].nag = tok; }
        else {
          const t = tok.replace(/^\d+\.+/, ""); if (!t) continue; // „12.Vb3” összeírva is jó
          const m = t.match(/^(.*?)([!?]{1,2})?$/);
          if (m[1]) plies.push({ san: m[1], comment: "", nag: m[2] || "", vars: [] });
        }
      }
      return { plies, intro };
    };
    const r = line();
    return { ...r, result };
  }

  const TAG_RE = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/;

  // Szöveg → játszmák: { head: [fejlécsorok], body: [mozgásszöveg sorai] }
  function splitPgn(text) {
    const games = []; let cur = null, inMoves = false;
    for (const line of String(text).replace(/^\uFEFF/, "").split(/\r?\n/)) {
      if (TAG_RE.test(line)) {
        if (!cur || inMoves) { cur = { head: [], body: [] }; games.push(cur); inMoves = false; }
        cur.head.push(line);
      } else if (cur) {
        if (line.trim()) inMoves = true;
        cur.body.push(line);
      } else if (line.trim()) { cur = { head: [], body: [line] }; games.push(cur); inMoves = true; } // fejléc nélküli, csak lépések
    }
    return games;
  }

  function parseHeaders(headLines) {
    const h = {};
    headLines.forEach(l => { const m = TAG_RE.exec(l); if (m) h[m[1]] = m[2].replace(/\\(["\\])/g, "$1"); });
    return h;
  }

  function parseGame(g) {
    const mt = parseMoveText(g.body.join("\n"));
    return { h: parseHeaders(g.head), ...mt, raw: [...g.head, "", ...g.body].join("\n").trim() };
  }

  // Magyar-e a szöveg? (akkor nem kell fordítani). Csak lépésjelölést/jeleket tartalmazó szöveget sem fordítunk.
  // Jellegzetes magyar szavak: egyetlen találat is elég. Az általánosabbak (angolban is előfordulhatnak névként) csak legalább kettő esetén.
  const HU_STRONG = new Set(["és", "hogy", "nem", "már", "csak", "után", "vagy", "lépés", "világos", "sötét", "bástya", "gyalog", "király", "vezér", "futó", "huszár", "cselt", "csel"]);
  const HU_WEAK = new Set(["az", "van", "ez", "mint"]);
  function needsTranslation(t) {
    const words = String(t).replace(/\b[KQRBNVFH]?[a-h]?[1-8]?x?[a-h][1-8][+#=]?[QRBNVFH]?\b/g, " ").match(/\p{L}{2,}/gu) || [];
    if (words.length < 2) return false; // csak lépések/jelek
    // Kisbetűvel kezdődő, magyar ékezetes szó ("vezért", "elején") → magyar. A nagybetűs nevek (Réti, Polgár) nem számítanak.
    const huWord = (String(t).match(/\p{L}+/gu) || []).some(w => w[0] === w[0].toLowerCase() && w[0] !== w[0].toUpperCase() && /[áéíóöőúüű]/.test(w));
    if (huWord) return false;
    const low = words.map(w => w.toLowerCase());
    return !(low.some(w => HU_STRONG.has(w)) || low.filter(w => HU_WEAK.has(w)).length >= 2);
  }

  return { NAG_SYM, parseMoveText, splitPgn, parseHeaders, parseGame, needsTranslation };
});
