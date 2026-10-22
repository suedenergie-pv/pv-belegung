# Foto vor Dachmaßen · 22.10.2026

Auftrag: Neue Hauptdachflächen beginnen mit Foto hochladen oder ausdrücklicher Wahl eines Projektfotos. Danach werden die leeren Dachmaße neben dem sichtbaren Foto eingegeben. Ziegel werden im Foto gezählt; eine neue Maßberechnung wurde nicht eingeführt. Bekannte Maße bleiben direkt eingebbar.

## Umfang und Isolation

Produktstand `0bfae1b`; identische Produktquellen im isolierten Worktree unter `C:\Users\Genrih-PC\Desktop\Projekte\Worktrees\pv-belegung\foto-zuerst-20261022` (`d353882`, die abweichenden Commit-IDs entstehen durch Cherry-Picks). Parallel entstandene PDF-Änderungen im Hauptcheckout wurden weder übernommen noch gestaged. Der Release enthält den bisherigen bestätigten PDF-Export. Private Fotos und lokale Einstellungen bleiben außerhalb des Exports.

## Ausgeführte Prüfungen

- Gesamte Testsuite: 168 Engine- und 302 Webtests bestanden. Typprüfung bestanden. Nach letzter Änderung zusätzlich die 34 betroffenen Bedienungstests bestanden; Produktionsbuild prüft TypeScript erneut.
- Isolierter VPS-Build und separater Pages-Build bestanden. Desktop-/Mobil-Smokes für beide Ausgaben bestanden: Belegung, PDF ohne Kundendaten, Rand 0 und Reload.
- Finaler Foto-/Maß-/Belegungs-/PDF-Ablauf auf sechs Größen bestanden: 1440×900, 1024×768, 768×1024, 375×812, 812×375 und 720×450. Echtes Dachfoto, leere Pflichtmaße, Zoom, kein versehentliches Markieren, zweite Fläche, ausdrücklich wiederverwendetes Foto, Upload-Abbruch, offener Maßentwurf mit Bleiben/Verwerfen und Erhalt der ersten Belegung. Desktop zusätzlich Pan ohne Geometrieänderung und Reload vor Maßbestätigung.
- Finale Mehrflächen-/Layoutprüfung auf allen acht Größen bestanden, zusätzlich 375×500 und 320×568. In kurzen Ansichten sind Fotoaktionen intern scrollbar. Der ursprüngliche Viewport-Container erzwang `overflow:visible!important`; dies wird ausschließlich für den neuen Fotoeinstieg überstimmt. Die nächste Fläche beginnt ohne alten Scrollstand.
- Gerenderte Desktop-, Tablet- und Smartphonezustände tatsächlich geöffnet. Auf 375×812 bleiben etwa 184 px Dachfoto, beide Hauptmaßfelder und feste Abschlussaktionen gemeinsam sichtbar. Keine native iPad-Abnahme und kein beobachteter Bedienversuch mit Walter.

## Bestehende Grenze, ausdrücklich kein bestandener Test

Die zwei vollständigen Walter-Abläufe auf 375×500 und 320×568 scheitern nach der Maßübernahme beim Dacheckenfortschritt: dessen gesamte Anzeige liegt nicht vollständig im sichtbaren Panel. Die unveränderten alten Tests aus `f8a7500` wurden separat auf dem bisherigen öffentlichen Release `20261020-flachdach-gauben` ausgeführt und scheitern exakt dort mit denselben sichtbaren Anteilen (0 beziehungsweise 0,3046875). Diese bestehende Grenze wurde nicht als neue Regression eingeordnet oder als bestanden gezählt. Keine Assertion wurde gelockert. Der Foto-/Maßzustand davor und die neue Mehrflächen-Fotoauswahl wurden auf diesen Größen geprüft.

## Artefakte

- `.debug-shots/foto-zuerst-2026-10-22/final/`: echte Fotoansichten und kurze Uploadansicht, ausschließlich lokal.
- Isolierter Worktree: `.release/foto-zuerst-layout-final/` (8 bestanden), `.release/foto-zuerst-ablauf-final/` (6 bestanden), `.release/foto-zuerst-kurz-final/` (offene bestehende Größenlimits).
- Hauptcheckout: `.release/foto-zuerst-baseline-result/` und `.debug-shots/foto-zuerst-2026-10-22/baseline/` als Gegenprobe der unveränderten Live-Version.
- Releasearchiv `.release/20261022-foto-zuerst.tar.gz`, Manifest `.release/foto-zuerst-vps-manifest.json`.
- Archiv SHA-256 `837e804c997f1b59057d7d3805e2ff8ac0988cc8cf372468a02bd2e130ab57e7`.
- Index SHA-256 `3ee1edfffca035489ee996370fae5a80bd335fc7e47ba141911604e2bfc8f503`.
- Unverändertes, auf LF normalisiertes Aktivierungsskript SHA-256 `2ef167f3aeab06ec2e07e7625562d5a63e3a6120d39be8c764d3f873049d1bde`.

Deploy und öffentliche Nachprüfung werden nach erfolgreichem unabhängigem Artefaktreview in `docs/vps-release.md` ergänzt.
