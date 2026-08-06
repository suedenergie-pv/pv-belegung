# SPEC — Belegungs- & Stringplan-Tool (Arbeitstitel: „Belegungsplaner")

**Status:** v0.1 — Planungsstand 04.07.2026
**Owner:** Genrih Porchatschow, SüdEnergie
**Kanonisches Dokument.** Dieses File ist die Single Source of Truth für alle Claude-Code-Sessions zu diesem Projekt. Änderungen an Scope, Regeln oder Datenmodell werden HIER eingepflegt, bevor Code angefasst wird.

---

## 1. Zweck

Internes Web-Tool, mit dem Vertriebler und Niederlassungsleiter selbstständig **grobe Dachbelegungen und Stringpläne** erstellen und als strukturierten Datensatz ins Ticketsystem exportieren. Ziel: Entlastung des einzigen Projektleiters, der aktuell alle Planungen für Hauptsitz + 2 Niederlassungen stemmt.

Leitprinzip UX: **idiotensicher = Auswahl wegnehmen, nicht erklären.** Dropdowns aus Fixkatalog, Buttons statt Freitext, ungültige Ergebnisse können gar nicht erst entstehen.

### 1.1 Was das Tool NICHT ist (harte Grenze)

- **Kein Ertragsrechner.** Keine kWh-Simulation, kein Meteonorm, keine Verschattungsanalyse. Ertrag und finale Auslegung bleiben in PV*SOL (Lizenz vorhanden).
- **Kein PV*SOL-Klon.** Keine allgemeine Komponenten-Datenbank, keine Klimadaten. Nur der eigene Fixkatalog (§5, §6).
- **Keine 3D-Rekonstruktion.** Siehe §3. Das ist der Punkt, an dem SolarEdge Designer regelmäßig scheitert (Fallback „flache Box") — wir bauen das Problem gar nicht erst.
- **Kein Standsicherheits- oder Elektro-Nachweis.** Output ist eine Vorplanung, die der PL in PV*SOL finalisiert.
- Satelliten-Auto-Erkennung eigener Bauart, echtes 3D-Modelling, Fassadenmodul: NICHT in v1 (siehe §15 Versionsplan).

### 1.2 Output pro Projekt

1. Dachplan (gruppierte Belegungsfotos je Fläche und Perspektive, §8.4/§11)
2. Modulbelegung (Anzahl, Ausrichtung, Position)
3. Stringplan (Strings pro MPPT, validiert gegen Regelwerk §7)
4. Grobe Anlagengröße (kWp = Modulanzahl × Pmax)
5. JSON-Export ins Ticketsystem (§13)

---

## 2. Nutzer & Rollen

| Rolle | Darf |
|---|---|
| Vertrieb / NL-Leiter | Projekte anlegen, Dach erfassen, belegen, Stringplan generieren, exportieren |
| Projektleiter | Alles + eskalierte Projekte übernehmen |
| Admin (Genrih) | Katalog pflegen, Normwerte ändern |

Katalogdaten (Module, WR, Speicher) und Auslegungstemperaturen sind für Vertrieb **read-only**. Änderung nur durch Admin.

---

## 3. Architektur-Grundsätze (nicht verhandelbar)

1. **Keine 3D-Rekonstruktion.** Dachflächen sind unabhängige Ebenen: `Polygon (2D in Flächenebene) + Neigung + Azimut`. Ob die Ebenen zusammen ein wasserdichtes Gebäude ergeben, ist für Engine und Renderer irrelevant.
2. **Semantik kommt vom User, nicht vom Solver.** Knicke und Gauben werden DEKLARIERT (§4.2, §4.3), niemals aus Geometrie erraten. Damit ist das Problem bestimmt statt unterbestimmt.
3. **Renderer = Kompositor, niemals Solver.** Die Gesamtansicht wird aus deklarierten Ebenen + Kanten + Katalog-Gauben ZUSAMMENGESETZT (2.5D, isometrische Projektion). Es gibt keinen Berechnungsschritt, der scheitern und in einen Fallback laufen kann.
4. **String-Engine ist deterministisch.** Reines Regelwerk + Datenblatt-Mathematik. Kein LLM, keine Heuristik im Rechenpfad. Testbar, erklärbar, kalibrierbar.
5. **Modulgrößen im Plan kommen AUSSCHLIESSLICH aus mm-Maßen × Maßstab.** Niemals aus CSS-/Layout-Verhalten. (Lesson learned: identische viewBoxen renderten ohne fixen Container unterschiedlich groß.)
6. **Kalibrierungs-Gate vor UI-Bau** (§14). Gleiche Regel wie beim Statik-Vorprüfungstool: erst wenn die Engine gegen PV*SOL validiert ist, wird UI gebaut.

---

## 4. Datenmodell Dach

### 4.1 Dachfläche (`RoofPlane`)

```ts
interface RoofPlane {
  id: string;
  polygon: Point2D[];        // 2D-Koordinaten IN der Flächenebene, Meter (wahre Maße, NICHT Draufsicht-verkürzt)
  pitchDeg: number;          // Neigung, 0–75; intern Pflicht, im Foto-Vertriebsflow vorbelegt/unter „Technische Details"
  azimuthDeg: number;        // 0 = Nord, 90 = Ost, 180 = Süd, 270 = West
  source: 'solar_api' | 'manual' | 'solar_api_edited';
  exclusions: Exclusion[];   // Gauben-Footprints, Hindernisse (§4.3, §4.4)
  sharedEdges: SharedEdge[]; // deklarierte Knicke/Grate (§4.2)
  flags: Flag[];             // §10
  flatRoofMounting?: {
    system: 'south' | 'east_west';
    angleDeg: number;
    pitchM: number;
    southDirectionInPlan: 'bottom' | 'left' | 'top' | 'right';
  };
}
```

Bei aufgeständerten Flachdächern ist die Himmelsrichtung Pflicht. Der Nutzer legt
fest, wo Süden in Draufsicht bzw. Foto liegt; Ost und West werden deterministisch
daraus abgeleitet. Die Wahl dreht Belegungsraster, Modul-Kippseiten, PDF und Export
gemeinsam. Altprojekte ohne Angabe behalten die bisherige Konvention „Süden unten“.

**Verkürzungskorrektur (kritisch):** Kommt die Geometrie aus Draufsicht (Luftbild-Trace oder Solar-API-Footprint), MUSS die Kante in Falllinie durch `cos(pitch)` geteilt werden, bevor sie ins `polygon` geschrieben wird. Traufkante (horizontal) bleibt unverändert. Bei 45° Neigung sind sonst ~29 % Sparrenlänge weg → ~40 % zu wenig Module. Kanonische Regel: **im Datenmodell stehen immer wahre Maße**, Verkürzung existiert nur beim Import und beim Draufsicht-Rendering.

### 4.2 Knick (`SharedEdge`)

User zieht eine Linie durch eine Fläche → Tool splittet in zwei `RoofPlane`s mit gemeinsamer Kante, fragt Neigung für beide ab (Vorbelegung aus Solar-API-Segmenten, falls vorhanden).

```ts
interface SharedEdge {
  planeA: string; planeB: string;
  edgeA: [Point2D, Point2D];  // Kante in Ebene A
  edgeB: [Point2D, Point2D];  // korrespondierende Kante in Ebene B
  kind: 'ridge' | 'break' | 'valley';  // First, Knick (Mansard), Kehle
}
```

Kanten ohne deklarierten Nachbarn werden im Kompositor mit dezenter Linie gerendert — kein Fehler, kein Solver-Eingriff.

### 4.3 Gaube — im Elternfoto angelegt, intern eigene Dachflächen (19.07.2026)

Gauben werden vom Nutzer im Foto einer Hauptdachfläche deklariert, niemals automatisch
erkannt. Der Vertriebsflow zeigt **eine verschachtelte Gaube**; intern bleiben ihre
belegbaren Seiten eigene Ebenen mit eigener Neigung, Ausrichtung, Perspektive,
Belegungsfeldern und Hindernissen. `elternFlaecheId` und `gaubenGruppeId` halten diese
Ebenen zusammen. Daraus wird weiterhin keine 3D-Geometrie gelöst.

```ts
interface DormerPlane {
  id: string;
  parentPlane: string;
  type: 'flat' | 'gable';
  side?: 'left' | 'right';            // Satteldachgaube = zwei Ebenen
  widthM: number;
  depthM: number;
  pitchDeg: number;
  covering: 'standing_seam' | 'tile' | 'other';
  measurement: {
    source: 'survey' | 'tiles' | 'neighbor_roof';
    quality: 'confirmed' | 'measured' | 'estimated';
  };
}
```

- **Flachdachgaube mit Stehfalz:** eine gering geneigte Ebene, Module dachparallel.
  Sie darf ausdrücklich NICHT als `art: 'flachdach'` in die PROFINESS-Aufständerung
  gelangen. Export-Montage: `gaube_stehfalz_dachparallel`.
- **Satteldachgaube:** zwei eigenständige Ebenen (links/rechts), weil beide Seiten
  andere Perspektive und Ausrichtung haben können. Die UI erzeugt beide Seiten in
  einem gemeinsamen Markierablauf; der Nutzer legt keine „linke/rechte Fläche“ an.
- **Aufmaß:** Breite und belegbare Länge sind bestätigt.
- **Ziegel zählen:** quer zur Falllinie `Anzahl × Deckbreite`, in Falllinie
  `Reihen × sichtbarer Reihenabstand`; beide Richtungen werden getrennt kalibriert.
- **Stehfalz/Nachbardach:** sichtbare Falze dürfen die Breite verbessern. Fehlen
  belastbare Referenzen auf der Gaube, wird der lokale Maßstab aus benachbarten
  Ziegeln übertragen und das Ergebnis ausdrücklich als **geschätzt** gespeichert.
- Die Homographie der Elternfläche darf nur einen Schätzwert vorbelegen: Die Gaube
  liegt auf einer anderen Ebene, deshalb kann die Verzerrung allein kein wahres Maß
  beweisen. Modulgrößen bleiben Katalog-mm × wahrer/geschätzter Flächenmaßstab.
- Der sichtbare Gaubenumriss wird über die inverse Homographie der Elternfläche in
  eine konservative rechteckige Aussparung überführt. Diese Aussparung ist mit der
  `gaubenGruppeId` verknüpft und wird beim Ändern/Löschen automatisch aktualisiert.
- Normaler Vertriebsablauf: Hauptdach markieren → „+ Gaube“ → Typ wählen → Maße
  angeben/Ziegel zählen oder Schätzung übernehmen → Gaube im selben Foto markieren →
  sofortige Modulvorschau. Parent-Auswahl, eigene Foto-Zuordnung, Seitenebenen,
  Neigung und Azimut der Gaube bleiben im Standardflow verborgen.

### 4.4 Hindernis (`Exclusion`)

Kamin, Dachfenster, SAT, Entlüfter: Rechteck/Kreis auf der Fläche + Clearance (Default 0.30 m). Nur Ausschluss, kein Renderkörper nötig (v1: einfacher grauer Block im Render).

---

## 5. Modulkatalog

Fixkatalog, gepflegt vom Admin. 2 Hersteller, 3 Modultypen (Update 04.07.2026 abends: beide Aiko-Varianten im Einsatz, §5.1). Geometrie nahezu identisch, **Elektrik nicht** — die Typen sind trotz fast gleicher Hülle KEINE austauschbaren Bausteine (WR-Eingangsstrom-Prüfung!).

```ts
interface ModuleType {
  id: string;
  name: string;
  lengthMm: number; widthMm: number; heightMm: number; weightKg: number;
  cells: number;
  // Elektrik @ STC — Quelle: Hersteller-Datenblatt, Version dokumentieren
  pmaxW: number;
  vocV: number; iscA: number; vmpV: number; impA: number;
  tempCoeffVocPctPerK: number;   // negativ
  tempCoeffPmaxPctPerK: number;  // negativ
  maxSystemVoltageV: number;     // 1500
  maxSeriesFuseA: number;
  // Rendering
  renderSymbol: 'jolywood_niwa_black' | 'aiko_abc';  // §11.2
}
```

### 5.1 Initialbestand — BEIDE MODULE BESTÄTIGT ✅

**Jolywood:** Fork aufgelöst 04.07.2026 per Zellzählung am Modul (6 Spalten × 16 Reihen = 96 Zellen) → **JW-HD96N-R2-460** („Niwa Black Series", n-Type bifazial Dual-Glass Transparent Black). Quelle: Hersteller-Datenblatt Version 2025.01 (PDF ins Repo `/docs/datenblaetter/`). Hero-Artikel 1103 ↔ Katalog-id verknüpfen; Typbezeichnung in Hero nachtragen (Feld war leer).
**Aiko:** BEIDE Varianten im Einsatz (bestätigt Genrih 04.07.2026 abends; Wattklassen korrigiert 05.07.2026: verkauft werden 485 W bzw. 480 W, nicht 460 W): Gen3 Neostar 3S+54 **AIKO-A485-MCE54Db** (Doppelglas; Datenblatt DSDr_EN_2405_V1.5 im Repo, Spalte A485) UND Neostar 2N **AIKO-A480-MAH54Mw** (Einzelglas; Datenblatt DS_DE_2407_V1.3 im Repo, Spalte A480). Beide als eigene Katalogeinträge — Elektrik unterschiedlich, nicht austauschbar.
**Alt-Modul (Bestandsanlagen):** JW-HD108N-R3, höchste Klasse 455 W — Voc 39,37 V / Isc 14,21 A / Vmp 33,87 V / Imp 13,43 A, TK −0,300/−0,250/+0,045 %/K, Fuse 30 A, 21,2 kg, 108 Zellen. Als optionaler dritter Katalogeintrag `jw-hd108n-r3-455` für Erweiterungen (Entscheidung Genrih).

| Feld | Jolywood JW-HD96N-R2-460 ✅ | Aiko A485-MCE54Db Gen3 ✅ | Aiko A480-MAH54Mw (Neostar 2N) ✅ |
|---|---|---|---|
| id | `jw-hd96n-r2-460` | `aiko-a485-mce54db` | `aiko-a480-mah54mw` |
| Hero-Artikelnr. | 1103 | TODO | TODO |
| Maße | 1762 × 1134 × 30 mm | 1762 × 1134 × 30 mm | 1757 × 1134 × 30 mm |
| Gewicht | 24,6 kg | 24,5 kg | 21,5 kg |
| Zellen | 96 (6×16) | 108 (6×18) | 108 (6×18) |
| Glas | 2,0/2,0 mm | 2,0/2,0 mm | Einzelglas 3,2 mm |
| Pmax | 460 W | 485 W | 480 W |
| Vmp / Imp | 30,34 V / 15,16 A | 34,30 V / 14,15 A | 34,86 V / 13,78 A |
| Voc / Isc | 35,31 V / **16,00 A** ⚡ | 40,90 V / 14,88 A | 41,30 V / 14,38 A |
| TK Pmax / Voc / Isc | −0,280 / −0,250 / +0,045 %/K | −0,26 / −0,22 / +0,05 %/K | −0,26 / −0,22 / +0,05 %/K |
| Max. Systemspg. / Fuse | 1500 V DC / 35 A | 1500 V DC / 25 A | 1500 V DC / 25 A |
| Bifazialität | 80 % | — | — |
| renderSymbol | `jolywood_niwa_black` (6×16) | `aiko_abc` (6×18) | `aiko_abc` (6×18) |

⚡ **Hohe Modulströme sind der Haupt-Filter der WR-Auswahl.** Jolywood fordert **16,00 A** Kurzschlussfestigkeit pro String am MPPT (Isc STC, direkter Vergleich — Korrektur 06.07.2026, s. §7); Aiko MCE485: 14,88 A; Aiko MAH480: 14,38 A. Standard-MPPTs mit ≤ 15 A Kurzschlussgrenze (z.B. Huawei M1) fallen durch — High-Current-Varianten explizit im WR-Katalog kennzeichnen. R6/R7 schlagen häufiger an als die Spannungsregeln.

Rechen-Referenzen für das Kalibrierungs-Gate (−15 °C / +70 °C):
- Jolywood: Voc_cold `35,31 × 1,10 ≈ 38,84 V` → 1000-V-WR: max. 25 Module/String; Vmp_hot `30,34 × 0,874 ≈ 26,52 V`
- Aiko MCE485: Voc_cold `40,90 × 1,088 ≈ 44,50 V` → 1000-V-WR: max. 22 Module/String; Vmp_hot `34,30 × 0,883 ≈ 30,29 V`
- Aiko MAH480: Voc_cold `41,30 × 1,088 ≈ 44,93 V` → 1000-V-WR: max. 22 Module/String; Vmp_hot `34,86 × 0,883 ≈ 30,78 V`

⚠️ **HARTE REGEL:** Elektrische Werte kommen ausschließlich aus dem exakten Datenblatt der verbauten Serie/Wattklasse (PDF im Repo, Version dokumentiert). Kein Wert aus dem Gedächtnis, keiner Extrapolation aus Nachbar-Wattklassen, keinem Chat-Verlauf, keiner Websuche ohne Datenblatt-PDF als Quelle. ✅ Aufgelöst 04.07.2026 abends: beide Aiko-Datenblätter (MCE54Db DSDr_EN_2405_V1.5 + MAH54Mw DS_DE_2407_V1.3) liegen in `docs/datenblaetter/`, alle Katalogwerte gegen die PDFs verifiziert.

---

## 6. Wechselrichter- & Speicherkatalog

Gleiche Fixkatalog-Logik. Herstellerbestand (Stand 04.07.2026):

| Hersteller | Rolle | Anmerkung |
|---|---|---|
| **EcoFlow** | Main-Marke (WR + Speicher) | Hybrid-Systeme; MPPT-Stromgrenzen gegen Isc 16 A prüfen! |
| Sungrow | WR | High-Current-Variante (SH-RT/RS „HV" vs. Standard) pro Modell kennzeichnen |
| SigEnergy | WR + Speicher (SigenStor) | modulares Stack-System, MPPT-Daten je Leistungsklasse |
| Huawei | WR | High-Current-Frage wie Sungrow |
| BYD | nur Speicher (gelegentlich) | Battery-Box an Fremd-WR — Kompatibilitätsmatrix WR↔Speicher nötig |

~~TODO Genrih: konkrete Modell-/Leistungsklassenliste liefern~~ ✅ **erledigt 04.07.2026 abends** — Datenblätter im Repo (`docs/datenblaetter/`), Modellliste unten. Speicher sind für die String-Engine v1 nur ein Kompatibilitäts-Flag am WR (`compatibleBatteries: string[]`), keine eigene Rechenlogik — DC-Speicher-Strings sind v2.

**Schema-Update 04.07.2026 abends:** Die realen Datenblätter (Sungrow SH-T: 32/32/16 A; Sigen Hybrid 10/12 TP2: 16/32 A; PowerOcean Plus: 32/16/16 A) haben **je MPPT unterschiedliche** Strom- und Stringwerte → `stringsPerMppt`, `maxInputCurrentPerMpptA`, `maxShortCircuitCurrentPerMpptA` sind Arrays der Länge `mpptCount` (Index 0 = MPPT 1).

```ts
interface InverterType {
  id: string; name: string; manufacturer: string;
  acPowerKw: number;
  maxDcVoltageV: number;          // absolute Grenze (Winter-Voc!)
  mpptCount: number;
  mpptVoltageRange: [number, number];  // [Vmin, Vmax] pro MPPT
  startupVoltageV: number;
  maxInputCurrentPerMpptA: number[];     // je MPPT — R6 (Imp-Summe)
  maxShortCircuitCurrentPerMpptA: number[]; // je MPPT — R7 (Σ Isc, STC direkt)
  maxShortCircuitCurrentPerStringA?: number[]; // je MPPT, optional — R12; nur wo Datenblatt Per-String-Wert nennt (PO Plus PV1: 19 A)
  maxDcAcRatio: number;                // Überbelegungsgrenze lt. Hersteller, sonst Default 1.35
  stringsPerMppt: number[];            // je MPPT
}
```

### 6.1 Modellliste Heimbereich bis 30 kWp (Stand 04.07.2026, alle Werte aus Datenblatt-PDFs im Repo)

| Familie | Klassen (AC) | maxDC | MPPT-Fenster / Start | MPPTs × Strings | maxIn / maxSC je MPPT | DC:AC lt. DB |
|---|---|---|---|---|---|---|
| EcoFlow PowerOcean (EF HD-P3-…-S1) | 6 / 8 / 10 / 12 kW | 1000 V | 200–850 V / 160 V | 2 × 1 | 16 A / 24 A | 1,67 / 1,5 / 1,4 / 1,33 |
| EcoFlow PowerOcean Plus (EF HD-P3-…-S1) | 15 / 20 / 25 / 29,9 kW | 1000 V | 200–850 V / 160 V | 3: PV1 2 Strings, PV2/PV3 je 1 | PV1 32/38 A · PV2/3 16/24 A | 2,0 / 1,75 / 1,6 / 1,34 |
| Sigenergy Sigen Hybrid TP2 | 3 / 4 / 5 / 6 / 8 / 10 / 12 kW | 1100 V | 160–1000 V / 180 V | 2; ab 10 kW: MPPT2 mit 2 Strings | 16/22 A; MPPT2 ab 10 kW 32/44 A | 2,0 |
| Sigenergy SigenStor EC (Energy Controller) | 5–30 kW (10 Klassen) | 1100 V | 160–1000 V / 180 V | 2 (≤8 kW) / 3 (10–15) / 4 (17–30), je 1 String | 16 A / 20 A | 1,6 |
| Sungrow SH15/20/25T | 15 / 20 / 25 kW | 1000 V | 150–950 V / 180 V | 3: 2/2/1 Strings | 32/32/16 A · SC 40/40/20 A | 2,0 |
| ~~Huawei SUN2000-3–10KTL-M1~~ | — | — | — | — | **11 A / 15 A** | — |

~~⚠️ Huawei M1~~ **Entschieden 05.07.2026 (Genrih): Huawei M1 NICHT im Katalog.** 11 A Eingangsstrom pro MPPT liegt unter dem Imp aller drei Katalogmodule (13,78–15,16 A) → jeder String fiele durch R6 (Jolywood zusätzlich durch R7: Isc 16,0 A > 15 A Kurzschlussgrenze; Vergleich seit 06.07.2026 ohne ×1,25). Datenblatt bleibt im Repo für den Fall einer High-Current-Variante.

⚠️ **PowerOcean Plus PV1:** Datenblatt nennt 19 A Kurzschlussstrom **pro String** (2 Strings = 38 A je MPPT), durch R12 abgedeckt (`maxShortCircuitCurrentPerStringA: [19, 24, 24]`). ~~Jolywood fordert 20,0 A pro String → verboten~~ **Korrigiert 06.07.2026 (Genrih, Praxis-Einspruch + Recherche):** Der Vergleich läuft mit Isc STC **ohne** Faktor 1,25 → Jolywood 16,0 A ≤ 19 A → **an PV1 zulässig** — deckt sich mit der Installationspraxis (Jolywood an PowerOcean-Plus-String 1 ist Standardfall). Begründung in §7.

Speicher (nur Flag, Datenblätter im Repo): EcoFlow PowerOcean LFP · Sungrow **SBR** (bestätigt 05.07.2026; SBH-Datenblatt liegt bei, wird aber nicht verknüpft) · SigenStor BAT.

Hinweis aus der Marktrealität: Module mit Imp ≈ 13 A+ erfordern bei manchen Herstellern (Sungrow, SMA, Huawei, SolarEdge) die High-Current-Variante. Genau dafür existiert `maxInputCurrentPerMpptA` als harte Prüfung.

---

## 7. String-Engine — Regelwerk

Reine Datenblatt-Mathematik. Auslegungstemperaturen (Admin-konfigurierbar, Defaults konservativ für Allgäu):

- `T_min = −15 °C` (Winter, Leerlauf morgens)
- `T_cell_max = +70 °C` (Sommer, Volllast)
- STC-Referenz 25 °C

### Berechnungen

```
Voc_cold  = Voc_STC × (1 + tkVoc/100 × (T_min − 25))       // z.B. −0,29 %/K, −15 °C → Faktor ~1,116
Vmp_hot   = Vmp_STC × (1 + tkPmax/100 × (T_cell_max − 25)) // Näherung über TK Pmax; konservativ
```

### Regeln (alle müssen bestehen, sonst ist der Plan UNGÜLTIG und nicht exportierbar)

| # | Regel | Prüfung |
|---|---|---|
| R1 | Max. DC-Spannung | `n × Voc_cold ≤ maxDcVoltageV` |
| R2 | Systemspannung Modul | `n × Voc_cold ≤ module.maxSystemVoltageV` |
| R3 | MPPT-Fenster unten | `n × Vmp_hot ≥ mpptVmin` |
| R4 | MPPT-Fenster oben | `n × Vmp_STC ≤ mpptVmax` |
| R5 | Anlaufspannung | `n × Vmp_hot ≥ startupVoltageV` |
| R6 | Eingangsstrom | `Σ Imp der parallelen Strings ≤ maxInputCurrentPerMpptA` |
| R7 | Kurzschlussstrom | `Σ Isc × iscSafetyFactor ≤ maxShortCircuitCurrentPerMpptA` (Default-Faktor **1,0**, s.u.) |
| R8 | Gleiche Stringlänge pro MPPT | parallele Strings am selben MPPT: identische Modulanzahl |
| R9 | Eine Ausrichtung pro MPPT | Module unterschiedlicher `RoofPlane`-Azimut/Neigung nicht am selben MPPT (Ausnahme: WR mit Schatten-Management, Flag pro WR-Katalogeintrag) |
| R10 | Kein Modul-Mix im String | ein String = ein `ModuleType` |
| R11 | DC:AC-Ratio | `kWp_gesamt / acPowerKw ≤ maxDcAcRatio` (Warnung ab 1,2, hart bei Katalogwert) |
| R12 | Kurzschlussstrom je String-Eingang | `Isc × iscSafetyFactor ≤ maxShortCircuitCurrentPerStringA[mppt]`; fehlt der Datenblattwert, gilt die MPPT-Grenze (R7) als Fallback. NEU 05.07.2026 |

**R12 (ergänzt 05.07.2026, Genrih):** Manche WR begrenzen den Kurzschlussstrom zusätzlich PRO STRING-EINGANG (PowerOcean Plus PV1: 19 A je Stecker bei 38 A je MPPT). Da der Stringstrom NICHT von der Modulanzahl abhängt, ist die Konsequenz eines R12-Fehlers immer: **anderer Modultyp oder anderer Eingang** — die Fehlermeldung sagt das explizit.

**Isc-Sicherheitsfaktor = 1,0 (Korrektur 06.07.2026, Genrih):** R7/R12 vergleichen den Modul-Isc (STC) **direkt** mit der WR-Kurzschlussgrenze. Der ursprünglich angesetzte Faktor 1,25 (VDE 0100-712 / IEC 60364-7-712) gilt der Dimensionierung von **Leitungen und Überstromschutz** (dafür: `module.maxSeriesFuseA`), nicht dem Vergleich mit dem WR-Gerätegrenzwert — die Hersteller weisen ihre Kurzschlussfestigkeit bereits mit eigener Marge gegen den Modul-Isc aus (EcoFlow Plus PV1: 19 A SC bei 16 A Eingangsstrom; Quellen: KOSTAL-Planungshinweis „Isc_PV zu keiner Zeit überschreiten" = STC-Vergleich, SMA-Blog „Das große Missverständnis I DC max", BayWa-re-Fachartikel Auslegung von Modulströmen). Auslöser: Praxisfall Jolywood (16,0 A) an PowerOcean-Plus-PV1 (19 A/String) — mit ×1,25 fälschlich verboten, real Standardinstallation. `iscSafetyFactor` bleibt konfigurierbar für konservative Auslegung.

**Fehlerdarstellung:** immer konkret mit Zahlen. Beispiel: „24 Module gehen nicht: Winter-Voc 1.052 V > WR-Maximum 1.000 V. Maximal 22 Module pro String." Niemals nur „ungültig".

### 7.1 Auto-Stringplan (v1.5)

Rule-based Solver, KEIN LLM: (1) gültige Stringlängen `n` je Modul×WR enumerieren (R1–R5), (2) Modulbestand pro Fläche auf MPPTs verteilen unter R6–R11, (3) Lösungen ranken (wenigste Strings, ausgeglichenste MPPT-Last). Deterministisch, jede Lösung erklärt sich über die Regeln.

---

## 8. Geometrie-Quellen

### 8.1 Primär: Google Solar API

- `buildingInsights` liefert pro Dachsegment `pitchDegrees`, `azimuthDegrees`, Fläche, Bounding Box → direkt in `RoofPlane` (mit Verkürzungskorrektur §4.1). 10.000 Calls/Monat frei.
- `dataLayers` (DSM, RGB) nur gezielt — kleineres Freikontingent (1.000/Monat), teurer.
- Coverage Deutschland großteils MEDIUM (0,25 m/px), ländlich teils BASE oder nichts → Fallback ist Pflicht-Feature, kein Nice-to-have.
- Bildalter beachten: Imagery kann Jahre alt sein. Hinweis im UI: „Luftbild vom {imageryDate} — Dach seitdem verändert? → manuell korrigieren."

**⛔ GATE-0 (vor jedem Bau von §8.1):** Test-Call mit EEA-Billing-Account. Seit 08.07.2025 gelten die EEA-Terms; bestimmte Solar-API-Inhalte werden im EEA nicht mehr ausgeliefert — real prüfen, was `buildingInsights` und `dataLayers` für 2–3 echte Allgäu-Adressen zurückgeben. Ergebnis in §16 dokumentieren. Kein Code gegen angenommene Responses.

**⛔ Verboten:** Screenshots von google.com/maps als Planungsgrundlage oder in Kundenoutputs (Maps-TOS: keine derivativen Werke). Nur API-Daten im lizenzierten Rahmen.

### 8.2 Workflow „korrigieren statt konstruieren"

1. Adresse → Solar-API-Segmente als editierbare Overlays
2. Vertriebler korrigiert: Segment löschen, Ecke ziehen, Gaube stempeln, Knick ziehen
3. Kein/schlechtes Ergebnis → Fallback: Flächen manuell anlegen (Polygon zeichnen ODER Aufmaß-Maße eingeben, Neigung/Azimut per Dropdown/Buttons)
4. Vorhandene Aufmaß-Maße überschreiben IMMER getracte Werte (Override-Feld pro Kante)

### 8.3 Eskalation (Pflicht-Feature)

Button **„Komplexes Dach → an PL"**: legt Ticket mit Rohdaten an, markiert Projekt als eskaliert. Anspruch des Tools sind 80 % Standarddächer, nicht 100 % — ehrliche Eskalation statt falscher Plan.

### 8.4 Belegungsfotos und Flächenzuordnung (04.08.2026)

- Drohnenfotos sind projektweite Bild-Assets. Ein Foto darf mehrere Dachflächen A/B/C enthalten; alternativ dürfen die Flächen auf mehrere Fotos verteilt werden.
- Jede Dachfläche darf **einem oder mehreren Belegungsfotos** zugeordnet sein. Jede
  Zuordnung ist eine eigene Perspektive derselben metrischen Dachfläche. Die
  Belegung wird ausschließlich auf kalibrierten Drohnenfotos bearbeitet; eine
  synthetische Draufsicht ist im Vertriebsflow nicht mehr vorhanden. Flächen ohne
  Foto behalten ihre metrischen Daten, bleiben aber bis zur Fotozuordnung und
  Kalibrierung unbelegbar und nicht als Belegungsplan exportierbar.
- Perspektive, Traufkante, Foto-Maßstab und Markierungsstatus gehören zur
  **Zuordnung Fläche ↔ Foto**, nicht zum Bild-Asset und nicht global zur Fläche.
  Belegungsfelder, ausgeschaltete Module, metrischer Umriss und Hindernisse gehören
  dagegen genau einmal zur Dachfläche. Eine Änderung in einer Perspektive wird daher
  automatisch in allen anderen Perspektiven derselben Fläche sichtbar.
- Eine Fläche darf demselben Foto höchstens einmal zugeordnet werden. Jede Perspektive
  wird separat mit vier Ecken kalibriert. Das Neusetzen einer Perspektive darf die
  gemeinsame metrische Geometrie der Dachfläche nicht löschen.
- UX: In der Flächenkarte wird zwischen den zugeordneten Fotos umgeschaltet.
  „Foto hinzufügen“ bzw. „Weitere Perspektive“ lädt direkt an dieser
  Fläche ein Bild hoch, ordnet es automatisch zu und öffnet die neue Perspektive.
  Bereits vorhandene Projektfotos können dort optional wiederverwendet werden. Die
  projektweite Fotoübersicht dient nur Vorschau, Umbenennen, Ersetzen und Löschen;
  sie enthält keinen zweiten Zuordnungsweg. Das Entfernen einer Perspektive löst
  nur die aktive Zuordnung und niemals die Belegung.
- Das frühere eigene UI-Tab „Gesamtansicht" entfällt. Die Foto-Gruppen im Belegungsschritt und im PDF übernehmen diese Aufgabe.
- Der Vertriebsablauf hat drei Hauptschritte: **Projekt → Dach & Belegung → Export**.
  Dachflächen-Grunddaten und Belegung liegen bewusst im selben Arbeitsschritt.
- Jede neue Hauptfläche startet mit geöffneten Grunddaten. Auf dem Desktop liegen
  die häufigen Angaben in einer kompakten Zeile: Flächenart, Traufe/Breite,
  Sparrenlänge/Tiefe, Flächenform, Ausrichtung und Neigung. Nur konditionale Angaben
  (Firstbreite/Versatz oder Flachdach-Aufständerung) dürfen eine zweite Zeile bilden.
  Die Dacheindeckung liegt, soweit für Export/Montage noch benötigt, unter
  „Technische Details" und belegt keine eigenen breiten Auswahlkarten mehr.
- Änderungen dieser Maße lassen die vier Fotoecken unverändert: Die Ecken bestimmen
  die Perspektive, die wahren Maße bestimmen den metrischen Maßstab und damit die
  sichtbare Modulgröße. Belegungsfelder, manuelle Umrisse und Hindernisse werden beim
  Ändern proportional mitgeführt, damit ihre Lage im Foto nicht springt.
- **„Am Foto anpassen"** scrollt das belegte Foto direkt unter die angeheftete
  Maßzeile. Form und Maße bleiben dort bedienbar, damit die Wirkung ohne
  Hin-und-her-Scrollen unmittelbar am Ziegelbild geprüft werden kann.
- Im Belegungseditor dürfen A/B/C-Rahmen der Orientierung dienen. Im Kunden-PDF zeigt
  die Foto-Übersicht nur Foto und Module — keine Zonen-Kreise und keine orange
  Flächenkontur.
- Gauben sind eigene untergeordnete Dachflächen (§4.3). Eine Flachdachgaube mit
  Stehfalz bleibt dachparallel; eine Satteldachgaube besteht aus zwei Ebenen. Angelegt
  und verwaltet werden sie jedoch verschachtelt im Foto ihrer Elternfläche; das Foto
  und die semantische Elternzuordnung werden automatisch übernommen.

---

## 9. Belegungslogik

- Raster pro `RoofPlane`: Modulmaß (aus Katalog, mm) + Ausrichtung hoch/quer (Button) + Reihen-/Spaltenabstand (Default 20 mm Klemmfuge, Admin-konfigurierbar)
- Randabstände: Default 0,05 m zu Traufe/First/Ortgang (Genrih 05.07.2026 — 0,30 m war zu konservativ und kostete Modulreihen; Admin-/UI-konfigurierbar je Fläche; Hinweis auf Wind-Randzonen als v2-Thema, v1 = pauschaler Rand)
- **Flächen-Umriss (06.07.2026):** optionales Polygon je Fläche (`umrissM`, beliebige Eckenzahl, Flächen-Koordinaten in Meter) für Walm/Trapez/L-Form. Das Rechteck Traufe × Sparren bleibt Rahmen + Koordinatensystem; Module müssen komplett im Polygon liegen, Randabstand gilt auch zu jeder Umrisskante (Grat!). Ohne Umriss gilt das Rechteck — Eckenzahl wird nie abgefragt, sie ergibt sich beim Klicken. v1 behält das zentrierte Rechteck-Raster und filtert (kein Packungs-Optimierer).
- **Hindernisse (06.07.2026):** Rechtecke je Fläche (`hindernisseM`: Kamin, Dachfenster, SAT); Module, die ein Hindernis schneiden, entfallen automatisch (Kantenberührung zählt nicht). Kein CV/ML — Markierung ist manuell (2 Klicks), Rückrechnung Foto→Fläche über die inverse Homographie.
- **Gauben-Aussparungen (19.07.2026):** gruppenbezogene Rechtecke auf der
  Elternfläche werden zusätzlich zu manuellen Hindernissen an die Engine übergeben.
  Die UI erzeugt und entfernt sie gemeinsam mit der Gaube; sie werden nicht als
  separates manuelles Hindernis behandelt.
- Manuelles Nacharbeiten: einzelne Module per Klick deaktivieren/aktivieren
- kWp = Σ aktive Module × Pmax

---

## 10. Flag-System („gelb anmalen")

**v1 (deterministisch, billig):**
- Solar-API-Segmente überlappen sich oder lassen Lücken → gelb
- Mini-Segment (< 4 m²) innerhalb großer Fläche → gelb + Dialog: „Gaube? Knick? Ignorieren?"
- Unplausibles Seitenverhältnis, Neigung 0° bei offensichtlichem Steildach-Kontext → gelb
- Fläche ohne Neigungsangabe → Belegung blockiert bis Eingabe

**v2 (hinter GATE-0):** DSM-Residuen — Ebene pro Segment fitten, Höhenabweichungen lokalisieren → unerkannte Gauben/Knicke gemessen statt geraten. Nur wenn `dataLayers` unter EEA-Terms das DSM liefert.

---

## 11. Rendering

### 11.1 Ansichten

- **v1:** Ein oder mehrere kalibrierte Belegungsfotos je Fläche. Auf jedem Foto werden alle zugeordneten Flächen mit ihrer eigenen projektiven Abbildung zusammengesetzt. Eine synthetische Draufsicht und ein separates Gesamtansicht-Tab gibt es nicht mehr. Die metrische 2D-Geometrie bleibt intern die verbindliche Grundlage für Raster, Randabstände, Hindernisse und Export.
- Kein Tilt/3D-Hover (konsistent mit Website-Designsystem).

### 11.2 Modul-Symbole (SVG `<symbol>` / `<use>`, freigegeben 04.07.2026)

Ein Symbol pro Modultyp, N-fach instanziert, Neigungs-Transform pro Fläche. Niemals Geometrie pro Modul duplizieren.

**Gemeinsam:** Rahmen außen `#0e0e10`→`#141416` (2 Stufen), Glasfläche `#08090b`, Rahmenkontur innen 1 px, dezenter diagonaler Glanz-Polygon (weiß, opacity ~0.025), Seitenverhältnis 1762:1134.

**`jolywood_niwa_black`** (Zellen tiefschwarz = identisch Aiko, NUR Linien silbern). **Raster final: 6×16** (HD96N-R2 bestätigt). Referenz-SVG v4 hat 18 Reihen — bei Code-Übernahme auf 16 Reihen / 15 Zwischenlinien anpassen; Raster wird aus `cells` im Katalog abgeleitet, nicht hartkodiert:
- Horizontale Verbinderlinien zwischen Zellreihen (Anzahl = Reihen − 1 = 15): `#5a5e66`, 0.7 px, opacity 0.85
- Mittelfuge (Halbzellen-Trennung): Balken `#54585f`, ~1 % Modulhöhe, opacity 0.9 — auffälligstes Element
- Vertikale SMBB-Drähte in den Zellen: `#3f424a`, 0.3 px, opacity 0.55, 5 je Zellspalte
- Spaltengrenzen fast schwarz `#101114` (real kaum sichtbar)

**`aiko_abc`** (All Back Contact, keine Frontkontakte):
- Homogen schwarz, Zellkanten nur minimal angedeutet: `#121316`, 0.5 px
- Mittellinie minimal betont `#15161a`, 0.8 px
- KEINE silbernen Linien, keine Drähte

**Level-of-Detail:** unterhalb Schwellwert (Modul < ~40 px Rendergröße) vereinfachte Variante — Jolywood: schwarz + Mittelfuge + Reihenlinien reduziert; Aiko: flat black + Rahmen. Farbunterschied trägt die Erkennbarkeit.

Referenz-SVGs: siehe Chat „Belegungstool" 04.07.2026, Widget `modul_grafiken_jolywood_vs_aiko_v4_silberlinien`. Bei Übernahme in Code: 1:1 als Symbol-Defs portieren.

### 11.3 Dachfarben

Swatch-Auswahl pro `RoofPlane` (Sales-Feature, null Einfluss auf Engine): Ziegelrot (Ton), Anthrazit (Beton/engobiert), Schiefer/Schwarz, Grau (Blech/Bitumen). Full-Black-Wirkung auf Anthrazit vs. Ziegelrot ist Teil des Verkaufsmoments — Dachfarbe × Modul-Look immer gemeinsam rendern.

### 11.4 Fassadenfarbe

**NICHT v1.** Draufsicht-Daten enthalten keine Fassaden. Späteres eigenes Modul (Kundenfoto-Upload + Segmentierung, v2+). Nicht an die Dach-Pipeline flanschen.

---

## 12. Tech-Stack (Vorschlag, konsistent mit Bestand)

- Frontend: Next.js 14 + Tailwind (wie Website-Projekt), Canvas/SVG für Plan-Editor
- Backend: Node.js/Express (wie Ticketsystem), SQLite reicht für Katalog + Projekte
- Hosting: bestehender IONOS VPS, Subdomain unter `intern.suedenergie-pv.de` oder eigene
- Auth: Session-Auth wie Ticketsystem, idealerweise gemeinsame User-Basis
- CI: internes Dashboard-CI (Inter, `#e8603a`, weiße Cards auf `#f4f6f8`) — NICHT das dunkle Website-CI

---

## 13. Export → Ticketsystem

Ein Klick erzeugt Ticket in `tickets_projektierung` mit Payload:

```json
{
  "tool": "belegungsplaner",
  "version": "1.0",
  "projekt": { "adresse": "...", "kunde": "...", "erfasser": "user_id" },
  "geometrie_quelle": "solar_api | manual | solar_api_edited",
  "flaechen": [
    { "id": "p1", "neigung_deg": 38, "azimut_deg": 182, "flaeche_m2": 54.2,
      "flachdach_montage": null,
      "module": { "typ": "jw-hd96n-r2-460", "anzahl": 24, "ausrichtung": "hoch",
        "anzahl_hochkant": 24, "anzahl_quer": 0,
        "anzahl_ost": 0, "anzahl_west": 0 } }
  ],
  "wechselrichter": { "typ": "...", "anzahl": 1 },
  "strings": [
    { "mppt": 1, "flaeche": "p1", "module": 12, "voc_cold_v": 0, "vmp_hot_v": 0 }
  ],
  "kwp": 11.04,
  "regel_pruefung": { "bestanden": true, "regeln": { "R1": "ok", "...": "..." } },
  "flags": [], "eskaliert": false,
  "render_png_url": "..."
}
```

Ticket-Kategorie: neue Kategorie „Vorplanung Vertrieb" (V3-Datenmodell des Ticketsystems: `user_categories` beachten — bekannter Bug!). PL macht daraus die PV*SOL-Detailauslegung. Feldnamen ASCII snake_case, kompatibel als spätere CRM-Keys (gleiche Konvention wie Objektaufnahme-PDF).

PDF- und JSON-Downloads enthalten im Dateinamen neben dem Kunden-/Projektbezug auch
die Gesamtanlagengröße in kWp, damit Dateien außerhalb des Tools eindeutig bleiben.

---

## 14. ⛔ KALIBRIERUNGS-GATE (Pflicht vor Produktiveinsatz)

**Update 05.07.2026 (Genrih, Owner-Entscheidung):** UI-Bau VOR der Kalibrierung freigegeben — Genrih ist nicht der PL und hat keinen PV*SOL-Zugang; die Gegenrechnung macht der PL, sobald verfügbar. Einordnung: Das Tool ist primär ein VERTRIEBstool (Belegung + kWp + Optik), der Stringplan ist ein optionaler Zusatz. Statt Banner-Mechanik: dezenter, permanenter Hinweis im UI („Vorplanung Vertrieb — keine Fachplanung, finale Auslegung durch PL/PV*SOL") und `hinweis`-Feld im Export-Payload. Die Kalibrierungsmatrix bleibt bestehen und wird vom PL abgearbeitet, sobald verfügbar.

1. Testmatrix definieren: alle Katalogmodule × alle Katalog-WR × Stringlängen (min, mitte, max, max+1) × T_min/T_cell_max → mindestens ~30 Fälle, davon gezielt Grenzfälle (max+1 MUSS durchfallen)
2. Jeden Fall in PV*SOL (vorhandene Lizenz) nachstellen: zulässige Stringlängen, Voc bei −15 °C, MPPT-Prüfungen
3. Abgleich: Engine-Ergebnis == PV*SOL-Ergebnis für JEDEN Fall. Abweichung → Ursache klären (Temperaturmodell? Datenblattwert? Rundung?), fixen, Matrix komplett neu laufen lassen
4. Matrix + Ergebnisse als `kalibrierung.md` neben dieser SPEC einchecken

Zusätzlich blockierend:
- **GATE-0** (§8.1): EEA-Test-Call Solar API, bevor Geometrie-Import gebaut wird
- Modulkatalog vollständig (R3-Datenblattwerte ⚠️ aus §5.1 geschlossen)
- WR-Katalog befüllt (§6 TODO)

---

## 15. Versionsplan

| Version | Inhalt |
|---|---|
| **v1** | Manuelle + Solar-API-Geometrie, Knick/Gaube-Deklaration, Belegung, String-Engine mit Regelwerk, Flags (Geometrie-Heuristiken), 2D-Plan + 2.5D-Gesamtansicht, Dachfarben, JSON-Export, Eskalations-Button |
| **v1.5** | Auto-Stringplan (Rule-Solver, §7.1), Render-Export als PNG/PDF fürs Angebot, LoD-Feinschliff |
| **v2** | DSM-Residuen-Flags (hinter GATE-0), Fassadenmodul (Kundenfoto), Wind-Randzonen statt Pauschalrand, CRM-Anbindung statt/neben Ticketsystem |

---

## 16. Offene Punkte / TODO

| # | Punkt | Wer | Blockiert |
|---|---|---|---|
| 1 | ~~Jolywood-Fork~~ ✅ aufgelöst 04.07. per Zellzählung (6×16 = 96) → HD96N-R2-460, Werte final in §5.1. Rest: Typbezeichnung in Hero-Artikel 1103 nachtragen | Genrih (Hero-Pflege) | — |
| 2 | ~~Aiko~~ ✅ erledigt 04.07. abends, Wattklassen korrigiert 05.07. — BEIDE Varianten im Einsatz: A485-MCE54Db (Doppelglas) + A480-MAH54Mw (Einzelglas), Werte in §5.1, beide Datenblätter im Repo. Offen nur: Hero-Artikelnummern | Genrih (Hero-Pflege) | — |
| 3 | ~~WR-Modelle~~ ✅ erledigt 04.07. abends — Heimbereich bis 30 kWp in §6.1, Datenblätter im Repo, Katalog geseedet. Offen: Huawei-M1-Einsatzfrage (11 A!), BYD-Kompatibilitätsmatrix | Genrih | — |
| 4 | GATE-0: Solar-API-Test-Call mit EEA-Account, Response dokumentieren | Genrih/Claude Code | §8, §10 v2 |
| 5 | Schneelast-/Wind-Randzonen: v1 bewusst Pauschalrand — mit Statik-Tool-Erkenntnissen später zusammenführen? | Genrih | nein (v2) |
| 6 | Ticketsystem: Kategorie „Vorplanung Vertrieb" + `user_categories`-Bug vorher fixen | Genrih | §13 |
| 7 | Auslegungstemperatur T_min: −15 °C Default fürs Allgäu bestätigen oder verschärfen (Höhenlagen) | Genrih | Kalibrierung |

---

## 17. Claude-Code-Handoff-Regeln

- Diese SPEC.md liegt im Repo-Root, dazu `CLAUDE.md` mit Verweis hierauf (gleiches Muster wie Statik-Tool)
- Reihenfolge: Katalog-Datenmodell → String-Engine + Tests → Kalibrierung (§14) → Geometrie-Import → Belegung → Renderer → Export → UI-Politur
- Engine-Code ohne Tests wird nicht gemerged; jede Regel R1–R11 hat mindestens einen Pass- und einen Fail-Testfall
- Bei Widerspruch zwischen Chat-Verlauf und dieser SPEC gilt die SPEC. Bei Lücken: fragen, nicht raten.
