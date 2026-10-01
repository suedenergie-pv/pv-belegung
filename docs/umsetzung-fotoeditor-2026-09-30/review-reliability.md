# Unabhängiger Review: Verlässlichkeit des Fotoeditors

Stand: 30.09.2026. Reviewer: `reliability_review`, getrennt von den Implementierungsautoren.

## Umfang und Ergebnis

Geprüft wurde Paket 1: projektweite Sitzungshistorie, Gruppierung von Eingaben und Halteaktionen, Fotoreferenzen, Maßstatus und Migration, sichere Geometrieentwürfe, Navigationsschutz, Speicher- und Übergabetexte, Kontrastkorrekturen, Modulkarten und Exportvorschau.

Die sechs im Review gefundenen Fehler sind nach zwei Reparaturrunden geschlossen. Im begrenzten Nachprüfungsumfang bestehen keine bekannten offenen Blocker oder Major-Befunde. Dies ist keine Freigabe des gesamten Fotoeditor-Umbaus oder eines Live-Deploys: Gemeinsamer Editor und neue Touchansicht warten weiterhin auf die konkrete Entwurfsfreigabe.

## Befunde und Reparaturen

| ID | Schwere | Befund und Reproduktion | Reparatur und Nachweis | Status |
| --- | --- | --- | --- | --- |
| R1 | Major | Ein vollständiger alter Flächensnapshot aus `FlaechenInlineEditor.tsx` überschrieb Änderungen, die während eines offenen Maßentwurfs an Feldern, Fotokalibrierungen oder Hindernissen vorgenommen wurden. Ablauf: Maße ändern, danach Foto/Feld ändern, danach Maße übernehmen. | `lib/geometrie-entwurf.ts` überträgt ausschließlich geänderte Parameter auf den aktuellen Flächenstand. Vorschau und Übernahme verwenden dieselbe Funktion. Tests erhalten neue Fotozuordnungen, verschobene Felder, Zelllöcher und Hindernisse; Formwechsel invalidieren ausdrücklich die aktuellen Kalibrierungen. | Geschlossen, Runde 1 |
| R2 | Major | Migrierte Gauben ohne Belegungsfelder erhielten `offen`, konnten diesen Status aber nicht verlassen: Der allgemeine Maßeditor schließt Gauben aus, und `aendereGaubenMasse` bestätigte den Status nicht. | Der explizite Gauben-Maßcommit bestätigt ausschließlich die gewählte gültige Seite. Schätzung und Messquelle bleiben getrennt; Nachbarseiten werden nicht stillschweigend bestätigt oder umetikettiert. Regression in `SchrittBelegung.test.tsx` deckt die offene Bestandsgaube ab. | Geschlossen, Runde 1 |
| R3 | Minor | Die Foto-Erfolgsmeldung behauptete eine lokale Speicherung vor Abschluss des asynchronen Speicherpfads und konnte neben einem Speicherfehler stehen bleiben. | Meldung lautet nun „Foto wurde verarbeitet und dem Projekt hinzugefügt.“ Der tatsächliche Speicherstatus bleibt Aufgabe der zentralen Anzeige. Produktionspfad in `SchrittBelegung.tsx` geprüft. | Geschlossen, Runde 1 |
| R4 | Minor | Der Foto-Maßvorschlag wurde an einen neuen optionalen Callback gebunden, den kein Produktionsaufruf übergab. Damit verschwand die vorhandene Aktion. | `SchrittBelegung.tsx` übergibt `onMassVorschlag` für Hauptflächen an `FotoHintergrund` und reicht den Vorschlag an `FlaechenInlineEditor` weiter. Der Vorschlag öffnet einen sicheren Entwurf und verändert den gespeicherten Plan erst nach Übernahme. | Geschlossen, Runde 1 |
| R5 | Minor | Weiß auf `emerald-600` erreichte nur 3,77:1; kleine `slate-500`-Texte auf ausgewählter Modulkarte etwa 4,41:1. | Die beanstandeten aktiven grünen Aktionen verwenden `emerald-700`, die kleinen aktiven Kartentexte `slate-600`. Die neue Akzentfarbe selbst erreicht gegenüber Weiß etwa 5,64:1. Code und Farbwerte geprüft. | Geschlossen, Runde 1 |
| R6 | Major | Nach R2 konnte eine geleerte Gaubenbreite trotz sichtbarem Eingabefehler bestätigt werden: `ZahlenEingabe` hielt den letzten gültigen State, der neue Maßcommit bestätigte diesen alten Wert. | `GaubenMassEditor` prüft vor `onSpeichern` die aktuell gerenderten ungültigen Felder und fokussiert das erste fehlerhafte Feld. Integrationstest leert die Breite, bestätigt den unveränderten Status `offen`, korrigiert auf 3 m und prüft danach `bestaetigt`, unveränderte Schätzqualität und unveränderte Nachbarseite. | Geschlossen, Runde 2 |

## Selbst ausgeführte Prüfungen

Abschließender fokussierter Testlauf:

```text
npm run test -w web -- components/SchrittBelegung.test.tsx lib/geometrie-entwurf.test.ts components/FlaechenInlineEditor.test.tsx components/GaubenEditor.test.tsx
```

Ergebnis: 4 Testdateien, 23 Tests bestanden, Exitcode 0. Darunter 11 Belegungs-, 7 Inlineeditor-, 3 Geometrieentwurfs- und 2 Gaubeneditor-Tests. Der Reviewer hat die Implementierung und die relevanten Testbehauptungen gelesen. Im ersten Review bestand zusätzlich `git diff --check`.

## Grenzen

- Dieser Reviewer hat keine produktiven Dateien geändert; einzig dieses Reviewprotokoll wurde auf ausdrücklichen Auftrag erstellt.
- Die eigene Prüfung besteht aus Codeprüfung, berechneten Kontrastwerten und fokussierten Vitest-Läufen. Keine eigene Browserreproduktion oder Screenshotprüfung in diesem Review.
- Der Hauptagent meldet 29 bestandene Playwright-Fälle über vier Ansichten, 11 bedingte iOS-Skips sowie einen zusätzlichen Navigationsfall über fünf Ansichten. Diese Resultate wurden hier nicht unabhängig erneut ausgeführt und ersetzen keine native iPad-Prüfung.
- Kein vollständiger Accessibility-Konformitätsnachweis; die Kontrastnachprüfung betrifft die konkret beanstandeten Stellen.
- Der gemeinsame Editor, dessen neue Gesten und die abschließende Praxisabnahme auf einem echten iPad sind nicht Bestandteil dieser Paketfreigabe. Daraus folgt keine Freigabe für Push oder Deploy.
