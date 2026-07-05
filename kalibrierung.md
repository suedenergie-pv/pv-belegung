# Kalibrierungsmatrix — String-Engine vs. PV*SOL

**Status:** v0.1 — Skelett, 04.07.2026. Gate lt. SPEC §14: kein UI-Bau vor 100 % Übereinstimmung.
**Vorgehen:** Jeden Fall (a) von der Engine rechnen lassen, (b) in PV*SOL nachstellen, (c) Ergebnis vergleichen. Abweichung → Ursache klären, fixen, **gesamte Matrix neu laufen lassen**.

## Auslegungsparameter (fix für alle Fälle)

| Parameter | Wert |
|---|---|
| T_min (Winter-Leerlauf) | −15 °C |
| T_cell_max (Sommer-Volllast) | +70 °C |
| Isc-Sicherheitsfaktor (R7) | 1,25 |
| PV*SOL-Version | TODO eintragen (Release dokumentieren!) |

## Modul-Referenzwerte

| | Aiko A485-MCE54Db ✅ | Jolywood JW-HD96N-R2-460 ✅ | Aiko A480-MAH54Mw ✅ |
|---|---|---|---|
| Voc / TK Voc | 40,90 V / −0,22 %/K | 35,31 V / −0,25 %/K | 41,30 V / −0,22 %/K |
| Voc_cold (−15 °C, erwartet) | ≈ 44,50 V | ≈ 38,84 V | ≈ 44,93 V |
| Vmp / TK Pmax | 34,30 V / −0,26 %/K | 30,34 V / −0,28 %/K | 34,86 V / −0,26 %/K |
| Vmp_hot (+70 °C, erwartet) | ≈ 30,29 V | ≈ 26,52 V | ≈ 30,78 V |
| Isc / ×1,25 | 14,88 A / 18,60 A | 16,00 A / **20,00 A** | 14,38 A / 17,98 A |

## Testfälle

Legende Erwartung: PASS = Plan gültig, FAIL(Rx) = muss an Regel Rx scheitern.
WR-Spalten bleiben leer, bis der WR-Katalog (SPEC §6) befüllt ist — dann pro Katalog-WR eine Fallgruppe duplizieren.

### Gruppe A — Aiko A485-MCE54Db × WR: `________________` (maxDC ___ V, MPPT ___–___ V, maxIn ___ A, maxSC ___ A)

| # | Module/String | Strings/MPPT | Prüfziel | Erwartung Engine | Engine | PV*SOL | Match |
|---|---|---|---|---|---|---|---|
| A1 | n_min (aus R3/R5) | 1 | MPPT-Untergrenze heiß | PASS | | | |
| A2 | n_min − 1 | 1 | Unterschreitung | FAIL(R3 o. R5) | | | |
| A3 | n_mitte | 1 | Normalfall | PASS | | | |
| A4 | n_max (aus R1) | 1 | Winter-Voc-Grenze | PASS | | | |
| A5 | n_max + 1 | 1 | Überschreitung | **FAIL(R1)** | | | |
| A6 | n_mitte | 2 parallel | Stromsumme | PASS/FAIL(R6/R7) je WR | | | |
| A7 | n_mitte | 2 parallel, ungleiche Länge | Stringlängen-Gleichheit | FAIL(R8) | | | |
| A8 | n_mitte, 2 Ausrichtungen | 1 MPPT | Ausrichtungs-Mix | FAIL(R9) | | | |
| A9 | DC:AC > Katalogwert | — | Überbelegung | FAIL(R11) | | | |

### Gruppe B — Jolywood JW-HD96N-R2-460 × gleicher WR

✅ ENTSPERRT 04.07. — Fälle B1–B9 analog Gruppe A. Kritischster Fall ist B6: 20,00 A Kurzschluss-Anforderung pro String — hier werden die meisten Standard-MPPTs durchfallen; erwartetes FAIL(R7) bei allen WR ohne High-Current-Eingang.

### Gruppe D — Aiko A480-MAH54Mw × gleicher WR

NEU 04.07. abends (beide Aiko-Varianten im Einsatz, SPEC §5.1): Fälle D1–D9 analog Gruppe A. Kurzschluss-Anforderung 17,98 A pro String.

### Gruppe C — Grenzfall-Sammlung (nach A/B/D, mit realen Projekten)

| # | Beschreibung | Quelle | Engine | PV*SOL | Match |
|---|---|---|---|---|---|
| C1 | Echtes Kundenprojekt 1 (PL wählt typisches EFH) | PL | | | |
| C2 | Echtes Kundenprojekt 2 (Ost/West, 2 MPPTs) | PL | | | |
| C3 | Echtes Kundenprojekt 3 (großes Dach, lange Strings) | PL | | | |

## Abnahme

- [ ] Alle Fälle Match = ✅
- [ ] Jede Regel R1–R12 mindestens einmal als Ursache eines erwarteten FAIL abgedeckt
      (R12: Jolywood × PowerOcean Plus, Fälle B1/B3/B4 an PV1 — erwartetes FAIL(R12))
- [ ] PV*SOL-Version dokumentiert
- [ ] Ergebnis-Commit referenziert Engine-Commit-Hash: `________`

Erst danach: UI-Bau freigegeben (SPEC §14).
