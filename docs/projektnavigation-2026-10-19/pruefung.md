# Projektnavigation – Prüfung 19.10.2026

Umgesetzt: normaler Einstieg über „Meine Projekte“, bewusste Neuanlage und Fortsetzen, explizite Projekt-URLs per Hash (VPS und Pages), getrennte Kundenidentität und Projektzugänge, Schrittnamen „Projektdaten“, „Dach & Belegung“, „Export“. Eine neue Belegung entsteht erst durch Neuanlage. Die freigegebene Workbench, Engine und Speicherformate bleiben erhalten.

## Ausgeführte Prüfungen

- `npm test`: 141 Engine- und 222 Web-Tests bestanden (363). Nach finalen Beschriftungs-/Testkorrekturen `npm run test -w web -- app/page.test.tsx`: 11/11 bestanden.
- `npm run typecheck`: bestanden. `git diff --check`: bestanden.
- `npx playwright test --config=playwright.projekt.config.ts --output .debug-shots/navigation-2026-10-19/navigation-final`: 10/10 bestanden. Desktop 1440×900; Tablet quer 1024×768 und hoch 768×1024 mit WebKit/Touch; Smartphone hoch 375×812 und quer 812×375 mit Chromium/Touch.
- Die Navigationsfälle prüfen leeren Einstieg, Neuanlage/Kundenfokus, mehrere Kunden, Fortsetzen, Root-Aufruf trotz gespeichertem Projekt, expliziten Reload, fehlenden Projekt-Link, Browser-Zurück/Vor, Bleiben/Verwerfen/Übernehmen offener Maßentwürfe sowie Schutz bei Neuanlage.
- `npx playwright test editor-interaction.spec.ts reliability.spec.ts workbench-layout.spec.ts --project desktop --project mobil-hoch --project mobil-quer --output .debug-shots/navigation-2026-10-19/editor-final`: 7/7 bestanden. Darin Sitzungshistorie/Entwurfsschutz zusätzlich auf allen fünf Zielgrößen und vorhandene Einrichtung, Zoom/Gesten, Korrektur, Export, Reload sowie mehrere Dachflächen.
- `npm run build:vps` und `npm run build:pages`: beide endgültigen statischen Artefakte erfolgreich gebaut.
- `npm run test:vps` und `npm run test:pages`: jeweils 2/2 bestanden. Desktop/Smartphone, Assets und Basepath, Fotoeinrichtung, Belegung, echter PDF-Download und Reload gegen exakt die lokalen Artefakte.
- `evidence.json` und `exec-plan.json` mit den globalen orchestrate-agent-work-Validatoren geprüft: gültig.

## Sichtprüfung und Review

Aktuelle Ansichten unter `.debug-shots/navigation-2026-10-19/umsetzung/`: leerer Einstieg, Projektdaten, Editor und gefüllte Projektliste auf fünf Größen. Hauptagent hat entscheidende Desktop-/Tablet-/Mobile-Ansichten geöffnet; separater Reviewer hat alle 20 Aufnahmen geöffnet. Finale Bildaufnahme wartet auf Schriftladung und stabilisiert den Scrollzustand. Zusätzlich finale statische VPS-Editoransichten auf Desktop/Smartphone geöffnet. Unabhängiger Review: `review.md`, keine offenen Blocker oder Majors.

Während der Prüfung behoben: mobile intrinsische Kopfzeilenbreite sowie Überlagerung von Schritten und Historie im Projektdaten-Schritt. Der zunächst fehlgeschlagene Editor-Reload im mobilen Querformat bestand isoliert und anschließend im vollständigen finalen 7-Fälle-Lauf. Die finale Navigation besteht nach diesen Korrekturen auf allen fünf Größen.

## Grenzen und Arbeitsstand

Kein Nutzertest oder native iPad-Praxisabnahme; Touch/WebKit sind Emulation. Kein Commit, Push oder Deploy. Lokale Vorschau über den gestarteten Entwicklungsserver auf `http://localhost:3100/`.

Die vor Auftrag vorhandenen Änderungen an `apps/web/next-env.d.ts` und lokalen Agent-/Claude-Dateien wurden erhalten. Weitere Änderungen beschränken sich auf Projektnavigation, die betreffenden Oberflächen, SPEC, zugehörige Tests und diese Prüf-Evidence. Keine Engine- oder Datenblattänderung.
