# Unabhängiger Strukturreview der Editorentwürfe

Stand: 30.09.2026, erste Prüfung vor Reparatur. Reviewer: `structure`, unabhängig vom Erzeuger. Grundlage: freigegebener Nutzerplan, Ergänzung in SPEC.md vom 30.09.2026, frontend-quality-gate und visual-review.

**Ergebnis: Reparatur erforderlich. Rangfolge A → B → C.** A stellt den Fotoarbeitsplatz, die Dachhierarchie und die jeweils anstehende Aufgabe auf dem Hauptgerät am überzeugendsten zusammen. Keine Produktionsfreigabe: Die unten genannten Majors sind vor der konkreten Entwurfsfreigabe zu beheben. Die Prüfung betrifft sichtbare Struktur und prototypische Bedienzustände; sie beweist weder korrekte Geometrie noch native iPad-Bedienung.

## Tatsächlich gesichtete Evidenz

33 Bilder unter `.debug-shots/fotoeditor-entwuerfe-2026-09-30/` mit `view_image` geöffnet und beurteilt:

- A, B, C × Einrichtung, Belegung, Korrektur × Desktop 1440×900, Tablet quer 1024×768, Smartphone hoch 375×812: 27 Bilder.
- A, B, C × Korrektur × Smartphone quer 812×375: drei Bilder.
- A, B, C × Einrichtung × Tablet hoch 768×1024: drei Bilder.

Ergänzend wurde die tatsächliche Werkzeugfreigabe im Prototypquelltext geprüft. Die Dachillustration und Beispielzahlen sind ausdrücklich als Entwurfsdarstellung gekennzeichnet und bei allen Richtungen identisch; sie wurden nicht als Echtdaten oder als visueller Mangel gewertet. Automatische Overflow- und Touchzielmetriken wurden nicht als visuelle Freigabe übernommen.

## Priorisierte Befunde

| ID | Gewicht | Kandidat / Zustand / Ansicht | Sichtbarer Befund und Wirkung | Konkrete Reparatur |
|---|---|---|---|---|
| S1 | Major | C / Einrichtung und Korrektur / Tablet quer | In `C-setup-tablet-quer.png` ist „Maße übernehmen“ unter der sichtbaren linken Leiste verschwunden. In `C-correction-tablet-quer.png` fehlen Übernehmen und Abbrechen im Erstbild. Die zusätzliche Phasenliste verdrängt die aktuelle Aufgabe. Die scrollbare Leiste macht die Aktionen erreichbar, aber gerade auf dem Hauptgerät bleibt unklar, wo die Aufgabe abgeschlossen oder sicher verworfen wird. | Phasenliste einklappen bzw. kurz halten; aktuelle Aufgabe und Übernehmen/Abbrechen im sichtbaren Bereich halten. Nur Detailinhalt scrollen, Foto erhalten. |
| S2 | Major | A/B/C / Einrichtung mit offenen Maßen / Desktop und Tablet | „Feld zeichnen“ ist bereits als reguläres Werkzeug angeboten. B nennt die Aktion ausdrücklich, A/C zeigen das gleiche aktive Zeichenicon. Der Prototyp erlaubt `tool-draw` ohne Zustandsschranke. Gleichzeitig sagt der Ablauf, dass Belegen erst nach der Einrichtung verfügbar wird. Damit zeigt der Entwurf zwei widersprüchliche Wege. | Zeichenwerkzeug bis zur Freigabe ausblenden oder sichtbar sperren; eine kurze Begründung bzw. die aktuelle Einrichtungsaufgabe nennen. Im Korrekturentwurf ebenfalls nur passende Ansichtswerkzeuge anbieten. |
| S3 | Major | A/B/C / Korrektur / Smartphone quer | In allen drei `*-correction-mobil-quer.png` fehlt der Speicherstatus vollständig. Die kompakte Kopfleiste behält Marke, Hauptnavigation und Leistung, verliert aber die explizit für alle Geräte verlangte Speicherrückmeldung. | Kompakten sichtbaren Speicherstatus erhalten, z. B. zweite Kopfzeile oder fester Statusbereich. Fehler müssen dort ebenfalls sichtbar bleiben. |
| S4 | Minor | B/C / Belegung / Smartphone hoch | Zwischen Foto und Bodenleiste bleiben nur „Aktive Fläche A“ und „Hauptdach Süd“ als verwaiste Detailüberschrift sichtbar. Die aktive Fläche steht bereits über dem Bild; die zugehörigen Auswahlaktionen sind eingeklappt. Das kostet Bildhöhe, ohne eine zusätzliche Entscheidung zu ermöglichen. | Überschrift zusammen mit den Details verbergen oder in einen klaren Detail-Trigger mit Auswahlzahl umwandeln. |
| S5 | Minor | A/B/C / Korrektur / Desktop | Das große Label „A · Hauptdach Süd“ verdeckt teilweise die neue Maßbeschriftung direkt unter der Traufe. Gerade der geänderte Wert ist im Korrekturschritt relevant. | Maßbeschriftung und Flächenlabel kollisionsfrei platzieren; Maßtext darf bei Zoom nicht hinter dem Auswahlziel verschwinden. |
| S6 | Minor | A/B/C / Belegung / Smartphone hoch | Zwei ausgewählte Felder werden gezeichnet, aber die Anzahl der Auswahl ist ohne Öffnen von Details nicht lesbar. Die zusätzliche alleinstehende Auswahl-Schaltfläche oben im Foto wiederholt außerdem die feste Bodenaktion. | Auf der Bodenaktion oder am Detail-Trigger „2 Felder“ anzeigen; redundantes Werkzeug entfernen, sofern kein eigener Zustand damit kommuniziert wird. |

Kein zusätzlicher Blocker im geprüften sichtbaren Umfang. Die Majors betreffen nachvollziehbare Aufgabenführung und explizite Anforderungen, nicht Geschmackspräferenzen.

## Vergleich der Richtungen

**A – erste Wahl nach Reparatur.** Auf Tablet quer bleiben Hauptdach und Gaubenseiten in einer stabilen, benannten Hierarchie sichtbar. Foto und Kontextwerkzeuge liegen nebeneinander. Einrichtung zeigt eine konkrete Aufgabe mit nächsten Schritt; Korrektur zeigt Alt/Neu, Erklärung und beide Abschlussaktionen gleichzeitig. Auf Smartphone hoch wechselt die Flächenliste in eine kompakte Auswahl, die Hauptaktionen nach unten. Das ist eine tatsächliche Anpassung an Platz und Aufgabe. Die rechte Belegungsleiste ist dicht; sekundäre Maßeinstellungen dürfen scrollen, während Auswahl und Hauptaktionen sichtbar bleiben.

**B – zweite Wahl.** Der breite Bildbereich und die Werkzeugnamen erleichtern Orientierung. Die Korrektur ist in der horizontalen Leiste gut zusammengefasst. Auf Tablet quer macht der breite, aber flache Bildbereich das Dach jedoch kleiner als bei A/C; zugleich verteilen sich Blickwechsel auf Bild, obere Flächenauswahl und unteren Aufgabenbereich. Die hierarchische Beziehung von Hauptdach und Gaubenseiten ist erst im Auswahlmenü sichtbar. Für eine überwiegend wiederholte Bearbeitung derselben Fläche brauchbar, für mehrere Flächen weniger direkt als A.

**C – dritte Wahl.** Die Schritte sind ausdrücklich benannt und das Bild bleibt groß. Die zusätzliche Ablaufnavigation wiederholt jedoch die bereits sichtbare Hauptnavigation und die aktuelle Aufgabenüberschrift. Auf dem entscheidenden Tablet-Querformat wandern dadurch Abschlussaktionen aus dem sichtbaren Bereich. Auf Tablet und Smartphone hoch steht das Formular teilweise vor Foto und Flächenauswahl; die zu bearbeitende Fläche wird somit erst nach der Eingabegruppe benannt. Diese Reihenfolge ist für einen gemeinsamen Editor mit mehreren Flächen weniger sicher. C benötigt die größte strukturelle Reparatur.

## Noch benötigte Zustandsaufnahme

Für A zusätzlich angefragt: `A-placement-details-mobil-hoch.png` bei 375×812 mit geöffneten kontextabhängigen Details. Zu prüfen sind eine weiterhin sichtbare Arbeitsfläche, klare „2 Felder drehen“-Aktion, „Alle auswählen“ und ein erreichbarer Weg zurück. Die Defaultansicht allein belegt diesen zentralen Abnahmepunkt nicht.

Nach Reparatur der Majors sind die betroffenen Bilder erneut unabhängig zu prüfen. Die Rangfolge ist eine begründete Empfehlung; sie ersetzt die im Nutzerplan geforderte Freigabe des konkreten Entwurfs nicht.
