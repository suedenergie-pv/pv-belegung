# Verlässlichkeit – Umsetzung und Prüfnachweis

Stand 30.09.2026. Das Verlässlichkeitspaket ist lokal umgesetzt und geprüft. Der gemeinsame Editor und seine neuen Gesten sind noch nicht implementiert; sie hängen von der vorgesehenen konkreten Entwurfsfreigabe ab. Es gab keinen Push oder Deploy.

## Vorhandenes Verhalten

- Zentrale Sitzungshistorie: 20 Änderungen je Projekt, vollständige Projektstände ohne Kopieren unveränderter Fotos, Undo/Redo über Schritte und Projektwechsel. Abgeschlossene Eingaben und gehaltene Pfeilaktionen sind jeweils gruppiert.
- Separater Maßstatus mit Bestandsmigration, gemeinsamer Belegungs-/Export-/PDF-Freigabe und neutraler ungeprüfter Foto-Plausibilität.
- Maß- und Formänderungen als Entwurf mit Modulzahlvergleich, Übernehmen/Abbrechen und Navigationsdialog. Foto-Maßvorschläge öffnen ebenfalls einen Entwurf. Jüngere Feld-/Fotoänderungen gehen beim Übernehmen nicht verloren.
- Gaubenbestätigung erhält Schätzqualität und Nachbarseiten. Ungültige sichtbare Eingaben dürfen keine alten internen Zahlen bestätigen.
- Speicherstatus auch auf kleinen Geräten, ehrliche lokale PL-Markierung, lesbarere Aktionsfarben und Hinweistexte. Modulkarten mit kanonischer Optik und technischen Angaben auf Abruf.
- Sichtbare Exportfotografie mit demselben Renderer wie die PDF; iOS-Speicheraufruf und PDF ohne Kundendaten bleiben erhalten.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| ExecPlan-Validator | gültig, keine Fehler |
| Ausgangsstand `npm test` | 135 Engine- und 108 Web-Tests bestanden |
| Abschließendes `npm test` | 135 Engine- und 157 Web-Tests bestanden |
| `npm run typecheck` | bestanden; abschließender Produktionsbuild prüfte TypeScript erneut |
| `npm run build` | bestanden; regulärer Next-Produktionsbuild, keine Veröffentlichung |
| `git diff --check` | bestanden; nur Hinweise zu LF/CRLF |
| Bestehende Playwright-Suite | 29 bestanden, 11 bedingt übersprungen, Exitcode 0 |
| Neuer Playwright-Fall `reliability.spec.ts` | bestanden; läuft intern über alle fünf Zielgrößen, Exitcode 0 |
| Unabhängiger Code-Review | sechs Befunde in zwei Reparaturrunden geschlossen; 23 Tests vom Reviewer selbst ausgeführt |

Die bestehende Browser-Suite durchlief 1440×900, 1023×768 (bestehende Breakpoint-Grenzprüfung), 375×812 und 812×375. Die 11 Skips betreffen absichtlich nur auf passenden Testprojekten laufende iOS-/Downloadzweige. Sie bedeuten keinen Nachweis einer nativen Geräteprüfung. Die expliziten iOS-Schnittstellen- und User-Agent-Fälle wurden in ihren vorgesehenen Projekten ausgeführt.

Der neue Fall prüft 1440×900, 1024×768, 768×1024, 375×812 und 812×375 mit Touchfähigkeit bei den kleinen Kontexten. Er verifiziert Maßbestätigung, Navigation mit Entwurf, Abbruch ungültiger Übernahme, Undo/Redo nach Export und Projektwechsel, sichtbaren Speicherstatus, PL-Markierung sowie fehlenden horizontalen Überlauf und JavaScript-Seitenfehler. Das ist Touch-Emulation, kein reales iPad.

Der erste Desktop-Suitelauf bestand alle sieben anwendbaren Fälle, hing aber bei der automatischen Serverbereinigung und wurde beendet. Der Nachweis oben stammt aus dem späteren regulär beendeten Gesamtlauf: Next lief als eigener, anschließend beendeter Prozess. Ein neuer Testselektor wurde wegen des zusätzlichen Next-Routen-Alerts präzisiert; der gesamte neue Fünf-Größen-Fall bestand danach.

## Gerenderte Evidenz

`.debug-shots/fotoeditor-verlaesslichkeit-2026-09-30/` enthält pro Zielbreite Projektansicht, offenen Navigationsdialog und PL-Markierung; `messungen.json` enthält die fünf Größen und Fehler-/Overflow-Ergebnisse. Tatsächlich betrachtet: 1440-Projekt/Dialog, 375-Projekt/Dialog, 768-Projekt, 812-Exportmarkierung. Zusätzlich tatsächlich betrachtet: `.debug-shots/export-nackt-desktop.png` und `export-nackt-mobil-hoch.png` mit 24 Modulen / 11,04 kWp und ohne Bearbeitungsmarkierungen. Testfotos sind synthetisch und ausschließlich lokale Fixtures.

## Noch im Gesamtauftrag offen

Konkrete Entwurfsfreigabe und anschließende Integration des gemeinsamen Editors; aktive Foto-/Flächenwahl und Sitzungs-Viewport; neue Ein-/Zweifingergesten, Zweipunkt-Zeichnen und sichere Koordinatenrückrechnung; vollständige durchgängige Einrichtung und kontextabhängige Werkzeuge; abschließende Editor-Regression, unabhängiger UX-Review und native iPad-Praxisabnahme. Die jetzigen Tests ersetzen diese späteren Prüfungen nicht.

Vorhandene fremde Änderungen (`apps/web/next-env.d.ts`, unversionierte lokale Agent-/Claude-Dateien und `test-results/`) wurden erhalten. Das Engine-Paket hat keinen Diff.
