# Prüfung der echten Editorintegration

Stand 30.09.2026. Die reduzierte freigegebene Fotoeditor-Richtung ist in die normale Anwendung integriert, nicht in eine separate Kundenversion. Port 4177 ist der historische Ansichtsprototyp. Die geprüfte Produktionsfassung läuft lokal auf **http://127.0.0.1:3101**; Port 3100 wurde für Entwicklungs-QA verwendet.

## Bereits ausgeführte Prüfungen

- `npm test`: 325 Tests bestanden (135 Engine, 190 Web). Engine unverändert. Enthalten sind separate Sitzungen, Koordinaten/Zoom, Zweifingerabbruch, Griffadressierung, Gaubenmaßentwürfe, sichere Geometrievorschau und bestehende Export-/Speicherfälle.
- `npm run typecheck`: beide Workspaces bestanden.
- `npm run build`: Produktionsbuild einschließlich TypeScript und Seitenerzeugung bestanden. Anschließend als normale lokale Anwendung auf `http://127.0.0.1:3101` gestartet.
- `git diff --check`: bestanden; lediglich bestehende Git-Hinweise zu LF/CRLF.
- Bestehender Headless-Audit nach Integration: 29 bestanden, 11 gerätespezifische iOS-Auslassungen gemäß bestehender Testabgrenzung. PDF ohne Kundendaten, Teilen-/Downloadpfade, Traufe, Dachecken, Umriss, Gaubenseiten, Feldzeichnen, Verschieben, Größenänderung und Undo geprüft.
- Reliability-Szenario: fünf Zielgrößen (1440×900, 1024×768, 768×1024, 375×812, 812×375), Maßentwurf/Navigation, Projektwechsel, Undo/Redo und lokale Projektleitungsmarkierung bestanden; keine Seitenfehler oder horizontale Überläufe.
- Neues echtes Foto-Szenario mit privatem Drohnenfoto: Einrichtung, Terrassenaussparung, Zwei-Punkt-Feld bei 125% Zoom, Zweifingerabbruch ohne Modellmutation, gehaltene Pfeilaktion als ein Undo-Schritt, Redo, Export, Rückkehr mit erhaltenem Zoom und Reload vom gespeicherten Stand bestanden. Geprüft auf allen fünf Zielgrößen sowie 1023×768 als bestehender Grenzfall.
- Tatsächlich geöffnete Bilder: Desktop und Smartphone Einrichtung/Korrektur; Tablet quer Korrektur; Tablet hoch Einrichtung nach Korrektur. Browser-Evidenz unter `.debug-shots/editor-integration-2026-09-30/`; Vollseiten und echte Viewports getrennt, entscheidende Aufnahmen ab scrollY=0. Exportbilder zusätzlich vom unabhängigen Reviewer geprüft.

## Abschlussprüfung

Der umfassende finale Playwright-Lauf einschließlich der zwei ergänzten Tablet-Projekte ist abgeschlossen: `npx playwright test --workers=2 --max-failures=3 --output=test-results/finaler-editor` ergab 47 bestanden, 19 gerätespezifische Auslassungen und einen veralteten Layoutvergleich. Dieser erwartete alle Werkzeuge oberhalb des Fotos. Die Annahme wurde an die ausdrücklich beschlossene Smartphone-Leiste am unteren Rand angepasst; Touchgröße und freie Erreichbarkeit werden weiterhin geprüft. Der gezielte Gegenlauf `npx playwright test audit.spec.ts --project=mobil-hoch -g 'responsive Ebenen' --output=test-results/editor-mobil-korrektur` bestand. Damit sind alle 48 anwendbaren Fälle der sechs Projektgrößen bestanden; kein offener Testfehler. Nach dieser ausschließlich testseitigen Korrektur wurde nicht der ganze Lauf wiederholt.

Der portable Standard-Test benötigt keine private Bilddatei; private Fotoevidenz bleibt separat. Der Reliability-Test durchläuft seine eigenen fünf Größen und wird deshalb nur im Desktop-Projekt gestartet. Die 19 Auslassungen betreffen die bestehenden iOS-Testvarianten, die ausschließlich ihren vorgesehenen Browser-/Geräteprofilen zugeordnet sind.

Zusätzlich ist der komplette neue Editor-Interaktionstest gegen den laufenden Produktionsserver auf 3101 bestanden (Einrichtung bis Reload, separates Playwright-Config unter `.debug-shots/editor-integration-2026-09-30/production.config.ts`). Lokaler Start nach `npm run build`: `npm run start -w web -- -p 3101 -H 127.0.0.1`. Die Anwendung enthält keine fest eingebauten Testprojekte.

Der unabhängige Review ist PASS: fünf konkrete Major-Befunde jeweils nach einer Reparaturrunde geschlossen, kein offener Blocker/Major. Das Protokoll dokumentiert getrennte Browser-Gegenprüfungen für Trefferflächen, Perspektivabbruch, Entwurfsschutz, Gaubenmaße und Tablet-Hochformat.

Native Bedienung auf einem echten iPad ist nicht geprüft. Touch-/Pointer-Emulation und simulierte iOS-Schnittstellen sind kein Hardware-Nachweis. Kein Commit, Push oder Live-Deploy.

## Nachprüfung 01.10.2026: Dachwerkzeuge direkt erreichbar

Gauben, Umriss und Aussparungen stehen sichtbar über dem Foto. Die erste Gaube öffnet direkt ihre Anlage; Umriss und Aussparungen starten unmittelbar ihr Werkzeug. Kleine Ansichten scrollen beim Öffnen zum Editor. Bestehende Maß- und Markierungsentwürfe bleiben beim Wechsel geschützt; ein erneuter Umriss-Aufruf öffnet auch nach dem Speichern direkt die vorhandenen Griffe.

- 42 fokussierte Vitest-Tests für SchrittBelegung, FotoHintergrund und GaubenEditor bestanden; Typecheck sowie abschließender Produktionsbuild bestanden.
- Der erweiterte Editor-Interaktionstest mit dem privaten Drohnenfoto bestand bei 1440×900, 1024×768, 768×1024, 375×812 und 812×375. Smartphone-Hochformat benötigte eine Korrektur des Testklicks: vor einer gehaltenen Pfeilaktion prüft eine Locator-Aktion nun die freie Erreichbarkeit gegenüber der festen unteren Leiste. Nach der Scroll-Anpassung beide Smartphone-Ausrichtungen erneut bestanden.
- Bestehende Umriss- und Gauben-Audits auf Desktop und Smartphone bestanden (vier Fälle). Zwei Umriss-Selektoren wurden an den nun sichtbaren Buttonnamen angepasst; die Geometrieprüfungen blieben erhalten.
- Die abschließende Produktionsfassung auf 3101 bestand den vollständigen erweiterten Editor-Interaktionstest auf Desktop und Smartphone, einschließlich erneutem Direkteinstieg nach Umriss-Übernahme. Keine Seitenfehler oder horizontalen Überläufe in diesen Tests.
- Tatsächlich gesichtete Viewport-Captures: Dachwerkzeuge, Gaubenanlage und Umriss auf Desktop/Smartphone sowie Tablet quer/hoch und Smartphone quer unter `.debug-shots/editor-integration-2026-09-30/`. Produktionsbilder tragen `produktion-desktop-*` bzw. `produktion-mobil-*`; geöffnete Werkzeuge werden in ihrer tatsächlichen Scrollposition aufgenommen. Der lange erste Playwright-Prozess blieb nach den fünf Testergebnissen in der Windows-Serverbereinigung hängen und wurde nach den gezielten Gegenläufen beendet; daraus wird kein erfolgreicher Prozessabschluss behauptet.

Lokale Vorschau auf derselben Adresse aktualisiert. Kein Commit, Push oder Live-Deploy. Native iPad-Prüfung weiterhin offen.

## Nachprüfung 01.10.2026: Tablet-Fadenkreuz

Touchgeräte aktivieren die Fadenkreuz-Bedienung bei Traufe, Dachecken, Umriss, Aussparungen, Ziegelstrecken, Gauben und nachträglicher Perspektivkorrektur automatisch. Auch ein primäres Trackpad verhindert die Touch-Erkennung nicht. Ein Finger verschiebt das Kreuz relativ; Loslassen oder Antippen des Fotos bestätigt keinen Punkt. Die feste Bestätigungsleiste liegt außerhalb des Bildes, bleibt beim Scrollen der Einstellungen erreichbar und benennt „Punkt setzen“, „Ecke greifen“ oder „Ecke hier ablegen“. Zwei Finger steuern ausschließlich die Ansicht; das Kreuz bleibt im sichtbaren Bildausschnitt. Die vorhandene direkte Mausbedienung und Feldwerkzeuge bleiben erhalten.

Der vertrauenswürdige Chromium-Touchlauf reproduzierte einen fehlenden nachfolgenden `click` nach einer Wischgeste: `pointerup` erreichte den Bestätigungsbutton, die Aktion blieb vorher aus. Die Bestätigung verarbeitet deshalb Touch-/Stift-`pointerup` mit Schutz gegen nachfolgende doppelte Klicks und verwirft Wischbewegungen über dem Button. Damit ist ein konkreter Fehler behoben; die Ursache des früheren echten iPad-Ausfalls ist dadurch nicht bewiesen. Zusätzlich erhält die Perspektivkorrektur auch während der noch offenen Fotoeinrichtung den zugehörigen Bildeditor. Vorher konnte dort die Korrekturleiste neben dem alten Markierungswerkzeug stehen.

Prüfungen:

- Vollständiger Web-Vitest-Lauf: 194 bestanden. Nach Ergänzung des offenen Einrichtungszustands 48 betroffene Komponententests bestanden; nach der abschließenden Gauben-Textergänzung alle drei Gauben-Komponententests erneut bestanden. Ein früherer Test erwartete noch unmittelbares Ziehen per Touch und prüft jetzt ausdrücklich den unveränderten Entwurf bei Einfinger-/Zweifingereingaben. Die Gesamtheit umfasst nun 195 Web-Testfälle; kein offener Testfehler.
- Abschließender Typecheck beider Workspaces und Produktionsbuild bestanden. Engine unverändert.
- Produktionsserver `http://127.0.0.1:3101`: acht erfolgreiche Durchläufe mit `playwright.touch.config.ts`, Chromium und WebKit jeweils bei 1024×768, 768×1024, 375×812 und 812×375. Dachmarkierung, Aussparung, Cursor nach Zoom, Einstellungen scrollen, Gaubenanlage, einzelne Gaubenecke versetzen und Perspektiventwurf abbrechen geprüft. Keine Seitenfehler oder horizontalen Überläufe; Bestätigungsbutton mindestens 44 px hoch, vollständig im Viewport, unterhalb des Fotos und per Hit-Test frei erreichbar. Nach der letzten reinen Gauben-Textergänzung WebKit Tablet quer und Smartphone nochmals bestanden.
- Eingabebelege getrennt: Chromium verschiebt per CDP-Touch-Eingabe; WebKit verschiebt per synthetischen PointerEvents. Beide bestätigen über Playwright-Touchscreen-Taps; Pinch wird in beiden Engines mit PointerEvents geprüft. Diese Prüfungen sind Browser-Emulation, kein Nachweis für native iPad-Gesten.
- Bestehender Desktop-Mausablauf einschließlich Einrichtung, Umriss, Feldzeichnen, Zoom, Korrektur, Export und Reload bestanden. Neuer portabler Touch-Test ohne privates Foto auf Chromium ebenfalls bestanden: ein erzeugtes neutrales 1600×900-Testbild ersetzt die ungeeignete 1×1-Pixel-Fixture, deren Firstlinie die bestehende Mindestlänge unterschritt. Ein früherer Dev-Lauf scheiterte beim Warten auf `load`; die abschließenden Prüfungen liefen gegen die Produktionsfassung mit DOM-Bereitschaft und sichtbaren Bedienzuständen.
- Tatsächlich gesichtete Produktionsbilder unter `.debug-shots/tablet-fadenkreuz-2026-10-01/`: Tablet quer/hoch und Smartphone hoch/quer, jeweils freie Bildfläche und separate Punktleiste. Abschließende WebKit-Gaubenansichten Tablet quer/Smartphone zusätzlich geöffnet. Das private Drohnenbild und alle Screenshots bleiben im ignorierten QA-Verzeichnis.

Reproduzierbar mit PowerShell: `$env:PV_QA_URL = 'http://127.0.0.1:3101'; npx playwright test --config playwright.touch.config.ts`. Für private Fotoevidenz zusätzlich `PV_QA_PHOTO` auf die lokale Datei setzen. Technische Grundlagen wurden gegen [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/) und [WebKit zu iPad-Eingabegeräten](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/) geprüft.

Die lokale Produktionsvorschau auf 3101 ist aktualisiert; der nur für QA gestartete Entwicklungsserver wurde beendet. Native iPad-Prüfung bleibt offen. Kein Commit, Push oder Live-Deploy.
