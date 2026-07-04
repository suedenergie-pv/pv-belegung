# OFFENE FRAGEN

Stand: 2026-07-04 abends. Erledigt seit letztem Stand: SPEC.md + kalibrierung.md
liegen im Repo; Aiko-Widerspruch aufgelöst (BEIDE Varianten im Einsatz, beide
Datenblätter verifiziert in `docs/datenblaetter/`); Engine R1–R11 + Testrunner
gebaut, 42 Tests grün.

## Blockiert die Kalibrierung (SPEC §14)

### 1. WR-Modellliste fehlt (SPEC §6 TODO, §16 #3) — WICHTIGSTER PUNKT

Der Katalog enthält nur 2 klar markierte DUMMY-WR (frei erfundene Werte).
Benötigt pro Modell: MPPT-Anzahl, Spannungsfenster, Anlaufspannung, max.
Eingangs-/Kurzschlussstrom pro MPPT, max. DC:AC — aus dem Hersteller-Datenblatt.
Achtung Ströme: Jolywood verlangt 20,0 A, Aiko MCE 18,23 A, Aiko MAH 17,81 A
pro String (×1,25) — High-Current-Varianten kennzeichnen.

### 2. PV*SOL-Version dokumentieren (kalibrierung.md)

Beim ersten Gegenrechnen Release-Stand eintragen.

## Entscheidungen für Genrih (nicht blockierend)

### 3. Feldname des R9-Ausnahme-Flags

SPEC §7 R9 nennt eine Ausnahme „WR mit Schatten-Management (Flag pro
WR-Katalogeintrag)", definiert aber keinen Feldnamen. Gewählt:
`hasShadeManagement` in `InverterType`. OK oder umbenennen (dann auch in SPEC §6
nachtragen)?

### 4. `stringsPerMppt` hat keine zugeordnete Regel

SPEC §6 definiert das Feld, aber keine Regel R1–R11 prüft die Stringanzahl pro
MPPT (physische Eingänge). Aktuell: reines Datenfeld, keine Prüfung. Soll eine
harte Prüfung ergänzt werden (→ SPEC §7 erweitern, z. B. „R12")?

### 5. Alt-Modul jw-hd108n-r3-455 seeden?

SPEC §5.1 nennt es als „optionaler dritter Katalogeintrag (Entscheidung
Genrih)" — NICHT geseedet. Zusätzlich fehlt das passende Datenblatt: das PDF
`4330_Jolywood-JW-HD108N-445W-Full-Black.pdf` im Repo ist die **445-W-Klasse**,
die SPEC-Werte sind die 455-W-Klasse (HD108N-R3) → als Quelle unzulässig
(exaktes Serien-/Wattklassen-Datenblatt nötig). Bei „ja": R3-455-Datenblatt
liefern. Das 445er-PDF ggf. aus dem Repo entfernen (gehört zu keinem
Katalogeintrag)?

### 6. Hero-Artikelnummern Aiko

Beide Aiko-Einträge haben in SPEC §5.1 noch „TODO" als Hero-Artikelnr.
(Jolywood = 1103). Nachtragen, sobald in Hero angelegt.

### 7. T_min −15 °C bestätigen (SPEC §16 #7)

Default fürs Allgäu ist −15 °C — für Höhenlagen bestätigen oder verschärfen.
(Engine: Admin-konfigurierbar über `DesignParams`.)

## Kleinkram / redaktionell

- SPEC §6 Interface-Kommentar „Isc-Prüfung — Aiko 14,25 A schlägt hier ggf.
  an!" am Feld `maxInputCurrentPerMpptA`: 14,25 A ist der **Isc der MAH54Mw**,
  das Feld prüft aber den Betriebsstrom (Imp, R6); die Isc-Prüfung ist R7 auf
  `maxShortCircuitCurrentPerMpptA`. Formulierung bei Gelegenheit präzisieren.
