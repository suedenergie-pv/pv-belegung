# Reproduzierbarer GitHub-Pages-Release

Stand: 01.10.2026. Dieser Prüfweg baut das tatsächlich auslieferbare statische Artefakt unter `/pv-belegung/`. Er ergänzt die normale lokale Next-Vorschau und verändert sie nicht.

## Freigegebener Release mit 0-cm-Rand (01.10.2026)

Genrih hat den Workbench-Stand angenommen und den Deploy nach Umstellung auf 0 cm ausdrücklich freigegeben. Der Standard gilt für sämtliche Flächenarten; gespeicherte individuelle Ränder bleiben erhalten. Die native iPad-Abnahme bleibt offen und wird von dieser Freigabe nicht als bestanden ausgegeben.

- `npm test`: **333/333 bestanden** (136 Engine, 197 Anwendung). Neue Grenzkantenprüfung: Ein exakt passendes Modul bleibt bei 0 cm belegbar, bei expliziten 5 cm nicht. Flächentypen und individuell gespeicherte Werte separat geprüft.
- `npm run typecheck` und `npm run build:pages`: bestanden. Manifest `2026-10-01T10:37:56.687Z`, 62 Quellen und 33 Exportdateien; Hashvergleich nach dem Smoke ohne Abweichung.
- `npm run test:pages`: **2/2 bestanden in 40,1 Sekunden**, einschließlich sichtbarem Randwert 0, Fotoeinrichtung, PDF ohne Kundendaten und Reload. Beide Exportbilder geöffnet: 24 Module / 11,04 kWp, Foto und PDF-Aktion auf Desktop und Smartphone vorhanden.
- Zwei reine Testkorrekturen: Dateinamen dürfen entsprechend der bestehenden Formatierung auch eine statt zwei Nachkommastellen haben; der neue Browser-Locator verwendet den vollständigen zugänglichen Feldnamen „Rand cm“. Keine Produktkorrektur dafür erforderlich.
- Dieser Abschnitt dokumentiert den Stand vor dem freigegebenen Push. Die älteren Nicht-Deploy-Aussagen unten gehören zu den jeweiligen historischen Prüfzeitpunkten. CI und Live-Smoke werden anschließend separat geprüft und im lokalen Release-Ergebnis festgehalten.

Für die Live-Nachprüfung kann dieselbe repository-eigene Headless-Prüfung mit `PAGES_SMOKE_URL=https://suedenergie-pv.github.io/pv-belegung/` und `npx playwright test --config=playwright.pages.config.ts` ausgeführt werden. Sie verwendet eine isolierte Browsersitzung und ausschließlich dort erzeugte Testdaten.

## Befehle

```text
npm test
npm run typecheck
npm run build:pages
npm run test:pages
```

Zum manuellen lokalen Öffnen nach bestandenem Build: `npm run preview:pages`, dann `http://127.0.0.1:3188/pv-belegung/`. Der Server bindet ausschließlich Loopback. Ein anderer Port ist über `PAGES_PREVIEW_PORT` möglich. Der Test startet und beendet seinen eigenen Server; auf diesem Port darf deshalb kein anderer Server laufen. Einzelprojekte: `npm run test:pages -- --project=pages-desktop`.

## Isolation und Artefakt

- `scripts/build-pages.mjs` kopiert die Produktionsquellen in den eigenen markierten Ordner `.release/pages/`. Nur dieser Ordner wird vor einem erneuten Build ersetzt. Andere lokale Dateien und Prozesse bleiben erhalten.
- Die vorhandene POST-Route `apps/web/app/api/debug-shot/route.ts` wird ausschließlich beim Kopieren ausgelassen. Sie wird weder gelöscht noch verschoben. Weitere API-Routen würden weiterhin vom Export-Build geprüft und nicht pauschal entfernt.
- App, Engine, Konfiguration und bereits installierte Abhängigkeiten werden für den Build verwendet; keine Installation durch den Build-Runner. Öffentliche Dateien werden nur kopiert, wenn Git sie bereits versioniert. Private QA-Fotos, Dokumentation und lokale Einstellungen gehören nicht zur Quellenliste.
- `.release/pages/manifest.json` enthält den Basepath, SHA-256-Werte der kopierten Quellen und sämtlicher Exportdateien. Der Runner vergleicht außerdem die lokale Debug-Route, `next-env.d.ts` und `.next/BUILD_ID` vor und nach dem Build. Eine parallele Änderung dieser Dateien bricht die Prüfung ab, damit der Nachweis eindeutig bleibt.
- Nur `.release/pages/apps/web/out/` wird als Pages-Artefakt hochgeladen. Manifest, Screenshots, Traces und JSON-Ergebnisse liegen außerhalb davon und sind gitignored.
- Der Staticserver serviert ausschließlich existierende Exportdateien unter `/pv-belegung/`. Es gibt keinen Next-Server und keinen SPA-Fallback, der fehlende Dateien verdecken könnte.

Die Umsetzung folgt den mit Next 16.3.3 gelieferten Guides `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` und `01-app/03-api-reference/05-config/01-next-config-js/basePath.md`: `output: 'export'` erzeugt `out`, POST-Handler sind nicht unterstützt und der Basepath wird beim Build in die Bundles geschrieben.

## CI-Gate

`.github/workflows/pages.yml` führt nach `npm ci` alle Workspace-Unit-Tests, den Typecheck, den isolierten Export und den Headless-Artefakt-Smoke aus. Erst danach kann der Pages-Upload und das abhängige Deploy-Job laufen. Die Pipeline installiert ihren Playwright-Chromium nur im CI-Runner. Lokale Tests nutzen das bereits vorhandene Chrome; es wurden keine lokalen Browser oder Pakete hinzugefügt.

Ein Push auf `main` löst weiterhin Live-Deploy aus. Diese Änderung wurde nicht gepusht; die GitHub-Actions-Ausführung selbst ist noch nicht geprüft.

## Erste lokale Evidenz vor dem UI-Abschluss

- `npm run build:pages`: bestanden, 33 Dateien im ersten statischen Artefakt. Lokale Route und Produktionsbuild unverändert; Root-Lockfile und App-Paketdefinition unverändert.
- `npm run test:pages`: 2 bestanden, Exitcode 0, 40,1 Sekunden. Desktop 1440×900 und Smartphone 375×812. Relative Einstiegsroute, sämtliche initialen JS-/CSS-Assets unter `/pv-belegung`, echte 404 für falschen Basepath/fehlende Dateien/Debug-Route, synthetischer Foto-Upload, Maßbestätigung, Dachecken, automatische Belegung, dekodiertes Exportfoto, echter PDF-Download ohne Kundendaten und gespeicherter Stand nach Reload geprüft. Keine Seitenfehler, fehlgeschlagenen Requests oder HTTP-Fehler im App-Ablauf.
- Das Testfoto wird erst im Browser erzeugt und hochgeladen. Es ist keine private Fixture im Build und kein fest eingebautes Testprojekt.
- Export-Captures `.release/screenshots/pages-desktop-export.png` und `pages-mobil-export.png` tatsächlich geöffnet: Foto und Modulbelegung vorhanden, PDF-Aktion sichtbar; dies ist ein funktionaler Artefaktnachweis, keine Freigabe des noch entstehenden Workbench-Designs.
- `node --check` für alle drei Runner, fokussierter Typecheck für Release-Config/Smoke und `git diff --check` im Release-Scope bestanden.

Zwei Infrastrukturkorrekturen waren nötig: Die isolierte Kopie musste auch bereits installierte Workspace-Abhängigkeiten auflösen. Nexts anfänglicher Installationsversuch wurde sofort abgebrochen; Paketdefinitionen und Lockfile blieben unverändert. Danach hing der erste erfolgreiche Browserlauf in der bekannten Windows-`webServer`-Prozessbereinigung. Der endgültige Runner hält den Staticserver deshalb im eigenen Node-Prozess; der Gegenlauf beendete sich regulär mit Exitcode 0.

## Abschließender Artefaktlauf nach UI-Freeze

Am 01.10.2026 nach dem eingefrorenen Workbench-Stand erneut ausgeführt. Nach den Reviewkorrekturen (äußeres Inspector-Scrollen bei kurzem Querformat, Entfernen eines ungenutzten Icon-Imports und zuletzt die kompakte Leeransicht ohne Foto im kurzen Querformat) wurden Build und beide Smokes nochmals vollständig wiederholt; die folgenden Angaben beschreiben diesen letzten Stand:

- `npm run build:pages`: bestanden. Manifest-Zeit `2026-10-01T10:26:25.803Z` (12:26 Uhr lokal), 62 kopierte Quelldateien, 33 Exportdateien. Der lokale Next-Produktionsbuild, die Debug-Route und `next-env.d.ts` blieben unverändert.
- `npm run test:pages`: **2/2 bestanden, Exitcode 0, 40,2 Sekunden**. Desktop 1440×900 und Smartphone 375×812 jeweils kompletter oben beschriebener Artefaktablauf einschließlich Foto, Belegung, echtem PDF-Download ohne Kundendaten und Reload. Keine Browser-, Request- oder HTTP-Fehler im App-Ablauf.
- Nach dem Smoke sämtliche SHA-256-Werte aus dem Manifest gegen die 62 aktuellen Arbeitsdateien und 33 tatsächlich getesteten Exportdateien abgeglichen: **keine Abweichung**. Dieser Nachweis gilt für genau diesen Quellenstand; spätere Produktänderungen erfordern einen neuen Build und Smoke.
- Die beiden neu erzeugten Export-Screenshots tatsächlich geöffnet: Belegungsfoto mit 24 Modulen, korrespondierende 11,04 kWp in der Zusammenfassung und erreichbare PDF-Aktion auf Desktop und Smartphone. Keine fehlenden Bildressourcen. Die Workbench-Designabnahme erfolgt separat am Editor.

Native iPad-Bedienung und iOS-Speichern bleiben gesonderte Praxisabnahme. Der geänderte GitHub-Actions-Workflow ist lokal vorbereitet, aber noch nicht auf GitHub ausgeführt. Kein Commit, Push oder Live-Deploy wurde ausgeführt.
