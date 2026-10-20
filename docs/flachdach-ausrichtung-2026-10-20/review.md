# Unabhängiger Flachdach-Review · 20.10.2026

Prüfer: separater Agent `flachdach_review`. Produktcode wird ausschließlich gelesen. Gegenstand: freie Flachdachfeld-Ausrichtung, sichere manuelle Korrekturen, vorhandene Gaubenbearbeitung im gemeinsamen Release. Kein allgemeiner Nachweis der Verständlichkeit für Walter und keine native iPad-Abnahme.

## Vorprüfung des Vertrags

Der vorliegende Vertrag in `evidence.json` ist fachlich und für den begrenzten Editor-Ausbau plausibel. Eine Freigabe des fertigen Produkts folgt daraus noch nicht. Das Audit zeigt einen reproduzierten Datenverlust: ein Wechsel von Süden unten auf oben entfernt `feld.leer` und bringt ein manuell entferntes Modul zurück. Dieser Defekt ist unabhängig von der freien Rotation zu schließen.

Tatsächlich geöffnete Primärquellen:

- [W3C: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), Stand 10.08.2026: Ziehen braucht eine Alternative mit einzelnen Zeigeraktionen. Ein präzises Zahlenfeld wird ausdrücklich als mögliche Alternative beschrieben; alleinige Tastaturbedienung genügt nicht für diesen Punkt.
- [Aurora: Design settings](https://help.aurorasolar.com/hc/en-us/articles/4406930393875-Design-settings-Account-configuration), Stand 17.06.2026: Abstand, Montage-Neigung und Hoch-/Querformat sind unterschiedliche Flachdach-Einstellungen. Daraus folgt für dieses Produkt die saubere Benennung der getrennten Größen, keine Validierung des konkreten Walter-Ablaufs.
- [Aurora: Multi-Object Selection](https://help.aurorasolar.com/hc/en-us/articles/24253418353555-Multi-Object-Selection-in-Design-Mode), Stand 15.04.2026: auswahlbezogene Bearbeitung und gemeinsame Transformation sind in einem professionellen PV-Editor dokumentiert. Das rechtfertigt die vorhandene Auswahlleiste als Ort der Feldrotation, nicht die Übernahme einer komplexen Produktnavigation.

## Prüfkriterien für den Candidate

1. **Bedeutung:** Dach-Kompasslage, Montage-Neigung (10/15°), Feld-Drehung und Abstand sind eindeutig getrennt. Ein gedrehtes Feld wird nicht unbegründet als exakt nach Osten/Westen ausgerichtet angekündigt. Richtungsanzeigen benutzen die kalibrierte Dach-/Fotoabbildung; ein Bildschirm-Pfeil darf nicht bei verzerrter Perspektive als wahrer Kompass ausgegeben werden.
2. **Wiedererkennen und Korrigieren:** Feld markieren, drehen, genauen Winkel eingeben und auf 0° zurücksetzen sind sichtbar. Betroffene Auswahl und Modulzahl ändern sich nachvollziehbar. Bei 0 verbleibenden Modulen bleiben Korrektur und Rückweg erreichbar. Drehen um die sichtbare Feldmitte verhindert eine unerwartete Translation.
3. **Manuelle Arbeit:** Lokale Zellidentitäten bleiben beim Drehen, Verschieben und Kompasswechsel erhalten. Kein stilles Zurückholen entfernter Module. Zwei Felder können unterschiedliche Winkel behalten; eine Aktion für die Auswahl ändert keine ungewählten Felder. 0°-Bestandsprojekte reproduzieren die bisherige Geometrie.
4. **Exakte Geometrie:** Physische Modulmaße, Hindernisse, Rand, Dachpolygon, Nachbarfeld-Überlappung und PDF verwenden dieselben gedrehten Modulpolygone. Achsenrechtecke reichen für die endgültige Kollision nicht. Renderer und UI führen keine abweichende Belegungsberechnung ein.
5. **Komplette Bearbeitung:** Modul-Klicktreffer und leere Geister sind gedreht; Rückholen, Mehrfachauswahl-Vorrang, Verschieben und Größen-Griffe bleiben korrekt. Größenänderung benutzt lokale Feldachsen und erhält Rasterphase beziehungsweise Löcher. Maus-/Touch-Modus und Ansichtsgesten bleiben voneinander getrennt.
6. **Abstand verständlich:** „Abstand der Modulpaare/Reihen“ nennt Meter und beschreibt Anfang-zu-Anfang beziehungsweise First-zu-First. Eine Skizze darf den Pitch nicht als freie Gassenbreite darstellen. Kleine ungültige Werte werden nicht als bestätigt gespeichert und anschließend still durch einen anderen Engine-Wert ersetzt.
7. **Kleine Ansichten:** Zahlenfeld und antippbare Drehknöpfe bleiben auf Smartphone hoch/quer sowie Tablet erreichbar. Foto und wirksamer Modus bleiben während des Korrigierens erkennbar. Fokus, fester Abschluss und Scrollbereich verdecken keine Eingaben. Sichtprüfung erfolgt an tatsächlich geöffneten Bildern.
8. **Speichern und Export:** Winkel bleiben nach Reload erhalten und sind im JSON pro Feld mit ASCII-snake-case benannt. Bestehender Dachazimut wird nicht als Nebeneffekt überschrieben. Foto- und PDF-Komposition stimmen überein.
9. **Release:** vollständige relevante Regression inklusive Gauben, Aussparungen, Projektstart und PDF; exakter isolierter VPS-Build und getrennte Pages-Prüfung. Archiv und Manifest stimmen mit geprüften Quellen überein; keine Privatfotos oder lokalen Einstellungen. Aktivierung nutzt den bestehenden atomaren VPS-Weg und erhält das vorherige Release. Öffentliche Nachprüfung erfolgt auf der VPS-Domain.

## Ergebnis: PASS für den geprüften Candidate · keine offenen Blocker/Majors

Der Source-, Sicht-, PDF- und Artefaktreview ist abgeschlossen. Das Urteil gilt für den nachstehend identifizierten Candidate; vollständige Abschlussregression, produktive Aktivierung und öffentliche Nachprüfung werden vom Hauptagenten getrennt durchgeführt. Eine behauptete Walter-/native-iPad-Abnahme ist daraus nicht abzuleiten.

### Reparierte Abweichungen

Candidate-Quellen unabhängig gelesen: Engine-Geometrie/Raster, Feldgesten, Feldwinkel-Formular, SVG-Komposition, Maßentwurf und Payload. Die bestätigte Abweichung bei anisotroper Dachmaßänderung ist behoben: `skaliereFeldRahmen` erhält jetzt die proportional geführte Feldmitte und den gesetzten Winkel; lokale Kantenlängen folgen der Länge ihrer skalierten Achsen. SPEC benennt ausdrücklich die Grenze einer rechtwinkligen Form bei ungleichen Maßfaktoren. Die unvermeidbare Scherung einer exakten affinen Form wird nicht als Rechteck ausgegeben.

Die finale SVG-Zielkorrektur wurde unabhängig gelesen: überlappende Touchziele derselben Griffebene wählen nach Clientabstand zum sichtbaren Griff, statt nach der SVG-Malreihenfolge. Bestehende Mousebutton-, Capture- und Cancel-Schutzpfade bleiben erhalten. Der Hauptagent reproduzierte vorher eine falsche zusätzliche Höhenänderung beim Ziehen des rechten Größengriffs im kurzen Querformat; der finale fünfteilige Browserlauf prüft diesen Pfad erneut. Eine weitere vom Hauptagenten gefundene leere Auswahl wurde vor dem Zugriff abgesichert. Diese Hauptagenten-Reproduktionen werden nicht als eigene Browserausführungen ausgegeben.

Der erste Artefaktcandidate erhielt nachträglich noch keine Aktivierung: Die bestehende Feldregression zeigte im kurzen Querformat, dass ein übergroßes Griffziel einen Klick in die Feldmitte abfing und die Mehrfachauswahl stehen blieb. Der abschließende Folgefix behandelt deshalb auch die Feldkörpermitte als möglichen normalen Auswahlzugang. Er wurde erneut unabhängig gelesen: echte sichtbare Griffpositionen bleiben vorrangig, der Feldkörper geht durch den bisherigen normalen Auswahlhandler, ohne Feldreihenfolge oder Enginepriorität umzuschreiben. Die neue gezielte Interaktionsprüfung deckt beide Fälle ab. Das folgende PASS und alle untenstehenden finalen Hashes beziehen sich ausschließlich auf diesen **zweiten, nachgeprüften Candidate**.

### Selbst ausgeführte Prüfungen

Selbst ausgeführte Prüfungen am Candidate:

- `npx vitest run --root packages/engine test/belegung-felder-drehung.test.ts test/belegung-flachdach.test.ts --reporter=dot`: **43/43 bestanden**.
- `npx vitest run --root apps/web components/SchrittBelegung-helfer.test.ts components/DachSvg.test.tsx components/FlachdachFeldEditor.test.tsx lib/geometrie-entwurf.test.ts lib/model.test.ts --reporter=dot`: **57/57 bestanden**. Die Tailwind-Warnung dieses Root-Testaufrufs ist kein gerenderter UI-Nachweis.
- `.debug-shots/flachdach-ausrichtung-2026-10-20/desktop-01-feld-15-grad.png` selbst geöffnet: präzise Winkelaktion, Drehgriff, Auswahl-Modulzahl und Dachkompass getrennt erkennbar. Die damalige Vorprüfung hat die noch im Umbau befindliche mobile Aufteilung ausdrücklich nicht vorweg freigegeben; finale Sichtprüfung siehe unten.

- Nach den Reparaturen erneut selbst ausgeführt: 27/27 Rotationstests sowie 40/40 DachSvg-/Modelltests bestanden. Frühere und wiederholte Fälle werden nicht zu einer künstlichen Gesamtsumme addiert.
- Nach dem letzten Feldmitten-Folgefix selbst ausgeführt: `npx vitest run --root apps/web components/DachSvg-interaktion.test.tsx app/page.test.tsx --reporter=dot`: **17/17 bestanden**. Der testlokale Speicher-Isolationsfix wartet echte asynchrone Unmountspeicherungen ab, bevor ein anderer Browsermock eingesetzt wird; Testaussagen wurden nicht gelockert. Die Gesamtprüfung von 168 Engine- und 301 Webtests sowie die fünfgrößige Feldregression wurden vom Hauptagenten als bestanden gemeldet, nicht vom Reviewer erneut vollständig ausgeführt.

### Finale Sichtprüfung

Aus `.debug-shots/flachdach-ausrichtung-2026-10-20/` tatsächlich geöffnet: Desktop-Feld15°, Tablet-hoch-Feld15°, Mobil-hoch-Feld15°, Mobil-quer-Feld15°, Desktop-/Mobil-hoch-Aufständerung, Mobil-quer-Mehrfachauswahl sowie die beiden finalen `mobil-*-01b-drehaktionen.png` und `desktop-pdf.png`.

Hochformat: Zahlenfeld und alle drei Drehknöpfe oberhalb des festen Exports, Foto bleibt sichtbar; „Fertig“ beendet die Auswahl. Kurzes Querformat: Seiteninspektor scrollt intern; die zusätzlichen Aufnahmen zeigen Links/Rechts/0° oberhalb des festen Abschlusses nach dem Scrollen. Die begleitenden `.release/flachdach-scroll-hits/.last-run.json` und `.release/flachdach-qa-tests/.last-run.json` melden bestanden ohne fehlgeschlagene Tests; diese Browserläufe führte der Hauptagent aus. Keine sichtbaren Überlagerungen verhindern die geprüften Aktionen. Der kompakte Querformat-Plan bleibt klein und erfordert bei Detailarbeit den vorhandenen Zoom; keine neue Blockade gegenüber dem bestehenden Arbeitsbereich festgestellt.

Das gerenderte PDF zeigt das Grundraster und die Feldwinkel 15°/0° ausdrücklich getrennt. Das Belegungsbild enthält die gedrehte Geometrie und manuelle Lücke ohne Editorgriffe oder Kompass. Geometrie und Tabelle widersprechen einander in diesem geprüften Fall nicht.

### Unabhängiger Artefakt- und Deployweg-Review

Eine eigene Hashprüfung hat 74 aktuelle Quellen sowie 74 Stage-Quellen gegen `.release/vps/manifest.json`, 33 Exportdateien gegen das Manifest und 33 Archivdateien bytegenau gegen dasselbe Inventar verglichen: keine Abweichungen. Das Tar enthält keine absoluten Pfade, `..`-Segmente, Symlinks oder zusätzlichen Dateien. Keine privaten Fotos, Debugroute oder lokalen Agent-/Claude-Einstellungen im Exportinventar.

- Archiv `.release/20261020-flachdach-gauben.tar.gz`: SHA-256 `00429977fd81ecd56c4db0e3c52fe8795699c81aa0ea8469ca9b15712db35157`.
- Index: SHA-256 `0e804c49632316d05178d7ef6e2bdda83dfabba550b8ea8fee38faae51272261`.
- Diese Quellen-/Stage-/Export-/Archivprüfung wurde nach dem Feldmitten-Folgefix vollständig erneut ausgeführt: **74/74/33/33**, erneut keine Hash- oder Pfadabweichung.
- `.release/activate-vps-20261020-flachdach-gauben.sh` stimmt nach LF-Normalisierung mit `scripts/activate-vps.sh` überein. Das Skript prüft neuen Zielpfad, Hashes und erwarteten unveränderten Vorgänger, aktiviert atomar und behält Rollback. Geplanter neuer Pfad `/var/www/belegung/releases/20261020-flachdach-gauben`; erwarteter Vorgänger `/var/www/belegung/releases/20261020-ux-einrichtung`.
- Gauben sind Bestandteil dieses Candidates; ihr vorliegender separater Review `docs/gauben-bearbeitung-2026-10-20/review.md` dokumentiert die behobenen Topologie-/Fokusabweichungen und eigene Prüfgrenzen. Im Flachdachauftrag wurden diese Änderungen nicht beiläufig neu gestaltet.

Der Reviewer hat keine produktive Aktion ausgeführt. Vor Aktivierung gelten unverändert die noch ausstehenden Abschlussnachweise des Hauptagenten; nach Aktivierung ist die echte öffentliche VPS-Domain zu prüfen. Ein Pages-Erfolg ersetzt diesen Nachweis nicht.
