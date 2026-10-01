# Workbench: Ausführung 01.10.2026

Auftrag: „dann plan es und setz es um“ nach dem konkret beschriebenen Workbench-Aufbau. Die neue Anordnung ersetzt die abgelehnte Gestaltung. Die bestätigte Richtung ist das große reale Foto mit linker beschrifteter Werkzeugleiste, rechter Dachhierarchie/Eigenschaften und fester Bestätigung außerhalb des Fotos. Es wird keine neue Richtungsentscheidung vom Nutzer verlangt. Dieser interne Editor ist keine Marketing- oder Conversion-Seite.

## Evidence und Gestaltungsvertrag

Die aktuelle Anwendung ist funktional, aber besitzt auf Desktop etwa 340px vor dem Foto, viele optisch gleichrangige Knöpfe und wechselnde eingerahmte Hinweisbereiche. Die letzten echten Aufnahmen liegen unter `.debug-shots/tablet-fadenkreuz-2026-10-01/`; der Nutzer lehnt dieses gestalterische Ergebnis ausdrücklich ab. Frühere technische Review-Pässe gelten nicht als gestalterische Abnahme dieser Revision.

Primärreferenzen (im vorangegangenen Rechercheturn direkt geöffnet): [Photoshop Workspace, 05.06.2026](https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/workspace-overview.html) trennt Dokumentfläche, Werkzeuge, Optionen und Panels. [Photoshop iPad Workspace](https://helpx.adobe.com/photoshop/ipad/get-started/overview-and-setup/workspace-ipad.html) zeigt kontextbezogene Werkzeuge und angedockte Optionen. Übertragen werden feste Orte und die Bildhierarchie. Unsere Beschriftungen, Dachhierarchie, Maßfreigabe und getrennte Punktbestätigung bleiben auf die Vertriebsaufgabe zugeschnitten.

Visuelle Prämisse: Das echte Drohnenfoto ist die dominante Arbeitsfläche. Anthrazit bildet den ruhigen Bildhintergrund, helle neutrale Inspektorflächen die Bedienung. Orange markiert die aktive Tätigkeit und die primäre Übernahme. Kleine Radien, Trennlinien, gemeinsame Typografie und zusammenhängende Panels ergeben eine präzise Arbeitsoberfläche. Keine dekorativen Karten, Farbhinweise nur für tatsächliche Warnungen/Fehler. Unveränderte kanonische Moduloptik. Das private Foto wird nur für lokale Prüfungen verwendet.

## Pakete und Abnahme

1. **Struktur:** Kompakte App-/Projekt-/Schrittnavigation, feste Editorhöhe, linke beschriftete Werkzeugleiste, rechter Inspektor mit hierarchischer Flächenwahl, feste Zoom-/Punktleiste. Kein Seitenüberlauf im Editor. Einrichtung, Belegung und Korrektur verwenden dieselbe Struktur. Auf schmalen Geräten bleibt die Bildfläche bei geöffneten Einstellungen sichtbar.
2. **Integration und Gestaltung:** Vorhandene Aktionen und Handler verwenden; Entwurfs- und Historiengrenzen nicht verschieben. Ein konsistentes Icon- und Kontrollsystem. Direkte Zugänge zu Gaube/Umriss/Aussparung. Hauptaktionen mindestens 44×44, aktive Texte 4,5:1. Unterschiede von Fachwarnung, Status und Anleitung bewahren.
3. **Releaseweg:** Isolierter statischer Build ohne Entfernen der lokalen API-Route, Prüfung unter `/pv-belegung`, vollständige Assetpfade, Speicherung/Reload und Export. CI führt Tests/Typecheck und statischen Smoke vor Veröffentlichung aus. Keine Kundendaten oder QA-Artefakte im Build.
4. **Prüfung:** Bestehende Unit-/Engine-/Browserfälle, neue Workbench-Geometriechecks, tatsächliche Bilder 1440×900 / 1024×768 / 768×1024 / 375×812 / 812×375. Browser ausschließlich repo-eigen headless. Unabhängiger Funktions- und visueller Review nach deterministischer QA, höchstens drei Reparaturen je Defektklasse. Derselbe reproduzierbare unveränderte Fehler zweimal beendet die betreffende Schleife zur Ursachenbewertung.

Keine neuen elektrischen Regeln, neuen Datenquellen, Cloud- oder Ticketsystemarbeit. Bestehende uncommittete Änderungen werden bewahrt. Kein Push/Deploy in diesem Auftrag; native iPad-Bedienung bleibt als echte Praxisabnahme offen und wird nicht durch WebKit-Emulation ersetzt.
