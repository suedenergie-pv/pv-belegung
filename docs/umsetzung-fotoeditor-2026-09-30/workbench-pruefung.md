# Workbench: Implementierung und Prüfung am 01.10.2026

## Ergebnis und Scope

Der beauftragte Workbench-Aufbau ist in der echten Anwendung integriert. Projekt/Schritte/Speicherung/Historie stehen im kompakten Kopf. Links sind die beschrifteten Dachwerkzeuge, rechts Dachhierarchie und kontextabhängige Eigenschaften. Das Foto und die Bestätigungs-/Zoomleiste bleiben im Fenster; nur Listen und Eigenschaften scrollen. Smartphone-Hauptaktionen liegen unten. Reales Drohnenfoto, kanonische Moduloptik, Geometrie-Engine und vorhandene Editorhandler bleiben Grundlage.

Plan und fachlicher Vertrag: `workbench-plan.md`, validierter `workbench-exec-plan.json`, entsprechender Zusatz in `SPEC.md`. Nutzerauftrag vom 01.10.: „dann plan es und setz es um“. Kein neuer Marketing-/Conversion-Funnel. Keine neuen Pakete, elektrischen Regeln oder externen Datenquellen. Bestehende uncommittete Arbeit wurde erhalten.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| ExecPlan-Validator | bestanden |
| `npm test` | 135 Engine- und 196 Web-Tests bestanden |
| `npm run typecheck` | beide Workspaces bestanden |
| Allgemeine Browserregression | 43 bestehende Fälle bestanden, sechs Größen von 375×812 bis 1440×900 einschließlich 812×375 und 1023px-Grenze |
| iOS-PDF-Schnittstellen | fünf relevante Fälle bestanden; sieben Durchläufe außerhalb ihrer vorgesehenen Konfiguration übersprungen |
| Fadenkreuz am statischen Pages-Artefakt | acht Fälle bestanden: Chromium und WebKit jeweils 1024×768, 768×1024, 375×812, 812×375 |
| Vierflächen-/Leeransicht | sechs von sechs bestanden, einschließlich vollständig sichtbarem und anklickbarem Foto-Upload |
| Statischer Build und Artefakt-Smoke | nach letzter Leeransicht-Korrektur bestanden; 2/2 Artefakt-Smokes, 62 Quell- und 33 Exporthashes identisch, siehe `pages-release.md` |
| Unabhängiger Code-/Sichtreview | PASS, keine offenen Blocker/Majors im geprüften Scope; siehe `workbench-review.md` |
| `git diff --check` | bestanden |

Die allgemeine Regression wurde mit `npx playwright test editor-interaction.spec.ts audit.spec.ts reliability.spec.ts workbench-layout.spec.ts --grep-invert 'PDF-Dateiübergabe|PDF-Ausgabe' --workers=2` ausgeführt. Der kombinierte erste Lauf enthielt zusätzlich sechs neue Layoutfälle: 47 bestanden, zwei identische subpixelbedingte Sichtbarkeitsfehler im neuen Test bei 1023/1024px. Der gezielte Nachtest `npx playwright test workbench-layout.spec.ts --workers=2 --output=.release/layout-results` bestand anschließend alle sechs. Die Assertion erlaubt maximal 1% Rand an einer Scrollkante und verlangt zusätzlich einen freien Treffer in der Buttonmitte. Nach der späteren visuellen Leeransicht-Korrektur bestanden erneut sechs von sechs Fälle, jetzt mit strengerem Check: Uploadbutton vollständig im Viewport, mindestens 44px hoch und bis an die Unterkante anklickbar.

Die iOS-Schnittstellen liefen mit `--grep 'PDF-Dateiübergabe|PDF-Ausgabe'` auf Desktop, Tablet-Grenze und Mobil-Hoch. Der alte Setuphelper klickte trotz aktiver Touch-Fadenkreuzbedienung ins Foto; er verwendet jetzt Cursorbewegung plus den festen Bestätigungsbutton. Dies ist eine Testvorbereitungskorrektur, keine Änderung der PDF-Implementierung.

Touchlauf: `PV_QA_URL=http://127.0.0.1:3188/pv-belegung/`, `npx playwright test --config=playwright.touch.config.ts --workers=2 --output=.release/touch-results`. Chromium verwendet für Wischbewegungen echte Browser-Touch-Events über CDP. WebKit verwendet synthetische Pointerbewegungen und echte Touch-Taps auf dem Button. Zweifingergesten werden im Test als Pointersequenzen erzeugt. Das belegt keine native iPad-Praxisabnahme.

## Tatsächlich geprüfte Darstellung

Lokale Evidenz unter `.debug-shots/workbench-2026-10-01/`; aktuelle Chromium-/WebKit-Artefaktbilder unter `pages-touch/`. Das private Drohnenfoto bleibt ausschließlich in ignorierten lokalen QA-Dateien und wurde nicht ins Pages-Artefakt aufgenommen.

Erzeugt und betrachtet: Einrichtung, Feldauswahl/Korrektur, direkte Gaube/Umriss-Zugänge, Touch-Aussparung und Gaubenpunkte sowie Mehrflächenzustände. Desktop und Smartphone wurden zusätzlich unabhängig geprüft; Tablet hoch/quer und kurzes Handy-Querformat ebenfalls. Unabhängiger Befund: `workbench-review.md`.

Die acht geprüften neuen Farbpaare liegen zwischen 5,52:1 und 12,36:1 (Haupttext, Nebeninformation, Werkzeugtext, aktives Werkzeug, primäre Aktion, aktiver Schritt, Speichertext und Fußleiste). Sichtbare Bedienelemente und die Punktbestätigung werden im Browser auf mindestens 44px geprüft. Dies ist kein vollständiges WCAG-Zertifikat.

## Korrigierte Befunde

- Direkter Wechsel auf „Foto verschieben“ führt nun durch den Entwurfsschutz; Maßänderungen bleiben bei „Bleiben“ erhalten und werden bei „Übernehmen“ als eine Historienänderung gespeichert. Eigener Regressionstest bestanden.
- Projektauswahl im kurzen Querformat auf mindestens 44px korrigiert.
- Lange Dachlisten können Eigenschaften in schmalen/kurzen Ansichten nicht mehr auf null Höhe verdrängen: der äußere Inspektor scrollt, Foto bleibt fest.
- Auswahlwerkzeug zeigt während noch gesperrter Einrichtung keinen falschen Aktivzustand.
- Gaubenformulare im Inspektor verwenden keine verschachtelten Karten und keine vier gedrängten Eingabespalten.
- Die Next-Entwicklerplakette ist über die dokumentierte Konfiguration deaktiviert, weil sie lokal die Smartphone-Werkzeugleiste verdeckte. Compile-/Laufzeitfehler bleiben sichtbar.
- Leeransicht ohne Foto im kurzen Querformat verkürzt; primärer Foto-Upload wird gesondert gegen Abschneiden geprüft.

Maximal zwei gezielte Korrekturen je betroffener Bedienfehlerklasse; keine ungelösten Fehler werden durch bloß wiederholte Läufe als bestanden erklärt.

## Verbleibende externe Abnahme

Ein echter iPad-Durchlauf mit typischem Dachprojekt einschließlich Speichern/Teilen der PDF fehlt. Der geänderte GitHub-Actions-Workflow ist lokal vorbereitet, wurde aber nicht auf GitHub ausgeführt. Kein Commit, Push oder Deploy. Live-Freigabe steht weiterhin aus.

## Lokale Vorschau

Der geprüfte statische Stand läuft unter `http://127.0.0.1:3188/pv-belegung/` (`npm run preview:pages`). Der temporäre Devserver für die QA wurde beendet. Die Vorschau verwendet echte lokale Projekt-/Fotoeingaben; das private QA-Drohnenfoto ist nicht fest eingebaut.

Abschlussstand: 331 Unit-/Engine-Tests und 64 unterschiedliche Browserfälle im beschriebenen Prüfumfang bestanden (43 Regression, 6 Layout, 5 iOS-PDF-Schnittstelle, 8 Touch, 2 Pages-Smoke). Der letzte isolierte Export nach der Leeransicht-Reparatur hat das Manifest `2026-10-01T10:26:25.803Z`; alle 62 Quellen und 33 Ausgabedateien wurden nach dem Smoke ohne Abweichung abgeglichen. Der unabhängige visuelle Review ist abgeschlossen; es verbleiben die oben genannten externen Abnahmen.

Nachtrag 01.10.2026: Genrih hat anschließend den Deploy ausdrücklich freigegeben und den pauschalen Rand auf 0 cm gesetzt. Für diese Änderung wurden die Tests ergänzt: aktuell 333/333 Unit-/Engine-Tests, Typecheck, erneuter Pages-Build und 2/2 Pages-Smokes bestanden. Die neue Randprüfung ist Teil derselben beiden Browserfälle; keine Doppelzählung. Manifest und Details siehe `pages-release.md`. Native iPad-Prüfung weiterhin offen; die frühere Aussage „Live-Freigabe steht aus“ ist durch die neue Nutzerfreigabe überholt.
