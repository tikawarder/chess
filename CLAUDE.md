# CLAUDE.md – projektkontextus Claude számára

Ez a fájl a jövőbeli Claude-munkamenetek (Claude Code / Cowork) számára foglalja össze a projektet.

## A projekt

**Magyar Sakkelemző**: böngészőben futó sakkjátszma-elemző, magyar nyelvű magyarázatokkal.

- Eredet: claude.ai artifact, „Magyar Sakkelemző”, utolsó frissítés 2026-10-05.
  Link (privát): https://claude.ai/artifact/NFgcx3fumDdi5ENkVFrxgU
- Az artifact egy korábbi Claude CLI-munkamenetben készült. Annak átirata nincs ebben a repóban.
- Repó: `tikawarder/chess` (privát), ág: `main`.

## Fájlok

| Fájl | Tartalom |
|---|---|
| `index.html` | A teljes alkalmazás egy fájlban (CSS + JS beágyazva, ~52 KB) |
| `README.md` | Rövid leírás, funkciók, ismert korlátok |
| `ROADMAP.md` | Megbeszélt fejlesztési irányok és döntések |
| `BESZELGETES.md` | A 2026-10-06 és 10-10 közötti Cowork-beszélgetés összefoglaló átirata |
| `CLAUDE.md` | Ez a fájl |

## Architektúra (jelenlegi `index.html`)

- **chess.js 0.10.3** (cdnjs): szabályok, PGN-beolvasás, FEN. Nem elemez.
- **Stockfish 10** (cdnjs, `stockfish.js`): Web Workerben fut (Blob + `importScripts`), `go depth 13`.
- `GAMES` tömb: 5 beépített híres játszma, lépésenkénti, előre megírt magyar kommentárral
  (`c` objektum, kulcs = félépés indexe 0-tól). A kommentárokat Claude írta, motorral nem ellenőrizték.
- Lépésminősítés (`classify`): centigyalog-veszteség alapján (≤20 Kiváló, ≤50 Jó, ≤100 Pontatlanság, ≤250 Hiba, felette Baklövés), plusz Legjobb és Kényszerlépés.
- Claude-elemzés: `window.claude.use("sample")` – csak claude.ai artifactként működik; önálló HTML-ben a gomb rejtve marad.
- PGN-import: `cleanPgn()` jelenleg **eldobja** a `{…}` kommentárokat és a változatokat.
- `localStorage`: utolsó állás, importált PGN-ek, gyorsítótárazott AI-elemzések (try/catch-be csomagolva).
- Magyar figurajelölés a megjelenítésben: K, V, B, F, H (`huSan`).

## Konvenciók

- A felület és a kommentárok nyelve: magyar.
- Kód és technikai dokumentáció: magyar vagy angol.
- Biztonság: API-kulcs soha ne kerüljön a kliensoldali HTML-be; AI-hívás csak backend proxyn keresztül.
- Szerzői jog: a lépések szabadon használhatók, a mások által írt kommentárok nem; csak közkincs, CC BY-SA (forrásmegjelöléssel) vagy saját/Claude által írt szöveg kerülhet be.
