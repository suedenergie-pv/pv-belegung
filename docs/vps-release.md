# Produktiver Release auf dem VPS

Kanonische Live-Adresse: **https://belegung.suedenergie-pv.de/**. GitHub Pages ist eine separate Ausgabe und kein Nachweis für einen produktiven VPS-Deploy. Nutzerkorrektur und Deploy-Freigabe: 01.10.2026.

## Verifizierter Bestand

- Domain zeigt auf 82.165.71.190; bestehender SSH-Hostschlüssel lokal bekannt, Anmeldung über vorhandenen Schlüssel möglich.
- nginx-Site `/etc/nginx/sites-available/belegung` liefert statische Dateien aus `/var/www/belegung/current` ohne Basepath aus.
- Vor diesem Release zeigt `current` auf `/var/www/belegung/releases/e22b84f` (HTML vom 11.09.2026). Keine automatische Übernahme der GitHub-Pages-Deploys.
- `/_next/static/` liefert echte 404 für fehlende Assets; normale unbekannte Routen verwenden den vorhandenen HTML-Fallback. HTML hat `no-cache, no-store, must-revalidate`; statische Assets sind durch ihren Dateinamen versioniert.

## Ablauf und Rollback

Lokale Befehle: `npm run build:vps`, danach `npm run test:vps`. Interaktive lokale Vorschau bei Bedarf mit `npm run preview:vps` auf `http://127.0.0.1:3189/`. Die gemeinsamen Release-Skripte akzeptieren ausschließlich die Ziele `pages` und `vps`; Artefakte liegen getrennt. Für die Live-Nachprüfung `STATIC_DEPLOY_TARGET=vps` und `PAGES_SMOKE_URL=https://belegung.suedenergie-pv.de/` setzen und `npx playwright test --config=playwright.pages.config.ts` ausführen.

1. Den bereits geprüften Workbench-Stand isoliert mit leerem Basepath nach `.release/vps/` bauen. Keine privaten Fotos, lokalen Einstellungen oder Debug-Route veröffentlichen.
2. Desktop-/Smartphone-Smoke gegen exakt dieses Artefakt: Root-Einstieg, Assets, Foto, Maßbestätigung, Belegung, Rand 0, PDF ohne Kundendaten und Reload. Quellen/Exportdateien anhand Manifest prüfen.
3. Release-Skripte, Evidence und Rollback vor dem Umschalten unabhängig prüfen lassen.
4. Export als Archiv übertragen, lokalen und entfernten SHA-256 vergleichen, in einen neuen unverwechselbaren Unterordner von `/var/www/belegung/releases/` entpacken. Keine bestehenden Releases löschen oder überschreiben.
5. Vollständigkeit und Dateien prüfen, dann `current` über einen temporären Symlink mit `mv -T` atomar ersetzen. nginx-Konfiguration und andere VPS-Anwendungen bleiben unverändert.
6. Die öffentliche VPS-Domain selbst prüfen. Bei wesentlichem Fehler `current` atomar auf den vorherigen Releasepfad zurücksetzen. Ein erfolgreicher Upload allein ist kein abgeschlossener Deploy.

`scripts/activate-vps.sh` wird nach den Prüfungen über die vorhandene SSH-Verbindung ausgeführt. Parameter: Release-ID, Archiv-SHA-256, Index-SHA-256 und erwarteter bisheriger Releasepfad. Das Skript prüft einen zwischenzeitlich veränderten Live-Stand, behält alle alten Releases und setzt bei fehlgeschlagener HTTP-/Hashprüfung nach dem Umschalten automatisch zurück. Die öffentliche Browserprüfung erfolgt zusätzlich danach.

Native iPad-Praxisabnahme bleibt offen. Der fachliche App-/Engine-Stand wird durch diese Korrektur des Veröffentlichungsziels nicht geändert.

## Erfolgreicher produktiver Release am 01.10.2026

- Aktiv: `/var/www/belegung/releases/20261001-workbench-38606d6` (fachlicher Produktstand `38606d6`, Workbench und Randstandard 0 cm). Vorgänger `/var/www/belegung/releases/e22b84f` bleibt vorhanden.
- Isolierter VPS-Build und Typecheck bestanden. Lokale VPS-Smokes 2/2, Pages-Regressionssmokes 2/2 bestanden. Shell-Syntax auf dem Zielserver geprüft.
- Unabhängiger Release-Review PASS: 62 Quell-, 33 Export- und 33 Archivdateien ohne Hashabweichung, sichere Zielpfade, Umschaltung und Rollback geprüft. Ein kleiner CI-Artefaktpfadbefund wurde vor Deploy korrigiert.
- Übertragenes Archiv SHA-256 `96e00aa16742b28769f7f1cbd0641e8114bc1dd7505a5d86756db17946704a95`; veröffentlichte `index.html` SHA-256 `298a5e6f0fb17b4c9a8c48bdb744ce18bcbf81528b2027f20f5a03d2c77dec65`. Beide auf dem VPS bestätigt; HTML dort zusätzlich über HTTPS geprüft.
- Anschließend sämtliche 33 Dateien über **https://belegung.suedenergie-pv.de/** heruntergeladen und gegen das geprüfte Manifest abgeglichen: keine Abweichung.
- Direkte öffentliche Headless-Prüfung derselben VPS-Domain: **2/2 PASS in 11,1 Sekunden**, Desktop und Smartphone, inklusive Fotoeinrichtung, Belegung, angezeigtem Rand 0, echtem PDF-Download ohne Kundendaten und Reload. Keine Browser-/Request-/HTTP-Fehler im Ablauf. Live-Editorbilder auf beiden Größen tatsächlich geöffnet.
- Lokale Detailnachweise: `.release/vps-review.md`, `.release/vps-deployment-check.json`, `.release/vps-live-hashes.json`, `.release/vps-live-smoke-results.json` und `.release/screenshots/vps-*-editor.png`. Diese Angaben ersetzen keine native iPad-Abnahme.

## Eingabekorrektur am 01.10.2026

- Aktiver Nachfolgerelease: `/var/www/belegung/releases/20261001-mouse-touch`; der Workbench-Vorgänger bleibt als Rollback erhalten.
- Touch-Hardware allein erzwingt keinen Fadenkreuzmodus mehr. Mausbewegung und erster Mausdruck wechseln direkt zum Klicken/Ziehen; die nächste Fingergeste aktiviert wieder das Fadenkreuz. Fotoeinrichtung, Gauben und Perspektivkorrektur geben gegriffene Touch-Ecken dabei ohne Geometrieänderung frei.
- 335 Unit-/Engine-Tests, Typecheck, isolierter VPS-Build und unabhängiger Review bestanden. Headless gegen das exakte lokale Artefakt: 4 hybride Maus-/Touch-/Tastaturfälle (Chromium/WebKit), 8 bestehende Touchfälle und 2 VPS-Smokes bestanden. Desktop-, Tablet- und Smartphone-Aufnahmen mit dem privaten Drohnenfoto geöffnet; das Foto bleibt außerhalb des Releases.
- Archiv SHA-256 `173c6cd9504341dd189f56cfa93d0625ab9eae412146fff00d0f97b8689caff4`; Index SHA-256 `189a0fc64275613e2df2b9bdeca25b5fbb8d347d9c0a547180fb8877d2809646`. Nach atomarer Umschaltung alle 33 öffentlich ausgelieferten Dateien ohne Hashabweichung.
- Direkte Prüfung auf `https://belegung.suedenergie-pv.de/`: 4/4 hybride Eingabefälle und 2/2 Desktop-/Smartphone-Smokes einschließlich Belegung, Rand 0, PDF und Reload bestanden. Lokale Evidence unter `.release/mouse-touch-qa.json`, `.release/mouse-touch-review.md` und `.release/mouse-touch-live/`.
- Native iPad-Praxisabnahme bleibt offen. Engine, Geometrie und Gestaltung wurden durch diese Korrektur nicht geändert.

## Exakte Gaubenaussparung am 01.10.2026

- Aktiver Nachfolgerelease: `/var/www/belegung/releases/20261001-gaubenkontur`; Rollback: `20261001-mouse-touch`.
- Aussparung und Gaube verwenden dieselbe Außenkontur, bei Satteldachgauben einschließlich beider Firstenden. Engine und Renderer verwenden dasselbe Polygon. Rekonstruierbare Altgauben werden aus ihren gespeicherten Seiten übernommen, auch auf einer zweiten Fotoperspektive.
- 343 Unit-/Engine-Tests, Typecheck, isolierter Build und unabhängiger Review bestanden. Lokale Headless-QA: 6 hybride Eingabefälle auf Desktop, Tablet und Smartphone mit exakten Konturprüfungen sowie 2 VPS-Smokes. Echte Drohnenfoto-Screenshots auf allen drei Größen geöffnet; privates Foto nicht veröffentlicht.
- Archiv SHA-256 `5d5cf436e4ae7c38d4a7a20884ec1bfe4610819fadd7931b92a89604a51d2305`; Index SHA-256 `65f8383834861adb06ab8dc7257f251aaea1492e0d026af170f49b406c2022df`. Atomare Aktivierung und HTTPS-Prüfung auf dem VPS erfolgreich, alle 33 öffentlichen Dateien stimmen mit dem geprüften Artefakt überein.
- Direkte öffentliche Browserprüfung: 6/6 Eingabe-/Gaubentests und 2/2 Belegungs-/PDF-Smokes. Evidence: `.release/gaube-qa.json`, `.release/gaube-review.md`, `.release/gaube-live/`. Native iPad-Prüfung bleibt offen.

## Feldauswahl und direkte Modulaktion am 01.10.2026

- Aktiver Nachfolgerelease: `/var/www/belegung/releases/20261001-feldauswahl`; der zuvor separat veröffentlichte Gaubenfix bleibt als Rollback erhalten.
- Ein normaler Klick wählt genau ein Feld. Shift/Strg/Command oder der sichtbare Mehrfachschalter bilden eine Gruppe; Ziehen erhält die Gruppe, ein normaler Klick reduziert sie auf das getroffene Feld. Freie Bildstelle und Escape heben die Auswahl auf, auch nach einer Pfeilaktion. Formulare und offene Geometrieentwürfe bleiben geschützt.
- Desktop und Tablet zeigen Mehrfachauswahl und „Module entfernen“ direkt links. Auf dem Smartphone liegt die Modulaktion direkt unten; der Mehrfachschalter ist im Auswahlbereich erreichbar. Module sämtlicher Felder der aktiven Fläche lassen sich ohne Feldauswahl entfernen und einzeln zurückholen.
- 347 Unit-/Engine-Tests, Typecheck, isolierter VPS-Build und unabhängiger Review bestanden. Gerenderte Screenshots mit privatem Drohnenfoto auf allen fünf Zielgrößen tatsächlich geprüft. Fünf Bedienabläufe, sechs Hybrid-/Gaubenfälle und zwei PDF-/Reload-Smokes lokal bestanden. Die WebKit-Pointerprüfung berücksichtigt höchstens einen CSS-Bildpixel Rundung und prüft identische Gruppenbewegung.
- Archiv SHA-256 `03cfc0c7e420236e4f47d9f3dbc42cd029e7b1ed3805001fbe6b0eb0fa70d095`; Index SHA-256 `8429586b2cacbfff39fe67202cfda1ee77c88e6544858fde5b421d5a5999ac4d`. Atomare VPS-Aktivierung erfolgreich; alle 33 öffentlichen Dateien stimmen mit dem geprüften Export überein.
- Dieselben öffentlichen Live-Prüfungen auf `https://belegung.suedenergie-pv.de/`: 5/5 Feld-/Modulfälle, 6/6 Hybrid-/Gaubenfälle und 2/2 PDF-/Reload-Smokes bestanden. Evidence: `.release/feld-tools-qa.json`, `.release/feld-tools-review.md`, `.release/feld-tools-live/`. Native iPad-Praxisprüfung bleibt offen.
