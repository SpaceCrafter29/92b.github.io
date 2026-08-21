# VideoWall

Live-Wallpaper für Android: spielt ein selbst gewähltes Video als Hintergrund auf
Start- und Sperrbildschirm ab. Gebaut und getestet für ein **Google Pixel 7a**.

Android bringt so etwas nicht von Haus aus mit — es gibt keine eingebaute
Funktion, ein Video als Hintergrundbild zu setzen. Diese App rüstet sie über die
`WallpaperService`-API nach.

## Installieren

1. **[VideoWall.apk herunterladen](https://github.com/SpaceCrafter29/92b.github.io/releases/latest/download/VideoWall.apk)** — direkt auf dem Handy öffnen.
2. Android fragt einmalig, ob Apps aus dieser Quelle installiert werden dürfen → erlauben.
3. App öffnen, **Video auswählen**, dann **Als Hintergrund festlegen**.

Die APK wird bei jedem Push automatisch von GitHub Actions gebaut
(`.github/workflows/build-apk.yml`). Es ist ein Debug-Build, signiert mit dem
Standard-Debug-Schlüssel — für die eigene Nutzung völlig ausreichend, für den
Play Store nicht.

## Was die App kann

| Einstellung | Wirkung |
|---|---|
| **Bildschirm füllen** | An: Video wird zugeschnitten, keine Balken. Aus: Video wird komplett eingepasst, mit schwarzen Balken. |
| **Helligkeit** | Dunkelt das Video ab, damit App-Symbole und Widgets lesbar bleiben. |
| **Parallax-Effekt** | Video wandert mit, wenn zwischen Startbildschirm-Seiten gewischt wird. |
| **Geschwindigkeit** | 0,25× bis 2× |
| **Ton** | Standardmäßig aus. |

Änderungen greifen sofort, ohne das Wallpaper neu setzen zu müssen.

**Akku:** Sobald der Bildschirm aus ist oder eine App im Vordergrund läuft, meldet
Android das Wallpaper als unsichtbar und die App hält die Video-Dekodierung an.
Ein kurzes, gut komprimiertes Video (HEVC/H.265, 10–20 s, in Bildschirmauflösung)
kostet deutlich weniger Akku als ein langer 4K-Clip.

## Wie es funktioniert

Ein `MediaPlayer` allein reicht nicht: er streckt sein Bild immer auf die volle
Surface-Größe und verzerrt damit jedes Video, dessen Seitenverhältnis nicht exakt
dem Bildschirm entspricht. Deshalb läuft das Bild hier über eine `SurfaceTexture`
in einen OpenGL-ES-2-Shader:

```
MediaPlayer ─▶ SurfaceTexture ─▶ OES-Textur ─▶ Shader ─▶ EGL-Surface des Wallpapers
                                                  │
                        Zuschnitt · Helligkeit · Parallax
```

Der Shader skaliert die Texturkoordinaten um ihre Mitte. Werte unter 1 schneiden
zu (Bildschirm füllen), Werte über 1 lassen Rand frei, der schwarz gefüllt wird
(einpassen). Der beim Zuschneiden übrige Spielraum links und rechts ist genau
das, was der Parallax-Effekt beim Wischen ausnutzt.

| Datei | Aufgabe |
|---|---|
| `VideoWallpaperService.kt` | Meldet das Wallpaper beim System an, reicht Sichtbarkeit und Wisch-Offset weiter |
| `VideoRenderer.kt` | EGL-Kontext, Shader, `MediaPlayer` — alles auf einem eigenen Render-Thread |
| `MainActivity.kt` | Einstellungen, Videoauswahl über SAF |
| `VideoMeta.kt` | Abmessungen und Länge, inklusive Rotations-Korrektur bei Hochkant-Videos |
| `Prefs.kt` | Gemeinsame Einstellungen; der Service hört auf Änderungen |

Das gewählte Video wird **nicht kopiert**. Die App merkt sich nur seine URI und
nimmt sich über `takePersistableUriPermission` dauerhaftes Leserecht. Wird die
Datei gelöscht, bleibt der Hintergrund schwarz — dann einfach ein neues Video
auswählen.

## Selbst bauen

```bash
./gradlew :app:assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

Voraussetzung: JDK 17 und ein Android SDK mit Plattform 35. In Android Studio
reicht Öffnen und *Run*.

- `minSdk` 26 (Android 8) · `targetSdk` 35 (Android 15) · Kotlin 2.0.21 · AGP 8.7.3

## Lizenz

GPL-2.0, siehe [LICENSE.md](LICENSE.md).
