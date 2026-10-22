# Unabhängiger Review: Erstes Verschieben nach Feldzeichnen · 22.10.2026

Prüfer: `foto_zuerst_review`, ohne Änderungen am Produktcode. Produktfix: `1e5b24b`; nachfolgende Testkorrekturen `9d96429` und `64d6916` ebenfalls gelesen. Isolierter abschließender Stand: `b51f2b0`.

## Prüfstand

**PASS für den eng begrenzten Fix des ersten Feldzugs. Keine offenen Blocker oder Majors in diesem Änderungsumfang.**

51 fokussierte Tests selbst ausgeführt und bestanden: `DachSvg-interaktion.test.tsx`, `SchrittBelegung.test.tsx`, `EditorViewport.test.tsx`. Der Hauptagent meldet im isolierten Stand 471 Tests und Typprüfung bestanden, beide statischen Builds bestanden, 19 Feld-Browserfälle bestanden/1 ausdrücklich ausgelassen, sechs Hybrid-Eingabefälle, zwei vollständige Walter-Abläufe und zwei VPS-Smokes bestanden. Das Abschlussprotokoll der Feldmatrix unter `.release/feld-drag-final-bestaetigt/.last-run.json` selbst gelesen: `passed`, keine fehlgeschlagenen Tests. Die unabhängigen eigenen Prüfungen sind Quellreview, die genannten 51 Tests, ausgewählte Captures und der unten stehende vollständige Artefaktvergleich. Pages-Smokes waren bei Erstellung dieses Reviews noch beim Hauptagenten in Arbeit.

Die neutralen Desktop-Captures unmittelbar nach Feldzeichnen und erstem Zug sowie der Smartphone-Zustand nach sofortigem Ziehen wurden selbst angesehen: Feldposition geändert, Auswahl, Griffe und bestehende Workbench weiterhin erkennbar.

## Ursache und Eingrenzung

Laut der vom Hauptagenten aufgezeichneten Reproduktion entsteht beim Feldzeichnen über einem Mehrflächenfoto eine native Browser-Textauswahl der SVG-Flächenbeschriftungen. Der folgende Zug im korrekt getroffenen Feld verliert den Pointer-Capture und verschiebt das Feld nicht. Abwählen und erneutes Auswählen beseitigen diese Browserauswahl und erklären den gemeldeten Workaround. Der Hauptagent hat den bisherigen Fehler zusätzlich mit einer portablen, anonymen Vierflächen-Fixture reproduziert. Die früheren Einflächenfälle konnten den Fehler deshalb nicht aufdecken.

Meine Prüfung bestätigt die passende Eingrenzung des Fixes:

- `pointerHandler` unterbindet den nativen Browserstandard erst nach primärer/linker Taste und erfolgreicher Projektion auf Meterkoordinaten. Rechts-/Mitteltaste und ungültige Projektion behalten ihre bisherigen Ausstiege.
- Der nun ausdrücklich gesetzte SVG-Fokus verwendet `preventScroll: true`, damit der entfallende native Fokuswechsel die bestehende Pfeiltasten-/Escape-Bedienung nicht unterbricht oder die Ansicht verschiebt.
- `userSelect` und `WebkitUserSelect` werden nur an den beiden SVG-Zweigen mit aktiver Feld-Pointersteuerung ausgeschaltet. Fotos, Maßformulare, Module-An/aus und Perspektiventwürfe werden nicht pauschal verändert.
- Pointer-Capture und dessen vorhandener Abbruchschutz bleiben bestehen. Der Fix unterdrückt die konkurrierende native Textziehgeste; er kaschiert keinen verloren gegangenen Capture durch nachträgliches Speichern.
- Keine Änderung an Engine, Modulmaßen, Auswahlpriorität, Griff-Fang, Raster-Snap, Pan-/Zweifingergesten oder Historienregeln.

## Regressionsevidence

Der neue anonyme Vierflächenfall zeichnet über Beschriftungen, verlangt danach eine leere Browserauswahl und verschiebt das automatisch ausgewählte Feld unmittelbar beim ersten Zug im Inneren. Er benötigt weder erneute Auswahl noch eine künstliche Wartezeit für die lokale Speicherung. Weitere neue Fälle prüfen Zeichnen bei vorhandenem Feld sowie automatische Belegung, sofortiges Ziehen und Rückgängig. Die Unitprüfung kontrolliert zusätzlich verhinderten Browserstandard, erhaltenen SVG-Fokus und die bisherige Capture-Abbruchbehandlung.

Der Test kann optional ein lokales Kundenprojekt aus einer Umgebungsvariable lesen; dieses Projekt gehört nicht zum Testcode oder Release. Die portable Standard-Fixture enthält nur neutrale Flächengeometrie und eine einfarbige Grafik.

## Bekannte Grenze des Prüfstands

Der neue Vierflächenfall ist bei 812 × 375 ausdrücklich ausgelassen: Vorhandene Dachnamen-Schaltflächen überdecken bei dieser komprimierten Darstellung den gewählten Zeichenstart. Die Fehlercapture unter `.release/feld-drag-final/` selbst angesehen. Der Ablauf gelangt so nicht bis zum untersuchten ersten Verschieben. Der Hauptagent bestätigt denselben Fehler vor der Feldanlage mit unverändertem Test gegen den bisherigen öffentlichen VPS-Stand; der Nachweis liegt im isolierten Checkout unter `.release/feld-drag-alt-quer/`. Die übrigen drei Querformat-Feldfälle bleiben unverändert Bestandteil der Matrix und haben laut Abschluss bestanden. Die Auslassung gilt nicht als bestandener Test und bestätigt keine vollständige Nutzbarkeit dieser engen Mehrflächenansicht.

## Unabhängiger Releasevergleich

Alle 74 Quellen des VPS-Manifests gegen den isolierten Checkout gehasht: identisch. Alle 33 statischen Exportdateien gegen Manifest und jeweils gegen den tatsächlichen Inhalt des Releasearchivs gehasht: identisch. Das Archiv enthält genau diese 33 Dateien und keine zusätzlichen Dateien.

Die PDF-Quelle im isolierten Checkout ist nach Zeilenendnormalisierung identisch mit der bereits committeten PDF-Quelle des Hauptrepos. Die parallelen uncommitteten PDF-Arbeiten und `pdf-font-data` sind nicht Teil dieses Releases. Keine privaten Projektdateien, Debug-Fotos, AGENTS-/CLAUDE-Dateien oder lokalen QA-Artefakte im Archiv.

Manifest: `.release/feld-drag-vps-manifest.json`.

Archiv: `.release/20261022-feld-sofort-ziehen.tar.gz`.

Archiv-SHA256: `d18010121653be75210c62d827fd63211398f260e1e0ebd568e4c837fae51a7e`.

Index-SHA256: `30c518e12317f4b9181684cfc89520f1d49d54ef4e07261bc44e224adcf19e81`.

Produktiver Deploy und anschließende Live-Prüfung sind Aufgabe des Hauptagenten und werden durch diesen Review nicht vorweggenommen.

Eine erfolgreiche Browsermatrix ist ein Funktionsnachweis; sie ersetzt weder eine native iPad-Prüfung noch einen Nutzertest mit Walter.
