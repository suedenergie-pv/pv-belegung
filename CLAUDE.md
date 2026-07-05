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
- Erwartungswerte für Sanity-Checks: Jolywood Voc_cold ≈ 38,84 V, Aiko MCE485 ≈ 44,50 V, Aiko MAH480 ≈ 44,93 V (SPEC §5.1). Weicht die Engine davon ab, ist die Engine falsch, nicht die SPEC.

## Kontakt-Punkte, die auf Genrih warten (nicht blockierend für Schritt 1–3)

- ~~WR-Modellliste~~ ✅ 04.07. geseedet (28 Klassen, §6.1; Huawei M1 bewusst raus)
- GATE-0: Solar-API-EEA-Testcall
- Ticketsystem-Kategorie "Vorplanung Vertrieb" (+ user_categories-Bug)

## Session-Übergabe 05.07.2026 (vorherige Session lief im falschen Ordner statik-check)

**Stand:** Engine R1–R12 + Belegungsraster + Kalibrier-Testrunner (`npm run kalibrierung`)
+ UI-Wizard `apps/web` fertig, 55 Tests grün, alles gepusht. Details: SPEC (v0.1 mit
Updates 04./05.07.), `OFFENE_FRAGEN.md`. Dev-Server: `npm run dev` (launch.json liegt bei).

**Offene Aufträge von Genrih (in dieser Reihenfolge):**

1. **Aiko-Wattklassen korrigieren** — verkauft werden 3S+54 = **A485-MCE54Db** und
   2N = **A480-MAH54Mw** (nicht 460!). Werte aus den PDF-Spalten A485/A480 in
   `docs/datenblaetter/` ziehen und ÜBERALL nachziehen: SPEC §5.1 (Tabelle, ids,
   Rechen-Referenzen), kalibrierung.md, `modules.ts`, alle Tests, Runner-Gruppen,
   OFFENE_FRAGEN-Stromwerte, Sanity-Zeile unten in dieser Datei.
   Neue Rechen-Referenzen (−15 °C/+70 °C): MCE485 Voc_cold 40,90 × 1,088 ≈ 44,50 V,
   Vmp_hot ≈ 30,29 V, Isc 14,88 → ×1,25 = 18,60 A; MAH480 41,30 × 1,088 ≈ 44,93 V,
   Vmp_hot ≈ 30,78 V, Isc 14,38 → ×1,25 = 17,98 A. (Ein erster Edit wurde vom
   System-Hickup unterbrochen — nichts davon ist schon umgesetzt.)
2. **Randabstand einstellbar** machen (UI; Engine-`berechneRaster` hat den
   `randM`-Parameter schon, Default 0,30 m bleibt).
3. **Drohnenfoto als Belegungs-Hintergrund** (Genrih: farbiges Rechteck wirkt
   „unseriös"): eigenes Foto hochladen (lizenzrechtlich ok, im Gegensatz zu
   Maps-Screenshots), Maßstab über Referenzstrecke kalibrieren, Module drüber
   rendern. Google-Maps-Screenshots bleiben verboten (§8.1); Solar-API erst nach GATE-0.
4. Nice-to-have: Wizard-State in localStorage (geht bei Reload verloren).

**Arbeitsweise (von Genrih so gewollt):** Das ist primär ein VERTRIEBstool —
Belegung/kWp/Optik zuerst, Stringplan ist „Spielerei" (optionaler Schritt), kein
Gate-Banner, nur dezenter Vorplanungs-Hinweis. Bei Widerspruch zwischen geliefertem
Material und SPEC: kurz nachfragen (hat sich bewährt — Aiko-PDF-Fall).
