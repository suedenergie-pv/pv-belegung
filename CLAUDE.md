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

## Screenshots & Verifikation im Dev-Betrieb

- `preview_screenshot` hängt in diesem Setup regelmäßig (30-s-Timeout, 6/6 Fehlschläge
  am 05.07.) — nach zwei Timeouts nicht weiter versuchen.
- Stattdessen die feste Dev-Route `apps/web/app/api/debug-shot/route.ts` nutzen
  (außerhalb von production aktiv): per `preview_eval` das SVG/Canvas als Base64-PNG
  rendern und `fetch('/api/debug-shot', { method: 'POST', body: JSON.stringify({ b64, name }) })`
  aufrufen. Die Datei landet in `.debug-shots/` (gitignored); der genaue Pfad steht in
  der Antwort. Die Route NICHT löschen — das Löschen hinterließ Geister-Typen in
  `.next/types` und brach den typecheck.
- Nach dem Öffnen von Print-/Export-Dialogen nie screenshotten (Renderer friert ein);
  `preview_eval` verwenden.

## Kontakt-Punkte, die auf Genrih warten (nicht blockierend für Schritt 1–3)

- ~~WR-Modellliste~~ ✅ 04.07. geseedet (28 Klassen, §6.1; Huawei M1 bewusst raus)
- GATE-0: Solar-API-EEA-Testcall
- Ticketsystem-Kategorie "Vorplanung Vertrieb" (+ user_categories-Bug)

## OFFENE Aufträge (Stand 06.07.2026 abends)

Lies zuerst diese CLAUDE.md komplett (v.a. „Nicht verhandelbar", Screenshot-Workflow,
Preview-Falle unten) und SPEC §9/§13. Arbeitsstand: alles committet & deployt,
Live-URL https://suedenergie-pv.github.io/pv-belegung/ (jeder Push auf main deployt).

✅ Projektliste, Dachform (Trapez), Jolywood-Rendering, PDF-Kleinkram,
Stringcheck-Umbenennung, Belegungs-Optimierer, SüdEnergie-Logo im PDF-Kopf
(Icon auf Versalhöhe, `lib/logo.ts`) — alle erledigt (5. Session, s.u.).

**Noch offen:**
1. **PV*SOL-Gegenrechnung (das Gate, Genrih)** — weiterhin der wichtigste Punkt.
2. Ideen: Foto-Feinpositionierung, R13+ (OFFENE_FRAGEN #4), mehr WR-Familien.

**Regeln dabei:** Engine rechnet, UI rechnet nie (SPEC §3.4/§3.5). Elektrik nur
aus Datenblatt-PDFs. Jede Engine-Änderung mit Tests (`npx vitest run --root
packages/engine`), vor jedem Push `npm run typecheck`. Commits klein, auf Deutsch,
mit Datum/Begründung wie bisher. Verifikation im Browser über die debug-shot-Route
(NICHT preview_screenshot), bei 0×0-Viewport zuerst `preview_resize` 1280×900.

## Session-Übergabe 06.07.2026 (5. Session — Opus, autonom)

Fünf Genrih-Wünsche + Backlog abgearbeitet, je Schritt committet & gepusht (Deploy automatisch):

1. **Dachform Rechteck/Trapez von Anfang an** (`SchrittFlaechen`): parametrische
   Form je Fläche → die digitale Fläche hat sofort die richtige Form, auch ohne Foto.
   Engine `trapezUmriss` (Traufe unten voll, First oben schmaler, 0 = Walmspitze).
   `model.ts umrissVon(f)`: manueller Umriss > Trapez > Rechteck. DachSvg/Belegung/PDF
   nutzen `umrissVon`. Manuelles „Umriss zeichnen" bleibt als Override.
2. **Jolywood-Rendering** (`DachSvg ModulSymbol`): Niwa Black rendert jetzt Glas-Glas-
   Optik mit sichtbaren SILBRIGEN Zellfugen (war schwarzes Rechteck); Aiko ABC bleibt
   echt schwarz. Genrih: „man sollte die leichten silbernen Linien erkennen."
3. **Belegungs-Optimierer** (`berechneRaster`): bei Umriss wird jede Reihe horizontal
   verschoben, WENN dadurch mehr Module passen (Walm 1–3 Module), Tie-Break zentriert
   → symmetrische Formen bleiben symmetrisch, Rechtecke unverändert. `optimiereReihen`-
   Flag (Default true). Verschiebt NIE Module raus (nur strikt mehr).
4. **PDF-Kleinkram**: `Projekt.erfasser` + Eingabefeld (SchrittProjekt), im PDF-Kopf +
   JSON; Datum „06.07.2026" (dd.mm.yyyy).
5. **Stringplan → „Stringcheck"** (Nav + Einleitungshinweis „optionaler Check für
   kleine Anlagen"). Genrih: kein Main-Feature.
6. **Foto-Umriss direkt zeichnen** (`FotoHintergrund` + `foto-geometrie`) — Genrih
   fand den alten „erst 4 Ecken kalibrieren, DANN Umriss zeichnen"-Zweischritt
   umständlich. Jetzt EINE Aktion „Umriss zeichnen": Ecken der Reihe nach klicken
   (≥4), schließen per erstem Punkt/„Fertig". `vierEckenFuerHomographie` bestimmt
   die 4 Perspektiv-Ecken (größtes umschließendes Viereck der konvexen Hülle) für
   die Homographie; zusätzliche Ecken → `umrissM`-Maske via inverse Homographie.
   4 Ecken = einfaches Viereck (umrissM leer), >4 = maskierte Form (L/Walm).

**Verifiziert im Browser** (debug-shot): Trapez-Filter, Jolywood-Linien, Optimierer an
asymmetrischem Walm (Reihen folgen dem Grat, keine Module verloren), PDF mit Erfasser+
Datum. 75 Engine-Tests grün.

## Session-Übergabe 06.07.2026 (4. Session — Opus)

## Session-Übergabe 06.07.2026 (4. Session — Opus)

**Projektliste (mehrere Projekte im Browser)** — Vertriebler haben mehrere Termine.
- `lib/model.ts`: neuer Key `pv-belegung-projekte-v1` mit `ProjektDb`
  (`aktivId` + `projekte: ProjektEintrag[]`, je Eintrag id/projekt/schritt/
  erstelltAm/geaendertAm). `ladeProjekte()` migriert EINMALIG vom Alt-Key
  `pv-belegung-wizard-v1` (Bestandsprojekt bleibt erhalten, Alt-Key wird danach
  entfernt weil Fotos = groß). `speichereProjekte()` behält den Fallback „bei
  vollem Speicher ohne Fotos". Katalog-id-Migration in `migriereProjekt()`
  extrahiert und pro Eintrag angewandt.
- `app/page.tsx`: Projektauswahl-Leiste oben (Select + „+ Neu"/„Duplizieren"/
  „Löschen"), Schritt-Stand pro Projekt erhalten. „Neu beginnen" entfällt.
  Invariante: es gibt IMMER genau ein aktives Projekt (leere Liste / letztes
  gelöscht → frisches leeres). Löschen mit `window.confirm`.
- Verifiziert im Browser: Migration (Alt-Kunde + Schritt 2 übernommen, Alt-Key
  weg), Neu/Bearbeiten/Duplizieren („(Kopie)")/Wechseln (Schritt-Stand folgt)/
  Löschen inkl. Edge Case „letztes Projekt gelöscht → neues leeres". Screenshot ok.

## Session-Übergabe 06.07.2026 (3. Session)

**Stand:** Engine R1–R12 (58 Tests grün) + UI-Wizard + **PDF-Export als Hauptexport**.

1. ✅ **Isc-Faktor korrigiert (1,25 → 1,0)** — Genrihs Praxis-Einspruch („Jolywood an
   EcoFlow-String-1 machen wir immer") war berechtigt: WR-Kurzschlussgrenzen werden
   mit Modul-Isc (STC) **direkt** verglichen (KOSTAL/SMA/BayWa; Herstellermarge schon
   eingerechnet — EcoFlow Plus PV1: 19 A SC bei 16 A Eingang). Der Faktor 1,25
   (VDE 0100-712) gilt Kabeln/Sicherungen, nicht dem WR-Vergleich. Jolywood (16,0 A)
   an PO-Plus-PV1 (19 A/String) ist jetzt ZULÄSSIG. SPEC §7 + §5.1 + §6.1,
   kalibrierung.md, OFFENE_FRAGEN, Tests nachgezogen; `iscSafetyFactor` bleibt
   konfigurierbar. Im UI verifiziert (2 × Jolywood-Strings an PV1 → R1–R12 bestanden).
2. ✅ **PDF-Export** (`lib/pdf-export.ts`, jspdf) — Genrih: „JSON bringt dem Vertriebler
   nichts". PDF = Hauptexport: Seite 1 Zusammenfassung (kWp, Modul/WR, Flächen-Tabelle,
   Gesamtansicht), danach je Fläche eine Detailseite. DachSvg wird offscreen gerendert
   und per Canvas gerastert (Maße bleiben mm × Maßstab). PDF ist NICHT vom
   Stringplan-Gate blockiert (Belegung = Hauptprodukt); gültiger Stringplan = grüner
   Vermerk, ungültiger wird weggelassen. JSON bleibt als „Ticketsystem-Payload"-Karte.
   Verifiziert über debug-shot-Route (PDF abgefangen + Seiten geprüft, 3 Seiten ok).

3. ✅ **Repo öffentlich + Live-Deploy** — GitHub Pages via Actions-Workflow
   (`.github/workflows/pages.yml`): jeder Push auf main deployt
   https://suedenergie-pv.github.io/pv-belegung/ (statischer Export; CI entfernt
   die dev-only debug-shot-Route, lokal bleibt sie). App ist rein clientseitig.
4. ✅ **Polygon-Umriss je Fläche** (Genrihs Walmdach-Frage) — `umrissM` (beliebige
   Eckenzahl; Eckenzahl wird nie abgefragt, sie ergibt sich beim Klicken),
   Engine filtert Module, die nicht komplett im Polygon liegen; Randabstand gilt
   auch zum Grat (`geometrie.ts` + 10 Tests). UI: „Umriss zeichnen" in Draufsicht
   UND Foto-Ansicht (Rückrechnung über `inverseHomographie`, Round-Trip ±1 px
   verifiziert); Schließen per Klick auf ersten Punkt oder „Fertig".
   Rechteck Traufe×Sparren bleibt Rahmen/Koordinatensystem, Umriss ist optionales
   Verfeinern. Alt-Ansicht „nur Traufkante" hat KEINE Zeichnen-Klicks.
5. ✅ **Hindernis-Markierung** (verlorener Auftrag aus Session 2 nachgeholt) —
   „Hindernis markieren": 2 Klicks = Rechteck (`hindernisse` an der Fläche),
   Engine entfernt schneidende Module automatisch (Kantenberührung zählt nicht);
   Chips mit ✕ zum Löschen; Modus bleibt für mehrere Hindernisse aktiv.

**Preview-Falle:** Wenn `preview_eval`-Klicks ins Leere gehen: erst
`window.innerWidth` prüfen — der Preview-Tab kann 0×0 sein (Layout kollabiert,
getBoundingClientRect liefert 0). Fix: `preview_resize` auf 1280×900.

**Weitere offene Punkte:** PV*SOL-Gegenrechnung (Gate, Genrih), Hero-Artikelnummern
Aiko, OFFENE_FRAGEN #4 (R13+), Foto-Feinpositionierung, Stringplan-Schritt evtl.
dezenter („optionaler Check für kleine Anlagen", Genrih 06.07.).

## Session-Übergabe 05.07.2026 (2. Session — alle 4 Aufträge erledigt)

**Stand:** Engine R1–R12 + Belegungsraster + Kalibrier-Testrunner (`npm run kalibrierung`)
+ UI-Wizard `apps/web`, 55 Tests grün. Details: SPEC (v0.1 mit Updates 04./05.07.),
`OFFENE_FRAGEN.md`. Dev-Server: `npm run dev` (launch.json liegt bei).

**Alle 4 Aufträge von Genrih erledigt (05.07. nachmittags):**

1. ✅ **Aiko-Wattklassen korrigiert** — Katalog jetzt **A485-MCE54Db** (`aiko-a485-mce54db`)
   + **A480-MAH54Mw** (`aiko-a480-mah54mw`), Werte aus den PDF-Spalten A485/A480,
   überall nachgezogen (SPEC §5.1, kalibrierung.md, modules.ts, Tests, Runner,
   OFFENE_FRAGEN, Sanity-Zeile oben). Kalibrier-Output neu generiert.
2. ✅ **Randabstand einstellbar** — cm-Feld je Dachfläche im Belegungs-Schritt,
   `Flaeche.randM` → Engine-`berechneRaster`. **Default seit 05.07. abends 0,05 m**
   (Genrih: 0,30 m kostete Modulreihen; SPEC §9 angepasst). Merkregel: 3 Hochkant-
   Reihen Jolywood brauchen 5,43 m Sparrenlänge — bei 5,40 m Rand auf ≤ 3 cm stellen.
3. ✅ **Drohnenfoto als Belegungs-Hintergrund** — `FotoHintergrund.tsx`: Foto-Upload
   (bleibt lokal, wird auf 1600 px JPEG verkleinert), Kalibrierung durch Anklicken
   der **Traufkante** im Foto (Referenzstrecke = `breiteM` aus dem Aufmaß → Maßstab
   px/m + Rotation, kein extra Eingabefeld nötig). `DachSvg` komponiert die Module
   mit cos(Neigung)-Verkürzung in Sparrenrichtung über das Foto (Draufsicht-
   Projektion, reiner Kompositor). Maps-Screenshots bleiben verboten (§8.1).
   Hinweis: Foto muss ~senkrecht von oben sein (Nadir); Klickreihenfolge Traufe
   links→rechts, First oberhalb — sonst „Traufkante neu setzen".
   Getestet mit echtem Luftbild (Haus Darup, Wikimedia CC BY-SA — nicht im Repo).
   **Nachtrag (Genrih-Idee, 05.07. abends): „Ziegel zählen"-Notnagel** — Strecke
   über n Ziegelbreiten anklicken × Deckbreite (editierbar; Beton 30 cm quasi
   genormt, Ton 18–30 cm je Modell, Blech-Falz 53 cm) → `DachFoto.pxProM`.
   Nur QUER zur Falllinie zählen (Deckbreite ist nicht neigungsverzerrt).
   **Nachtrag 2 (05.07. spät): 4-Ecken-Homographie + Belegungs-Check** — Genrihs
   echtes Drohnenfoto war schräg aufgenommen (Dachfläche = Trapez), das alte
   Traufkanten-Parallelogramm passte sichtbar nicht. Jetzt: alle 4 Ecken
   anklicken (`DachFoto.eckenPx`; **Klick-Reihenfolge egal** — `sortiereEcken`
   ordnet zum Ring, unterste Kante = Traufe-Annahme, „↻ Traufe wechseln"
   rotiert die Zuordnung falls falsch; der Check erkennt Vertauschung sofort
   an der Traufbreite) →
   `lib/foto-geometrie.ts` rechnet die Homographie, `DachSvg` zeichnet jedes
   Modul als projiziertes Viereck (pures SVG, kein CSS-3D). Alte
   `traufePx`-Stände rendern weiter über den Affin-Zweig. Nach dem Markieren
   läuft automatisch der **Belegungs-Check** (deterministisch, kein LLM):
   Foto-Maße (via Ziegel-Maßstab) vs. eingegebene Maße (>10 %/15 % → Warnung),
   Ecken-Plausibilität, Perspektiv-Hinweis (First/Traufe-Verhältnis). „Maße aus
   Foto übernehmen"-Knopf schreibt den Vorschlag in die Fläche. WICHTIG fürs
   Verständnis: Die Homographie passt für JEDE eingegebene Größe — richtig
   dimensioniert sind die Module nur bei korrekten Maßen, genau dafür ist der
   Check da (Modulgrößen kommen weiter aus mm × Maßstab, SPEC §3.5).
4. ✅ **Wizard-State in localStorage** (`pv-belegung-wizard-v1`): speichert Projekt +
   Schritt bei jeder Änderung, lädt nach Reload; migriert veraltete Modul-/WR-ids
   (wichtig nach der Aiko-Umbenennung); bei vollem Speicher Fallback ohne Fotos;
   „Neu beginnen"-Knopf in der Schrittleiste.

**Offen / Ideen für nächste Session:** PV*SOL-Gegenrechnung (das Gate, Genrih),
Hero-Artikelnummern Aiko, OFFENE_FRAGEN #4 (R13+: stringsPerMppt / kW je MPPT /
Imp je String), evtl. Foto-Feinpositionierung (Verschieben/Nudgen nach Kalibrierung).

**Arbeitsweise (von Genrih so gewollt):** Das ist primär ein VERTRIEBstool —
Belegung/kWp/Optik zuerst, Stringplan ist „Spielerei" (optionaler Schritt), kein
Gate-Banner, nur dezenter Vorplanungs-Hinweis. Bei Widerspruch zwischen geliefertem
Material und SPEC: kurz nachfragen (hat sich bewährt — Aiko-PDF-Fall).
