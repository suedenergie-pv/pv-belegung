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
