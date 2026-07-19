import type { Ecken } from './foto-geometrie';
import {
  MODULES,
  INVERTERS,
  DEFAULT_RAND_M,
  berechneFelderRaster,
  checkStringPlan,
  leerePositionen,
  schraegGeometrie,
  trapezUmriss,
  vollFeld,
  type BelegungRaster,
  type BelegungsFeldM,
  type FelderInput,
  type InverterType,
  type ModuleType,
  type PunktM,
  type RechteckM,
  type SchraegGeometrie,
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
  // Flachdach (16.07.2026)
  { id: 'bitumen', name: 'Bitumenbahn', fill: '#4a4d52', dunkel: '#3a3d41', art: 'flach' },
  { id: 'kies', name: 'Kiesdach', fill: '#9aa0a6', dunkel: '#7d8288', art: 'flach' },
  // Fassade (16.07.2026)
  { id: 'putz', name: 'Putz hell', fill: '#d8d5cd', dunkel: '#bdb9af', art: 'wand' },
  { id: 'klinker', name: 'Klinker', fill: '#8a4a38', dunkel: '#6e3a2b', art: 'wand' },
] as const;
export type DachfarbeId = (typeof DACHFARBEN)[number]['id'];
export type Dachfarbe = (typeof DACHFARBEN)[number];

/** Art der Fläche (16.07.2026): Schrägdach (Default), Flachdach, Fassade. */
export type FlaechenArt = 'dach' | 'flachdach' | 'fassade';
export type FlachdachSuedRichtung = 'unten' | 'links' | 'oben' | 'rechts';

/** Gauben sind eigene Ebenen, aber KEINE aufgeständerten Flachdächer. */
export type GaubenTyp = 'flachdach' | 'satteldach';
export type GaubenSeite = 'links' | 'rechts';
export type GaubenMassQuelle = 'aufmass' | 'ziegel' | 'nachbardach';
export type GaubenMassQualitaet = 'bestaetigt' | 'gemessen' | 'geschaetzt';

/** Herkunft der Maße einer logisch zusammengehörigen Gaube. */
export interface GaubenMessung {
  quelle: GaubenMassQuelle;
  qualitaet: GaubenMassQualitaet;
  /** Optionale Zählwerte für nachvollziehbare spätere Korrekturen. */
  ziegelQuer?: number;
  deckbreiteCm?: number;
  ziegelReihen?: number;
  reihenabstandCm?: number;
}

/** Automatisch mit einer Gaubengruppe verknüpfte Aussparung auf dem Hauptdach. */
export interface GaubenAussparung {
  gaubenGruppeId: string;
  rechteck: RechteckM;
  /**
   * Sichtbarer Außenumriss im gemeinsamen Foto. Damit kann die gekoppelte
   * Aussparung neu berechnet werden, wenn die Perspektive des Mutterdachs
   * korrigiert wird. Fehlt bei Altprojekten und nach einem Fotoaustausch.
   */
  fotoEckenPx?: Ecken;
}

/** Zur Flächen-Art passende Eindeckungen/Oberflächen. */
export function farbenFuer(art: FlaechenArt): Dachfarbe[] {
  const arten: Record<FlaechenArt, string[]> = {
    dach: ['ziegel', 'beton', 'blech'],
    flachdach: ['flach'],
    fassade: ['wand'],
  };
  return DACHFARBEN.filter((d) => arten[art].includes(d.art));
}

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

/**
 * Projektweites Gesamt-Drohnenfoto (ein Bild vom ganzen Dach) für die
 * Gesamtansicht: jede Fläche wird über ihre eigenen Anker-Ecken (Flaeche.gesamtEckenPx)
 * perspektivisch daraufgelegt. Bleibt lokal im Browser (SPEC §8.1).
 */
export interface GesamtFoto {
  dataUrl: string;
  breitePx: number;
  hoehePx: number;
}

/**
 * Ein projektweites Drohnenfoto. Mehrere Flächen dürfen demselben Foto
 * zugeordnet sein; das Bild selbst wird dadurch nur EINMAL im localStorage
 * gespeichert. Die flächenspezifische Perspektive liegt in FotoZuordnung.
 */
export interface ProjektFoto extends GesamtFoto {
  id: string;
  name: string;
}

/** Lage genau einer Fläche auf ihrem primären Belegungsfoto. */
export interface FotoZuordnung {
  fotoId: string;
  eckenPx?: Ecken;
  /** Alt-/Zwischenmodus: nur Traufkante gesetzt, noch keine 4-Ecken-Homographie. */
  traufePx: [number, number, number, number] | null;
  /** Optionaler Maßstab aus der Ziegelzählung, flächenspezifisch. */
  pxProM?: number;
}

/**
 * Parametrische Dachform (SPEC §9). 'trapez' = symmetrisches Walm/Krüppelwalm;
 * 'schief' = Parallelogramm / schiefes Trapez (First seitlich versetzt, Genrih 08.07.).
 */
export type Dachform = 'rechteck' | 'trapez' | 'schief';

export interface Flaeche {
  id: string;
  name: string;
  /**
   * Art der Fläche (Default 'dach'). 'flachdach' belegt mit Aufständerung
   * (siehe flachdach-Block); 'fassade' ist eine senkrechte Ebene (Neigung 90°) —
   * geometrisch identisch zum Schrägdach, Foto frontal statt von oben.
   */
  art?: FlaechenArt;
  /**
   * Gaubenfläche mit eigener Perspektive/Neigung. Eine Flachdachgaube wird trotz
   * geringer Neigung als normale Dachfläche gerechnet: dachparallel auf Stehfalz,
   * niemals mit der PROFINESS-Aufständerung aus `art: 'flachdach'`.
   */
  gaubenTyp?: GaubenTyp;
  /** Zugehöriges Hauptdach; rein semantisch, kein 3D-Solver. */
  elternFlaecheId?: string;
  /** Bei einer Satteldachgaube werden zwei eigenständige Ebenen angelegt. */
  gaubenSeite?: GaubenSeite;
  gaubenGruppeId?: string;
  /** Messweg/Verlässlichkeit; bei Satteldachgauben auf beiden Kindflächen identisch. */
  gaubenMessung?: GaubenMessung;
  /**
   * Flachdach-Aufständerung (nur bei art 'flachdach'). Defaults = System
   * PROFINESS Flat (Montageanleitung 05/2025 in docs/datenblaetter/):
   * Ost-West 10° mit Paar-Pitch 2,48 m; Süd 10°/15° mit Reihen-Pitch 1,80/1,90 m.
   * pitchM ist editierbar (anderes Gestell/anderer Reihenabstand).
   * richtungSued legt die Kompasslage in Plan und Foto fest. Fehlt sie in einem
   * Altprojekt, gilt die frühere Konvention „Süden unten“.
   */
  flachdach?: {
    aufstaenderung: 'sued' | 'ostwest';
    winkelDeg: number;
    pitchM?: number;
    /** Lage von Süden in Draufsicht/Foto; daraus folgen Ost und West eindeutig. */
    richtungSued?: FlachdachSuedRichtung;
  };
  /** Traufkante, Meter (Flachdach: waagerechte Planausdehnung; Fassade: Wandbreite) */
  breiteM: number;
  /** Sparrenlänge (wahres Maß, Aufmaß — SPEC §4.1), Meter (Flachdach: senkrechte Planausdehnung; Fassade: Wandhöhe) */
  hoeheM: number;
  neigungDeg: number;
  azimutDeg: number;
  dachfarbe: DachfarbeId;
  ausrichtung: 'hoch' | 'quer';
  /** Randabstand zu Traufe/First/Ortgang, Meter (Default: Engine DEFAULT_RAND_M) */
  randM?: number;
  /** Parametrische Dachform (Default 'rechteck'); 'trapez' nutzt firstBreiteM. */
  dachform?: Dachform;
  /** Firstbreite oben, Meter — bei 'trapez' (0 = Walmspitze) und 'schief' (Default = Traufe). */
  firstBreiteM?: number;
  /**
   * Seitlicher Versatz der First-Mitte gegen die Traufe-Mitte, Meter (+ = nach
   * rechts) — nur bei dachform 'schief'. 0 + firstBreiteM < Traufe = symmetrisches
   * Trapez; firstBreiteM = Traufe = Parallelogramm.
  */
  firstVersatzM?: number;
  /** Grunddaten im kombinierten Dach-/Belegungsschritt einmal bestätigt. */
  grunddatenFertig?: boolean;
  /** Drohnenfoto als Hintergrund (optional) */
  foto?: DachFoto;
  /**
   * Primäres Belegungsfoto im neuen Mehrfoto-Modell. Das Bild liegt einmalig in
   * Projekt.fotos; hier stehen nur Zuordnung, Perspektive und Maßstab.
   */
  fotoZuordnung?: FotoZuordnung;
  /**
   * Lage dieser Fläche auf dem projektweiten Gesamtfoto (4 Anker-Ecken in
   * Foto-Pixeln, gleiche Konvention wie foto.eckenPx: Traufe links/rechts, First
   * rechts/links). Nur für die Gesamtansicht — unabhängig vom Einzelflächen-Foto.
   */
  gesamtEckenPx?: Ecken;
  /**
   * Foto-Markierung abgeschlossen → Belegung anzeigen. Solange false (und ein Foto
   * mit Umriss existiert), bleibt das LEERE Foto sichtbar, um Hindernisse VOR der
   * Belegung zu markieren (Genrih 07.07.: bei belegtem Dach sieht man sie nicht).
   */
  markierungFertig?: boolean;
  /**
   * Manuell gezeichneter Flächen-Umriss (beliebige Eckenzahl, Flächen-Koordinaten
   * in Meter). Hat Vorrang vor dachform; ohne beides gilt das Rechteck (SPEC §9).
   */
  umrissM?: PunktM[];
  /** Hindernisse (Kamin, Fenster, SAT): schneidende Module entfallen automatisch. */
  hindernisse?: RechteckM[];
  /** Vom Parent-Gaubenflow verwaltete Aussparungen; nicht als manuelle Hindernisse editieren. */
  gaubenAussparungen?: GaubenAussparung[];
  /**
   * Belegungsfelder (16.07.2026): die vom Nutzer gezogenen Rechtecke, die sich mit
   * Modulen füllen — die EINZIGE Quelle der Belegung. Fehlt/leer = unbelegte Fläche.
   * Ersetzt den kompletten Automatismus (Auto-Vollbelegung, Optimierer, Versatz,
   * Bänder, Zusatzmodule, gelöschte Fußabdrücke), der mehrere Bug-Wellen
   * verursachte (Genrih: „komplett verbuggt" / „Automatismus mildern").
   */
  felder?: BelegungsFeldM[];
  /**
   * VERALTET (13.07.2026): einzeln deaktivierte Module. Kein Werkzeug setzt das
   * noch — gelöscht wird jetzt zellweise im Feld (BelegungsFeldM.leer). Bleibt
   * im Modell, weil `aktiveModule` weiterhin dagegen filtert; ist immer leer.
   */
  inaktiv: string[];
  /**
   * Fester Zonen-Buchstabe (A/B/C …), einmal beim Anlegen vergeben. Bleibt stabil,
   * wenn andere Flächen gelöscht werden — vorher rutschte B zu A und stimmte nicht
   * mehr mit ausgedruckten PDFs überein (Review 08.07.).
   */
  zone?: string;
}

/** Anzeige-Buchstabe einer Fläche: fest vergebene zone, sonst Fallback aus dem Index. */
export function zonenVon(f: Flaeche, index: number): string {
  return f.zone ?? zonenLabel(index);
}

/** Kompakte, eindeutige Bezeichnung für UI und PDF. */
export function flaechenTitel(f: Flaeche, index: number): string {
  const zone = zonenVon(f, index);
  if (f.gaubenTyp === 'flachdach') return `${zone} · Flachdachgaube`;
  if (f.gaubenTyp === 'satteldach') {
    const seite = f.gaubenSeite ? ` ${f.gaubenSeite}` : '';
    return `${zone} · Satteldachgaube${seite}`;
  }
  return `${zone} · ${f.name}`;
}

/** Nächster freier Zonen-Buchstabe beim Anlegen einer neuen Fläche. */
export function naechsteZone(flaechen: Flaeche[]): string {
  const belegt = new Set(flaechen.map((f, i) => zonenVon(f, i)));
  for (let i = 0; i < 26; i++) {
    if (!belegt.has(zonenLabel(i))) return zonenLabel(i);
  }
  return zonenLabel(flaechen.length);
}

/**
 * Effektiver Umriss einer Fläche (SPEC §9): manuell gezeichneter Umriss gewinnt,
 * sonst erzeugt 'trapez' das Polygon aus Traufe/Sparren/Firstbreite, sonst
 * (Rechteck) kein Umriss → volles Raster. So hat die digitale Fläche von Anfang
 * an die richtige Form, auch ohne Foto.
 */
/** Rohe Schräg-Geometrie einer 'schief'-Fläche (Rahmen, Umriss, Perspektiv-Ecken). */
function schraegGeoVon(f: Flaeche): SchraegGeometrie {
  return schraegGeometrie(f.breiteM, f.hoeheM, f.firstBreiteM ?? f.breiteM, f.firstVersatzM ?? 0);
}

/**
 * RAHMENBREITE (Meter): die horizontale Ausdehnung der Fläche, die als breiteM in
 * die Engine/Homographie geht. Bei 'schief' ist der Rahmen breiter als die Traufe
 * (First seitlich versetzt) — sonst passt „nichts drauf" (Genrih 08.07.). Sonst = Traufe.
 */
export function rahmenBreiteVon(f: Flaeche): number {
  return f.dachform === 'schief' ? schraegGeoVon(f).rahmenBreiteM : f.breiteM;
}

/**
 * Quell-Ecken für die Foto-Homographie (08.07.2026): Der Nutzer klickt die 4 ECHTEN
 * Dach-Ecken; die Homographie muss die passende Quellform (Trapez bzw. Parallelogramm/
 * schiefes Trapez) in Rahmen-Koordinaten liefern, sonst wird ein Rechteck in die Form
 * gestreckt und alles verzerrt. Reihenfolge Traufe l/r, First r/l — wie die geklickten
 * Ecken. Rechteck oder manuell gezeichneter Umriss → undefined (Rechteck-Perspektive).
 */
export function perspektiveQuelle(f: Flaeche): Ecken | undefined {
  if (f.umrissM && f.umrissM.length >= 3) return undefined;
  if (f.dachform === 'schief') {
    const e = schraegGeoVon(f).ecken;
    return [
      [e[0][0], e[0][1]],
      [e[1][0], e[1][1]],
      [e[2][0], e[2][1]],
      [e[3][0], e[3][1]],
    ];
  }
  if (f.dachform === 'trapez') {
    const B = f.breiteM;
    const H = f.hoeheM;
    const fb = Math.max(f.firstBreiteM ?? B * 0.6, B * 0.05);
    const inset = (B - fb) / 2;
    return [[0, H], [B, H], [B - inset, 0], [inset, 0]];
  }
  return undefined;
}

export function umrissVon(f: Flaeche): PunktM[] | undefined {
  if (f.umrissM && f.umrissM.length >= 3) return f.umrissM;
  if (f.dachform === 'schief') return schraegGeoVon(f).umriss;
  if (f.dachform === 'trapez') {
    return trapezUmriss(f.breiteM, f.hoeheM, f.firstBreiteM ?? f.breiteM * 0.6);
  }
  return undefined;
}

export type { PunktM, RechteckM };

export { DEFAULT_RAND_M };

export function artVon(f: Flaeche): FlaechenArt {
  return f.art ?? 'dach';
}

/**
 * Gestell-Pitch-Default nach PROFINESS Flat (Montageanleitung 05/2025 im Repo):
 * Ost-West 10° → 2,48 m (Paar); Süd 10° → 1,80 m, Süd 15° → 1,90 m (Reihe).
 */
export function flachdachPitchDefault(aufstaenderung: 'sued' | 'ostwest', winkelDeg: number): number {
  if (aufstaenderung === 'ostwest') return 2.48;
  return winkelDeg >= 15 ? 1.9 : 1.8;
}

/** Altprojekte behalten ihre bisherige Konvention: Süden liegt unten. */
export function flachdachSuedRichtung(f: Flaeche): FlachdachSuedRichtung {
  return f.flachdach?.richtungSued ?? 'unten';
}

/** Richtung von Osten in der Draufsicht, abgeleitet aus der gewählten Südrichtung. */
export function flachdachOstRichtung(f: Flaeche): FlachdachSuedRichtung {
  const ostVonSued: Record<FlachdachSuedRichtung, FlachdachSuedRichtung> = {
    unten: 'rechts',
    rechts: 'oben',
    oben: 'links',
    links: 'unten',
  };
  return ostVonSued[flachdachSuedRichtung(f)];
}

export function flachdachRichtungsLabel(f: Flaeche): string {
  const sued = flachdachSuedRichtung(f);
  if (f.flachdach?.aufstaenderung === 'ostwest') {
    const ost = flachdachOstRichtung(f);
    const west: FlachdachSuedRichtung =
      ost === 'unten' ? 'oben' : ost === 'oben' ? 'unten' : ost === 'links' ? 'rechts' : 'links';
    return `Ost ${ost} / West ${west}`;
  }
  return `Süd ${sued}`;
}

export function flaechenAusrichtungsLabel(f: Flaeche): string {
  return artVon(f) === 'flachdach' && f.flachdach
    ? flachdachRichtungsLabel(f)
    : `Azimut ${f.azimutDeg}°`;
}

/**
 * Randabstand-Default je Flächen-Art: Schrägdach/Fassade 5 cm; Flachdach nach
 * PROFINESS-Empfehlung (Windlast): O/W und Süd 10° → 0,60 m, Süd 15° → 0,80 m.
 */
export function randDefaultVon(f: Flaeche): number {
  if (artVon(f) === 'flachdach') {
    const fd = f.flachdach;
    return fd?.aufstaenderung === 'sued' && fd.winkelDeg >= 15 ? 0.8 : 0.6;
  }
  return DEFAULT_RAND_M;
}

export function randVon(f: Flaeche): number {
  return f.randM ?? randDefaultVon(f);
}

export interface UiStringDef {
  id: string;
  flaecheId: string;
  anzahl: number;
}

export interface Projekt {
  adresse: string;
  kunde: string;
  /** Vertriebler/Erfasser (Name), erscheint im PDF-Kopf (SPEC §13) */
  erfasser?: string;
  modulId: string;
  flaechen: Flaeche[];
  wrId: string | null;
  /** Strings je MPPT (Index 0 = MPPT 1) */
  mppts: UiStringDef[][];
  /** Projektweite Belegungsfotos; jedes kann beliebig viele Flächen enthalten. */
  fotos: ProjektFoto[];
  /** Migrationsmarker für das Mehrfoto-Modell (17.07.2026). */
  fotoModellVersion?: 2;
  /** Projektweites Gesamt-Drohnenfoto für die Gesamtansicht (optional). */
  gesamtFoto?: GesamtFoto;
}

/** Kurzes Zonen-Kürzel A/B/C/… für die Gesamtansicht (0-basiert). */
export function zonenLabel(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

export const AZIMUT_PRESETS = [
  { label: 'Ost', deg: 90 },
  { label: 'Süd-Ost', deg: 135 },
  { label: 'Süd', deg: 180 },
  { label: 'Süd-West', deg: 225 },
  { label: 'West', deg: 270 },
  { label: 'Nord', deg: 0 },
] as const;

export function neueFlaeche(nr: number, zone?: string): Flaeche {
  return {
    id: `p${nr}`,
    zone,
    name: `Dachfläche ${nr}`,
    breiteM: 10,
    hoeheM: 6,
    neigungDeg: 35,
    azimutDeg: 180,
    dachfarbe: 'anthrazit',
    ausrichtung: 'quer',
    grunddatenFertig: false,
    // Neue Flächen starten UNBELEGT — der Nutzer zieht seine Felder selbst
    // (oder klickt „Automatisch füllen"). Genrih 16.07.: Automatismus mildern.
    felder: [],
    inaktiv: [],
  };
}

export function neuesProjekt(): Projekt {
  return {
    adresse: '',
    kunde: '',
    modulId: MODULES[0]!.id,
    flaechen: [neueFlaeche(1, 'A')],
    wrId: null,
    mppts: [],
    fotos: [],
    fotoModellVersion: 2,
  };
}

/**
 * Neue Gaubenebene. Flachdachgauben starten als 5°-Stehfalzfläche mit
 * dachparalleler Belegung; Satteldachgauben als normale geneigte Dachebene.
 */
export function neueGaubenFlaeche(
  nr: number,
  zone: string,
  typ: GaubenTyp,
  elternFlaecheId?: string,
  seite?: GaubenSeite,
  gruppeId?: string,
): Flaeche {
  const flach = typ === 'flachdach';
  return {
    ...neueFlaeche(nr, zone),
    name: flach ? 'Flachdachgaube' : `Satteldachgaube${seite ? ` ${seite}` : ''}`,
    art: 'dach',
    gaubenTyp: typ,
    elternFlaecheId,
    gaubenSeite: seite,
    gaubenGruppeId: gruppeId,
    breiteM: 3,
    hoeheM: 2.5,
    neigungDeg: flach ? 5 : 30,
    dachfarbe: flach ? 'grau' : 'anthrazit',
    dachform: 'rechteck',
    grunddatenFertig: true,
    randM: DEFAULT_RAND_M,
  };
}

/** Stabile neue Foto-ID für Uploads im Belegungstab. */
export function neueFotoId(): string {
  return `foto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Das zu einer Fläche gehörende Projektfoto, falls die Zuordnung gültig ist. */
export function projektFotoVon(p: Projekt, f: Flaeche): ProjektFoto | undefined {
  return f.fotoZuordnung
    ? p.fotos.find((foto) => foto.id === f.fotoZuordnung!.fotoId)
    : undefined;
}

/**
 * Kompatibilitätsansicht für FotoHintergrund/DachSvg: Bild-Asset und
 * flächenspezifische Zuordnung werden transient zu einem DachFoto zusammengesetzt.
 */
export function dachFotoVon(p: Projekt, f: Flaeche): DachFoto | undefined {
  const asset = projektFotoVon(p, f);
  const z = f.fotoZuordnung;
  if (!asset || !z) return undefined;
  return {
    dataUrl: asset.dataUrl,
    breitePx: asset.breitePx,
    hoehePx: asset.hoehePx,
    traufePx: z.traufePx,
    ...(z.eckenPx ? { eckenPx: z.eckenPx } : {}),
    ...(z.pxProM !== undefined ? { pxProM: z.pxProM } : {}),
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

/** Rahmenbedingungen der Fläche für die Feld-Belegung (Engine-Input). */
export function felderInput(f: Flaeche, modul: ModuleType): FelderInput {
  const basis: FelderInput = {
    // Rahmenbreite (Traufe + Firstversatz bei 'schief'), NICHT die reine Traufe.
    breiteM: rahmenBreiteVon(f),
    hoeheM: f.hoeheM,
    module: modul,
    randM: randVon(f),
    umrissM: umrissVon(f),
    hindernisseM: hindernisseVon(f),
  };
  if (artVon(f) === 'flachdach' && f.flachdach) {
    basis.montage = {
      aufstaenderung: f.flachdach.aufstaenderung,
      winkelDeg: f.flachdach.winkelDeg,
      richtungSued: flachdachSuedRichtung(f),
      pitchM:
        f.flachdach.pitchM ??
        flachdachPitchDefault(f.flachdach.aufstaenderung, f.flachdach.winkelDeg),
    };
  }
  return basis;
}

/** Modulmaße (Meter) in der gewünschten Ausrichtung. */
export function modulMasse(modul: ModuleType, quer: boolean): { w: number; h: number } {
  return {
    w: (quer ? modul.lengthMm : modul.widthMm) / 1000,
    h: (quer ? modul.widthMm : modul.lengthMm) / 1000,
  };
}

/**
 * Belegung einer Fläche = ihre Felder, gefüllt durch die Engine. Keine
 * Nachbearbeitung in der UI (SPEC §3.4): was der Nutzer gezogen hat, ist die
 * Wahrheit — kein Optimierer, kein Versatz, keine Zusatzmodule.
 */
export function rasterFuer(f: Flaeche, modul: ModuleType): BelegungRaster {
  return berechneFelderRaster(felderInput(f, modul), f.felder ?? []);
}

/** Zentriertes Voll-Feld über der Nutzfläche („Automatisch füllen"). */
export function vollFeldFuer(f: Flaeche, modul: ModuleType): BelegungsFeldM {
  return vollFeld({ ...felderInput(f, modul), ausrichtung: f.ausrichtung });
}

/**
 * Maß-/Formänderung bei feststehenden Fotoecken: metrische Inhalte proportional
 * mitführen, damit Felder und Markierungen im Foto an derselben Stelle bleiben.
 */
export function patchFlaechenGeometrie(f: Flaeche, patch: Partial<Flaeche>): Flaeche {
  const altBreite = rahmenBreiteVon(f);
  const altHoehe = f.hoeheM;
  const neu = { ...f, ...patch, inaktiv: [] };
  const neuBreite = rahmenBreiteVon(neu);
  const neuHoehe = neu.hoeheM;
  const sx = altBreite > 0 && neuBreite > 0 ? neuBreite / altBreite : 1;
  const sy = altHoehe > 0 && neuHoehe > 0 ? neuHoehe / altHoehe : 1;
  if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return neu;

  const rechteck = (r: RechteckM): RechteckM => ({
    xM: r.xM * sx,
    yM: r.yM * sy,
    breiteM: r.breiteM * sx,
    hoeheM: r.hoeheM * sy,
  });
  return {
    ...neu,
    // Zell-Ausnahmen gehören zum alten Raster und werden bei Maßänderungen verworfen.
    felder: neu.felder?.map((feld) => ({ ...rechteck(feld), quer: feld.quer })),
    umrissM: neu.umrissM?.map((p) => [p[0] * sx, p[1] * sy]),
    hindernisse: neu.hindernisse?.map(rechteck),
    gaubenAussparungen: neu.gaubenAussparungen?.map((a) => ({
      ...a,
      rechteck: rechteck(a.rechteck),
    })),
  };
}

/** Abgeschaltete Modul-Plätze (nur zum Anzeigen im „Module an/aus"-Modus). */
export function leerePositionenFuer(f: Flaeche, modul: ModuleType) {
  return leerePositionen(felderInput(f, modul), f.felder ?? []);
}

export function aktiveModule(f: Flaeche, raster: BelegungRaster): number {
  return raster.positionen.filter((p) => !f.inaktiv.includes(`${p.row}-${p.col}`)).length;
}

/** Manuelle Hindernisse plus automatisch gekoppelte Gaubenfüße für die Engine. */
export function hindernisseVon(f: Flaeche): RechteckM[] | undefined {
  const alle = [
    ...(f.hindernisse ?? []),
    ...(f.gaubenAussparungen ?? []).map((a) => a.rechteck),
  ];
  return alle.length > 0 ? alle : undefined;
}

/** Fertig markierte Flächen eines Projektfotos, inklusive stabilem Projektindex. */
export function fertigeFotoFlaechen(
  p: Projekt,
  fotoId: string,
): Array<{ f: Flaeche; i: number }> {
  return p.flaechen
    .map((f, i) => ({ f, i }))
    .filter(
      ({ f }) =>
        f.fotoZuordnung?.fotoId === fotoId &&
        !!f.fotoZuordnung.eckenPx &&
        !!f.markierungFertig,
    );
}

/** Tatsächliche Ausrichtungsverteilung der aktiven Module einer Fläche. */
export function ausrichtungenVon(
  f: Flaeche,
  raster: BelegungRaster,
): { hochkant: number; quer: number; bezeichnung: 'hoch' | 'quer' | 'gemischt' } {
  const positionen = raster.positionen.filter(
    (p) => !f.inaktiv.includes(`${p.row}-${p.col}`),
  );
  if (positionen.length === 0) {
    return {
      hochkant: 0,
      quer: 0,
      bezeichnung: f.ausrichtung === 'quer' ? 'quer' : 'hoch',
    };
  }
  if (artVon(f) === 'flachdach') {
    return { hochkant: 0, quer: positionen.length, bezeichnung: 'quer' };
  }
  const quer = positionen.filter((p) => p.quer).length;
  const hochkant = positionen.length - quer;
  return {
    hochkant,
    quer,
    bezeichnung: hochkant > 0 && quer > 0 ? 'gemischt' : quer > 0 ? 'quer' : 'hoch',
  };
}

/** Wahre Fläche des wirksamen Dachpolygons in m² (Rechteck als Fallback). */
export function flaecheM2(f: Flaeche): number {
  const polygon = umrissVon(f);
  if (!polygon || polygon.length < 3) return f.breiteM * f.hoeheM;
  let doppelteFlaeche = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    doppelteFlaeche += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(doppelteFlaeche) / 2;
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
 * Projektverwaltung in localStorage (mehrere Projekte, 06.07.2026): Ein
 * Vertriebler hat mehrere Termine — jedes Projekt bleibt erhalten. Kein
 * Server-State, reines Browser-Feature. Migration vom Alt-Key (Einzelprojekt,
 * `pv-belegung-wizard-v1`) beim ersten Laden, damit nichts verloren geht.
 */
const STORAGE_KEY = 'pv-belegung-wizard-v1'; // alt, nur noch für Migration
const PROJEKTE_KEY = 'pv-belegung-projekte-v1';

export interface ProjektEintrag {
  id: string;
  projekt: Projekt;
  schritt: number;
  erstelltAm: number;
  geaendertAm: number;
}

export interface ProjektDb {
  aktivId: string | null;
  projekte: ProjektEintrag[];
  /** 2 = zusammengeführter Drei-Schritt-Ablauf seit 19.07.2026. */
  workflowVersion?: 2;
}

const WORKFLOW_VERSION = 2 as const;

/** Alte Schritte 0/1/2/3 auf Projekt / Dach & Belegung / Export abbilden. */
function migriereWorkflowSchritt(schritt: number): number {
  if (schritt <= 0) return 0;
  if (schritt >= 3) return 2;
  return 1;
}

export function neueProjektId(): string {
  return `prj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Anzeigename eines Eintrags (Kunde > Adresse > Fallback). */
export function eintragName(e: ProjektEintrag): string {
  return e.projekt.kunde.trim() || e.projekt.adresse.trim() || 'Unbenanntes Projekt';
}

/** kurzes Datum dd.mm.jj für die Projektliste */
export function eintragDatum(e: ProjektEintrag): string {
  return new Date(e.geaendertAm).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Einmalige Migration der bisherigen zwei Foto-Wege:
 * - Flaeche.foto (ein Bild je Fläche)
 * - Projekt.gesamtFoto + Flaeche.gesamtEckenPx (ein gemeinsames Bild)
 *
 * Einzelbilder gewinnen für ihre Fläche; das alte Gesamtfoto bleibt zusätzlich als
 * Foto-Gruppe erhalten und kann im Belegungstab neu zugeordnet werden. Danach liegen
 * Bilddaten ausschließlich in Projekt.fotos und werden nicht mehr je Fläche dupliziert.
 */
function migriereFotoModell(roh: Projekt, projekt: Projekt): void {
  const bereitsNeu = roh.fotoModellVersion === 2 && Array.isArray(roh.fotos);
  if (bereitsNeu) {
    projekt.fotos = roh.fotos.filter(
      (f): f is ProjektFoto =>
        !!f &&
        typeof f.id === 'string' &&
        typeof f.dataUrl === 'string' &&
        Number.isFinite(f.breitePx) &&
        Number.isFinite(f.hoehePx),
    );
    const fotoIds = new Set(projekt.fotos.map((f) => f.id));
    projekt.flaechen = projekt.flaechen.map((f) => {
      const rest = { ...f };
      delete rest.foto;
      delete rest.gesamtEckenPx;
      if (rest.fotoZuordnung && !fotoIds.has(rest.fotoZuordnung.fotoId)) {
        delete rest.fotoZuordnung;
      }
      return rest;
    });
    delete projekt.gesamtFoto;
    projekt.fotoModellVersion = 2;
    return;
  }

  const fotos: ProjektFoto[] = [];
  const reserviert = new Set<string>();
  const eindeutigeId = (basis: string) => {
    let id = basis;
    let nr = 2;
    while (reserviert.has(id)) id = `${basis}-${nr++}`;
    reserviert.add(id);
    return id;
  };

  let gesamtId: string | null = null;
  if (roh.gesamtFoto) {
    gesamtId = eindeutigeId('foto-gesamt');
    fotos.push({
      id: gesamtId,
      name: 'Drohnenfoto 1',
      dataUrl: roh.gesamtFoto.dataUrl,
      breitePx: roh.gesamtFoto.breitePx,
      hoehePx: roh.gesamtFoto.hoehePx,
    });
  }

  projekt.flaechen = projekt.flaechen.map((f) => {
    let zuordnung: FotoZuordnung | undefined;
    if (f.foto) {
      const id = eindeutigeId(`foto-${f.id}`);
      fotos.push({
        id,
        name: f.name || `Dachfläche ${f.id}`,
        dataUrl: f.foto.dataUrl,
        breitePx: f.foto.breitePx,
        hoehePx: f.foto.hoehePx,
      });
      zuordnung = { fotoId: id, traufePx: f.foto.traufePx };
      if (f.foto.eckenPx) zuordnung.eckenPx = f.foto.eckenPx;
      if (f.foto.pxProM !== undefined) zuordnung.pxProM = f.foto.pxProM;
    } else if (gesamtId && f.gesamtEckenPx) {
      zuordnung = { fotoId: gesamtId, eckenPx: f.gesamtEckenPx, traufePx: null };
    }

    const rest = { ...f };
    delete rest.foto;
    delete rest.gesamtEckenPx;
    if (zuordnung) rest.fotoZuordnung = zuordnung;
    if (zuordnung?.eckenPx && rest.markierungFertig === undefined) {
      rest.markierungFertig = true;
    }
    return rest;
  });

  projekt.fotos = fotos;
  projekt.fotoModellVersion = 2;
  delete projekt.gesamtFoto;
}

/** Katalog-Migration eines geladenen Projekts (Modul-/WR-ids nach Updates veraltet). */
function migriereProjekt(roh: Projekt): Projekt {
  const projekt: Projekt = { ...neuesProjekt(), ...roh };
  migriereFotoModell(roh, projekt);
  const flaechenIds = new Set(projekt.flaechen.map((f) => f.id));
  projekt.flaechen = projekt.flaechen.map((f) => {
    const neu = { ...f };
    if (neu.elternFlaecheId === neu.id || !flaechenIds.has(neu.elternFlaecheId ?? '')) {
      delete neu.elternFlaecheId;
    }
    // Fachliche Invariante: Gauben sind dachparallele Ebenen und dürfen nie in
    // die aufgeständerte Flachdach-Engine rutschen.
    if (neu.gaubenTyp) {
      neu.art = 'dach';
      delete neu.flachdach;
    }
    return neu;
  });
  if (!MODULES.some((m) => m.id === projekt.modulId)) projekt.modulId = MODULES[0]!.id;
  if (projekt.wrId && !INVERTERS.some((w) => w.id === projekt.wrId)) {
    projekt.wrId = null;
    projekt.mppts = [];
  }
  // Fehlende Zonen-Buchstaben einmalig vergeben (Bestand: nach Reihenfolge)
  if (projekt.flaechen.some((f) => !f.zone)) {
    const mit: Flaeche[] = [];
    for (const f of projekt.flaechen) mit.push(f.zone ? f : { ...f, zone: naechsteZone(mit) });
    projekt.flaechen = mit;
  }
  // Bestehende Foto-Flächen (Umriss schon gesetzt) gelten als fertig markiert,
  // damit sie nach dem Update nicht plötzlich in die Markier-Ansicht springen.
  projekt.flaechen = projekt.flaechen.map((f) =>
    f.fotoZuordnung?.eckenPx && f.markierungFertig === undefined
      ? { ...f, markierungFertig: true }
      : f,
  );
  // 16.07.2026 (Felder-Umbau): Alt-Schlüssel des Automatismus strippen. Genrih:
  // „es gibt eh keine gespeicherten Belegungen" — Alt-Belegungen werden NICHT
  // konvertiert; die Fläche startet unbelegt („Automatisch füllen" ist ein Klick).
  projekt.flaechen = projekt.flaechen.map((f) => {
    const rest = { ...f } as Flaeche & Record<string, unknown>;
    for (const alt of [
      'optimierung',
      'versatzXM',
      'versatzYM',
      'baender',
      'extraModule',
      'geloescht',
      'geloeschtRel',
    ]) {
      delete rest[alt];
    }
    return {
      ...rest,
      grunddatenFertig: f.grunddatenFertig ?? true,
      felder: f.felder ?? [],
      inaktiv: [],
    };
  });
  return projekt;
}

/** Alt-Key (Einzelprojekt) lesen — nur für die einmalige Migration. */
function ladeAltStand(): { projekt: Projekt; schritt: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const roh = window.localStorage.getItem(STORAGE_KEY);
    if (!roh) return null;
    const stand = JSON.parse(roh) as { projekt?: Projekt; schritt?: number };
    if (!stand.projekt || !Array.isArray(stand.projekt.flaechen)) return null;
    return { projekt: migriereProjekt(stand.projekt), schritt: stand.schritt ?? 0 };
  } catch {
    return null;
  }
}

export type SpeicherStatus = 'gespeichert' | 'speicher_voll';

export function speichereProjekte(db: ProjektDb): SpeicherStatus {
  if (typeof window === 'undefined') return 'gespeichert';
  try {
    window.localStorage.setItem(
      PROJEKTE_KEY,
      JSON.stringify({ ...db, workflowVersion: WORKFLOW_VERSION }),
    );
    return 'gespeichert';
  } catch {
    // Den letzten vollständigen Stand niemals durch eine Version ohne Fotos
    // überschreiben. Die UI warnt, bis ein kompletter Speichervorgang gelingt.
    return 'speicher_voll';
  }
}

export function ladeProjekte(): ProjektDb {
  if (typeof window === 'undefined') {
    return { aktivId: null, projekte: [], workflowVersion: WORKFLOW_VERSION };
  }
  try {
    const roh = window.localStorage.getItem(PROJEKTE_KEY);
    if (roh) {
      const db = JSON.parse(roh) as Partial<ProjektDb>;
      if (Array.isArray(db.projekte)) {
        const bereitsNeu = db.workflowVersion === WORKFLOW_VERSION;
        const projekte = db.projekte
          .filter((e): e is ProjektEintrag => !!e?.projekt && Array.isArray(e.projekt.flaechen))
          .map((e) => ({
            ...e,
            schritt: bereitsNeu
              ? Math.max(0, Math.min(2, e.schritt ?? 0))
              : migriereWorkflowSchritt(e.schritt ?? 0),
            projekt: migriereProjekt(e.projekt),
          }));
        const aktivId = projekte.some((e) => e.id === db.aktivId)
          ? db.aktivId!
          : (projekte[0]?.id ?? null);
        return { aktivId, projekte, workflowVersion: WORKFLOW_VERSION };
      }
    }
  } catch {
    // fällt weiter zur Migration/Neuanlage
  }
  // Einmalige Migration vom Alt-Key (genau ein Projekt)
  const alt = ladeAltStand();
  if (alt) {
    const jetzt = Date.now();
    const eintrag: ProjektEintrag = {
      id: neueProjektId(),
      projekt: migriereProjekt(alt.projekt),
      schritt: migriereWorkflowSchritt(alt.schritt),
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    };
    const db: ProjektDb = {
      aktivId: eintrag.id,
      projekte: [eintrag],
      workflowVersion: WORKFLOW_VERSION,
    };
    speichereProjekte(db);
    try {
      window.localStorage.removeItem(STORAGE_KEY); // Alt-Key freigeben (Fotos = groß)
    } catch {
      // egal
    }
    return db;
  }
  return { aktivId: null, projekte: [], workflowVersion: WORKFLOW_VERSION };
}

/** Neuer, leerer Eintrag (Zeitstempel jetzt). */
export function neuerEintrag(): ProjektEintrag {
  const jetzt = Date.now();
  return {
    id: neueProjektId(),
    projekt: neuesProjekt(),
    schritt: 0,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  };
}

/** Export-Payload nach SPEC §13 */
export function bauePayload(p: Projekt, result: StringPlanResult | null): object {
  const modul = modulById(p.modulId);
  const stringFlaeche = new Map(p.mppts.flat().map((s) => [s.id, s.flaecheId]));
  return {
    tool: 'belegungsplaner',
    version: '1.0',
    projekt: { adresse: p.adresse, kunde: p.kunde, erfasser: p.erfasser ?? '' },
    geometrie_quelle: 'manual',
    flaechen: p.flaechen.map((f) => {
      const raster = rasterFuer(f, modul);
      const ausrichtungen = ausrichtungenVon(f, raster);
      const aktivePositionen = raster.positionen.filter(
        (pos) => !f.inaktiv.includes(`${pos.row}-${pos.col}`),
      );
      const gaubenRolle =
        f.gaubenTyp === 'flachdach'
          ? 'gaube_flachdach'
          : f.gaubenTyp === 'satteldach'
            ? 'gaube_satteldach'
            : 'hauptflaeche';
      return {
        id: f.id,
        zone: f.zone ?? '',
        rolle: gaubenRolle,
        eltern_flaeche_id: f.elternFlaecheId ?? null,
        gauben_seite: f.gaubenSeite ?? null,
        gauben_gruppe_id: f.gaubenGruppeId ?? null,
        gauben_aufmass: f.gaubenMessung
          ? {
              quelle: f.gaubenMessung.quelle,
              qualitaet: f.gaubenMessung.qualitaet,
              ziegel_quer: f.gaubenMessung.ziegelQuer ?? null,
              deckbreite_cm: f.gaubenMessung.deckbreiteCm ?? null,
              ziegel_reihen: f.gaubenMessung.ziegelReihen ?? null,
              reihenabstand_cm: f.gaubenMessung.reihenabstandCm ?? null,
            }
          : null,
        // ASCII snake_case (SPEC §13): dach | fassade | flachdach_sued_10 | flachdach_ostwest_10
        montage:
          f.gaubenTyp === 'flachdach'
            ? 'gaube_stehfalz_dachparallel'
            : f.gaubenTyp === 'satteldach'
              ? 'gaube_dachparallel'
              : artVon(f) === 'flachdach' && f.flachdach
            ? `flachdach_${f.flachdach.aufstaenderung}_${f.flachdach.winkelDeg}`
            : artVon(f),
        eindeckung: f.dachfarbe,
        neigung_deg: f.neigungDeg,
        azimut_deg: f.azimutDeg,
        flachdach_montage:
          artVon(f) === 'flachdach' && f.flachdach
            ? {
                aufstaenderung: f.flachdach.aufstaenderung,
                winkel_deg: f.flachdach.winkelDeg,
                pitch_m:
                  f.flachdach.pitchM ??
                  flachdachPitchDefault(f.flachdach.aufstaenderung, f.flachdach.winkelDeg),
                sued_richtung_im_plan: flachdachSuedRichtung(f),
                ost_richtung_im_plan: flachdachOstRichtung(f),
              }
            : null,
        flaeche_m2: Math.round(flaecheM2(f) * 10) / 10,
        module: {
          typ: modul.id,
          anzahl: aktiveModule(f, raster),
          ausrichtung: ausrichtungen.bezeichnung,
          anzahl_hochkant: ausrichtungen.hochkant,
          anzahl_quer: ausrichtungen.quer,
          anzahl_ost: aktivePositionen.filter((pos) => pos.seite === 'ost').length,
          anzahl_west: aktivePositionen.filter((pos) => pos.seite === 'west').length,
        },
      };
    }),
    wechselrichter: p.wrId ? { typ: p.wrId, anzahl: 1 } : null,
    strings: result
      ? result.strings.map((s) => ({
          mppt: s.mpptIndex,
          flaeche: stringFlaeche.get(s.id) ?? '',
          module: s.moduleCount,
          voc_cold_v: Math.round(s.vocColdV * 10) / 10,
          vmp_hot_v: Math.round(s.vmpHotV * 10) / 10,
        }))
      : [],
    kwp: Math.round(kwpGesamt(p) * 100) / 100,
    regel_pruefung: result ? { bestanden: result.valid, regeln: result.regeln } : null,
    flags: [],
    eskaliert: false,
    render_png_url: '',
    hinweis:
      'Vorplanung Vertrieb — keine Fachplanung. Finale Auslegung durch Projektleitung (PV*SOL).',
  };
}
