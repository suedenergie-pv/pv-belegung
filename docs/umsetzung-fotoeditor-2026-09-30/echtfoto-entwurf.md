# Fotoeditor – Revision mit echtem Drohnenfoto

30.09.2026. Der Nutzer hat die bisherigen Ansichten als unübersichtlich abgelehnt und ein eigenes Drohnenfoto geliefert. Die frühere Empfehlung A ist damit überholt. Dieses Dokument hält den damaligen Ansichtsprototyp fest. Anschließend bestätigte der Nutzer die reduzierte Richtung und verlangte die reguläre Umsetzung; aktueller Integrations- und Prüfstand: `integration-status.md` und `pruefung-integration.md`.

## Überarbeiteter Aufbau

- Das Foto belegt die volle Breite. Keine dauerhafte Flächenliste und kein dauerhaft geöffneter Eigenschaftenbereich.
- Oben: drei Hauptschritte, kompakte Flächenwahl, Auswählen/Feld zeichnen/Verschieben sowie Rückgängig/Wiederherstellen.
- Erst das Antippen eines Feldes öffnet dessen Werkzeuge. Dachdetails und Fotoverwaltung sind aufrufbar.
- „Alle Felder auswählen“ und „Module aus-/einblenden“ sind über „Mehr“ erreichbar. Bei Mehrfachauswahl nennen die Feldaktionen ihren Umfang.
- Maßeingaben und Korrektur erscheinen in einem aufrufbaren Bereich; Abschlussaktionen bleiben fest sichtbar. Auf schmalen Geräten liegt der Kontext unter dem Foto.
- Smartphone hoch zeigt zunächst einen gekennzeichneten Arbeitsausschnitt. „Alles anzeigen“ stellt die gesamte Dachansicht wieder her. Die Verschiebefunktion ist über „Mehr“ erreichbar.

![Tablet: ruhige Arbeitsansicht](C:/Users/Genrih-PC/Desktop/pv-belegung/.debug-shots/fotoeditor-echtfoto-2026-09-30/placement-tablet-quer.png)

![Tablet: Werkzeuge erst bei Auswahl](C:/Users/Genrih-PC/Desktop/pv-belegung/.debug-shots/fotoeditor-echtfoto-2026-09-30/placement-field-tablet-quer.png)

[Einrichtung](C:/Users/Genrih-PC/Desktop/pv-belegung/.debug-shots/fotoeditor-echtfoto-2026-09-30/setup-tablet-quer.png) · [Korrektur](C:/Users/Genrih-PC/Desktop/pv-belegung/.debug-shots/fotoeditor-echtfoto-2026-09-30/correction-tablet-quer.png) · [Smartphone](C:/Users/Genrih-PC/Desktop/pv-belegung/.debug-shots/fotoeditor-echtfoto-2026-09-30/placement-mobil-hoch.png) · [Smartphone quer](C:/Users/Genrih-PC/Desktop/pv-belegung/.debug-shots/fotoeditor-echtfoto-2026-09-30/correction-mobil-quer.png)

## Echtes Foto, illustrative Planung

Das gelieferte Foto wurde unverändert in den lokalen, gitignorierten `.debug-shots`-Ordner kopiert. Es ist weder in der Produktion noch als öffentliches Asset eingebaut. Die Moduloptik stammt aus dem vorhandenen kanonischen Asset. Die gezeichneten Modulpositionen, 24 Module / 11,04 kWp und die Zahlen der Korrekturansicht sind ausdrücklich Beispieldaten. Sie sind kein aus dem Foto abgeleitetes Aufmaß und kein Engine-Ergebnis. Die echte Fläche besitzt hier keine bestätigten Maße oder Perspektive.

Der Prototyp demonstriert Ansichtswechsel, Feldauswahl, aufrufbare Bereiche, Zoom und Ansichtverschiebung. Maßübernahme, Zeichnen, Resize, Löschen, Historie und Export verändern keine echten Projektdaten. Zweifingergesten und native iPad-Bedienung wurden damit nicht nachgewiesen.

## Prüfungen dieser Revision

Repository-eigenes Playwright headless über `.debug-shots/fotoeditor-echtfoto-2026-09-30/render.cjs`: vier Zustände auf fünf Größen (1440×900, 1024×768, 768×1024, 375×812, 812×375), 20 Screenshots; keine Seitenfehler, kein Overflow, keine HTML-Bedienelemente unter 44×44 und keine abgeschnittenen Abschlussaktionen. Pro Größe Auswahl → Bereich schließen → Dachdetails öffnen geprüft. Metriken: `qa.json` im gleichen Ordner.

Nach dem ersten unabhängigen Review: Beispielkennzeichnung dauerhaft in allen Größen, erreichbare Sammelauswahl und Modulwerkzeug ergänzt, ausgewähltes Feld auf Smartphone vollständig eingepasst. `check-actions.cjs` prüft die Erreichbarkeit dieser beiden Aktionen und die Beispielkennzeichnung über alle fünf Größen; bestanden, dokumentiert in `qa-actions.json`. Die eigentliche Modul-/Feldmutation bleibt außerhalb dieses Ansichtsprototyps.

Vom Ersteller tatsächlich betrachtet: Tablet quer leerer Kontext und Feldauswahl, Smartphone hoch vor/nach Ausschnittkorrektur, Smartphone quer Korrektur. Zusätzlicher unabhängiger Sichtreview: `review-echtfoto.md`.

Zum Zeitpunkt dieser Entwurfsrevision wurden nur der Ansichtsprototyp und seine Dokumentation geändert. Die spätere echte Integration ist separat dokumentiert; diese historischen Beispielansichten sind kein Funktionsnachweis. Eine Veröffentlichung wurde nicht vorgenommen.
