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

## Direkte Dachflächenlöschung und PDF ab Seite 1 am 01.10.2026

- Aktiv: `/var/www/belegung/releases/20261001-dach-pdf`; Rollback bleibt `/var/www/belegung/releases/20261001-feldauswahl`.
- Die Dachflächenliste bietet direkt „Entfernen“. Hauptdach samt Gauben und Stringzuordnungen bzw. ganze Gaubengruppe samt Aussparung werden über die vorhandene Logik entfernt. Fotos bleiben erhalten. Abbruch, offener Maßentwurf, Rückgängig/Wiederherstellen und Schutz der letzten Hauptfläche geprüft.
- PDF: Zwei große Fotos bereits auf Seite 1. Tatsächliche Downloads für 1/2/3/4/6 Bilder ergeben die Verteilungen `[1]`, `[2]`, `[2,1]`, `[2,2]`, `[2,2,2]`. Kompakter Kopf und Flächendaten; umfangreiche Details erst nach den Bildseiten. Seiten gerendert und visuell geprüft, einschließlich unverzerrter Bilder, Seitenränder und Fußzeilen. Unabhängig zusätzlich 60 Flächen und lange Stammdaten geprüft.
- 350 Unit-/Engine-Tests, Typecheck, isolierter VPS-Build und unabhängiger Code-/Sicht-/Archivreview bestanden. Lokal 5 Löschfälle auf Desktop, Tablet und Smartphone, 10 echte PDF-Downloads auf Desktop/Smartphone, 5 Feld-/Modulregressionen und 2 VPS-Smokes bestanden. Die 15 in der PDF-Testkonfiguration nicht vorgesehenen Tablet-/Querformat-Duplikate sind ausdrücklich übersprungen, nicht als bestanden gezählt.
- Archiv SHA-256 `3cd17a4b13873a207f622f35c9bbc2f33c673c09bc4c2abec86119bc0f835e06`; Index SHA-256 `ebddbe0029c5d259d3fd302ec80e64db0797302502f37c01bdf9af9ec63d837e`. 63 Quellen, 33 Export- und 33 Archivdateien unabhängig abgeglichen. Atomare Aktivierung und serverseitige HTTPS-Prüfung erfolgreich; alle 33 öffentlichen Dateien stimmen mit dem geprüften Export überein.
- Direkte öffentliche Nachprüfung: 15/15 Lösch-/PDF-Fälle und 2/2 Belegungs-/PDF-/Reload-Smokes bestanden. Evidence: `.release/dach-pdf-qa.json`, `.release/dach-pdf-layout.json`, `.release/dach-pdf-review.md`, `.release/dach-pdf-live-hashes.json` und `.release/dach-pdf-live/`. Privates Drohnenfoto ausschließlich lokal, nicht veröffentlicht. Native iPad-Praxisprüfung weiterhin offen.


## Werkzeuge und sichtbarer Export am 02.10.2026

- Aktiv nach ausdrücklicher Nutzerfreigabe: `/var/www/belegung/releases/20261002-werkzeuge-export`; Rollback bleibt `/var/www/belegung/releases/20261001-dach-pdf`.
- Desktop/Tablet: Automatisch belegen und Perspektive direkt links. Mehr enthält erklärte Zweckgruppen für Randabstand, Anzeige und Zurücksetzen; kompakte Ansichten bieten dort zusätzlich die direkten Aktionen an. Foto-Markierung/Ziegelmaß unter Fotos. Sichtbarer orangefarbener Export-Knopf oben; bestehender Entwurfsschutz erhalten.
- 350 Unit-/Engine-Tests, Typecheck und isolierter Build bestanden. Lokal 5 neue Werkzeug-/Exportabläufe auf fünf Größen, 5 Feldregressionen, 6 hybride Eingabefälle und 2 VPS-Smokes bestanden. Screenshots tatsächlich geöffnet. Der veraltete Smoke-Locator wurde auf Randabstand angepasst; Tablet-Capture wartet auf Bilddekodierung. Unabhängiger Code-/Sicht-/Archivreview PASS ohne offene Blocker/Majors.
- Archiv SHA-256 `6d50abe2246b4ca65746619246ad249a0903b9dadb4490284d0491beabf8e20f`; Index SHA-256 `7430a276d742d025ab28fe9c23ce18abc3ae7ff8278b50368533323c437d8744`. 63 Quellen, 33 Export- und 33 Archivdateien abgeglichen. Archiv und unverändertes Aktivierungsskript in neue Pfade unter `/var/www/belegung/releases/` übertragen; Remotehashes und Shell-Syntax bestätigt.
- Nach zunächst abgelehnter automatischer Freigabe hat Genrih die Aktivierung ausdrücklich bestätigt. Vorgänger und Remotehashes erneut geprüft, dann atomar aktiviert. Server-HTTPS-/Indexprüfung erfolgreich; alle 33 öffentlichen Dateien stimmen mit dem geprüften Export überein. Direkte Live-Prüfung: 5/5 Werkzeug-/Exportabläufe auf fünf Größen sowie 2/2 PDF-/Reload-Smokes bestanden. Desktop-/Smartphone-Livebilder geöffnet. Endgültiger Typecheck und 28 Bedienungs-Unit-Tests nach Korrektur einer fehlenden Test-Hilfsfunktion erneut bestanden; Produktionsquellen unverändert.
- Evidence: `.release/werkzeuge-export-qa.json`, `.release/werkzeuge-export-review.md`, `.debug-shots/werkzeuge-export/` und `.release/werkzeuge-*.log`, `.release/werkzeuge-export-live-hashes.json` und `.release/werkzeuge-export-live/`. Native iPad-Prüfung nicht erfolgt; privates Foto ausschließlich lokal.


## Desktop-Leertaste am 12.10.2026

- Aktiv: `/var/www/belegung/releases/20261012-space-pan`. Rollback bleibt `/var/www/belegung/releases/20261002-werkzeuge-export`.
- Leertaste halten über dem Foto und mit linker Maustaste ziehen verschiebt vorübergehend nur die Ansicht. Nach Loslassen bleibt das bisherige Werkzeug aktiv; ein Rest-Mouse-up/-click löst keine Modellaktion aus. Eingaben/Dialoge, Fensterverlust, native Touch- und Zweifingergesten sind berücksichtigt. Die bestehende Gestaltung bleibt erhalten; der Cursor zeigt die temporäre Hand.
- 353 Unit-/Engine-Tests, Typecheck und isolierter VPS-Build bestanden. 3 neue headless Shortcutfälle in Chromium/WebKit einschließlich frühem Loslassen, Werkzeugrückkehr, unveränderten Projektdaten, Fensterverlust und Texteingabe bestanden. Dazu 6 Hybrid- und 8 Touchregressionen sowie 2 PDF-/Reload-Smokes. Nach finaler Mausgrenzen-Korrektur fokussierte 9 Unit-Tests, Typecheck, Build, 3 Shortcutfälle und 2 Smokes erneut bestanden.
- Archiv SHA-256 `ff27e33f31c2188d958a95efc83b23141179c887b3fbc946d678f4d24f891d00`; Index SHA-256 `588937313c530d5372f156904a2186c91d14d55e192e863466b3ea48d221a1c9`. 63 Quellen/33 Export-/33 Archivdateien abgeglichen. Remotehashes und Shell-Syntax geprüft; vorhandenes Aktivierungs-/Rollbackskript unverändert.
- Unabhängiger Review PASS: finale Quellen/Export/Archiv ohne Abweichung. Atomare Aktivierung und serverseitige HTTPS-Prüfung erfolgreich; alle 33 öffentlichen Dateien stimmen mit dem geprüften Artefakt überein. Direkt auf der Live-Domain 3/3 Shortcut-/Eingabefälle und 2/2 PDF-/Reload-Smokes bestanden.
- Evidence: `.release/space-pan-qa.json`, `.release/space-pan-review.md`, `.release/space-pan-*.log`, `.release/space-pan-live-hashes.json`, `.release/space-pan-live/` und `.debug-shots/space-pan/`. Gerenderte Desktop-/Mobileansichten geöffnet; echte iPad-Praxisprüfung nicht erfolgt.


## Zusätzlicher Exportknopf am 12.10.2026

- Aktiv: `/var/www/belegung/releases/20261012-export-button`; Rollback bleibt `/var/www/belegung/releases/20261012-space-pan`.
- Zusätzlich zur Schrittnavigation dauerhaft sichtbarer orangefarbener „Weiter zum Export“-Knopf am unteren Rand des Inspektors. PDF-Vorschau/Download als Ziel erklärt. Einstellungen scrollen im inneren Container; Export bleibt auf Desktop, Tablet und Smartphone erreichbar, auch nach Belegung/Auswahl und bei geöffneten Werkzeugen. Callback verwendet unverändert den bestehenden setSchritt/Entwurfsschutz.
- 36 fokussierte Unit-Tests, Typecheck und isolierter VPS-Build bestanden. Headless: 5 Export-/Werkzeugfälle auf fünf Größen, 5 Feld-/Modulregressionen, 1 WebKit-Mobile-Touchablauf und 2 PDF-/Reload-Smokes bestanden. Desktop-/Tablet-/Mobile-Screenshots tatsächlich geöffnet. Privatfoto ausschließlich lokal.
- Archiv SHA-256 `837b0e3d9ee2c909333a6cd10ab5264d9eae240ef89ffd54d43ee38fed087e6c`; Index SHA-256 `4210631e329a72a56ad6fef5d4b44fac349405f546f9c6e209bbbf8c91530e07`. 63 Quellen, 33 Export- und 33 Archivdateien abgeglichen. Upload in neue Pfade, Remotehashes und Shell-Syntax bestätigt. Aktivierungsskript unverändert.
- Unabhängiger Code-/Sicht-/Archivreview PASS. Zusätzlicher echter Scroll-/Hitcheck auf Smartphone-Hoch-/Querformat bestätigt unveränderte Footerposition und Erreichbarkeit unterster Einstellungen. Atomare Aktivierung und HTTPS-Prüfung erfolgreich; alle 33 öffentlichen Dateien ohne Hashabweichung. Direkte Live-Prüfung: 5/5 Export-/Werkzeugabläufe und 2/2 PDF-/Reload-Smokes bestanden.
- Evidence: `.release/export-button-qa.json`, `.release/export-button-review.md`, `.release/export-button-*.log`, `.release/export-button-live-hashes.json`, `.release/export-button-live/` und `.debug-shots/export-button/`. Native iPad-Prüfung nicht erfolgt.

## Geführter Ablauf ohne Doppelaktionen am 12.10.2026

- Aktiv: `/var/www/belegung/releases/20261012-gefuehrter-ablauf`; Rollback bleibt `/var/www/belegung/releases/20261012-export-button`. Implementierung: `6655a14`.
- Aktuelle Einrichtungsschritte haben genau eine feste Bestätigung im Inspektorabschluss. Neue Dachmaße müssen bewusst eingegeben werden; Bestandswerte bleiben erhalten. Skizzen erklären Maße und Dachecken. Beim Einstieg über Foto zuerst zeigt die Bildfläche während der Maßeingabe die richtige Aufgabe, ohne Punktsteuerung. Auf leerer Fläche aktiviert „Weiter zur Modulplatzierung“ sofort das Feldzeichnen; bestehende Belegungen bleiben in Auswahl.
- Sichtbarer Export im Belegungsbereich ab vorhandenem Modulfeld, bei offenen Eingaben zweitrangig mit unverändertem Entwurfsschutz. PDF-Download steht oben und bleibt beim Scrollen sichtbar. Desktop erklärt Leertaste + Ziehen; Touchhinweise bleiben passend. Kleine Ansichten erhalten erreichbare Formulare und Aktionen.
- 355 Unit-/Engine-Tests (141 Engine, 214 Web), Typecheck und isolierter VPS-Build bestanden. Finale lokale QA: 16/16 Foto-zuerst-/Mehrflächenabläufe auf acht Größen (1440×900, 1024×768, 768×1024, 375×812, 812×375, 320×568, 375×500, 720×450), dazu 2/2 PDF-/Reload-Smokes. Vor der letzten begrenzten Maßanleitungskorrektur zusätzlich 5 Werkzeug-/Entwurfs-, 6 Hybrid-, 8 Touch- und 3 Space-Pan-Fälle bestanden.
- Unabhängiger Code-, Sicht-, Hittest- und Archivreview PASS ohne offene Blocker/Majors. 65 Quellen, 33 Export- und 33 Archivdateien stimmen überein. Archiv SHA-256 `a4abeb92c8ccc69ef9bcba4ad0867ed70509f8a4ef572a50678d95f7a37ba60c`; Index SHA-256 `23176e755423c3cf9c18be2c7780a3bab8ed127029b9af8cbf27d6c9f75a5691`. Remotehashes und Shell-Syntax bestätigt; unverändertes Aktivierungsskript mit atomarer Umschaltung und automatischem Rollback verwendet.
- Produktive Aktivierung und serverseitige HTTPS-Prüfung erfolgreich. Alle 33 öffentlichen Dateien gegen Manifest bestätigt. Direkt auf `https://belegung.suedenergie-pv.de/` ebenfalls 16/16 Bedienabläufe (27,8 s) und 2/2 PDF-/Reload-Smokes (10,7 s) bestanden. Desktop-/Mobile-Livebilder tatsächlich geöffnet.
- Evidence: `.release/walter-qa.json`, `.release/walter-review-final.md`, `.release/walter-independent-artifact.json`, `.release/walter-live-hashes.json`, `.release/walter-*.log`, `.release/walter-live/`, `.debug-shots/walter-fix/`. Privates Drohnenfoto ausschließlich zur lokalen Browser-Laufzeitprüfung, nicht im Release. Kleine Einschränkung: dichte Werkzeugbeschriftung bei 320 px. Keine native iPad-Abnahme und kein Test mit einem unerfahrenen Menschen; kompakter Desktop-Viewport ersetzt keinen echten Browserzoom-Test.
