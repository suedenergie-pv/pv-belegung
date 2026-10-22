# SüdEnergie-Druckdatei · 22.10.2026

Nutzerauftrag: LCV-Druckarbeit als Ausgangspunkt untersuchen, eigenständige SüdEnergie-Gestaltung umsetzen, alle Informationen lesbar erhalten, mehrere Dachseiten und Perspektiven mit großen Bildern berücksichtigen; anschließend ausdrücklich deployen. Letzte Korrektur vor dem Deploy: wiederholter grauer Fußblock entfällt.

## Ergebnis und Umfang

- Weißer Grund, unverändertes Original-Logo, eingebettete Inter und Original-Logo-Orange `#EF4C29`. Keine Übernahme des LCV-Layouts oder dessen Farben. Dashboardfarben unverändert.
- Mehrere Fotos erhalten eigene große, proportional unbeschnittene A4-Bildseiten. Querformat mit linkem Projekt-/Leistungsstreifen, Hochformat mit Angaben über dem Foto. Bildname, Dachzuordnung und Seitenzahl bilden den Abschluss direkt am Bild.
- Anlagendaten, Modul-/WR-Ausstattung, Dachangaben sowie vollständige lange Projekt-/Bildnamen bleiben erhalten. Beratung, Website und Vorplanungshinweis werden bei Mehrfoto-Dokumenten einmal gesammelt. Kompakter Bildindex mit Seitenverweisen, wenn er ohne Zusatzseite Platz hat.
- Alle aktiven Schriftgrößen mindestens 12 pt, ausdrücklich auch im Einzelbild-Ausdruck. Übliche kurze Einzelbilder mit ein bis zwei Dachflächen bleiben einseitig; umfangreiche Angaben laufen vollständig im Anhang weiter.
- Keine Änderungen an Engine, elektrischen Katalogwerten, Modulassets oder Projektpersistenz. Gegenüber dem bisherigen VPS-Quellmanifest sind ausschließlich PDF-Generator und neue Schriftdatei inhaltlich verschieden; 23 weitere Quellhashunterschiede sind exakt durch LF/CRLF erklärbar.

## Verifikation vor Aktivierung

- 477 Tests bestanden: 168 Engine und 309 Web, darunter 28 PDF-Tests. Schrift-/Inhaltsschutz prüft Einzel- und Mehrfoto-Ausgabe. Typprüfung und isolierter VPS-Build bestanden.
- Am finalen Produktionsartefakt: zwei Desktop-/Mobil-Smokes einschließlich Fotoeinrichtung, Belegung, PDF und Reload sowie zehn echte PDF-Downloads mit 1/2/3/4/6 Fotos bestanden.
- Muster für Einzelbild, Hochformat, mehrere Dächer, drei Perspektiven und überlange Angaben gerendert. Finale Bild- und Datenblätter sowie echte Browser-PDFs geöffnet. Musterfotos sind gekennzeichnete KI-Demos; keine Kundenfotos im Release.
- Unabhängiger Review: anfänglicher Major zu kleinen Einzelbild-Schriften korrigiert und erneut geprüft. Finale Sicht-/Quell-/Archivprüfung PASS ohne offenen Blocker/Major. Unabhängig alle zehn Download-PDFs geparst: Fonts mindestens 12 pt und richtige Seitenzahlen. Ein anfänglicher Bild-/Cacheverdacht wurde mit frisch gerendertem identischem PDF ausgeschlossen.
- 75 aktuelle/Stage-Quellen und 34 Export-/Archivdateien vollständig hashgleich. Exakter Archivdateisatz, keine privaten Bilder, QA-Dateien, unsicheren Pfade oder Symlinks. Aktivierungsskript unveränderte LF-Kopie des vorhandenen atomaren Skripts mit Rollback.

## Kandidat und Rollback

- Release-ID: `20261022-pdf-suedenergie-final`.
- Erwarteter Vorgänger: `/var/www/belegung/releases/20261022-feld-sofort-ziehen`.
- Archiv SHA-256: `1bf08ce176166661dc8a90fe63e314125a557eba3909d18e8f2c91e2062fa371`.
- Index SHA-256: `96d54d15ff72c1d80e396c1a4e92b615c5bb6a31f77d5c0dc6c1efd978a6c43f`.
- Aktivierungsskript SHA-256: `2ef167f3aeab06ec2e07e7625562d5a63e3a6120d39be8c764d3f873049d1bde`.
- Lokale Evidence: `.release/pdf-ci-qa.json`, `.release/pdf-ci-vps-manifest.json`, `.release/pdf-ci-independent-review-final.md`, `.debug-shots/pdf-ci-2026-10-22/release-final/`.

Produktiv aktiviert und öffentlich geprüft: `20261022-pdf-suedenergie-final`, Produktcommit `d070542`. Alle 34 öffentlichen Dateien hashgleich; zwei Live-Smokes und zehn echte PDF-Downloads bestanden. Alle zehn Live-PDFs zusätzlich geparst: mindestens 12 pt, richtige Seitenzahlen, vollständiger Planungshinweis genau einmal. Details in `docs/vps-release.md`. GitHub Pages ist kein Nachweis für den VPS-Deploy. Native iPad-Abnahme oder Walter-Nutzerstudie werden nicht behauptet.
