import {
  MODULES,
  INVERTERS,
  berechneRaster,
  checkStringPlan,
  type BelegungRaster,
  type InverterType,
  type ModuleType,
  type StringPlanInput,
  type StringPlanResult,
} from '@pv-belegung/engine';

/**
 * UI-Datenmodell. Enthält KEINE Formeln — Raster und Regelprüfung kommen
 * ausschließlich aus @pv-belegung/engine (CLAUDE.md / SPEC §3.4).
 */

export const DACHFARBEN = [
  { id: 'ziegelrot', name: 'Tonziegel rot', fill: '#a34a31', dunkel: '#7e3620', art: 'ziegel' },
  { id: 'anthrazit', name: 'Betonziegel anthrazit', fill: '#3d4249', dunkel: '#2b2f35', art: 'beton' },
  { id: 'schiefer', name: 'Engobiert schwarz', fill: '#26282c', dunkel: '#17181b', art: 'beton' },
  { id: 'grau', name: 'Blech (Stehfalz)', fill: '#8b9199', dunkel: '#6e747d', art: 'blech' },
] as const;
export type DachfarbeId = (typeof DACHFARBEN)[number]['id'];
export type Dachfarbe = (typeof DACHFARBEN)[number];

export interface Flaeche {
  id: string;
  name: string;
  /** Traufkante, Meter */
  breiteM: number;
  /** Sparrenlänge (wahres Maß, Aufmaß — SPEC §4.1), Meter */
  hoeheM: number;
  neigungDeg: number;
  azimutDeg: number;
  dachfarbe: DachfarbeId;
  ausrichtung: 'hoch' | 'quer';
  /** deaktivierte Module als "row-col" */
  inaktiv: string[];
}

export interface UiStringDef {
  id: string;
  flaecheId: string;
  anzahl: number;
}

export interface Projekt {
  adresse: string;
  kunde: string;
  modulId: string;
  flaechen: Flaeche[];
  wrId: string | null;
  /** Strings je MPPT (Index 0 = MPPT 1) */
  mppts: UiStringDef[][];
}

export const AZIMUT_PRESETS = [
  { label: 'Ost', deg: 90 },
  { label: 'Süd-Ost', deg: 135 },
  { label: 'Süd', deg: 180 },
  { label: 'Süd-West', deg: 225 },
  { label: 'West', deg: 270 },
  { label: 'Nord', deg: 0 },
] as const;

export function neueFlaeche(nr: number): Flaeche {
  return {
    id: `p${nr}`,
    name: `Dachfläche ${nr}`,
    breiteM: 10,
    hoeheM: 6,
    neigungDeg: 35,
    azimutDeg: 180,
    dachfarbe: 'anthrazit',
    ausrichtung: 'quer',
    inaktiv: [],
  };
}

export function neuesProjekt(): Projekt {
  return {
    adresse: '',
    kunde: '',
    modulId: MODULES[0]!.id,
    flaechen: [neueFlaeche(1)],
    wrId: null,
    mppts: [],
  };
}

export function modulById(id: string): ModuleType {
  const m = MODULES.find((x) => x.id === id);
  if (!m) throw new Error(`Unbekanntes Modul ${id}`);
  return m;
}

export function wrById(id: string): InverterType {
  const wr = INVERTERS.find((x) => x.id === id);
  if (!wr) throw new Error(`Unbekannter WR ${id}`);
  return wr;
}

export function rasterFuer(f: Flaeche, modul: ModuleType): BelegungRaster {
  return berechneRaster({
    breiteM: f.breiteM,
    hoeheM: f.hoeheM,
    module: modul,
    ausrichtung: f.ausrichtung,
  });
}

export function aktiveModule(f: Flaeche, raster: BelegungRaster): number {
  return raster.positionen.filter((p) => !f.inaktiv.includes(`${p.row}-${p.col}`)).length;
}

/** kWp = Σ aktive Module × Pmax (SPEC §9) */
export function kwpGesamt(p: Projekt): number {
  const modul = modulById(p.modulId);
  return (
    p.flaechen.reduce((sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)), 0) *
    (modul.pmaxW / 1000)
  );
}

export function baueEngineInput(p: Projekt): StringPlanInput | null {
  if (!p.wrId) return null;
  const mppts = p.mppts
    .map((strings, i) => ({
      mpptIndex: i + 1,
      strings: strings
        .filter((s) => s.anzahl > 0)
        .map((s) => ({
          id: s.id,
          modules: Array.from({ length: s.anzahl }, () => ({
            moduleTypeId: p.modulId,
            planeId: s.flaecheId,
          })),
        })),
    }))
    .filter((m) => m.strings.length > 0);
  if (mppts.length === 0) return null;
  return {
    inverter: wrById(p.wrId),
    moduleTypes: MODULES,
    planes: p.flaechen.map((f) => ({ id: f.id, azimuthDeg: f.azimutDeg, pitchDeg: f.neigungDeg })),
    mppts,
  };
}

export function pruefeStringplan(p: Projekt): StringPlanResult | null {
  const input = baueEngineInput(p);
  return input ? checkStringPlan(input) : null;
}

/** Nicht verstringte / überbuchte Module je Fläche (UI-Konsistenz, keine Normregel) */
export function zuordnungsHinweise(p: Projekt): { fehler: string[]; hinweise: string[] } {
  const modul = modulById(p.modulId);
  const fehler: string[] = [];
  const hinweise: string[] = [];
  for (const f of p.flaechen) {
    const aktiv = aktiveModule(f, rasterFuer(f, modul));
    const zugeordnet = p.mppts.flat().filter((s) => s.flaecheId === f.id)
      .reduce((sum, s) => sum + s.anzahl, 0);
    if (zugeordnet > aktiv) {
      fehler.push(`${f.name}: ${zugeordnet} Module verstringt, aber nur ${aktiv} belegt.`);
    } else if (zugeordnet < aktiv && zugeordnet > 0) {
      hinweise.push(`${f.name}: ${aktiv - zugeordnet} von ${aktiv} Modulen noch keinem String zugeordnet.`);
    }
  }
  return { fehler, hinweise };
}

export const fmtDe = (v: number, digits = 2): string =>
  v.toLocaleString('de-DE', { maximumFractionDigits: digits });

/** Export-Payload nach SPEC §13 */
export function bauePayload(p: Projekt, result: StringPlanResult | null): object {
  const modul = modulById(p.modulId);
  const stringFlaeche = new Map(p.mppts.flat().map((s) => [s.id, s.flaecheId]));
  return {
    tool: 'belegungsplaner',
    version: '1.0',
    projekt: { adresse: p.adresse, kunde: p.kunde, erfasser: '' },
    geometrieQuelle: 'manual',
    flaechen: p.flaechen.map((f) => {
      const raster = rasterFuer(f, modul);
      return {
        id: f.id,
        neigungDeg: f.neigungDeg,
        azimutDeg: f.azimutDeg,
        flaecheM2: Math.round(f.breiteM * f.hoeheM * 10) / 10,
        module: { typ: modul.id, anzahl: aktiveModule(f, raster), ausrichtung: f.ausrichtung },
      };
    }),
    wechselrichter: p.wrId ? { typ: p.wrId, anzahl: 1 } : null,
    strings: result
      ? result.strings.map((s) => ({
          mppt: s.mpptIndex,
          flaeche: stringFlaeche.get(s.id) ?? '',
          module: s.moduleCount,
          vocColdV: Math.round(s.vocColdV * 10) / 10,
          vmpHotV: Math.round(s.vmpHotV * 10) / 10,
        }))
      : [],
    kwp: Math.round(kwpGesamt(p) * 100) / 100,
    regelPruefung: result ? { bestanden: result.valid, regeln: result.regeln } : null,
    flags: [],
    eskaliert: false,
    renderPngUrl: '',
    hinweis:
      'Vorplanung Vertrieb — keine Fachplanung. Finale Auslegung durch Projektleitung (PV*SOL).',
  };
}
