# Büro-Übergabe: Belegungsplaner: aktuelle Bedienung und PDF-Export

Stand: 02.10.2026, Europe/Berlin. Sicherungsbranch: `codex/office-20261002-belegung`.

Diese Sicherung ist ein Entwicklungs-/Kontext-Snapshot, keine Deploymentfreigabe. Originalbranch, Arbeitsdateien und Git-Index bleiben unverändert.

Ausgangsstand e9646a7 am 02.10.2026 bereits origin/main. Diese Woche: Gauben-/Auswahllogik, Module entfernen, Dachflächen direkt löschen, größere PDF-Bilder mit zwei Bildern schon ab Seite 1, verständlich geordnete Werkzeuge, sichtbarer Weiter-zum-Export-Knopf. Aktuelles produktives Ziel laut korrigierter AGENTS.md ist belegung.suedenergie-pv.de auf VPS; GitHub Pages ist separate Ausgabe. Frühere Browser-/Live-Prüfungen stehen in docs/, hier kein neuer Live-Zugriff. Echte iPad/iPhone-Prüfung bleibt separat. next-env.d.ts ist automatisch generiert und nicht in den Quell-Snapshot übernommen; neue Abhängigkeiten erzeugen es. apps/web/AGENTS.md und CLAUDE.md mitgesichert; lokale .claude/settings.local.json bleibt privat.

## Wiedereinstieg

1. Diesen Sicherungsbranch vom bestehenden Repository klonen.
2. AGENTS.md und die oben genannten fachlichen Übergaben lesen.
3. Node.js 24.19.0 verwenden; Lockfile und README beachten. Abhängigkeiten lokal neu installieren.
4. Mit synthetischen Daten fortsetzen. Zugangsdaten neu und außerhalb Git bereitstellen; keine .env aus Chat/Git beziehen.
5. Live-Server unangetastet lassen. Push sichert nur den Branch; kein Merge nach main/master und kein Workflow-Dispatch.

## Sicherungsgrenzen

Ausgangs-HEAD: `e9646a7ed72713201237d8d1567b4e698b3b2454`. 2 vorhandene geänderte/neue Dateien für Git ausgewählt; 2 lokale/generierte/vertrauliche Dateipfade ausgeschlossen. Die vollständige Klassifikation liegt im zentralen Sicherungsmanifest.

Die zentrale Übersicht liegt im CRM-Repository unter `docs/office-handover-2026-10-02/START_HERE.md` auf `codex/office-handover-20261002`.
