import type { Ecken } from './foto-geometrie';
import {
  MODULES,
  INVERTERS,
  DEFAULT_RAND_M,
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

/**
 * Drohnenfoto als Belegungs-Hintergrund (eigenes Foto, lizenzrechtlich ok —
 * Google-Maps-Screenshots bleiben verboten, SPEC §8.1). Bleibt lokal im Browser.
 * Maßstab über Referenzstrecke: die Traufkante im Foto wird angeklickt, ihr
 * wahres Maß ist breiteM (Aufmaß aus Schritt Dachflächen) → px/m + Rotation.
 */
export interface DachFoto {
  /** Bild als Data-URL (beim Upload auf max. 1600 px verkleinert, JPEG) */
  dataUrl: string;
  breitePx: number;
  hoehePx: number;
  /**
   * Alle 4 Ecken der Dachfläche im Foto (Traufe links, Traufe rechts,
   * First rechts, First links) → perspektivisch exakte Platzierung per
   * Homographie (foto-geometrie.ts), auch bei schräg aufgenommenen Fotos.
   */
  eckenPx?: Ecken;
  /**
   * Alt-Variante (nur Traufkante, affine Platzierung) — wird weiter
   * gerendert, neue Markierungen erzeugen eckenPx.
   */
  traufePx: [number, number, number, number] | null;
  /**
   * Optionaler Maßstab aus Ziegelzählung (Notnagel, wenn die Traufkante nicht
   * frei sichtbar/bekannt ist): Strecke über n Ziegel × Deckbreite. Gesetzt
   * überschreibt er „Trauflänge = breiteM"; die Traufklicks liefern dann nur
   * noch Ankerpunkt + Richtung. Deckbreite ist quer zur Falllinie und damit
   * nicht neigungsverzerrt (Beton quasi genormt 30 cm; Ton je Modell 18–30 cm).
   */
  pxProM?: number;
}

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
  /** Randabstand zu Traufe/First/Ortgang, Meter (Default: Engine DEFAULT_RAND_M) */
  randM?: number;
  /** Drohnenfoto als Hintergrund (optional) */
  foto?: DachFoto;
  /** deaktivierte Module als "row-col" */
  inaktiv: string[];
}

export { DEFAULT_RAND_M };

export function randVon(f: Flaeche): number {
  return f.randM ?? DEFAULT_RAND_M;
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
    randM: randVon(f),
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

/**
 * Wizard-Stand in localStorage (Nice-to-have lt. Übergabe 05.07.2026):
 * geht sonst bei jedem Reload verloren. Kein Server-State — reines Browser-Feature.
 */
const STORAGE_KEY = 'pv-belegung-wizard-v1';

export function speichereStand(projekt: Projekt, schritt: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ projekt, schritt }));
  } catch {
    // Speicher voll (Fotos!) — Notnagel: Stand ohne Fotos sichern
    try {
      const ohneFotos: Projekt = {
        ...projekt,
        flaechen: projekt.flaechen.map(({ foto: _foto, ...rest }) => rest),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ projekt: ohneFotos, schritt }));
    } catch {
      // localStorage nicht verfügbar — Stand bleibt flüchtig
    }
  }
}

export function ladeStand(): { projekt: Projekt; schritt: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const roh = window.localStorage.getItem(STORAGE_KEY);
    if (!roh) return null;
    const stand = JSON.parse(roh) as { projekt?: Projekt; schritt?: number };
    if (!stand.projekt || !Array.isArray(stand.projekt.flaechen)) return null;
    const projekt: Projekt = { ...neuesProjekt(), ...stand.projekt };
    // Migration: gespeicherte Modul-/WR-ids können nach Katalog-Updates veraltet sein
    if (!MODULES.some((m) => m.id === projekt.modulId)) projekt.modulId = MODULES[0]!.id;
    if (projekt.wrId && !INVERTERS.some((w) => w.id === projekt.wrId)) {
      projekt.wrId = null;
      projekt.mppts = [];
    }
    return { projekt, schritt: stand.schritt ?? 0 };
  } catch {
    return null;
  }
}

export function loescheStand(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // egal — dann war auch nichts gespeichert
  }
}

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
