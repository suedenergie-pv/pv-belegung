# OFFENE FRAGEN

Stand: 2026-07-05. Erledigt: SPEC + kalibrierung.md im Repo; beide
Aiko-Varianten geklärt und verifiziert — **Wattklassen 05.07. korrigiert auf
A485-MCE54Db (Isc ×1,25 = 18,60 A) und A480-MAH54Mw (17,98 A)**, Werte aus den
PDF-Spalten A485/A480; Engine R1–R12 + Testrunner gebaut;
**WR-Katalog Heimbereich bis 30 kWp geseedet** (28 Klassen, SPEC §6.1, alle
Werte aus den Datenblatt-PDFs).

## Für die Kalibrierung (SPEC §14)

### 1. PV*SOL-Gegenrechnung machen (Genrih) — das Gate selbst

`npm run kalibrierung` erzeugt `kalibrierung-engine-output.md` mit allen
Fällen (34 WR × 3 Module × 9 Fälle). Empfehlung: repräsentative Teilmenge
gegenrechnen (z. B. pro Familie eine Klasse) statt aller 918 Zeilen — Filter:
`npm run kalibrierung -- sh25t`. PV*SOL-Version dokumentieren!

## Fachliche Entscheidungen (Genrih)

### ~~2. Huawei SUN2000-M1~~ ✅ entschieden 05.07.2026: raus aus dem Katalog

Grund: 11 A/15 A pro MPPT unter den Modulströmen. Datenblatt bleibt im Repo.

### ~~3. PO Plus PV1: 19 A pro String~~ ✅ erledigt 05.07.2026: R12 gebaut

Neue Regel R12 (SPEC §7): Isc × 1,25 ≤ Kurzschlussgrenze je String-Eingang;
ohne expliziten Datenblattwert gilt die MPPT-Grenze als Fallback. Jolywood an
PO-Plus-PV1 wird jetzt mit konkreter Meldung („Modultyp an diesem Eingang
nicht zulässig") abgewiesen. Explizite Per-String-Werte bisher nur bei PO Plus
— falls Handbücher von Sungrow SH-T (MPPT1/2) oder Sigen TP2 (MPPT2) eigene
Per-String-Kurzschlusswerte nennen, nachtragen.

### 4. Regel-Lücken: stringsPerMppt + max. Leistung pro MPPT + Imp pro String

Keine Regel prüft bisher (a) die Stringanzahl pro MPPT (physische Eingänge;
Parallelschaltung per Y-Stecker wäre elektrisch möglich), (b) die max.
DC-Leistung pro MPPT (z. B. PowerOcean 5–8 kW je MPPT, PO Plus PV1 20 kW),
(c) den Betriebsstrom PRO STRING (Sungrow: „max. 16 A pro Strang" — Jolywood
Imp 15,16 A passt knapp). PV*SOL prüft (a)+(b) → fällt ggf. bei der
Kalibrierung als Abweichung auf. Regeln ergänzen (R13+)?

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
