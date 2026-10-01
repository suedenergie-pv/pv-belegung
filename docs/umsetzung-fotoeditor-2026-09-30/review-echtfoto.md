# Unabhängiger Review: reduzierter Editor mit echtem Foto

Stand: 30.09.2026. Review-only; keine Änderung an Oberfläche oder Produktionscode.

**PASS im geprüften Ansichtsumfang nach gezielter Nachprüfung; alle drei Befunde geschlossen.** Das reale Dach ist der dominante Inhalt. Im Grundzustand konkurriert keine Seitenleiste mit ihm; Auswahl, Einrichtung und Korrektur öffnen einen klar abgegrenzten Kontext. Auf Tablet quer bleiben Foto, Eingaben und Fertig/Abbrechen/Übernehmen gleichzeitig sichtbar. Die reduzierte Richtung kann zur konkreten Nutzerentscheidung vorgelegt werden. Das ist keine Freigabe des vollständigen Editorablaufs, seiner Funktionen oder der Produktionsintegration.

## Priorisierte Befunde

1. **ER-01 · Major · geschlossen — Beispielkennzeichnung an allen Breakpoints.** Ursprünglich fehlte sie auf Tablet hoch und Smartphone quer, insbesondere bei den Werten 24,00 m / 11,00 m. Erneut betrachtet: `placement-tablet-hoch.png`, `placement-mobil-quer.png`, `correction-mobil-quer.png` und alle fünf `actions-*.png`. Die Fußzeile zeigt jetzt stets „Beispielwerte · Maße unbestätigt“, auch neben dem Korrekturpanel und bei geöffnetem Menü. Das reale Foto und die illustrative Belegung werden damit im geprüften Ansichtsumfang unterscheidbar.

2. **ER-02 · Major · im Ansichtsprototyp geschlossen — notwendige Belegungsaktionen erreichbar.** Alle fünf `actions-*.png` zeigen im Mehr-Menü „Alle Felder auswählen“ und „Module aus-/einblenden“. Beide Einträge sind auch auf Smartphone quer vollständig sichtbar; das Menü ist für weitere Inhalte scrollbar. Ergänzende Quellprüfung von `pop()`, `details()` und dem Klickhandler bestätigt den Zweifelder-Kontext mit „2 Felder drehen“/„2 Felder löschen“ sowie den ausdrücklich als Ansichtsbeispiel bezeichneten Hinweis zum einzelnen Antippen von Modulen. `qa-actions.json` und der gelesene Prüfer dokumentieren die vom Erzeuger ausgeführten Klickprüfungen in fünf Größen. Die echte Modulschaltung und Mehrfachbearbeitung sind weiterhin nicht funktional abgenommen.

3. **ER-03 · Minor · geschlossen — alle vier Auswahlgriffe sichtbar.** Das neue `placement-field-mobil-hoch.png` zeigt das gesamte ausgewählte Feld mit Abstand zur oberen Werkzeugleiste und zum unteren Panel. Alle vier Griffe liegen frei; das Foto-Label wird in diesem Zustand ausgeblendet. Auch `placement-field-tablet-quer.png` erneut geprüft: unverändert freie Auswahlkante und sichtbarer Fertig-Knopf. Dies belegt die sichtbare Einpassung, nicht die spätere Touch- oder Resize-Funktion.

## Sichtung und Abnahmegrenze

Erste Prüfung mit `view_image`: alle 20 PNGs unter `.debug-shots/fotoeditor-echtfoto-2026-09-30/`: `placement`, `placement-field`, `setup`, `correction`, jeweils Desktop 1440×900, Tablet quer 1024×768, Tablet hoch 768×1024, Smartphone hoch 375×812 und Smartphone quer 812×375. Zusätzlich SPEC-Ergänzung vom 30.09., bisherige Richtungs-/Auswahldokumentation sowie Prototyp-Markup, Styles und Renderprüfer gelesen.

Nach der gezielten Reparatur **zehn aktuelle Aufnahmen erneut beziehungsweise erstmals geöffnet**: alle fünf `actions-*.png`, `placement-tablet-hoch.png`, `placement-mobil-quer.png`, `correction-mobil-quer.png`, `placement-field-mobil-hoch.png` und `placement-field-tablet-quer.png`. Keine zweite vollständige Bildsichtung der übrigen Hauptmatrix behauptet. Quellprüfung auf die drei Befundklassen begrenzt; keine neue Designrunde und keine UI-Änderungen durch den Reviewer.

Nach der abschließenden Entfernung der doppelten mittleren Fußnote zusätzlich `placement-tablet-quer.png` und `placement-desktop.png` erneut geöffnet: nur der dauerhaft sichtbare linke Beispielhinweis bleibt. Keine Änderung am Befundabschluss.

Die festen Abschlussleisten bleiben in den betrachteten Zuständen sichtbar. Tablet hoch und Smartphone benötigen jedoch internes Panel-Scrolling für weitere Feldaktionen beziehungsweise den Vorher/Nachher-Vergleich; deren Erreichbarkeit ist hier nur aus `overflow:auto` im Quelltext belegt, nicht durch einen eigenen Klicktest. Die Auswahlkante bleibt auf Tablet quer frei. Ein großer neutraler Rand bei Tablet hoch entsteht durch das vollständige Einpassen des breiten Fotos und ist für diese Übersicht kein eigenständiger Major.

Keine eigenen Browser-, Gesten-, Engine- oder iPad-Tests. Die vom Erzeuger berichteten technischen Prüfungen werden nicht als eigene Prüfung ausgegeben; das PASS beruht auf der benannten Bildsichtung und gilt nur für den Ansichtsumfang. Das Foto ist real, die Modulpositionen, Stückzahlen, kWp und Korrekturwerte sind illustrative Beispieldaten. Perspektive, Aufmaß, vollständige Einrichtung, Mehrflächen-/Gaubenarbeit, Speicherung und Export sind durch diese Ansichten nicht nachgewiesen. Konkrete Nutzerfreigabe bleibt erforderlich. Keine Produktions- oder Funktionsfreigabe, kein Push und kein Deploy.
