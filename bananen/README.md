# Krumme Dinger

Ein scroll-getriebenes 3D-Schaufenster für Bananen. Eigenständig, ohne Bezug zum
restlichen Repo — `index.html` einfach im Browser öffnen.

## Was passiert beim Scrollen

| Station | Effekt |
|---|---|
| Kopfbereich | Banane kippt der Maus hinterher, dreht sich mit dem Scrollstand |
| 01 Anlieferung | 16 Kisten fliegen aus der Tiefe direkt auf die Kamera zu (`translateZ`) |
| 02 Sichtung | Sortenpanels schwenken abwechselnd von **links** und von **rechts** herein (`rotateY` + `translate3d`) |
| 03 Sortierband | angeheftete Sektion: runterscrollen fährt die Prüfkarten **seitwärts** durchs Bild |
| 04 Reifegrad | Schalenfarbe läuft über den Farbfächer von Stufe 1 bis 7, Punkte kommen dazu |
| 05 Finale | Bananenregen, Klick auf die große Banane wirft welche durchs Bild |

## Bedienung

- **Turbo** — Effektstärke auf 215 %
- **Ruhe** — fast alles aus; ist bei `prefers-reduced-motion: reduce` von Anfang an aktiv

## Aufbau

    index.html    Struktur + das SVG-Bananensymbol (einmal definiert, überall per <use>)
    bananen.css   Tokens, Layout, 3D-Bühnen
    bananen.js    eine rAF-Schleife, alles über transform/opacity

Kein Framework, keine Build-Schritte, keine externen Assets außer den Schriften
von Google Fonts (Alfa Slab One, Archivo, Courier Prime).

Die Scrollgeschwindigkeit landet als `--vel` / `--avel` auf `:root` — daher der
Farbversatz im Titel und das Zittern der Laufschrift beim schnellen Scrollen.
