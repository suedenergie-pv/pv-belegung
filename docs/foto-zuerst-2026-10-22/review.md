# Unabhängiger Review: Foto zuerst · 22.10.2026

Prüfer: `foto_zuerst_review`, ohne Produktänderungen. Umfang: neue Hauptdachfläche, ausdrückliche Fotoauswahl, offenes Maßformular mit Bild, bekannte Maße als Alternative, Entwurfsschutz und Erhalt anderer Flächen. PDF-Änderungen stammen aus paralleler Arbeit und gehören nicht zu diesem Review.

## Prüfstand

**PASS für die begrenzte Foto-zuerst-Korrektur**, isolierter Produktstand `d353882` (Hauptcheckout `0bfae1b`). Keine offenen Blocker oder Majors innerhalb dieses Änderungsumfangs. Die zwei nachgewiesenen bestehenden Dacheckenprobleme sehr kurzer Ansichten sind unten ausdrücklich ausgenommen.

44 selbst ausgeführte fokussierte Tests (`SchrittBelegung.test.tsx`, `FlaechenInlineEditor.test.tsx`) bestanden. Der Hauptagent meldet für den isolierten Stand 470 Tests, Typprüfung und beide statischen Builds bestanden, außerdem sechs vollständige Abläufe (Desktop, Tablet quer/hoch, Smartphone quer/hoch, kompakter Desktop) und acht Layoutfälle bestanden. Diese Angaben stammen vom Hauptagenten; eigene Prüfung umfasst Quelltext, ausgewählte tatsächliche Captures und den unten beschriebenen vollständigen Hashvergleich.

### F01 · Major · Behoben: Zu wenig Fotohöhe beim Maßeingeben auf Smartphone

Reproduktion im gerenderten Zustand `mobil-hoch-01-masse.png`, 375 × 812: Nach Fotoauswahl bleibt im Maßpanel nur ungefähr 74 px sichtbare Bildhöhe zwischen der Anleitung und der Zoomleiste. Die Regel `data-masse-offen=true` reserviert 68 % des Arbeitsbereichs für den Inspektor. Das Bild ist technisch vorhanden, eignet sich in dieser Aufteilung aber schlecht für den ausdrücklich angefragten Ablauf „Ziegel im Foto zählen und Maße eintragen“.

Korrektur: Der Maßzustand mit vorhandenem Foto erhält auf kompakten Hochansichten 48 % Formularanteil. Auf Smartphone entfällt dort die zusätzliche Skizze, damit die tatsächlichen Maße direkt sichtbar sind. Das Formular scrollt intern, Übernehmen/Abbrechen bleiben fest. Die Maß-zuerst-Alternative ohne Bild bleibt erhalten.

Nachprüfung anhand des tatsächlichen Dachfotos unter `final/mobil-hoch-01-masse.png`: etwa 184 px sichtbare Bildhöhe statt 74 px; beide leeren Hauptmaßfelder und feste Abschlussaktionen gleichzeitig sichtbar. Tablet-Hochformat zeigt ebenfalls Bild, Formular und Abschluss sinnvoll. Zusätzlich `klein-hoch-01-masse.png`, `kurz-hoch-01-masse.png`, `mobil-quer-01-masse.png` und den mehrflächigen Desktopzustand geprüft. Keine feste Mindesthöhe drückt in kurzen Ansichten die Abschlussaktionen aus dem Arbeitsbereich.

### F02 · Major · Behoben: Uploadziel in sehr kurzer Fotoauswahl

Die Browsermatrix zeigte bei `kurz-hoch` nur 22 px sichtbares Uploadziel. Die neue Fotoauswahl übernahm den Scrollstand der vorigen Fläche; außerdem überschrieb der bestehende EditorViewport die Scrollregel. Korrektur: eigener Schlüssel der leeren Auswahl je Fläche, Fotoeinstieg ohne feste Mindesthöhe bei kurzen Ansichten und intern scrollbar. Die Überstimmung bleibt auf diesen Fotoeinstieg begrenzt.

`final/kurz-hoch-foto-start-2.png` selbst geprüft: Auf Dachfläche 4 ist „Foto hochladen“ vollständig mit 44 px Höhe sichtbar. Die alternative bekannte Maßeingabe folgt darunter im scrollbaren Bildbereich. Die Dachflächenliste bleibt erhalten. Alle acht Layoutfälle danach laut Hauptagent bestanden.

## Bestehende Grenze außerhalb der Änderung

Bei 375 × 500 und 320 × 568 ist im nachfolgenden Dachecken-Schritt der Fortschrittsbereich nicht vollständig sichtbar. Der Hauptagent führte die unveränderten bisherigen Waltertests gegen den bisherigen produktiven Release `20261020-flachdach-gauben` aus: dieselben Fehler (Sichtbarkeitsratio 0 beziehungsweise 0,3046875). Die alte Live-Capture für 375 × 500 wurde selbst angesehen und bestätigt den bereits zuvor fast fehlenden Bildbereich und die angeschnittene Punktsetzen-Leiste. Nachweis unter `.release/foto-zuerst-baseline-result/`. Diese zwei Fälle sind ausdrücklich **nicht bestanden**; keine Testassertion wurde dafür gelockert. Das PASS bezeichnet die Foto-zuerst-Korrektur ohne neue Regression, keine vollständige Nutzbarkeit des alten Dacheckenablaufs bei diesen extrem kurzen Höhen.

## Unabhängiger Artefaktvergleich

- Alle 74 im VPS-Manifest aufgeführten Quellen gegen den isolierten Checkout gehasht: identisch.
- Alle 33 Exportdateien gegen Manifest und jeweils den Inhalt des Releasearchivs gehasht: identisch; Archiv enthält genau diese 33 Dateien, keine zusätzlichen Dateien.
- Isolierte PDF-Quelle ist nach Zeilenendnormalisierung identisch mit dem bereits committeten PDF-Stand im Hauptrepo. Die gleichzeitig bearbeitete PDF-Arbeitsdatei weicht davon ab und wurde nicht übernommen. Keine `pdf-font-data`-Quelle im Manifest.
- Keine Debug-Fotos, AGENTS-/CLAUDE-Dateien oder Release-Metadaten im Archiv.
- Aktivierungsskript ist bytegleich mit `scripts/activate-vps.sh`; vorheriger Releasepfad wird geprüft, Umschaltung erfolgt mit Rollbackschutz. Der tatsächliche Deploy und die anschließende Live-Prüfung liegen beim Hauptagenten.

Archiv-SHA256: `837e804c997f1b59057d7d3805e2ff8ac0988cc8cf372468a02bd2e130ab57e7`.

Index-SHA256: `3ee1edfffca035489ee996370fae5a80bd335fc7e47ba141911604e2bfc8f503`.

## Bereits geprüfte Eigenschaften

- Neue Fläche öffnet keine Maßpflichtansicht; „Foto hochladen“ und bewusste Projektfotoauswahl werden angeboten.
- Eine Fotozuordnung ändert ausschließlich die gewählte Fläche. Fremde Dachmaße, Aussparungen und Belegungsfelder werden dabei nicht übernommen oder ersetzt.
- Neue Maße bleiben leer und unbestätigt. Die zentrale Maßfreigabe verhindert weiterhin erste Belegung mit internen Startmaßen.
- „Maße sind bereits bekannt“ und „Dachmaße“ bleiben direkte Alternativen.
- Upload und bestehende Fotoauswahl im neuen Einstieg verwenden den bestehenden Entwurfsschutz.
- Offene Maße sperren Zeichenaktionen im Foto; Zoom/Pan sind Ansichtszustand.
- Im betrachteten Desktopzustand sind Bild, Formular und feste Übernahme klar getrennt sichtbar. Andere bereits belegte Flächen erzeugen auf der neuen offenen Fläche keinen primären Exportabschluss.

Screenshots liegen lokal und nicht im Release unter `.debug-shots/foto-zuerst-2026-10-22/final/`. Bei nur 500 px Fensterhöhe bleibt das Foto sehr klein; genaue Ziegelarbeit benötigt dort Zoom/Pan und Formularscrollen. Das ist eine praktische Grenze dieser Bildschirmhöhe. Die Sichtprüfung und Automatisierung sind kein Nutzertest mit Walter und keine native iPad-Abnahme.
