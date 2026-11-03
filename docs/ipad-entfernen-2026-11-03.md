# Dachflächen entfernen: stillen Browserdialog-Abbruch beseitigt

## Befund und Grenze

Gemeldet: zwei angelegte Dachflächen, roter Entfernen-Knopf sichtbar, beim Antippen keinerlei sichtbare Reaktion.

Der bisherige Handler beendet die Aktion sofort, wenn `window.confirm(...)` false liefert. Das geschieht auch, wenn der Browser die native Rückfrage gar nicht anzeigt. Dann sieht der Nutzer weder Bestätigung noch Fehlermeldung. Dieser Fehlerpfad wurde mit dem unveränderten Live-JavaScript reproduziert: Eine ausschließlich im isolierten Testprofil gesetzte CSP `sandbox allow-same-origin allow-scripts allow-downloads` sperrt native Dialoge. Die Pointer-, Touch- und Click-Ereignisse erreichen den sichtbaren Entfernen-Knopf; der unveränderte native confirm-Aufruf liefert false. Es erscheint kein Dialog und beide Flächen bleiben bestehen. Der Live-Server wurde dafür nicht verändert.

Trace: `test-results/dach-touch-live-blocked/dach-touch-Sichtbares-Entf-aed55-ertipp-beide-belegt-direkt--ipad-hoch/trace.zip`. Enthält die Ereignisfolge, `confirm-start` mit aktiver Nutzergeste, `confirm-end: false` und die Browserdiagnose zur fehlenden allow-modals-Freigabe. Kein Mock des Rückgabewerts in diesem Nachweis.

**Diese Browserrichtlinie ist ein reproduzierbarer Auslöser, kein Nachweis der Konfiguration des gemeldeten iPads.** Ohne diese Richtlinie waren im bisherigen Live-Stand zwölf direkte bzw. Browser-Zurück-Fälle in WebKit-Touchemulation erfolgreich. Ein echtes iPad steht in dieser Umgebung nicht zur Verfügung. Die Ursache auf genau dem betroffenen Gerät bleibt deshalb unbestätigt; als behoben gilt der nachgewiesene stille Browserdialog-Abbruch.

Referenz: [HTML-Standard zu confirm](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-confirm-dev), [MDN zu unterdrückten Bestätigungen](https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm).

## Änderung

- Dachflächen- und Gaubenlöschung verwenden jetzt `FlaecheEntfernenDialog`, einen modalen Anwendungsdialog mit Zielnamen, Abbrechen und Entfernen. Keine Abhängigkeit von der Freigabe nativer JavaScript-Dialoge.
- Abbrechen und Escape erhalten die Daten. Bestätigen entfernt Fläche und abhängige Zuordnungen atomar; Fotos, Historie und Schutz der letzten Hauptfläche bleiben erhalten. Nach dem Entfernen erhält die aktive Dachfläche den Fokus.
- Der vorhandene Schutz offener Entwürfe bleibt vorgeschaltet.
- Zusätzlich gefundener Fehler: Mobile CSS blendete die Dachflächenliste bei geöffneten Maßen/Werkzeugen vollständig aus. Die Liste bleibt nun aufklappbar. Das erklärt nicht den ursprünglich gemeldeten sichtbaren, wirkungslosen Knopf, wurde aber im betroffenen Löschablauf ebenfalls korrigiert.

## Erste Prüfung vor dem Abgleich mit dem Live-Stand

- `npx vitest run --root apps/web components/SchrittBelegung.test.tsx`: 34 bestanden.
- `npm run typecheck`: bestanden.
- `npx playwright test --config=playwright.dach-touch.config.ts`: 18 bestanden. WebKit mit iPad-Hochformat, -Querformat und Pro-Querformat; je vorhandene/belegte und neu angelegte Fläche. Normalbetrieb, tatsächlich gesperrte native Browserdialoge und Browser-Zurück. Erster Fingertipp, Abbrechen, Bestätigen, richtige verbleibende Fläche und Speicherung nach Reload.
- Derselbe isolierte Fehlerfall schlug mit dem Live-JavaScript fehl und bestand nach der Änderung lokal ohne Änderung der Fehlervoraussetzung.
- `npm run build:vps`: bestanden. Nur lokaler statischer Export; Manifest `.release/vps/manifest.json` vom 03.11.2026, 12:05:40 UTC.
- Sechs Löschfälle mit gesperrten nativen Dialogen gegen diesen statischen Export: bestanden (`test-results/dach-touch-release`).
- `npx playwright test --config=playwright.dach-pdf.config.ts --grep 'Dach direkt|Dachflächen bleiben'` gegen den statischen Export: zehn bestanden. Desktop, Tablet hoch/quer, Smartphone hoch/quer; Gauben, Fotos, Stringbereinigung, Entwurfsschutz, Abbruch, Undo/Redo und Erreichbarkeit der Liste (`test-results/dach-loeschen-release`).
- Gerenderte Bestätigungen auf Desktop, Tablet und Smartphone geöffnet: Zielname, Text und beide Aktionen vollständig sichtbar. Keine native iPad-Abnahme oder Verständlichkeitsstudie behauptet.

Evidenz: `test-results/dach-touch-final`, `test-results/dach-touch-release`, `.debug-shots/dach-loeschen-bestaetigung`, `.debug-shots/dach-loeschen-release`.

## Finale Releasevorbereitung nach Nutzerauftrag „deploy“

Die SSH-Vorprüfung fand entgegen dem alten lokalen Releasebericht den neueren aktiven Stand `/var/www/belegung/releases/20261027-fuenf-dachseiten`. **Das erste Paket auf Basis 06ed2b6 wurde verworfen und nicht übertragen.** Es hätte neuere Funktionen zurückgesetzt.

Finale Basis ist `origin/main` / `f93d73372c3a8d0515aa1acb697cb9f4b1766322`. Der isolierte Worktree liegt unter `C:/Users/Genrih-PC/Desktop/Projekte/Worktrees/pv-belegung/ipad-entfernen-20261103`, Branch `codex/ipad-entfernen-20261103`. Nur der Löschfix wurde übernommen; neuere Dachrand-, Gauben-, Feldabstands-, Süd- und Foto-Maßfunktionen sowie der dortige PDF-/Engine-Stand bleiben erhalten. Bestehende Nutzeränderungen im ursprünglichen Checkout wurden nicht angefasst.

- Finale Tests: 1.474 Engine- und 1.340 Webtests bestanden; Typprüfung und VPS-Build bestanden.
- Auf dem finalen statischen Export: 18 WebKit-Touchfälle und zwei Desktop-/Mobil-Produktionssmokes einschließlich PDF und Reload bestanden.
- Zwei alte Testlocators an die bereits vorhandene neue Oberfläche angepasst: „Traufe“ als spinbutton zu „Breite unten“ als textbox, Werkzeug „Umriss“ zu „Dachrand“. Keine Produktänderung und keine gelockerte Assertion dafür. Der erste fehlgeschlagene Altlocator-Lauf zählt nicht als bestanden.
- Manifest `.release/vps/manifest.json` vom 03.11.2026, 12:22:00 UTC; 89 Quellen und 33 Exportdateien.
- Finales Archiv `.release/20261103-ipad-entfernen.tar.gz`, SHA-256 `779771b1baf9eddb7628f696f8976dcc9c79d84d19f23d98bc3a19ec11a7c9b7`.
- Index SHA-256 `ee0fcb1d7a3efe11670fad9e8d891cda23df4e0294b163591d78fc16567e3319`.
- Aktivierungsskript nur LF-normalisiert, SHA-256 `2ef167f3aeab06ec2e07e7625562d5a63e3a6120d39be8c764d3f873049d1bde`.
- Unabhängiger Code-/Artefaktabgleich: aktuelle Quellen, Stage, Export und Archiv vollständig hashgleich; keine privaten Fotos oder lokalen Konfigurationen enthalten.

Finale Evidenz liegt im neuen Worktree: `test-results/ipad-release-final`, `test-results/dach-release-final`, `test-results/ipad-release-smoke`, `.debug-shots/ipad-release-final` und `.release/ipad-entfernen-release-review.md`.


## Veröffentlichung

Nach ausdrücklichem Nutzerauftrag produktiv als `20261103-ipad-entfernen` aktiviert. Produktcommit `e6aa1cb`. Alle 33 öffentlich ausgelieferten Dateien hashgleich zum endgültigen Paket; bisheriger Release `20261027-fuenf-dachseiten` bleibt als Rollback erhalten. Zehn finale Löschregressionen auf dem lokalen Produktionsbuild bestanden. Aktivierung mit dem unveränderten geprüften Skript einschließlich serverseitiger HTTPS-/Indexprüfung erfolgreich.

Direkt auf der öffentlichen VPS-Domain: 18/18 Touch-Löschfälle und 2/2 Produktionssmokes bestanden. Live-Dialog und Mobilansicht geöffnet. Evidenz `test-results/ipad-live`, `test-results/ipad-live-smoke` und `.release/ipad-entfernen-live-hashes.json`. Keine native iPad-Praxisabnahme behauptet.

Der zusätzliche Push auf main wurde durch die automatische Freigabeprüfung abgelehnt (VPS-Deploy autorisiert, Default-Branch-Push mit möglicher Pages-Auslösung nicht ausdrücklich freigegeben). Kein Push erfolgt. Fix und Nachweis lokal committet; produktiver VPS-Deploy abgeschlossen.
