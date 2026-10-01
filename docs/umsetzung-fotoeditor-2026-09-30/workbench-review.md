# Unabhängiger Workbench-Review – 01.10.2026

## Urteil

**PASS für den geprüften Workbench-Umbau. Keine offenen Blocker oder Majors im unten beschriebenen Prüfbereich.** Die während dieses Reviews gefundenen konkreten Funktions- und Layoutfehler sind behoben und nachgeprüft. Das Urteil ersetzt weder die native iPad-Praxisabnahme noch einen erfolgreichen abschließenden Build/Smoke des exakt auszuliefernden Stands.

Der Reviewer war nicht am Produktcode beteiligt. Er hat ausschließlich diese Reviewdatei geschrieben. Die Browserläufe wurden vom Implementierer mit der repository-eigenen Headless-Automation ausgeführt; um konkurrierende Läufe zu vermeiden, hat der Reviewer keine eigenen Browser oder Tests gestartet. Sourcecode, neue Screenshotdateien und die hinzugefügten Regressionstests wurden unabhängig gelesen. Vom Implementierer gemeldete Testergebnisse sind unten ausdrücklich so bezeichnet.

## Vertrag und Umfang

Gelesen wurden `workbench-plan.md`, `workbench-exec-plan.json`, der aktuelle SPEC-Zusatz und die unmittelbar betroffenen Implementierungen: `page.tsx`, `globals.css`, `SchrittBelegung.tsx`, `FotoEditor.module.css`, `EditorViewport.module.css`, `WorkbenchIcon.tsx`, die zugehörigen Navigations-/Layoutregressionen sowie `next.config.mjs`.

Zusätzlich geprüft wurden `scripts/build-pages.mjs`, `scripts/serve-pages.mjs`, `scripts/test-pages.mjs`, `scripts/pages-smoke.spec.ts`, `playwright.pages.config.ts`, Paketdefinitionen und `.github/workflows/pages.yml`.

Maßstab ist die ausdrücklich beauftragte interne Tool-Workbench: großes echtes Foto, beschriftete Werkzeuge, getrennte Dachhierarchie/Eigenschaften, feste Punktbestätigung, erreichbare mobile Bedienung und unveränderter Entwurfsschutz. Die Richtung wurde nicht neu zur Diskussion gestellt. Frühere Reviews des abgelehnten Editorlayouts zählen nicht als visuelle Evidenz dieser Revision.

## Befunde und Nachprüfung

| Befund | Reproduktion / Auswirkung | Korrektur und Nachprüfung | Stand |
|---|---|---|---|
| Major: direkter Wechsel zu „Foto verschieben“ umging den Entwurfsschutz | Dachdetails öffnen, Traufe ändern, direkt „Foto verschieben“ wählen. Der bisherige Handler schloss das Formular ohne `navigation.weiter`; ungespeicherte Eingaben konnten verschwinden. | Beide Pan-Einstiege verwenden jetzt `navigation.weiter`. Der neue Test in `app/page.test.tsx` prüft Bleiben, anschließendes Übernehmen, gespeicherten Wert und genau einen Undo-Eintrag. Aktuellen Handler und Test gelesen; Implementierer meldet 8/8 App-Tests bestanden. | Geschlossen, Reparaturrunde 1 |
| Major: Projektauswahl im kurzen Querformat nur 30px hoch | 812×375 aktivierte die 30px-Sonderregel für das Projektselect und unterschritt die vereinbarten 44px. | Select jetzt 44px, Header mit 58px Gesamthöhe. CSS gelesen; aktuelle Chromium-/WebKit-Querformatbilder zeigen das vollständige Bedienelement. | Geschlossen, Reparaturrunde 1 |
| Minor: deaktiviertes „Auswählen“ erschien während der Einrichtung aktiv | Bei noch nicht belegbarer Fläche erfüllte der Defaultmodus die aktive Markierung, obwohl das Werkzeug gesperrt war. | `aria-pressed` zusätzlich an `belegungZeigen` gebunden. Im aktuellen Sourcecode und in den neu betrachteten Pages-Touch-Aufnahmen ist die falsche aktive Markierung weg. | Geschlossen |
| Code-Risiko: geöffnete Mehrflächenliste verdrängte Eigenschaften in schmalen Inspektoren | Der feste Hierarchiebereich konnte den verfügbaren Inspektorplatz aufbrauchen; die anfängliche äußere Scrollkorrektur erfasste das kurze Querformat noch nicht. Vor dem Fix wurde dafür kein eigenständiger Browser-Repro ausgeführt. | Äußeres Inspector-Scrollen gilt jetzt auch für kurzes Querformat; Eigenschaften schrumpfen dort nicht auf Höhe 0. Vierflächen-Captures auf Desktop, Tablet und beiden Smartphone-Orientierungen geprüft. Der gelesene Test schützt außerdem unveränderte Canvas-Abmessungen, freie Anklickbarkeit und ausbleibenden Seitenscroll. Implementierer meldet abschließend 6/6 bestanden. | Geschlossen |
| Major: primärer Foto-Upload in der leeren Querformatansicht abgeschnitten | `mobil-quer-mehrere-flaechen.png` vor der letzten Korrektur zeigte oben eine abgeschnittene Überschrift und unten einen teilweise von der Zoomleiste verdeckten Uploadbutton; sichtbar waren nur ungefähr 33px des Buttons. | Kompakte Leeransicht mit kleinerer Überschrift, reduziertem Abstand und nicht schrumpfbarem 44px-Button. Das neue Bild vom 01.10.2026, 12:25 Uhr zeigt Überschrift und Button vollständig. Zusätzlichen Test auf 100% Sichtbarkeit, Höhe ≥44px und freien Treffer 2px vor der Unterkante gelesen. Implementierer meldet Gegenlauf 6/6 bestanden. | Geschlossen, Reparaturrunde 1 |

Die letzte Korrektur betrifft ausschließlich die leere Canvas-Ansicht im kurzen Querformat. Die fotografischen Arbeitszustände behalten ihre zuvor betrachtete Anordnung.

## Tatsächlich betrachtete Render

Alle folgenden Dateien liegen lokal unter `.debug-shots/workbench-2026-10-01/`. Es wurden die Bilder selbst geöffnet, nicht nur Dateinamen oder Prüfergebnisse gelesen.

- **Desktop 1440×900:** Einrichtung sowie neu gerenderte Korrektur und direkte Gaubenansicht (`desktop-einrichtung-viewport.png`, `desktop-korrektur-viewport.png`, `desktop-gauben-direkt-viewport.png`). Die Korrektur-/Gaubenfassungen von 12:16 Uhr wurden nach den ersten Reparaturen erneut betrachtet. Zusätzlich `desktop-mehrere-flaechen.png`.
- **Tablet quer 1024×768:** Chromium-/WebKit-Aussparungsansichten, `tablet-quer-mehrere-flaechen.png`; zusätzlich `pages-touch/chromium-tablet-quer-aussparung.png` am statischen Artefakt.
- **Tablet-Grenze 1023×768:** `tablet-grenze-mehrere-flaechen.png`, Fassung von 12:24 Uhr.
- **Tablet hoch 768×1024:** Chromium-Aussparung und -Gaube, WebKit-Gaube, `tablet-hoch-mehrere-flaechen.png`; zusätzlich `pages-touch/webkit-tablet-hoch-gaube.png`.
- **Smartphone hoch 375×812:** Chromium-/WebKit-Aussparung, die neu gerenderten Korrektur-/Gaubenansichten von 12:22 Uhr, `mobil-hoch-mehrere-flaechen.png` nochmals nach dem letzten Gegenlauf und `pages-touch/chromium-mobil-gaube.png`.
- **Smartphone quer 812×375:** Chromium-Aussparung und -Gaube, WebKit-Gaube, `pages-touch/webkit-mobil-quer-aussparung.png`; `mobil-quer-mehrere-flaechen.png` vor und nach der Leeransicht-Reparatur, zuletzt Fassung von 12:25 Uhr.

In diesen Aufnahmen bleibt die Bildfläche bei geöffneten Werkzeugoptionen sichtbar. Werkzeuge sind beschriftet; aktive Zustände und die tatsächlichen Warnungen sind unterscheidbar. Die Punktbestätigung liegt außerhalb des Fotos an einer festen Stelle. Die lange Gaubenbedienung ist im Inspektor scrollbar, während Foto und Hauptwerkzeuge stehen bleiben. Die Mehrflächenliste verhindert nach der Reparatur weder die Maßbestätigung noch den Einstieg über Foto-Upload. Das Smartphone-Layout ist deutlich dichter als Desktop, zeigt aber keine ungelöste Überdeckung der geprüften Hauptaktionen.

## Release-Code und Nachweisgrenze

Im geprüften Release-Code wurde kein konkreter Blocker oder Major gefunden:

- Der Build arbeitet in einer markierten, auf ihren realen Pfad geprüften Kopie. Die lokale Debug-Route wird nur aus der Kopie ausgeschlossen; private Foto-/QA-Verzeichnisse gehören nicht zur Quellenliste. Öffentliche Assets werden aus der Git-Dateiliste übernommen.
- Der statische Server bindet Loopback, bedient den richtigen Basepath und verdeckt fehlende Dateien nicht durch einen SPA-Fallback.
- Der Smoke prüft Einstieg und Assets unter `/pv-belegung/`, echte 404-Fälle, Foto-Upload, Maßfreigabe, Belegung, dekodiertes Exportbild, einen echten PDF-Download ohne Kundendaten und Reload. Das ist ein nachvollziehbarer Test des ausgelieferten Artefakts.
- Der CI-Deploy hängt von Unit-Tests, Typecheck, isoliertem Build und Artefakt-Smoke ab. Der geänderte GitHub-Workflow selbst wurde in diesem Review nicht auf GitHub ausgeführt.

Das Manifest von `2026-10-01T10:16:42.871Z` wurde vom Reviewer selbst gegen alle 62 damaligen Arbeitsdateien gehasht: keine Abweichung. **Dieser Vergleich liegt vor der abschließenden Leeransicht-CSS-Korrektur und ist deshalb kein Release-Nachweis des endgültigen Stands.** Der Implementierer hat den erneuten isolierten Build/Smoke für diese letzte Änderung gestartet. Dessen finales Ergebnis und Manifest gehören in die Release-Evidenz; dieses Review behauptet keinen noch ausstehenden Lauf als bestanden.

## Offene Grenzen

- Native Bedienung auf einem echten iPad einschließlich realem iOS-Speichern bleibt offen. Chromium-/WebKit-Touchemulation ist gesonderte Evidenz.
- Dieses Urteil gilt für den beschriebenen Code und die tatsächlich betrachteten Zustände. Es ist keine pauschale Prüfung sämtlicher möglichen Projekt-, Foto- oder Browserkombinationen.
- Keine erneute Engine-Prüfung durch diesen Reviewer, keine elektrische Fachänderung bewertet.
- Kein Commit, Push oder Deploy durch den Reviewer. Die finale Releaseprüfung bleibt an den aktuellen Quellstand gebunden.
