# Laufender Stand der Editorintegration

Die reduzierte Richtung aus `echtfoto-entwurf.md` ersetzt A/B/C. Der Nutzer antwortete auf die konkrete Richtungsfrage mit „ok. Kannst mir ne preview geben zum klicken? lokal“. Die nächste Klarstellung verlangt die reguläre Umsetzung des schon beauftragten Plans; keine Sonderversion für das gelieferte Haus. Der unabhängige Ansichtsreview ist abgeschlossen. Diese Freigabe betrifft die Editorstruktur, nicht einen Push oder Deploy.

Die lokale Adresse auf Port 4177 zeigte ausschließlich den Ansichtsprototyp. Die echte Anwendung wird separat mit der bestehenden Engine und dem bestehenden Projektspeicher integriert. Das gelieferte Foto bleibt privates, nicht versioniertes Testmaterial; keine Maßannahmen werden als Kundenprojekt eingebaut.

## Abgegrenzte Arbeiten

- Gemeinsamer Editor: aktive Fläche/Foto, aufrufbare Werkzeuge, reale Feldaktionen, Auswahl und Zweipunkt-Zeichnen; bestehende Handler weiterverwenden.
- Fotoeinrichtung: vorhandene Trauf-/Perspektiv-/Umriss-/Hindernislogik in den gemeinsamen Arbeitsbereich integrieren, ehrliche Maßbestätigung und Vorschau erhalten.
- Sitzungszustand und Ansicht: Zustand je Projekt außerhalb des Schritts; Zoom/Pan und Zweifinger-Abbruch von Modellgesten, vorhandene Koordinatenprojektion respektieren.
- Danach gezielte Regression, kompletter Testlauf, Typecheck/Build, tatsächliche Bildprüfung und unabhängiger Review. Maximal drei Reparaturrunden pro Defektklasse. Native iPad-Abnahme bleibt separat.

Bestehende fremde oder bereits vorhandene Änderungen bleiben erhalten, insbesondere `apps/web/lib/pdf-export.ts`, lokale Agent-/Claude-Dateien und generierte Dateien. Keine Engine-Änderung und kein Push vorgesehen.

## Integrierter lokaler Stand

Die geprüfte Produktionsfassung auf http://127.0.0.1:3101 verwendet jetzt den gemeinsamen Editor (Port 3100 war der Entwicklungsserver). Aktive Fläche, Perspektive, Werkzeug, Auswahl und Zoom/Pan bleiben je Projekt in der Sitzung erhalten. Foto-/Gaubenmarkierung und Belegung nutzen denselben Bildbereich. Bestehende Flächen ohne Foto behalten ihre Draufsicht. Auswahl erzeugt keine Felder; zwei Punkte oder Ziehen sind ausdrückliche Zeichenwerkzeuge. Auf Smartphones bleiben die Hauptaktionen unten erreichbar.

Reale Modellaktionen, Engine-Raster, Fotospeicher, Rückgängig/Wiederherstellen und PDF sind verbunden. Geometrievorschau sperrt Feldänderungen bis zur Übernahme; Gaubenmaßentwürfe verwenden denselben Navigationsschutz. Zweifingergesten verwerfen eine laufende Feld-/Perspektiv-/Gaubenpunktbewegung und ändern nur die Ansicht. Fotoersatz ist eine vollständige rückgängig machbare Projektänderung; er benötigt anschließend neue Kalibrierung.

Prüfstand und noch ausstehende Prüfungen stehen in `pruefung-integration.md`; unabhängige Befunde in `review-editorintegration.md`. Das originale Drohnenfoto wird ausschließlich in Wegwerfkontexten der lokalen QA verwendet. Kein Kundenprojekt und keine Maße werden in die Anwendung eingebaut.
