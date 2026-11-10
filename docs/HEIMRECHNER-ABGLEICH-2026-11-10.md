# Heimrechner-Abgleich — 10.11.2026

Nutzerentscheidung: Änderungen vom Heimrechner haben Veto. Integrationsbranch `codex/heimrechner-abgleich-20261110` beginnt auf `origin/main` / `f93d733`. Die ursprünglichen zwei lokalen PDF-Commits und offenen Produktarbeiten sind vollständig über `codex/lokale-arbeit-sicherung-20261110` / `60abb3c` gesichert. Dieser Sicherungsbranch ist kein freizugebender Produktstand.

Beim Merge des Sicherungsbranches wurden drei Konflikte gefunden: SchrittBelegung.tsx, audit.spec.ts und pdf-export.ts. Der Integrationsbaum wurde gezielt auf die Heimrechnerbasis zurückgeführt und ausschließlich der bereits separat auf dieser Basis entwickelte Löschfix `e6aa1cb` übernommen. Kein pauschales Zurückkopieren älterer UI-Dateien. Effektiver Produktdiff gegenüber Heimrechnerbasis exakt dieser elf Dateien umfassende Löschfix: Anwendungsdialog statt window.confirm, Dachflächenliste bei Touch erreichbar, zugehörige Tests und Spezifikation. PDF-Exporter und dessen Tests sind exakt identisch zu origin/main; ältere Fonts, PDF-Generator und frühere PDF-Optik wurden nicht wieder eingeführt. Die lokale PDF-Arbeit bleibt im Sicherungsbranch lesbar. Bestehende Gauben-/Dach-/Maß-/Engine-Neuerungen der Heimrechnerbasis erhalten.

Prüfungen dieses Abgleichs:
- 1.474 Engine- und 1.340 Webtests bestanden, Typprüfung bestanden.
- Erster Testversuch über den Junction-Pfad scheiterte bei 24 Suite-Imports durch unterschiedliche absolute Pfade. Über den tatsächlichen Repositorypfad erneut vollständig erfolgreich; keine Produktänderung zur Umgehung.
- Produktionsbuild zunächst durch Sandbox-Junction-Rechte abgebrochen, unverändertes Buildskript mit erforderlichen Rechten erneut erfolgreich. 33 Exportdateien. Keine Buildskript- oder Paketänderung.
- Auf dem gebauten statischen Paket 18 WebKit-Touchfälle bestanden: iPad hoch/quer/Pro, vorhandene/neue belegte Fläche, normale/gesperrte native Browserdialoge und Browser-Zurück.
- Vier zusätzliche Desktop-/Mobilfälle bestanden: Entfernen mit Abbruch, Gauben-/Foto-/Stringbereinigung, Undo, offene Maßentwürfe, neue Dachfläche und erreichbare Liste.
- Gerenderte Desktop-, Mobil- und Tablet-Löschbestätigung tatsächlich geöffnet. Keine physische iPad- oder Walter-Nutzerabnahme behauptet.

Lokale Evidenz: output/heimrechner-20261110-tests-realpath.log, output/heimrechner-touch-20261110, output/heimrechner-loeschen-20261110 und .debug-shots/dach-pdf. Keine Testergebnisse, Fotos oder lokalen Einstellungen in Git aufgenommen. Nicht versionierte .claude/settings.local.json, apps/web/AGENTS.md, apps/web/CLAUDE.md und output/ bleiben erhalten. next-env.d.ts ist generiert und wurde nicht als Produktänderung committet.

Kein Live-Deploy bei diesem Git-Abgleich, kein main-Push, kein Force-Push. Die heutige SüdEnergie-Anwendung ist das separate Repository pv-entwurf. Dieser historische pv-belegung-Abgleich ersetzt dessen produktiven VPS-Release nicht. Die Firmen bleiben getrennt. LCV wurde separat zusammengeführt; dort hat die weiterentwickelte Heimrechner-Traufenfassung vollständig Vorrang.
