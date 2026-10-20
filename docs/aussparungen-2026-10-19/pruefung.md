# Aussparungen bearbeiten · 19.10.2026

Lokaler Stand, kein Commit, Push oder Deploy. Bereits bestehende Änderungen an Navigation und Fotoeinrichtung erhalten. Nutzer bestätigt frei einzeln verschiebbare Ecken.

Manuelle Aussparungen können im Foto oder in der Liste ausgewählt werden. Ganze Kontur verschieben, Eckpunkte frei verziehen, Rahmenbreite/-höhe proportional ändern, Zentimeterknöpfe und Tastatur verwenden. Entwurf bleibt lokal bis zur Übernahme; ein Historieneintrag, Undo/Redo und bestehender Navigationsschutz. Touch verwendet vorhandenes Fadenkreuz mit Greifen/Ablegen. Ungültige Konturen sind sichtbar gesperrt. Bestehende Rechtecke bleiben kompatibel, exakte Konturen werden bereits durch Engine und Renderer unterstützt und bei Dachmaßänderung mitgeführt. Automatische Gaubenaussparungen bleiben gekoppelt.

Ausgeführt und bestanden:

- `npm test`: 141 Engine- und 242 Webtests, darunter neue Transformations-, Polygonfilter-, Entwurfs-, Löschfortsetzungs- und Undo-Regressionsfälle.
- `npm run typecheck`; abschließender statischer Build führt TypeScript erneut aus.
- `playwright.aussparungen.config.ts`: 5/5 Desktop, Tablet quer/hoch, Smartphone quer/hoch. Verschieben, freie Ecken, Maßänderung, Verwerfen, Navigationsdialog, Undo/Redo, Reload; mobile Abschlussleiste anschließend erneut 2/2.
- `playwright.touch.config.ts`: 2/2 Chromium Smartphone und WebKit Tablet quer, einschließlich Verschieben per Touch-Fadenkreuz, Pinch und anschließendem Gaubenablauf.
- `npm run build:vps` und `npm run test:vps`: statischer lokaler Build und 2/2 Desktop/Mobile bis PDF und Reload.
- `git diff --check`, ExecPlan-Validator.

Captures in `.debug-shots/aussparungen-2026-10-19/`, mit vorhandenem lokalem Drohnenfoto. Desktop und alle vier Tablet-/Mobilegrößen tatsächlich geöffnet. Finale mobile Leiste stellt Verwerfen/Übernehmen nebeneinander dar, damit Maße mehr Platz erhalten. Keine Fotos neu versioniert. Portable E2E-Fallbackgrafik, wenn die lokale Fixture fehlt.

Unabhängiger Review: `review.md`, PASS nach Reparatur dreier reproduzierter Fälle mit alten Auswahlständen. Keine offenen Blocker/Majors. Die native iPad-Praxisabnahme ist durch Headless-Tests nicht nachgewiesen. Präzise Arbeit auf kleinen Displays verwendet den vorhandenen Zoom.
