# Unabhängiger Review der Editorintegration

Stand: 30.09.2026, Review durch separaten Agenten ohne Implementierungsänderungen.

## Umfang und Evidenz

Verbindlicher Fotoeditor-Auftrag in SPEC.md und validierter ExecPlan, reduzierte freigegebene Echtfoto-Richtung. Keine Conversion-Seite und keine neue Freigabeforderung. Prüfung von Sitzungszustand, Pointer-/Zoom-Koordinaten, Entwurfsnavigation, Gauben, gemeinsamen Fotos und responsiver Oberfläche. Engine wird wiederverwendet.

Browser ausschließlich repository-eigenes Playwright mit installiertem Chrome, headless an localhost:3100. Eigene Wegwerf-Browserkontexte mit privatem Referenzfoto; keine Kundendaten oder Testfotos im produktiven Projekt. Eigene Repros unter `.debug-shots/editor-integration-2026-09-30/review-*.cjs`. Kein Push/Deploy, kein nativer iPad-Nachweis.

## Konkrete Befunde und Reparaturen

1. **Major – Feldgriffe hatten keine stabilen Touchziele. Geschlossen, Runde 1.** Das Trefferrechteck war 3% der Fotobreite, gemessen 29,71px auf Desktop und 10,54px auf 375px. Zusätzlich erkannte der Schritt einen Griff ausschließlich über 0,35m Abstand, unabhängig vom getroffenen SVG-Griff. Reparatur: feste transparente 44px-Strichfläche und ausdrückliche Übergabe von Griff/Index. Unabhängige Browser-Gegenprüfung trifft 20px rechts und unter dem SE-Griffzentrum auf Desktop und Smartphone den richtigen Griff. `getBoundingClientRect()` enthält den zusätzlichen SVG-Strich nicht und darf nicht als alleiniger Gegenbeleg dienen.

2. **Major – Zweifingergeste ließ eine begonnene Perspektivänderung zurück. Geschlossen, Runde 1.** Der erste Finger konnte eine Ecke bereits verändern; der zweite brach nur die Feldgeste ab. Reparatur: Perspektivgeste mit Startzustand und Abbruchrevision. Unabhängiger Browserlauf: Ecke (150,2000) zunächst auf Desktop (190,395;1999,997), mobil (263,874;1999,970) verändert; zweiter Touch stellt in beiden Fällen exakt (150,2000) wieder her. Folgende Pointer-Up-Ereignisse ändern diesen Stand nicht.

3. **Major – Maßvorschau erlaubte Mutationen am bisherigen Plan. Geschlossen, Runde 1.** Repro: bestätigte Traufe 18m, Feld (1,1,5,4); Entwurf auf 36m, dargestelltes Feld um 50px ziehen. Ohne Übernehmen wurde Feld.xM im gespeicherten Projekt von 1 auf 3 geändert, da Anzeige/Koordinaten aus dem Entwurf und Mutation aus dem Altstand stammten. Reparatur sperrt Modellinteraktion während der Maßvorschau; Zoom bleibt verfügbar. Identischer unabhängiger Browserlauf erhält das gespeicherte Feld jetzt exakt (1,1,5,4).

4. **Major – Gaubenmaßentwurf ging bei Navigation still verloren. Geschlossen, Runde 1.** `GaubenMassEditor` hielt Werte lokal ohne Registrierung mit EntwurfNavigation. Maß verbessern → Breite ändern → Export/Flächenwechsel verlor die Eingabe ohne Übernehmen/Verwerfen/Bleiben. Vorher-/Nachher-Modulzahl und Abbrechen fehlten ebenfalls. Die bestehende Registrierungslogik erfasste nur Gaubenpunktmarkierungen. Reparatur ergänzt Maßentwurfsschutz, Abbrechen und Vorschau. Unabhängiger Browserlauf mit bestehender geschätzter Gaube: Breite 3→4; Export öffnet Dialog; Bleiben erhält 4; Verwerfen erhält gespeicherte 3; erneutes 4 und Übernehmen schreibt 4. Quelle `nachbardach` und Qualität `geschaetzt` bleiben unverändert. Screenshot `review-gaubenmass-navigation.png` geöffnet.

5. **Major – Tablet hoch blendete Kontextwerkzeuge unter den sichtbaren Arbeitsbereich. Geschlossen, Runde 1.** Im echten 768×1024-Viewport beginnt die Bildfläche bei y343 und endet bei y947, Kontextpanel ab y958. Werkzeuge sind damit erst nach Fensterscroll erreichbar; beim Arbeiten an tieferen Angaben verschwindet das Foto. Ursache: bis 999px gestapeltes Layout mit 59vh Bildhöhe und unbegrenztem Kontextpanel, während nur bis 600px eine kompakte Bild-/Panelaufteilung greift. Screenshot `tablet-hoch-einrichtung-viewport.png` tatsächlich geöffnet. Reparatur begrenzt Bild auf 34vh und Kontext auf 30vh bis 999px. Neue echte 768×1024-Captures Einrichtung und Korrektur wurden geöffnet: Foto und relevante Aktionen sind gemeinsam sichtbar, weitere Details scrollen innerhalb des Panels.

## Tatsächliche Sichtprüfung

Geöffnet: Einrichtung und Korrektur Desktop/Smartphone, sowie neue echte Viewport-Captures Desktop-Korrektur, Smartphone-Korrektur, Tablet-hoch-Einrichtung und Smartphone-quer-Korrektur. Zusätzlich 1024×768-Korrektur sowie Desktop-/Smartphone-Export geöffnet: Foto und Modulbild ohne Bearbeitungsmarkierungen. Das Foto bleibt der inhaltliche Schwerpunkt; Werkzeuge erscheinen passend zum aktuellen Zustand. Auf Smartphone stehen Hauptaktionen jetzt am unteren Rand. Eine zunächst über Navigation liegende Sticky-Kopfzeile war ein Vollseiten-Aufnahmeartefakt nach Scrollen; neue Aufnahmen ab scrollY=0 zeigen keine Überdeckung.

Smartphone quer: Der obere Appbereich nimmt bei 812×375 zunächst etwa 303px ein. Nach Scrollen sind Bild und seitliches Panel gemeinsam bedienbar; als Minor festgehalten, kein eigenständiger Abschlussblocker. Im Smartphone-Export ist die Projektauswahl durch die breite Projektaktionen-Schaltfläche auf etwa 70px gedrückt; der geschlossene Projektname ist stark gekürzt (Minor, geöffnetes Auswahlmenü bleibt bedienbar). Native Touchqualität bleibt einem echten iPad-Durchlauf vorbehalten.

## Abschlussstatus

**PASS für diesen unabhängigen Code-/UX-Review.** Alle fünf wesentlichen Befunde sind nach jeweils einer Reparaturrunde unabhängig geschlossen; kein offener Blocker/Major im geprüften Umfang. Die genannten zwei Minor-Punkte blockieren den lokalen Prüflauf nicht. Vollständige Projektregression, Typecheck und Build werden separat von Root ausgewiesen; dieser Review behauptet keine eigene Ausführung dieser kompletten Suite. Native iPad-Praxisabnahme bleibt ausdrücklich offen. Keine Überschreitung der maximal drei Reparaturrunden pro Defektklasse.
