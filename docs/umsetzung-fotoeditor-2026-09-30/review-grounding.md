# Unabhängige Prüfung der Quellenbindung

Stand: 30.09.2026. Rolle: `reference_grounding_eval`. Geprüft ohne Kenntnis der anderen Kritikerurteile oder einer bevorzugten Richtung. Dies ist eine Entwurfsprüfung, keine Freigabe der noch nicht implementierten Bedienlogik.

## Ergebnis

Die gemeinsame Fotoarbeitsfläche, explizite Belegungswerkzeuge, Maßübernahme und Korrekturvorschau sind nachvollziehbar aus dem Auftrag und den unten direkt geöffneten Quellen abgeleitet. Keine Quelle beweist, dass die konkrete Anordnung A, B oder C im Vertrieb am besten funktioniert. Dafür bleiben die vergleichende Entwurfswahl und die Praxisprüfung erforderlich.

Der gemeinsame **Major G-01 ist nach erneuter visueller Prüfung geschlossen**. Alle drei Status bleiben nun über „Prüfstatus“ erreichbar. Aus dieser Quellenprüfung bleiben **keine offenen Blocker oder Majors**, jedoch die beiden unten genannten Minor-Befunde und ausdrücklich ungeprüfte Funktionsanforderungen. Damit ist der Stand für die Entwurfswahl bewertbar; er ist keine fertige Produktimplementierung.

## Tatsächlich betrachtet

Verzeichnis `.debug-shots/fotoeditor-entwuerfe-2026-09-30/`:

- A: Einrichtung Desktop und Smartphone hoch; Belegung Tablet quer und Smartphone quer; Korrektur Smartphone hoch; geöffnetes Detailpanel Smartphone hoch.
- B: Einrichtung Tablet hoch; Belegung Desktop und Smartphone hoch; Korrektur Desktop und Smartphone quer; Fotoverwaltung Smartphone hoch.
- C: Einrichtung Desktop und Smartphone quer; Belegung Tablet hoch und Smartphone quer; Korrektur Tablet quer und Smartphone hoch.
- Nach der ersten Reparatur neu betrachtet: A Belegung Smartphone quer mit Speicherstatus; C Einrichtung Desktop mit gesperrtem Zeichenwerkzeug; A `placement-details-mobil-hoch` mit wieder sichtbarer Hauptaktionsleiste; B Belegung Smartphone hoch mit Auswahlumfang statt wiederholter Flächenüberschrift.
- Nach der abschließenden Statusreparatur sämtliche neun `{A|B|C}-placement-status-{tablet-hoch|mobil-hoch|mobil-quer}.png` tatsächlich betrachtet. In jedem Capture stehen Perspektive, Maße und Foto-Prüfung getrennt und lesbar; das Dachfoto bleibt gleichzeitig sichtbar. Zusätzlich B Belegung Desktop erneut betrachtet und die wirksame CSS-Regel für das geöffnete Statusfeld geprüft.

Zusätzlich wurden SPEC-Ergänzung vom 30.09., `evidence.md`, relevanter Prototyp-Quelltext und die vorhandenen QA-Metriken gelesen. Die Metriken stammen aus der separaten Automation; diese Rolle hat deren Messlauf nicht selbst ausgeführt. Das klar bezeichnete Beispieldach ist als Entwurfsillustration akzeptabel.

## Quellen und zulässige Ableitung

| Primärquelle, am 30.09. direkt geöffnet | Belegt | Grenze der Ableitung |
|---|---|---|
| [W3C: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Normaler Text benötigt mindestens 4,5:1; Bewertung anhand der tatsächlichen Vorder-/Hintergrundfarben. | Ein gut lesbarer Screenshot beweist keine vollständige Konformität. |
| [W3C: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Für selbst implementierte Ziehaktionen ist eine Alternative mit einem Zeiger ohne Ziehen erforderlich; zwei nacheinander gesetzte Punkte sind ein genanntes Beispiel. Tastatur allein genügt nicht. | Das gilt ebenfalls für Größenänderung und eigenes Pan. Ein Handwerkzeug, das weiterhin Ziehen verlangt, ist allein keine solche Alternative. |
| [W3C: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | AA-Mindestgröße ist 24 × 24 CSS-Pixel mit bestimmten Ausnahmen. | Die 44 × 44 Pixel sind die ausdrücklich strengere Projektvorgabe. Unsichtbare Trefferbereiche müssen auch bei Zoom geprüft werden. |
| [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Seltene Details dürfen auf Abruf liegen; der Einstieg muss auffindbar und verständlich sein. Häufig nötige Funktionen gehören in die erste Ebene. | Das rechtfertigt Fotoverwaltung und technische Details auf Abruf, aber kein ersatzloses Ausblenden fachlicher Status. Nutzungshäufigkeit muss im Alltag bestätigt werden. |
| [NN/g: Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | Sichtbarer Systemstatus, klare Ausstiege und Rückgängig/Wiederherstellen unterstützen Kontrolle und Fehlerkorrektur. | Die sichtbaren Pfeile beweisen weder projektweite Historie noch Gruppierung von Halteaktionen. |
| [GoodWe: Modules](https://learn-designer.goodwe.com/en/documentation/editor/modules) | Explizites Platzieren, Erweiterung durch einen zweiten Klick und Auswahl von Modulgruppen sind reale Bedienmuster. | Die Quelle beschreibt einen anderen Editor einschließlich 3D. Daraus folgt keine Übernahme seiner Fachlogik oder ein Beleg für diese konkrete Tablet-Anordnung. |

Die wesentlichen Prototypfarben wurden unabhängig mit der W3C-Formel nachgerechnet: Weiß auf `#b83e1f` 5,60:1; `#536171` auf Weiß 6,33:1; `#182436` auf Weiß 15,62:1; `#8b2c15` auf `#fff0e9` 7,65:1; `#286041` auf Weiß 7,40:1. Dies prüft diese Farbpaare, nicht sämtliche Overlay-, Fokus-, Fehler- und Fotozustände.

## Konkrete Befunde

### G-01 — Major, geschlossen — Getrennte Status waren ersatzlos verborgen

Auf Smartphone verschwinden Perspektive, Maßbestätigung und Foto-Prüfung durch `.inspector .checks { display:none!important }` auch bei geöffneten Details. B versteckt `.checks` generell; bei A/C betrifft es zusätzlich Tablet hoch. In A `placement-details-mobil-hoch` stehen Auswahlaktionen, aber keine erreichbaren getrennten Status. Der gemeinsame grüne Text an breiten Ansichten trennt Maßbestätigung und Perspektive zwar sprachlich; der neutrale Stand der optionalen Foto-Prüfung fehlt bei B trotzdem.

**Reparatur visuell verifiziert:** „Prüfstatus“ ist jetzt eine aufklappbare Zeile in den Details. Die neun oben aufgeführten Nachprüfungen zeigen „Perspektive – festgelegt“, „Maße – bestätigt“ und „Foto-Prüfung – nicht geprüft“. Die nicht erfolgte Prüfung wird neutral dargestellt. Der Fotoarbeitsbereich bleibt in allen neun Fällen sichtbar, auf Smartphone hoch auch die untere Hauptaktionsleiste. Die neue Regel `.status-disclosure[open] .checks { display:grid!important }` übersteuert auch das bisher generelle Verbergen in B; der Desktop-Bereich besitzt weiterhin eigenen Scrollzugang. `qa-status.json` dokumentiert die neun erfolgreichen automatischen Prüfungen des Erzeugers, nicht einen von dieser Rolle ausgeführten Testlauf.

### G-02 — Minor — B macht Verschiebungseinheit erst indirekt verständlich

In B Desktop werden die Pfeile ohne den bei A sichtbaren Text „Auswahl verschieben · 10 cm“ gezeigt. Die Nähe zu „2 Felder ausgewählt“ macht den Wirkbereich plausibel, die Schrittweite bleibt jedoch verborgen. Sichtbare oder klar abrufbare Schrittweite und eine eindeutige Beschriftung sind vor der Produktintegration nötig. Kein zusätzlicher dauerhaft großer Block erforderlich.

### G-03 — Minor — Zweipunkt-Alternative nur flüchtig angekündigt

Der Prototyp nennt nach Werkzeugwahl kurz „ziehen oder zwei Eckpunkte setzen“. Die statische Belegungsansicht enthält diese Anleitung nicht. Bei der Umsetzung sollte der erste und zweite Punkt als aktueller Werkzeugschritt sichtbar bleiben. Das ist besonders relevant, wenn eine Person den kurzen Hinweis übersieht; die Alternative muss auffindbar sein.

### Keine erneuten Befunde

Speicherstatus Smartphone quer, Zeichnen vor Maßübernahme und die zuvor aus dem sichtbaren Bereich geratene untere Aktionsleiste wurden in erneuten Captures korrigiert gesehen. Die drei Formkorrekturen zeigen Vorher/Nachher-Zahl und Übernehmen/Abbrechen. Das ist eine passende Darstellung; die atomare Übernahme und Navigation mit offenem Entwurf sind im Ansichtsprototyp noch nicht geprüft.

## Vergleich für die Auswahl

| Richtung | Sichtbar gestützter Vorteil | Konkreter Preis |
|---|---|---|
| A | Auf Tablet quer stehen Flächenhierarchie, ausgewählte Felder und deren Aktionen gleichzeitig bereit. Gaubenseiten sind dem Hauptdach direkt zugeordnet. | Zwei Seitenbereiche beschränken die Fotobreite. Auf Smartphone verschwindet die persistente Flächenliste in die Auswahl. |
| B | Der Fotobereich erhält die gesamte Breite; das untere Werkzeugband verbindet Formular und Vorschau. Auf Smartphone zeigt die kurze Auswahlzeile inzwischen den Umfang. Der getrennte Prüfstatus ist ergänzt. | Tablet quer verbleiben im zuerst geprüften Belegungszustand etwa 345 px Fotohöhe statt A 489/C 469; ein breiter Container bedeutet daher kein größeres dargestelltes Dach. Der Pfeilkontext benötigt noch die bei G-02 beschriebene Ergänzung. |
| C | Die Einrichtung führt am Desktop mit benannten Schritten. Ein Seitenbereich lässt im Vergleich zu A mehr Fotobreite. | Die ständig sichtbare Flächenhierarchie entfällt. Tablet hoch setzt Werkzeuge oberhalb des Bildes; die Aufgabenführung beansprucht dort einen erheblichen Teil der Höhe. |

Keine Quellenbasis rechtfertigt einen pauschalen Sieger. Für häufigen Wechsel zwischen Hauptdach und Gaubenseiten ist A unmittelbar verständlich; für die erstmalige Einrichtung vermittelt C den Ablauf deutlicher. B setzt den stärksten Schwerpunkt auf eine breite Bildansicht, muss aber die geringere tatsächliche Bildhöhe auf Tablet quer berücksichtigen.

## Noch nicht durch diese Entwürfe nachgewiesen

Zwei-Finger-Gesten ohne Geometrieänderung, Koordinaten bei Zoom, antippbare Alternativen für Pan/Größenänderung, Maßvalidierung, Nullauswahl beim Drehen, projektweite Historie, Import/Migration, PDF-Gleichheit und native iPad-Bedienung. Diese Punkte gehören in die anschließende Implementierungsabnahme; die Vorlage demonstriert dafür derzeit überwiegend Anordnung und Texte.
