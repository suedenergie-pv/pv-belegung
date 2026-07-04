# OFFENE FRAGEN

Stand: 2026-07-04 spät. Erledigt: SPEC + kalibrierung.md im Repo; beide
Aiko-Varianten geklärt und verifiziert; Engine R1–R11 + Testrunner gebaut;
**WR-Katalog Heimbereich bis 30 kWp geseedet** (34 Klassen, 6 Familien, alle
Werte aus den Datenblatt-PDFs, SPEC §6.1). 48 Tests grün.

## Für die Kalibrierung (SPEC §14)

### 1. PV*SOL-Gegenrechnung machen (Genrih) — das Gate selbst

`npm run kalibrierung` erzeugt `kalibrierung-engine-output.md` mit allen
Fällen (34 WR × 3 Module × 9 Fälle). Empfehlung: repräsentative Teilmenge
gegenrechnen (z. B. pro Familie eine Klasse) statt aller 918 Zeilen — Filter:
`npm run kalibrierung -- sh25t`. PV*SOL-Version dokumentieren!

## Fachliche Entscheidungen (Genrih)

### ~~2. Huawei SUN2000-M1~~ ✅ entschieden 05.07.2026: raus aus dem Katalog

Grund: 11 A/15 A pro MPPT unter den Modulströmen. Datenblatt bleibt im Repo.

### 3. EcoFlow PowerOcean Plus PV1: 19 A Kurzschluss PRO STRING

Datenblatt nennt für PV1 „19×2 A" — also 19 A je String (38 A je MPPT).
Jolywood fordert 20,0 A pro String. R7 prüft nur die MPPT-Summe (≤ 38 A) →
die Per-String-Grenze wird NICHT geprüft. Soll eine Per-String-Regel ergänzt
werden (SPEC §7 erweitern)? Bis dahin: Jolywood an PO-Plus-PV1 manuell meiden.

### 4. Regel-Lücken: stringsPerMppt + max. Leistung pro MPPT

Keine Regel R1–R11 prüft (a) die Stringanzahl pro MPPT (physische Eingänge;
Parallelschaltung per Y-Stecker wäre elektrisch möglich) und (b) die max.
DC-Leistung pro MPPT (z. B. PowerOcean 5–8 kW je MPPT, PO Plus PV1 20 kW).
PV*SOL prüft beides → wird bei der Kalibrierung als Abweichung auffallen.
Regeln ergänzen (R12/R13)?

### 5. Sigen Hybrid SP2 (einphasig, 2,0–6,0 kW) weggelassen

Das TP2-Datenblatt enthält auch die einphasige SP2-Serie (maxDC 600 V,
MPPT 50–550 V). Nicht geseedet (Annahme: Heimbereich = dreiphasig).
Bei Bedarf sagen — Werte liegen im PDF vor.

### 6. Feldname des R9-Ausnahme-Flags

`hasShadeManagement` gewählt (SPEC §7 R9 nennt das Flag ohne Namen). Aktuell
bei ALLEN 34 WR `false` — kein Datenblatt nennt explizit Schatten-Management
im R9-Sinn. Pro WR bestätigen/ändern.

### 7. Alt-Modul jw-hd108n-r3-455 seeden?

SPEC §5.1 „Entscheidung Genrih" — nicht geseedet. Passendes R3-455-Datenblatt
fehlt (das 4330er-PDF im Repo ist die 445-W-Klasse → als Quelle unzulässig).

### 8. Hero-Artikelnummern Aiko (beide Varianten)

SPEC §5.1 noch „TODO" (Jolywood = 1103).

### 9. T_min −15 °C bestätigen (SPEC §16 #7)

Für Höhenlagen bestätigen oder verschärfen (Engine: konfigurierbar).

### 10. BYD-Speicher

SPEC §6: „BYD nur Speicher (gelegentlich)" — kein Datenblatt geliefert, kein
Katalogeintrag, Kompatibilitätsmatrix WR↔BYD offen.

## Kleinkram

- ~~Speicher-Zuordnung Sungrow~~ ✅ 05.07.2026: Sungrow SH → **SBR** (bestätigt).
  Aktive Speicher-IDs: ecoflow-powerocean-lfp, sungrow-sbr, sigenstor-bat.
