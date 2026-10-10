# ROADMAP – Magyar Sakkelemző

A 2026-10-06 és 10-10 közötti beszélgetésben megbeszélt irányok. A 6. pont (AI önálló futáskor) Gemini-proxyval megvalósult, a többi még nincs.

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
| 6 | AI önálló HTML-ben | Csak backend proxyn keresztül, a kulcs a szerveren marad. **Gemini-proxyval megvalósítva** (`server.js`, 2026-10-10); Anthropic-kulcsos változat nincs |
| 7 | Beépített kommentárok ellenőrzése | Stockfish-sel és megbízható forrásokkal; főleg „Az évszázad játszmája” szövegei pontatlanok helyenként |
| 8 | További beépített játszmák | Például Polgár Judit, Lékó Péter, Portisch Lajos játszmái, saját írású kommentárral |
| 9 | **Klasszikus mérkőzések helyből kereshető katalógusa** | Lásd lent: „Klasszikus játszmák katalógusa”. Alap: Fischer–Szpasszkij 1972 (21 játszma) |
| 10 | Több játszmás PGN beolvasása | Egy beillesztett szövegből (pl. egy meccs vagy egy havi chess.com-archívum) kiválasztható lista; ma csak az első játszmát tölti be |
| 11 | PGN fájl kiválasztása a gépről | A bemásolás mellett fájlfeltöltés (`.pgn`) |
| 13 | **A mérkőzés története és érdekességei** (AI) | Lásd lent: „Történet és érdekességek”. Döntés 2026-10-10: egyelőre csak a ROADMAP-ban, nincs megvalósítva |
| 14 | **AI-tartalék: ha nincs (vagy ki van kapcsolva) az API-kulcs, a számítógépen futó AI-ügynök (pl. Claude Code, Gemini CLI) dolgozik** | Lásd lent: „AI-szolgáltató tartalék”. Egyelőre csak ötlet, nincs megvalósítva |
| 12 | Előre generált magyar kommentárok a katalógushoz | A Gemini egyszer generálja és a katalógusba menti, így lejátszáskor nem kell minden lépéshez AI-hívás (becslés: ~0,0007 USD / lépés, a Fischer–Szpasszkij meccs ~0,6 USD) |

## Klasszikus játszmák katalógusa (ötlet, 2026-10-10)

Cél: híres mérkőzések (pl. Fischer–Szpasszkij) könnyű keresése és betöltése, kézi PGN-másolás nélkül. Jelenleg a PGN-t kézzel kell letölteni és bemásolni; a chess.com-ról letöltött egyjátszmás PGN már betölthető.

1. **Katalógus** (`classics.json`): kb. 50–100 híres játszma, PGN-nel és metaadattal (játékosok, év, esemény, eredmény). Egyszeri letöltő szkript a PGN Mentorból (csak lépések, ingyenes), utána helyben, offline elérhető. Tartalom: Fischer–Szpasszkij 1972, Morphy, Kaszparov–Deep Blue, Polgár Judit, Lékó Péter stb.
2. **Játszma-böngésző a felületen**: keresés név, év, esemény szerint, szűrők (pl. világbajnoki meccs), egy kattintásra betöltés.
3. **Online import később**: Lichess azonosító/URL, Chess.com felhasználónév (1. pont); a Lichess Masters explorer (`explorer.lichess.ovh/masters`) állás szerinti kereséshez.

| Forrás | Megjegyzés |
|---|---|
| PGN Mentor | Játékos- és eseményfájlok zip-ben, ingyenes, csak lépések; ez a katalógus alapja |
| Lichess Masters explorer | Hivatalos API, állás szerint keres, név szerint nem |
| Lichess / Chess.com API | Online játszmák; klasszikus OTB meccsek nincsenek benne |
| chessgames.com | A feltételek tiltják az automatikus letöltést, nem használjuk |

Nyitott kérdések: az adatok mellékelt fájlként a repóban legyenek-e (javasolt) vagy futáskor töltődjenek; melyik játszmákkal induljunk; a magyar kommentár előre generált vagy kérésre készüljön.

## Történet és érdekességek (ötlet, 2026-10-10; még nincs megvalósítva)

Cél: az AI „letöltsön” a mérkőzésekhez háttértörténetet és érdekességeket (pl. a Fischer–Szpasszkij meccs körüli események). A Gemini önmagában nem böngész az interneten, ezért forrás kell, különben kitalálhat „tényeket”.

Megbeszélt döntések:
- **Hol jelenjen meg:** a lépésenkénti AI-elemzésbe szőve (pl. „ennél a lépésnél történt …”), amikor kapcsolódik az adott lépéshez; emellett opcionálisan egy „A mérkőzés története” kártya a játszma betöltésekor.
- **Forrás:** Wikipedia (magyar és angol, kulcs nélküli MediaWiki API, CC BY-SA, forrásmegjelöléssel). Ha nincs releváns találat, a Gemini saját tudására esik vissza, az eredmény pedig **„nem ellenőrzött”** jelölést kap.
- A választást a felhasználó rám bízta; a javasolt megoldás az „A” változat (Wikipedia + Gemini).

Terv (javaslat):
1. Szerver végpont: `GET /api/trivia?title=&white=&black=&event=&year=` → Wikipedia-találat(ok) lekérése, relevancia-szűrés (a játékosok vezetékneve szerepel-e), Gemini-összefoglaló a forrásszövegek alapján (a forrás adat, nem utasítás), válasz: `{text, sources[], verified, usage}`.
2. Gyorsítótár játszmánként (`trivia-cache/`, gitből kizárva), hogy egy meccsre egyszer kelljen lekérni; `refresh=1` újratöltéshez.
3. A lépésenkénti AI-elemzés promptja megkapja a háttérszöveget („szőj bele egy mondatot, ha az adott lépéshez kapcsolódik, különben ne említsd”); a „számmentes” szabály marad.
4. Kártya a felületen: szöveg, forráslinkek („Forrás: Wikipedia, CC BY-SA”), „nem ellenőrzött” jelzés.
5. Beállítások a `settings.properties`-ben: `trivia.enabled`, `trivia.langs=hu,en`, `trivia.maxChars`, `trivia.maxWords`, `trivia.autoLoad`.
6. Tesztek hamis Wikipedia- és Gemini-szerverrel (találat, nincs találat, gyorsítótár, irreleváns találat, hibás válasz).

Költség: egy meccs háttere ~1000–1500 token ≈ 0,001 USD, gyorsítótárból utána 0.

## AI-szolgáltató tartalék (ötlet, 2026-10-10; még nincs megvalósítva)

Cél: ha a `GEMINI_API_KEY` hiányzik vagy ki van kapcsolva, az alkalmazás ne maradjon AI nélkül (ma ilyenkor az AI-gomb rejtve marad), hanem a **számítógépen futó, helyi AI-ügynökkel** dolgozzon. Ez bármelyik, a gépen elérhető ügynök lehet: elsőként Claude Code, Gemini CLI (ha az alkalmazást abból indították, azt részesítjük előnyben), később más is, egy általános, beállítható parancson át (pl. `ai.localCommand`).

Terv (javaslat):
1. **Szolgáltató-lánc** a `settings.properties`-ben, például `ai.provider=auto` (vagy `gemini-api`, `claude-cli`, `gemini-cli`) és `ai.fallbackOrder=gemini-api,claude-cli,gemini-cli`. Az `auto`: elsőnek az API-kulcs, ha nincs vagy hibázik (kulcs letiltva, kvóta, 401/403/429), a következő elérhető helyi CLI.
2. **Helyi CLI hívása a szerverről** (`server.js`): nem interaktív, csak szöveges mód, pl. a `claude` illetve `gemini` parancs „print”/prompt kapcsolójával. A pontos kapcsolókat a telepített verzió súgójából kell ellenőrizni, ezt még nem néztem meg.
3. **Biztonság:** `execFile`/`spawn` shell nélkül, a prompt stdin-en, időkorlát, kimeneti méretkorlát, a CLI-nek **nincs fájl- vagy parancs-hozzáférése** (csak szöveget kér és kap). A prompt a böngészőből jön, tehát nem megbízható bemenet (prompt-injection kockázat), ezért a szerver csak `127.0.0.1`-en marad.
4. **Elérhetőség-felismerés:** induláskor megnézi, melyik CLI van a `PATH`-on (`claude --version`, `gemini --version`), és a `/api/status` megmutatja, melyik szolgáltató aktív (a kliens ehhez igazítja az „AI” feliratot és a költségkijelzést).
5. **Költség:** a CLI az előfizetésből fut, tokenszámot nem feltétlenül ad vissza, ezért a költségkijelzés ilyenkor „n/a”.
6. **Tesztek:** hamis CLI-szkripttel (kulcs nélküli eset, kulcs kikapcsolva, API-hiba utáni átváltás, időkorlát, túl hosszú kimenet).

Nyitott kérdések: a CLI-hívás válaszideje (néhány másodperc – fél perc lehet, a stream nincs), és hogy az „indítva volt belőle” felismerés környezeti változóból történjen-e, vagy elég a `PATH`-keresés.

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
