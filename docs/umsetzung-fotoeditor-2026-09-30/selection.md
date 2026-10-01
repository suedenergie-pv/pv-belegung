# Auswahl der Fotoeditor-Richtung

**Historischer Reviewstand:** Der Nutzer hat diese Richtung anschließend als unübersichtlich abgelehnt. Die damalige interne Empfehlung ist keine Nutzerfreigabe. Fortsetzung in `echtfoto-entwurf.md` und `review-echtfoto.md`.

Stand: 30.09.2026. Unabhängiger Selector; Ansichtsreview ohne Änderungen an Prototypen oder Produktionscode. Grundlage: SPEC-Ergänzung vom 30.09., `directions.md`, Ausführungsplan und drei unabhängige Reviews.

**PASS für die Entwurfswahl: Empfehlung A — Flächenliste und Inspektor.** Nach gezielter Reparatur und unabhängiger erneuter Sichtung aller 19 A-Aufnahmen bleiben im geprüften Ansichtsumfang keine offenen Blocker oder Majors. B und C bleiben transparente Gegenentwürfe mit offenen Majors. A kann dem Nutzer jetzt zur ausdrücklich erforderlichen konkreten Entwurfsfreigabe vorgelegt werden; diese Auswahl ist keine Produktionsfreigabe.

## Gewichtete Begründung

Die Gewichtung ist eine Prioritätenfolge, kein numerischer Nutzwert: **zuerst** sichtbare Bildarbeit und sichere Abschlüsse auf dem Tablet; **danach** Wechsel zwischen Hauptdach und Gaubenseiten; **danach** Smartphone-Anpassung und geführte Ersteinrichtung. Markentreue ist Voraussetzung und unterscheidet die Kandidaten wenig.

| Richtung | Konkreter Vorteil | Preis / Auswahlurteil |
|---|---|---|
| **A — empfohlen** | Auf Tablet quer stehen Dachhierarchie, gemeinsames Foto und Aktionen für genau zwei ausgewählte Felder gleichzeitig bereit. Einrichtung und Maßkorrektur behalten dieselben Arbeitsorte. Tablet hoch ordnet den Kontext unter das Foto; Smartphone bietet Details auf Abruf. | Zwei Seitenbereiche begrenzen die Fotobreite; Smartphone verliert die dauerhafte Hierarchie. Die separate Zoomzeile beansprucht etwas Höhe, erhält aber freie Feldkanten. Beste Passung für wiederholte Arbeit an mehreren unabhängigen Flächen. |
| **C — geführte Alternative** | Benannte Einrichtungsschritte und ein breiteres Bild neben nur einer Seitenleiste. Die festen Abschlüsse auf Tablet quer sind inzwischen sichtbar. | Aufgabenblock beansprucht auf Tablet hoch viel Höhe; Flächenhierarchie ist aufrufbar statt dauerhaft sichtbar. Zoom überlagert weiter bearbeitbare Feldbereiche. Für Auswahl verworfen, kein erneuter Reparaturauftrag. |
| **B — breite Alternative** | Vollbreites Foto und gut vergleichbare Korrekturwerte im unteren Band. | Tablet quer zeigt trotz voller Breite ein deutlich kleineres Dach als A; viel seitlicher Freiraum, Blickwechsel zwischen oberer Flächenwahl und unterem Werkzeugband. Für diesen Tablet-Auftrag schwächste Richtung; verworfen. |

## Befundabschluss

Alle Bilddateien liegen unter `.debug-shots/fotoeditor-entwuerfe-2026-09-30/`.

| Befund | Stand und sichtbarer Beleg |
|---|---|
| **SEL-A1 · Major · geschlossen** — Abschlussaktionen aus dem Sichtbereich | Im ersten finalen Stand fehlte Abbrechen auf Tablet quer; Smartphone quer schnitt Einrichtung/Korrekturabschlüsse ab. Erneut geöffnet: `A-correction-tablet-quer.png`, `A-setup-mobil-quer.png`, `A-correction-mobil-quer.png` sowie alle übrigen Einrichtung-/Korrekturgrößen. Nun sind Maße übernehmen bzw. Übernehmen und Abbrechen vollständig sichtbar. Nur der ergänzende Kontext scrollt. |
| **SEL-A2 · Major · geschlossen** — Zoom verdeckt Bearbeitungsbereich | Erneut geöffnet: `A-placement-details-mobil-hoch.png`, `A-placement-status-mobil-hoch.png` und gesamte A-Matrix. Zoom liegt in schmalen Ansichten in einer eigenen Zeile außerhalb des Fotos. Die zuvor verdeckte rechte untere Modulfläche/Feldkante ist frei; Details, Hauptaktionsleiste und Foto bleiben sichtbar. |
| **S1 / Brand C2 · geschlossen im Tablet-Querformat** | `C-setup-tablet-quer.png` zeigt Maße übernehmen; `C-correction-tablet-quer.png` zeigt Übernehmen und Abbrechen vollständig. Der innere Inhalt darf weiter scrollen. Das schließt den ursprünglichen C-Befund, nicht den später erkannten A-Befund. |
| **S2 · im Ansichtsprototyp geschlossen** | `A/B/C-setup-tablet-quer.png`: Feldzeichnen sichtbar gesperrt; A zusätzlich Desktop geprüft. Die spätere echte Freigabelogik bleibt Implementierungsprüfung. |
| **S3 / Brand G1 · geschlossen** | Speichertext im Kopf sichtbar: A Einrichtung, Belegung und Korrektur Smartphone quer; B/C Korrektur Smartphone quer. |
| **Grounding G-01 · geschlossen** | Grounding hat alle neun neuen Statusbilder geprüft. Hier zusätzlich alle drei A-Statusbilder betrachtet: Perspektive, Maße und Foto-Prüfung getrennt, „nicht geprüft“ neutral, Foto erhalten. |
| **S5 / Brand G3 · für A geschlossen** | A Korrektur Desktop/Tablet hoch/quer: geänderter Maßwert liegt getrennt vom Flächenlabel. C Korrektur Desktop: Maßtext wird dagegen noch von der unteren Werkzeugpalette angeschnitten; Minor bleibt. |
| **Brand C1 · Major · offen in verworfenem C** | `C-placement-tablet-quer.png` und `C-placement-tablet-hoch.png`: Zoom über rechter unterer Modulfläche und Feldkante. |
| **Brand B1 · Major · offen in verworfenem B** | `B-placement-tablet-quer.png` und `B-correction-desktop.png`: niedrige Fotofläche und kleines Dach trotz großer Gesamtbreite. |
| **Abschlussklasse · offen in verworfenem B/C** | `B-correction-mobil-quer.png` / `C-correction-mobil-quer.png`: Abschlussknöpfe unten angeschnitten. Kein zusätzlicher Reparaturauftrag für diese Gegenentwürfe. |

Nicht sperrende Hinweise: sehr kleine Maßtexte auf dem Foto; A zeigt den Auswahlumfang auf Smartphone erst in den Details; B verschweigt die Pfeilschrittweite; eine dauerhafte Zweipunkt-Anleitung muss beim späteren Werkzeugbau entstehen. Die beiden letzten Punkte stammen aus Grounding G-02/G-03. Keine dieser Beobachtungen wird als bestandener Funktionstest ausgegeben.

## Tatsächlich betrachtete Evidenz und Grenze

Mit `view_image` betrachtet und **nach der letzten A-Reparatur vollständig erneut geöffnet:** alle 15 A-Hauptansichten (drei Zustände × fünf Größen), A-Details Smartphone hoch sowie alle drei A-Statusbilder — insgesamt 19 aktuelle A-Aufnahmen. Zusätzlich B: Einrichtung/Belegung Tablet quer, Belegung Smartphone hoch, Korrektur Desktop und Smartphone quer. C: Einrichtung Tablet quer, Belegung Tablet quer/hoch und Smartphone hoch, Korrektur Desktop, Tablet quer und Smartphone quer. Die ursprünglichen unabhängigen Reviews decken weitere Ansichten ab. Keine eigenen Browser-, Gesten- oder Engine-Tests in dieser Selector-Rolle; die automatischen Prüfergebnisse des Erzeugers ersetzen diese Bildsichtung nicht.

Die Illustration ist ausdrücklich ein Beispieldach; Beispielzahlen sind keine Engine-Ergebnisse. Eine Nutzerfreigabe von A beträfe ausschließlich Aufbau und sichtbare Zustände Einrichtung/Belegung/Korrektur in den geprüften Größen. Echte Fotos, Traufkante/Dachecken/Aussparungen, Zeichnen/Drag/Resize, Zoomkoordinaten, Historie, atomare Maßübernahme, Export und native iPad-Praxis bleiben separat nachzuweisen. Konkrete Nutzerfreigabe vor Produktionsintegration weiterhin erforderlich; kein Push oder Deploy durch diese Auswahl autorisiert.
