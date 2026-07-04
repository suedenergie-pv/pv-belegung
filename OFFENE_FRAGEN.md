# OFFENE FRAGEN / BLOCKER

Stand: 2026-07-04

## Blocker — Schritte 1–3 (SPEC §17) können nicht regelkonform gebaut werden

### 1. SPEC.md fehlt komplett (harter Blocker)

CLAUDE.md nennt `SPEC.md` als Single Source of Truth („Bei Lücken: fragen,
nicht raten"). Auf diesem Rechner wurde sie nicht gefunden — durchsucht am
04.07.2026: Desktop, Downloads, Dokumente sowie das gesamte Benutzerprofil
(alle heute geänderten .md-Dateien). Einziger Fund: `Downloads\CLAUDE.md`.

Ohne SPEC fehlen alle Definitionen für Schritt 1–3:

- **§5.1** — die bestätigten Moduldaten (welche zwei Module genau, welche
  Felder/Werte). Bekannt sind nur die Sanity-Werte aus CLAUDE.md:
  Jolywood Voc_cold ≈ 38,84 V, Aiko ≈ 43,96 V.
- **§6** — WR-Schema + Seed-Struktur (auch die Dummy-WR brauchen das Schema).
- **§7** — Regeln R1–R11 inkl. Temperaturkorrektur (Formel, Auslegungs-
  temperaturen, Grenzwerte). Aus dem Gedächtnis zu implementieren wäre
  genau das, was CLAUDE.md verbietet.
- **§13** — Export-Feldnamen (ASCII snake_case, aber welche Felder?).
- **§14** — Definition des Kalibrierungs-Gates.

### 2. kalibrierung.md fehlt

Die Testmatrix fürs Kalibrierungs-Gate existiert nicht → der Testrunner
(Schritt 3) hat keine Fälle, die er mit Engine-Ergebnissen befüllen könnte.

### 3. Aiko-Datenblatt fehlt

In `docs/datenblaetter/` liegen nur zwei Jolywood-PDFs (vom Desktop
übernommen, Download vom 04.07.2026):

- `4330_Jolywood-JW-HD108N-445W-Full-Black.pdf`
- `Jolywood-JW-HD96N-R2-435-460W-Datasheet.pdf`

Offen:
- Welches der beiden Jolywood-Module ist das in §5.1 bestätigte?
- Welches Aiko-Modul ist bestätigt? **Es liegt kein Aiko-PDF vor** —
  laut CLAUDE.md sind die Datenblatt-PDFs im Repo die einzige zulässige
  Quelle, Websuche ist verboten.

### 4. Dummy-Wechselrichter

Schema + Seed-Struktur mit 1–2 als DUMMY markierten WR sollen jetzt gebaut
werden — das Schema steht aber in SPEC §6 (siehe Blocker 1).

## Bewusst NICHT gemacht (statt Annahmen zu treffen)

- Keine Implementierung von R1–R11 oder der Temperaturkorrektur aus dem
  Gedächtnis.
- Keine frei erfundenen TypeScript-Interfaces (die SPEC definiert sie).
- Keine elektrischen Werte aus den PDFs extrahiert, solange unklar ist,
  welche Module bestätigt sind und welche Felder §5.1 verlangt.

## Bereits vorbereitet (SPEC-unabhängig)

- Monorepo-Gerüst (npm workspaces), `packages/engine` als pures TS-Paket
  ohne UI-Abhängigkeiten, vitest lauffähig, strikte tsconfig.
- `docs/datenblaetter/` mit den beiden vorhandenen Jolywood-PDFs.
- Platzhalter-Testsuiten (`describe.todo`) für §5.1/§6, Temperaturkorrektur,
  R1–R11 und den Kalibrierungs-Testrunner.

## Nächster Schritt

`SPEC.md` + `kalibrierung.md` (+ Aiko-Datenblatt) ins Repo legen →
dann werden Schritte 1–3 wie beauftragt gebaut, Stopp am Kalibrierungs-Gate,
kein UI.
