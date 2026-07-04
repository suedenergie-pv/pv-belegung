# CLAUDE.md — Belegungsplaner SüdEnergie

## Lies zuerst

1. `SPEC.md` — kanonisches Dokument, Single Source of Truth. Bei Widerspruch zwischen irgendetwas und der SPEC gilt die SPEC. Bei Lücken: fragen, nicht raten.
2. `kalibrierung.md` — Testmatrix fürs Kalibrierungs-Gate (SPEC §14).
3. `docs/datenblaetter/` — einzige zulässige Quelle für elektrische Modulwerte.

## Nicht verhandelbar (Kurzfassung, Details in SPEC §3)

- Keine 3D-Rekonstruktion. Dachflächen = unabhängige Ebenen. Renderer = Kompositor, nie Solver.
- String-Engine = deterministisches Regelwerk R1–R11 (SPEC §7). Kein LLM im Rechenpfad.
- Elektrische Werte NUR aus den Datenblatt-PDFs im Repo. Keine Extrapolation, keine Websuche als Quelle.
- **⛔ KEIN UI-Bau, bevor das Kalibrierungs-Gate (SPEC §14) bestanden ist.** Das PV*SOL-Gegenrechnen macht Genrih manuell — die Engine muss dafür bereitstehen.
- Modulgrößen im Plan ausschließlich aus mm-Maßen × Maßstab, nie aus CSS-Layout.

## Bau-Reihenfolge (SPEC §17)

1. Katalog-Datenmodell + Seed-Daten aus SPEC §5.1 (beide Module final bestätigt) und §6 (WR-Schema; Modelle folgen von Genrih — Schema + Seed-Struktur trotzdem jetzt bauen, mit 1–2 Dummy-WR klar als DUMMY markiert)
2. String-Engine: Temperaturkorrektur + Regeln R1–R11, jede Regel mit min. 1 Pass- und 1 Fail-Test
3. CLI/Testrunner, der die Fälle aus `kalibrierung.md` ausgibt (Engine-Spalte automatisch befüllbar), damit Genrih nur noch PV*SOL-Werte daneben legen muss
4. Danach STOPP am Gate. Geometrie-Datenmodell (SPEC §4) darf parallel entstehen (reine Typen + Tests, kein UI). Solar-API-Code erst nach GATE-0 (SPEC §8.1).

## Stack & Konventionen

- Node.js/TypeScript, Tests mit vitest o.ä. Engine als eigenes Paket ohne UI-Abhängigkeiten.
- Feldnamen ASCII snake_case in Exporten (SPEC §13), TypeScript-Interfaces wie in SPEC definiert.
- Commits klein, jede Regel-Implementierung referenziert die Regelnummer (z.B. "R7: Kurzschlussstrom-Prüfung + Tests").
- Erwartungswerte für Sanity-Checks: Jolywood Voc_cold ≈ 38,84 V, Aiko ≈ 43,96 V (SPEC §5.1). Weicht die Engine davon ab, ist die Engine falsch, nicht die SPEC.

## Kontakt-Punkte, die auf Genrih warten (nicht blockierend für Schritt 1–3)

- WR-Modellliste (EcoFlow, Sungrow, SigEnergy, Huawei; BYD nur Speicher-Flag)
- GATE-0: Solar-API-EEA-Testcall
- Ticketsystem-Kategorie "Vorplanung Vertrieb" (+ user_categories-Bug)
