# Magyar Sakkelemző

Híres sakkjátszmák lépésenkénti visszajátszása magyar kommentárral, Stockfish-értékeléssel és saját PGN-import lehetőségével.

## Cél

Híres sakkjátszmákat szeretnék megnézni és letölteni, lehetőleg automatikusan. Ehhez kell egy megjelenítő, ami nagyjából kész.

Ezután a Gemini API-kulcs segítségével a játszma aktuális állásánál, kérésre magyar nyelvű magyarázatot szeretnék kapni: például miért volt jó az előző lépés, és mi jöhet most. A magyarázatok legyenek szórakoztatóak.

## Funkciók

- 5 beépített híres játszma (Operajátszma, Réti csapdája, Halhatatlan, Örökzöld, Az évszázad játszmája) előre megírt magyar kommentárokkal
- Stockfish 10 motor (mélység 13): értékelősáv, lépésminősítés, legjobb folytatás nyíllal
- Saját játszma betöltése PGN-ből (chess.com, Lichess stb.)
- Léptetés gombokkal vagy a ← → billentyűkkel, tábla forgatása
- Világos és sötét téma

## Használat

Nyisd meg az `index.html` fájlt böngészőben, vagy tedd fel statikus tárhelyre (pl. GitHub Pages).

A chess.js és a Stockfish a cdnjs CDN-ről töltődik be, ezért internetkapcsolat szükséges.

### AI-magyarázat Gemini-vel (helyi proxy)

A Gemini API-kulcs soha nem kerül a böngészőbe: a `server.js` proxy tartja a szerveren.

```bash
cp .env.example .env      # írd be: GEMINI_API_KEY=...  (az .env nincs verziókezelve)
node server.js            # http://localhost:3000
node --test               # tesztek (hamis Gemini-szerverrel, kulcs nélkül)
```

Kulcs nélkül az AI-gomb rejtve marad, minden más működik. Kulcs: https://aistudio.google.com/apikey

### Beállítások: `settings.properties`

Amíg nincs beállító felület, minden nem titkos beállítás a `settings.properties` fájlban van (kulcs=érték). A szerver minden kérésnél újraolvassa, a böngészőben F5 után lép életbe. API-kulcs ide **ne** kerüljön, az az `.env`-be megy.

| Kulcs | Alap | Jelentés |
|---|---|---|
| `ai.model`, `ai.temperature`, `ai.maxOutputTokens`, `ai.thinkingBudget` | gemini-2.5-flash, 0.7, 1024, 0 | A Gemini hívás paraméterei |
| `ai.maxWords` | 90 | Az elemzés kért hossza (hogy kiférjen az oldalra) |
| `replay.autoStart`, `replay.stepSeconds`, `replay.loop` | true, 3, true | Az elemzett lépések automatikus, ismétlődő lejátszása a táblán, piros kiemeléssel |
| `speech.autoStart`, `speech.lang`, `speech.rate` | false, hu-HU, 1 | Felolvasás; közben a kimondott lépés szinkronban, pirosan jelenik meg a táblán (a szöveg lépésenként szeletelve szól, így nem függ a böngésző szóhatár-eseményeitől) |
| `animation.enabled`, `animation.ms` | true, 900 | A bábuk lassú odacsúszása, ütésnél az ütött bábu elhalványul; kézi léptetésnél, PGN-lejátszásnál és AI-lejátszásnál is ugyanaz |
| `play.stepSeconds` | 3 | A ⏵ Játszma gombbal indított PGN-lejátszás lépésköze (sárga kiemelés; az AI-lejátszásé piros) |

Az AI-elemzés kész szövegéből a program kiszedi a lépéseket, és a ▶ (tovább) gombig vagy a ⏹ gombig ismétlődve lejátssza őket, majd visszaáll az eredeti állás.

## Ismert korlátok

- Az AI-elemzés önállóan csak a `server.js` proxyn át (Gemini) működik; claude.ai artifactként továbbra is a Claude-ot használja. Statikus tárhelyen (pl. GitHub Pages) a gomb nem jelenik meg.
- A PGN-ben lévő `{…}` kommentárokat a betöltés jelenleg eldobja.
- A beépített kommentárokat Claude írta, motorral nem ellenőrizték.

## Eredet

A claude.ai-on publikált „Magyar Sakkelemző” artifact 2026-10-05-i változata.
