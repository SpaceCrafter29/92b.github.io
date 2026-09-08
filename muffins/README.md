# Ofentrieb

Ein scroll-getriebenes 3D-Schaufenster für Muffins. Eigenständig, ohne Bezug zum
restlichen Repo — `index.html` einfach im Browser öffnen.

## Die Muffins sind gerechnet, nicht fotografiert

Jeder Muffin entsteht beim Laden auf einem `<canvas>` in einem 1000 × 1000 großen
Zeichenraum (`paintMuffin` in `muffins.js`):

- **Förmchen** — 17 einzeln schattierte Falten, darüber ein Zylinderverlauf und der
  Schatten, den die überhängende Kuppel aufs Papier wirft
- **Kuppel** — Superellipse (breiter als hoch, steile Flanken) mit drei überlagerten
  Sinuswellen als Beulen, plus welliger Schürze über den Förmchenrand
- **Krume** — 26 weiche Wölbungen brechen den Verlauf auf, darüber ~300 Poren mit
  Lichtkante und 210 helle Krümelspitzen
- **Riss** — getapertes Polygon mit dunklem Spalt und hellerer, versetzter Bruchkante
- **Belag** — je Sorte: Schokostücke, Beeren mit Farbbleed in den Teig, Mohn unter
  Zuckerguss mit Tropfnasen, Streusel, Frischkäsehaube mit Walnusshälfte

Alles deterministisch (`mulberry32`), derselbe Muffin sieht also immer gleich aus.
`data-jitter` am Canvas verschiebt den Startwert, damit acht Muffins im Blech nicht
achtmal derselbe sind. Der Marmor im Hintergrund wird genauso gezeichnet: Adern,
Korn, Mehlstaub.

## Was beim Scrollen passiert

| Station | Effekt |
|---|---|
| Kopfbereich | Muffin kippt der Maus hinterher, Mehlstaub zieht hoch |
| 01 Der Teig | Zutatenring dreht sich mit dem Scrollstand (`rotateY` auf 8 Karten im Kreis) |
| 02 Die Sorten | Panels schwenken abwechselnd von **links** und **rechts** herein |
| 03 Das Blech | angeheftet: runterscrollen fährt die Mulden **seitwärts** durchs Bild |
| 04 Der Ofen | 7 vorgerenderte Backstufen blenden ineinander — die Kuppel steigt und bräunt |
| 05 Finale | Dampf, Klick auf den Muffin wirft Krümel |

## Bedienung

- **Turbo** — Effektstärke auf 210 %
- **Ruhe** — fast alles aus; bei `prefers-reduced-motion: reduce` von Anfang an aktiv

## Aufbau

    index.html    Struktur
    muffins.css   Tokens, Layout, 3D-Bühnen
    muffins.js    Zeichner + eine rAF-Schleife

Kein Framework, keine Bilddateien, keine externen Assets außer den Schriften von
Google Fonts (Fraunces, Karla, IBM Plex Mono). Muffins werden per
`IntersectionObserver` erst gezeichnet, wenn sie in die Nähe des Fensters kommen.
