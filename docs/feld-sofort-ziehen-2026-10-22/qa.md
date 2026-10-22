# Erstes Verschieben eines neuen Felds · 22.10.2026

Auftrag: Das automatisch ausgewählte, neu gezeichnete Modulfeld muss beim ersten Zug im Inneren verschiebbar sein. Abwählen und erneutes Anwählen dürfen keine Voraussetzung sein. Bestehende Eingaben und Gestaltung erhalten; nach bestandener Prüfung produktiv deployen (fortgeltender Nutzerauftrag).

## Reproduktion und Ursache

Mit ausdrücklicher Erlaubnis den bestehenden Chrome-Tab betrachtet und über „Rohdaten sichern“ eine lokale Projektsicherung erhalten. Kundendaten und Foto ausschließlich in gitignorierter lokaler QA verwendet; den tatsächlichen Projektstand im Nutzertab nicht verändert.

Der einfache Einflächen-Test reproduzierte den Fehler nicht. Das tatsächliche Vierflächenprojekt reproduziert ihn: Beim Aufziehen werden unterliegende SVG-Beschriftungen als Browsertext ausgewählt (`A\nB\nC\n` in der anonymen Reproduktion). Beim nächsten Innenzug ist der richtige Feldpfad getroffen, aber die native Textziehgeste beendet den Pointer-Capture; der Pfad bleibt unverändert. Abwählen/erneut Anwählen entfernt die Textauswahl und lässt denselben Zug funktionieren. Eine neutrale Vierflächen-Fixture reproduziert den Fehler auf dem alten Artefakt ebenfalls.

## Enger Fix

Produktcommit `1e5b24b`: Im Feld-Pointerpfad nach linker Taste und gültiger Meterprojektion `preventDefault()` sowie ausdrücklicher SVG-Fokus mit `preventScroll`. In beiden interaktiven SVG-Zweigen `userSelect: none` und `WebkitUserSelect: none`. Keine Änderung an Geometrie, Engine, Capture-Abbruchschutz, Auswahlpriorität, History oder Gestaltung. Testtypkorrektur `9d96429`, ausdrückliche Prüfstandsgrenze `64d6916`.

## Ausgeführte Prüfung

- Isolierter Checkout: `C:/Users/Genrih-PC/Desktop/Projekte/Worktrees/pv-belegung/foto-zuerst-20261022`, Produktcode identisch mit obigen Commits. Parallel vorhandene PDF-Änderungen im Hauptcheckout ausdrücklich ausgeschlossen.
- 471 Unit-/Engine-Tests bestanden (168 Engine, 303 Web); Typprüfung bestanden. Unabhängiger Reviewer zusätzlich 51 fokussierte SVG-/Feld-/Viewporttests bestanden.
- Statischer VPS-Build und getrennter Pages-Build bestanden; beide jeweils zwei Desktop-/Mobil-Smokes einschließlich PDF und Reload bestanden.
- Finale Feldmatrix: **19 bestanden, ein ausdrücklich ausgelassener Fall** auf fünf Größen. Enthält sofortigen Innenzug nach Zeichnen und Automatik, überlappende Felder, native emulierte Touchzüge auf Smartphone, Gruppen-/Modulaktionen und Rückgängig.
- Tatsächliches privates Vierflächenprojekt: **vier bestanden, ein ausgelassener Fall**; Desktop, Tablet quer/hoch und Smartphone hoch. Neues Feld sofort innen gezogen, keine Ab-/Wiederanwahl. Browserauswahl muss leer und Feldpfad verändert sein.
- Sechs hybride Maus-/Touch-/Tastaturfälle bestanden. Zwei vollständige Foto-/Maß-/Mehrflächen-/PDF-Abläufe auf Desktop/Smartphone mit zusätzlicher Erstzugprüfung bestanden.
- Tatsächliche Desktop-/Smartphoneaufnahmen geöffnet: Feld verschoben, Auswahlgriffe und bestehende Workbench erhalten. Auch neutrale Captures unabhängig angesehen. Keine native iPad-Abnahme und kein beobachteter Walter-Nutzertest.

## Belegte bestehende Grenze

Im sehr kurzen Querformat 812×375 verdecken Dachnamen im Vierflächenfoto den Startpunkt der neuen großen Zeichenbewegung. Der Test erreicht dort die Feldanlage nicht und kann den anschließenden ersten Innenzug nicht prüfen. Identischer unveränderter Test gegen den bisherigen öffentlichen VPS-Release scheitert bereits an derselben Feldanlage. Keine Assertion gelockert; dieser eine Fall ausdrücklich ausgelassen. Die anderen drei Feldfälle auf dieser Größe bestehen. Vergrößern/Positionieren versuchsweise geprüft, keine Produktänderung daraus übernommen. Diese bestehende Überdeckung bleibt außerhalb des engen Pointerfixes offen.

## Artefakt und Evidence

VPS-Manifest `.release/feld-drag-vps-manifest.json`, Archiv `.release/20261022-feld-sofort-ziehen.tar.gz`. Archiv SHA-256 `d18010121653be75210c62d827fd63211398f260e1e0ebd568e4c837fae51a7e`; Index `30c518e12317f4b9181684cfc89520f1d49d54ef4e07261bc44e224adcf19e81`.

Browserresultate im Hauptcheckout: `.release/feld-drag-final-bestaetigt`, `.release/feld-drag-privat-bestaetigt`, `.release/feld-drag-hybrid`, `.release/feld-drag-walter`, `.release/feld-drag-vps-smoke`. Die Baseline-Querformatprüfung liegt im isolierten Checkout unter `.release/feld-drag-alt-quer`. Bilder unter `.debug-shots/feld-sofort-ziehen-2026-10-22/`, private Sicherung ausschließlich lokal. Unabhängiger Abschlussreview in `review.md`. Produktive Aktivierung und öffentliche Nachprüfung werden in `docs/vps-release.md` dokumentiert.
