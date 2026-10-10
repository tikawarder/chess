# Magyar Sakkelemző

Híres sakkjátszmák lépésenkénti visszajátszása magyar kommentárral, Stockfish-értékeléssel és saját PGN-import lehetőségével.

## Funkciók

- 5 beépített híres játszma (Operajátszma, Réti csapdája, Halhatatlan, Örökzöld, Az évszázad játszmája) előre megírt magyar kommentárokkal
- Stockfish 10 motor (mélység 13): értékelősáv, lépésminősítés, legjobb folytatás nyíllal
- Saját játszma betöltése PGN-ből (chess.com, Lichess stb.)
- Léptetés gombokkal vagy a ← → billentyűkkel, tábla forgatása
- Világos és sötét téma

## Használat

Nyisd meg az `index.html` fájlt böngészőben, vagy tedd fel statikus tárhelyre (pl. GitHub Pages).

A chess.js és a Stockfish a cdnjs CDN-ről töltődik be, ezért internetkapcsolat szükséges.

## Ismert korlátok

- A „Részletes elemzés Claude-dal” funkció csak claude.ai artifactként fut; önálló HTML-ként a gomb nem jelenik meg.
- A PGN-ben lévő `{…}` kommentárokat a betöltés jelenleg eldobja.
- A beépített kommentárokat Claude írta, motorral nem ellenőrizték.

## Eredet

A claude.ai-on publikált „Magyar Sakkelemző” artifact 2026-10-05-i változata.
