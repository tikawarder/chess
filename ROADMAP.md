# ROADMAP – Magyar Sakkelemző

A 2026-10-06 és 10-10 közötti beszélgetésben megbeszélt irányok. Egyik pont sincs még megvalósítva.

## Célok

1. Játszmák importálása a chess.com-ról (és a Lichessről).
2. Elemzés elsősorban motorral, ingyenesen; AI-elemzés csak másodsorban.
3. Működjön minden modern böngészőben (Chrome, Edge, Firefox, Safari; asztali és mobil).

## Teendők

| # | Feladat | Megjegyzés |
|---|---|---|
| 1 | Chess.com-import felhasználónév alapján | Nyilvános API: `api.chess.com/pub/player/{név}/games/archives`, majd `/games/{év}/{hó}`. Lichess-hez hasonlóan. A PGN-bemásolás marad |
| 2 | Stockfish 16/17 „lite”, egyszálas WASM | Erősebb a Stockfish 10-nél, és nem kell hozzá COOP/COEP fejléc |
| 3 | Szabályalapú magyar magyarázatok | A Stockfish-adatokból és a chess.js-sel vizsgált állásból: ütésben hagyott figura, villa, kötés, kihagyott matt, anyagvesztés, „jobb lett volna: …”, megnyitásnév a fejlécből. Változatos sablonok, dicséret, összesítő (pontosság %) |
| 4 | PGN `{…}` kommentárok megtartása | Az emberi kommentár jelenjen meg a kommentárkártyán |
| 5 | Egyszeri Claude-elemzés mentéssel | Egy gomb a teljes játszmát elemzi; az eredmény JSON-ként vagy kommentált PGN-ként mentődik, utána AI nélkül újranézhető |
| 6 | AI önálló HTML-ben | Csak backend proxyn keresztül, az Anthropic API-kulcs a szerveren marad |
| 7 | Beépített kommentárok ellenőrzése | Stockfish-sel és megbízható forrásokkal; főleg „Az évszázad játszmája” szövegei pontatlanok helyenként |
| 8 | További beépített játszmák | Például Polgár Judit, Lékó Péter, Portisch Lajos játszmái, saját írású kommentárral |

## Csomagolás – döntés még nincs

| Változat | Leírás | Előny | Hátrány |
|---|---|---|---|
| A | Egy fájl, CDN-hivatkozásokkal | Kicsi (~60 KB) | Internet és CDN kell; helyi megnyitásnál a motor bizonytalan. **Nem javasolt** |
| B | Egy fájl, minden beágyazva (Stockfish base64-ben) | Önálló, duplakattintással megy | ~8–10 MB |
| C | Mappa: `index.html` + `stockfish.js` + `stockfish.wasm` | Tiszta, gyors | Webszerverről kell megnyitni (pl. GitHub Pages, belső szerver) |

A chess.com-import mindhárom esetben internetet igényel.

## Magyarázatok rétegei (cél)

1. **Motorsor:** címke és értékelés – Stockfish, ingyenes (megvan).
2. **Rövid magyar szöveg:** beépített játszmánál kézzel írt kommentár, importáltnál szabályalapú mondat (új).
3. **Részletes elemzés és kérdés:** Claude, opcionális (claude.ai-on megvan; máshol proxy kell).

## Kommentárforrások

| Forrás | Felhasználhatóság |
|---|---|
| Lichess Studies | Felhasználói tartalom; átvételhez a szerző engedélye kell |
| Wikipedia / Wikibooks | CC BY-SA: forrásmegjelöléssel |
| Közkincs könyvek (Capablanca: Chess Fundamentals, Löwenthal Morphy-gyűjteménye, Steinitz) | Szabadon; fordítani és PGN-be alakítani kell |
| chessgames.com | Automatikus letöltést a feltételek korlátozzák |
| PGN Mentor, TWIC | Szinte csak lépések |
| ChessBase, Chess Informant, New in Chess | Fizetős, védett; csak saját használatra |

## GitHub Pages

A repó jelenleg privát. Ingyenes fiókkal a Pageshez nyilvánossá kell tenni (Settings → General → Change visibility), majd Settings → Pages → `main` ág.
