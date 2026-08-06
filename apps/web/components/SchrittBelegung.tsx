'use client';

import { useEffect, useRef, useState } from 'react';
import { feldSchrittmasse, posKey, type BelegungsFeldM } from '@pv-belegung/engine';
import { dateiZuBild } from '../lib/bild';
import {
  aktiveModule,
  artVon,
  dachFotoVon,
  felderInput,
  fotoZuordnungVon,
  fotoZuordnungenVon,
  fmtDe,
  leerePositionenFuer,
  modulById,
  modulMasse,
  naechsteZone,
  neueFlaeche,
  neueGaubenFlaeche,
  neueFotoId,
  patchFlaechenGeometrie,
  projektFotoVon,
  rahmenBreiteVon,
  randVon,
  rasterFuer,
  umrissVon,
  vollFeldFuer,
  zonenVon,
  type Flaeche,
  type FotoZuordnung,
  type Projekt,
  type ProjektFoto,
  type PunktM,
  type RechteckM,
} from '../lib/model';
import { DachSvg, griffPunkte, type GriffId } from './DachSvg';
import { FlaechenInlineEditor } from './FlaechenInlineEditor';
import { FotoHintergrund } from './FotoHintergrund';
import { aktualisiereGaubenAussparungen } from '../lib/gauben-geometrie';
import {
  GaubenEditor,
  type AktualisierteGaubenMarkierung,
  type NeueGaubeAusFoto,
} from './GaubenEditor';
import { fotoFlaechenInhalt, ProjektFotoSvg } from './GesamtSvg';
import {
  IconFeld,
  IconFoto,
  IconHindernis,
  IconLeeren,
  IconMasse,
  IconModulHoch,
  IconModulLoeschen,
  IconModulQuer,
  IconUmriss,
} from './icons';
import { HoldButton, Karte, KartenTitel, ToggleButton } from './ui';

/** Laufende Zeichnung (Umriss oder Hindernis) — immer nur eine Fläche gleichzeitig */
interface Zeichnung {
  flaecheId: string;
  art: 'umriss' | 'hindernis';
  punkte: PunktM[];
}

/**
 * Werkzeuge der Belegung (16.07.2026, Genrih: „Belegungsautomatismus mildern").
 * null = FELDER (Standard): Felder aufziehen, auswählen, verschieben.
 * 'zellen' = einzelne Module im Feld antippen und dauerhaft entfernen.
 */
type WerkzeugArt = 'zellen';

type FotoUploadZiel =
  | { art: 'ersetzen'; fotoId: string }
  | { art: 'perspektive'; flaecheId: string };

/** Laufende Zeiger-Geste — lebt nur im State, wird erst beim Loslassen committet. */
type Drag =
  | { art: 'neu'; flaecheId: string; start: PunktM; aktuell: PunktM }
  | { art: 'move'; flaecheId: string; start: PunktM; aktuell: PunktM; indices: number[] }
  | {
      art: 'resize';
      flaecheId: string;
      start: PunktM;
      aktuell: PunktM;
      index: number;
      griff: GriffId;
    };

/** Klick vs. Ziehen: darunter gilt die Geste als Klick (Meter). */
const KLICK_SCHWELLE_M = 0.05;
/** So viel Feld muss im Rahmen bleiben, damit es nicht „verloren geht" (Meter). */
const MIN_SICHTBAR_M = 0.5;
/** Fangradius der Größen-Griffe (Meter) — etwa Fingerbreite auf dem Tablet. */
const GRIFF_FANG_M = 0.35;
/** Kleinste Feldgröße beim Ziehen an den Griffen (Meter). */
const MIN_FELD_M = 0.2;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Hauptflächen und ihre Gauben für die verschachtelte UI zusammenhalten. */
export function flaechenInBelegungsReihenfolge(flaechen: Flaeche[]): Flaeche[] {
  return [
    ...flaechen
      .filter((f) => !f.gaubenTyp)
      .flatMap((hauptflaeche) => [
        hauptflaeche,
        ...flaechen.filter(
          (f) => f.gaubenTyp && f.elternFlaecheId === hauptflaeche.id,
        ),
      ]),
    ...flaechen.filter(
      (f) =>
        f.gaubenTyp &&
        !flaechen.some(
          (hauptflaeche) => !hauptflaeche.gaubenTyp && hauptflaeche.id === f.elternFlaecheId,
        ),
    ),
  ];
}

/**
 * Feldgröße aus einem Griff-Zug (16.07.2026): nur die vom Griff berührten Kanten
 * wandern (`nw` = links+oben, `e` = nur rechts …). Zieht man eine Kante über die
 * gegenüberliegende hinaus, klappt das Rechteck um, statt negativ zu werden.
 *
 * WICHTIG — die LINKE/OBERE Kante rastet in ganzen Modulschritten ein: das Zellraster
 * hängt an der linken oberen Feldecke, also würde ein freies Ziehen dort die ganze
 * Belegung mitschieben (Module wandern, abgeschaltete Zellen landen woanders → „Lücken,
 * obwohl Module reinpassen", Genrih 16.07.). Mit dem Raster als Schrittweite bleiben die
 * bestehenden Module exakt stehen; es kommen nur ganze Spalten/Reihen dazu oder weg.
 * Rechts/unten darf frei gezogen werden (dort hängt keine Phase dran).
 *
 * `zellVersatz` sagt, um wie viele Spalten/Reihen sich die Zell-Nummerierung dabei
 * verschoben hat — die abgeschalteten Zellen (`leer`) müssen entsprechend mitwandern.
 */
export function feldMitGriff(
  feld: BelegungsFeldM,
  griff: GriffId,
  dx: number,
  dy: number,
  pitchX: number,
  pitchY: number,
): { rect: RechteckM; zellVersatz: { col: number; row: number } } {
  let links = feld.xM;
  let oben = feld.yM;
  let rechts = links + feld.breiteM;
  let unten = oben + feld.hoeheM;
  let dCol = 0;
  let dRow = 0;
  if (griff.includes('w')) {
    const k = Math.round(dx / pitchX); // ganze Modulschritte
    links += k * pitchX;
    dCol = -k; // Feld wächst nach links (k<0) → jede Zelle rückt eine Spalte weiter
  }
  if (griff.includes('e')) rechts += dx;
  if (griff.includes('n')) {
    const k = Math.round(dy / pitchY);
    oben += k * pitchY;
    dRow = -k;
  }
  if (griff.includes('s')) unten += dy;
  return {
    rect: {
      xM: Math.min(links, rechts),
      yM: Math.min(oben, unten),
      breiteM: Math.max(MIN_FELD_M, Math.abs(rechts - links)),
      hoeheM: Math.max(MIN_FELD_M, Math.abs(unten - oben)),
    },
    zellVersatz: { col: dCol, row: dRow },
  };
}

/** `leer`-Zellen um (dCol,dRow) umnummerieren; was aus dem Feld fällt, entfällt. */
export function leerVerschoben(
  leer: readonly string[] | undefined,
  dCol: number,
  dRow: number,
): string[] | undefined {
  if (!leer?.length) return undefined;
  if (dCol === 0 && dRow === 0) return [...leer];
  const neu = leer
    .map((z) => {
      const [r, c] = z.split('-').map(Number);
      return [r! + dRow, c! + dCol] as const;
    })
    .filter(([r, c]) => r >= 0 && c >= 0)
    .map(([r, c]) => `${r}-${c}`);
  return neu.length ? neu : undefined;
}

/** Normalisiertes Rechteck aus zwei gezogenen Ecken. */
export function rechteckAus(a: PunktM, b: PunktM): RechteckM {
  return {
    xM: Math.min(a[0], b[0]),
    yM: Math.min(a[1], b[1]),
    breiteM: Math.abs(b[0] - a[0]),
    hoeheM: Math.abs(b[1] - a[1]),
  };
}

export function punktInRechteck(p: PunktM, r: RechteckM): boolean {
  return p[0] >= r.xM && p[0] <= r.xM + r.breiteM && p[1] >= r.yM && p[1] <= r.yM + r.hoeheM;
}

/**
 * Segment-Knopf der Werkzeugleiste (U1, 08.07.): Werkzeuge liegen als Gruppe auf
 * grauem Grund, das aktive als weiße „Pille" — wie in einem Zeichenprogramm.
 */
function WerkzeugKnopf({
  aktiv,
  disabled,
  title,
  onClick,
  children,
}: {
  aktiv: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={aktiv}
      title={title}
      onClick={onClick}
      className={`touch-target inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
        disabled
          ? 'cursor-not-allowed text-slate-300'
          : aktiv
            ? 'bg-white font-semibold text-akzent shadow'
            : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

export function SchrittBelegung({
  projekt,
  onChange,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
}) {
  const modul = modulById(projekt.modulId);
  const [zeichnung, setZeichnung] = useState<Zeichnung | null>(null);
  // Maße einblenden — beim Kunden vor Ort abschaltbar (Genrih 07.07.)
  const [masseZeigen, setMasseZeigen] = useState(true);
  const [fotoFokusId, setFotoFokusId] = useState<string | null>(null);
  /** Aktive Arbeitsansicht je Fläche: Foto-ID oder 'plan' für die Draufsicht. */
  const [ansichtJeFlaeche, setAnsichtJeFlaeche] = useState<Record<string, string>>({});
  // Aktives Werkzeug (exklusiv je Fläche); null = Felder-Werkzeug (Standard)
  const [modus, setModus] = useState<{ art: WerkzeugArt; flaecheId: string } | null>(null);
  // Schrittweite der Pfeil-Bewegung in cm
  const [schrittCm, setSchrittCm] = useState(10);
  // Ausgewählte Felder (Indices in Flaeche.felder) — Mehrfachauswahl per Antippen
  const [auswahl, setAuswahl] = useState<{ flaecheId: string; indices: number[] } | null>(null);
  // Laufende Zeiger-Geste (Aufziehen/Verschieben) — NICHT im Projekt, s. mitDrag()
  const [drag, setDrag] = useState<Drag | null>(null);
  /**
   * Läuft gerade eine Geste? Als Ref, damit `onUpM` doppelt aufgerufen werden darf
   * (SVG-Handler + Sicherheitsnetz unten) und trotzdem genau EINMAL committet — ein
   * zweiter Commit würde das Delta ein zweites Mal aufaddieren.
   */
  const dragAktiv = useRef(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const fotoZielRef = useRef<FotoUploadZiel | null>(null);

  const gesamt = projekt.flaechen.reduce(
    (sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)),
    0,
  );
  const kwp = (gesamt * modul.pmaxW) / 1000;

  /**
   * Aktuellster Projektstand — auch zwischen zwei Renders (16.07.2026). Ein
   * gehaltener Pfeil (Tastatur-Repeat ~30/s, Halte-Knopf alle 130 ms) feuert
   * schneller, als React neu rendert; ohne diese Ref läse jeder Schritt die
   * Fläche der letzten gerenderten Closure und rechnete wieder von derselben
   * Ausgangslage — jeder zweite Schritt ginge verloren (gemessen: 2 statt 8/s).
   */
  const projektRef = useRef(projekt);
  projektRef.current = projekt;

  const patchFlaeche = (id: string, patch: Partial<Flaeche>) => {
    const neu = {
      ...projektRef.current,
      flaechen: projektRef.current.flaechen.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    };
    projektRef.current = neu; // sofort mitziehen, nicht erst beim nächsten Render
    onChange(neu);
  };

  /** Projektänderung ebenfalls über den aktuellen Ref-Stand, nicht über alte Render-Closures. */
  const aendereProjekt = (fn: (p: Projekt) => Projekt) => {
    const neu = fn(projektRef.current);
    projektRef.current = neu;
    onChange(neu);
  };

  /** Grundmaße ändern den Maßstab, nicht die gesetzten Fotoecken. */
  const patchGrunddaten = (id: string, patch: Partial<Flaeche>) => {
    aendereProjekt((p) => ({
      ...p,
      flaechen: p.flaechen.map((f) =>
        f.id === id ? patchFlaechenGeometrie(f, patch) : f,
      ),
    }));
    setAuswahl(null);
    setDrag(null);
    if (fotoFokusId === id) {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => scrolleZuFotoMitMassen(id)),
      );
    }
  };

  const fuegeHauptflaecheHinzu = () => {
    const p = projektRef.current;
    const nr = Math.max(
      0,
      ...p.flaechen.map((f) => Number.parseInt(f.id.replace(/^p/, ''), 10) || 0),
    ) + 1;
    const neu = neueFlaeche(nr, naechsteZone(p.flaechen));
    aendereProjekt((aktuell) => ({
      ...aktuell,
      flaechen: [...aktuell.flaechen, neu],
    }));
    window.setTimeout(() => {
      document.getElementById(`belegung-${neu.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  };

  const loescheHauptflaeche = (flaeche: Flaeche) => {
    const hauptflaechen = projektRef.current.flaechen.filter((f) => !f.gaubenTyp);
    if (hauptflaechen.length <= 1) return;
    if (!window.confirm(`Dachfläche „${flaeche.name}" mit ihrer Belegung entfernen?`)) return;
    aendereProjekt((p) => {
      const ids = new Set(
        p.flaechen
          .filter((f) => f.id === flaeche.id || f.elternFlaecheId === flaeche.id)
          .map((f) => f.id),
      );
      return {
        ...p,
        flaechen: p.flaechen.filter((f) => !ids.has(f.id)),
        mppts: p.mppts.map((strings) => strings.filter((s) => !ids.has(s.flaecheId))),
      };
    });
  };

  const scrolleZuFotoMitMassen = (flaecheId: string) => {
    const ziel = document.getElementById(`foto-masse-${flaecheId}`);
    if (!ziel) return;
    const massLeiste = document.getElementById(`flaechen-masse-${flaecheId}`);
    const abstand = (massLeiste?.getBoundingClientRect().height ?? 96) + 12;
    const top = ziel.getBoundingClientRect().top + window.scrollY - abstand;
    const reduzierteBewegung = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduzierteBewegung ? 'auto' : 'smooth',
    });
  };

  const aktiviereFotoFokus = (flaecheId: string) => {
    setFotoFokusId(flaecheId);
    window.requestAnimationFrame(() => scrolleZuFotoMitMassen(flaecheId));
  };

  const waehleFotoDatei = (ziel: FotoUploadZiel) => {
    fotoZielRef.current = ziel;
    fotoInputRef.current?.click();
  };

  const fotoDateiGewaehlt = async (file: File) => {
    const bild = await dateiZuBild(file);
    const ziel = fotoZielRef.current;
    fotoZielRef.current = null;
    if (!ziel) return;
    const neueId = ziel.art === 'perspektive' ? neueFotoId() : null;
    aendereProjekt((p) => {
      if (ziel.art === 'ersetzen') {
        const zielId = ziel.fotoId;
        return {
          ...p,
          fotos: p.fotos.map((foto) =>
            foto.id === zielId ? { ...foto, ...bild } : foto,
          ),
          // Neue Pixelmaße machen alte Anker unbrauchbar; Flächen bleiben zugeordnet,
          // müssen aber auf dem neuen Bild sauber neu markiert werden.
          flaechen: p.flaechen.map((f) => {
            const zuordnungen = fotoZuordnungenVon(f);
            if (!zuordnungen.some((z) => z.fotoId === zielId)) return f;
            return {
              ...f,
              fotoZuordnungen: zuordnungen.map((z) =>
                z.fotoId === zielId
                  ? { fotoId: zielId, traufePx: null, markierungFertig: false }
                  : z,
              ),
              // Gauben-Markierungen sind an die erste (definierende) Perspektive
              // gekoppelt. Der Austausch einer Zusatzperspektive darf sie nicht löschen.
              gaubenAussparungen:
                zuordnungen[0]?.fotoId === zielId
                  ? f.gaubenAussparungen?.map(
                    ({ fotoEckenPx: _altePixel, ...a }) => a,
                    )
                  : f.gaubenAussparungen,
            };
          }),
        };
      }
      const id = neueId!;
      const foto: ProjektFoto = {
        id,
        name: `Drohnenfoto ${p.fotos.length + 1}`,
        ...bild,
      };
      return {
        ...p,
        fotos: [...p.fotos, foto],
        flaechen: p.flaechen.map((f) => {
          if (f.id !== ziel.flaecheId) return f;
          const neu = {
            ...f,
            fotoZuordnungen: [
              ...fotoZuordnungenVon(f),
              { fotoId: id, traufePx: null, markierungFertig: false },
            ],
          };
          delete neu.fotoZuordnung;
          delete neu.markierungFertig;
          return neu;
        }),
      };
    });
    if (ziel.art === 'perspektive' && neueId) {
      setAnsichtJeFlaeche((alt) => ({ ...alt, [ziel.flaecheId]: neueId }));
      setAuswahl(null);
      setDrag(null);
      setZeichnung(null);
      setModus(null);
    }
  };

  /** Eine weitere Perspektive derselben Fläche anlegen. */
  const fuegeFotoZuordnungHinzu = (flaecheId: string, fotoId: string) => {
    setAuswahl(null);
    setDrag(null);
    setZeichnung(null);
    setModus(null);
    aendereProjekt((p) => ({
      ...p,
      flaechen: p.flaechen.map((f) => {
        if (f.id !== flaecheId) return f;
        const neu = { ...f };
        delete neu.foto;
        delete neu.gesamtEckenPx;
        const bisher = fotoZuordnungenVon(neu);
        neu.fotoZuordnungen = bisher.some((z) => z.fotoId === fotoId)
          ? bisher
          : [...bisher, { fotoId, traufePx: null, markierungFertig: false }];
        delete neu.fotoZuordnung;
        delete neu.markierungFertig;
        return neu;
      }),
    }));
    setAnsichtJeFlaeche((alt) => ({ ...alt, [flaecheId]: fotoId }));
  };

  /** Nur eine Perspektive lösen; metrische Geometrie und Belegung bleiben erhalten. */
  const loeseFotoZuordnung = (flaecheId: string, fotoId: string) => {
    setAuswahl(null);
    setDrag(null);
    setZeichnung(null);
    setModus(null);
    aendereProjekt((p) => ({
      ...p,
      flaechen: p.flaechen.map((f) => {
        if (f.id !== flaecheId && f.elternFlaecheId !== flaecheId) return f;
        const verbleibend = fotoZuordnungenVon(f).filter((z) => z.fotoId !== fotoId);
        if (verbleibend.length === fotoZuordnungenVon(f).length) return f;
        const neu = { ...f, fotoZuordnungen: verbleibend };
        delete neu.fotoZuordnung;
        delete neu.markierungFertig;
        return neu;
      }),
    }));
    setAnsichtJeFlaeche((alt) => ({ ...alt, [flaecheId]: 'plan' }));
  };

  const loescheFoto = (foto: ProjektFoto) => {
    const anzahl = projektRef.current.flaechen.filter(
      (f) => fotoZuordnungenVon(f).some((z) => z.fotoId === foto.id),
    ).length;
    if (
      !window.confirm(
        anzahl > 0
          ? `„${foto.name}“ löschen? ${anzahl} zugeordnete ${anzahl === 1 ? 'Fläche wird' : 'Flächen werden'} vom Foto gelöst; Belegungsfelder bleiben erhalten.`
          : `„${foto.name}“ löschen?`,
      )
    ) return;
    aendereProjekt((p) => ({
      ...p,
      fotos: p.fotos.filter((x) => x.id !== foto.id),
      flaechen: p.flaechen.map((f) => {
        const bisher = fotoZuordnungenVon(f);
        if (!bisher.some((z) => z.fotoId === foto.id)) return f;
        const neu = {
          ...f,
          fotoZuordnungen: bisher.filter((z) => z.fotoId !== foto.id),
        };
        delete neu.fotoZuordnung;
        delete neu.markierungFertig;
        return neu;
      }),
    }));
  };

  /** FotoHintergrund arbeitet weiter mit DachFoto; hier zurück ins neue Modell übersetzen. */
  const patchFotoFlaeche = (f: Flaeche, fotoId: string, patch: Partial<Flaeche>) => {
    const { foto, markierungFertig, ...rest } = patch;
    aendereProjekt((p) => {
      const aktuell = p.flaechen.find((x) => x.id === f.id);
      if (!aktuell) return p;
      const neu: Partial<Flaeche> = { ...rest };
      const aktuellZ = fotoZuordnungVon(aktuell, fotoId);
      if (aktuellZ) {
        const z: FotoZuordnung = {
          ...aktuellZ,
          ...(foto ? { traufePx: foto.traufePx } : {}),
        };
        if (foto?.eckenPx) z.eckenPx = foto.eckenPx;
        else if (foto) delete z.eckenPx;
        if (foto?.pxProM !== undefined) z.pxProM = foto.pxProM;
        else if (foto) delete z.pxProM;
        if (markierungFertig !== undefined) z.markierungFertig = markierungFertig;
        neu.fotoZuordnungen = fotoZuordnungenVon(aktuell).map((x) =>
          x.fotoId === fotoId ? z : x,
        );

        // Gauben-Pixel bleiben im gemeinsamen Foto fest. Wird nur die
        // Perspektive des Mutterdachs korrigiert, folgt die metrische Aussparung
        // automatisch, statt als unsichtbares altes Loch liegenzubleiben.
        if (
          !aktuell.gaubenTyp &&
          foto?.eckenPx &&
          fotoZuordnungenVon(aktuell)[0]?.fotoId === fotoId
        ) {
          neu.gaubenAussparungen = aktualisiereGaubenAussparungen(
            { ...aktuell, ...rest, foto },
            aktuell.gaubenAussparungen,
          );
        }
      }
      return {
        ...p,
        flaechen: p.flaechen.map((x) => (x.id === aktuell.id ? { ...x, ...neu } : x)),
      };
    });
  };

  /** Gaube aus EINEM Parent-Foto-Workflow als interne Kindfläche(n) anlegen. */
  const erstelleGaube = (eltern: Flaeche, fotoId: string, daten: NeueGaubeAusFoto) => {
    if (!fotoZuordnungVon(eltern, fotoId)) return;
    aendereProjekt((p) => {
      const gruppeId = `gaube-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const nummern = p.flaechen
        .map((f) => Number.parseInt(f.id.replace(/^p/, ''), 10))
        .filter(Number.isFinite);
      let nr = Math.max(0, ...nummern) + 1;
      const mitZonen = [...p.flaechen];
      const gemeinsameWerte = {
        breiteM: daten.breiteM,
        hoeheM: daten.hoeheM,
        gaubenMessung: daten.messung,
        inaktiv: [] as string[],
      };

      const baueKind = (
        seite: 'links' | 'rechts' | undefined,
        eckenPx: FotoZuordnung['eckenPx'],
      ) => {
        const seitenMass = seite ? daten.seitenMasse?.[seite] : undefined;
        const zone = naechsteZone(mitZonen);
        let kind = neueGaubenFlaeche(nr++, zone, daten.typ, eltern.id, seite, gruppeId);
        kind = {
          ...kind,
          ...gemeinsameWerte,
          ...(seitenMass ? { breiteM: seitenMass.breiteM, hoeheM: seitenMass.hoeheM } : {}),
          azimutDeg:
            daten.typ === 'satteldach'
              ? (eltern.azimutDeg + (seite === 'links' ? 270 : 90)) % 360
              : eltern.azimutDeg,
          fotoZuordnungen: [{
            fotoId,
            traufePx: null,
            markierungFertig: true,
            ...(eckenPx ? { eckenPx } : {}),
          }],
        };
        // Sofortige Vorschau: ein Feld über die ganze neue Gaubenfläche.
        kind.felder = [vollFeldFuer(kind, modul)];
        mitZonen.push(kind);
      };

      if (daten.typ === 'flachdach') {
        baueKind(undefined, daten.aussen);
      } else if (daten.seiten) {
        baueKind('links', daten.seiten.links);
        baueKind('rechts', daten.seiten.rechts);
      }

      return {
        ...p,
        flaechen: mitZonen.map((f) =>
          f.id === eltern.id
            ? {
                ...f,
                gaubenAussparungen: [
                  ...(f.gaubenAussparungen ?? []),
                  {
                    gaubenGruppeId: gruppeId,
                    rechteck: daten.aussparung,
                    fotoEckenPx: daten.aussen,
                  },
                ],
                inaktiv: [],
              }
            : f,
        ),
      };
    });
  };

  const loescheGaube = (elternId: string, gruppeId: string) => {
    if (!window.confirm('Gaube und ihre Modulbelegung entfernen?')) return;
    aendereProjekt((p) => {
      const ids = new Set(
        p.flaechen
          .filter((f) => (f.gaubenGruppeId ?? f.id) === gruppeId)
          .map((f) => f.id),
      );
      return {
        ...p,
        flaechen: p.flaechen
          .filter((f) => !ids.has(f.id))
          .map((f) =>
            f.id === elternId
              ? {
                  ...f,
                  gaubenAussparungen: f.gaubenAussparungen?.filter(
                    (a) => a.gaubenGruppeId !== gruppeId,
                  ),
                  inaktiv: [],
                }
              : f,
          ),
        mppts: p.mppts.map((strings) => strings.filter((s) => !ids.has(s.flaecheId))),
      };
    });
  };

  const aendereGaubenMarkierung = (
    elternId: string,
    gruppeId: string,
    markierung: AktualisierteGaubenMarkierung,
  ) => {
    aendereProjekt((p) => {
      const eltern = p.flaechen.find((f) => f.id === elternId);
      const fotoId = eltern ? fotoZuordnungenVon(eltern)[0]?.fotoId : undefined;
      return {
        ...p,
        flaechen: p.flaechen.map((f) => {
          if (f.id === elternId) {
            return {
              ...f,
              gaubenAussparungen: f.gaubenAussparungen?.map((a) =>
                a.gaubenGruppeId === gruppeId
                  ? {
                      ...a,
                      rechteck: markierung.aussparung,
                      fotoEckenPx: markierung.aussen,
                    }
                  : a,
              ),
              inaktiv: [],
            };
          }
          if ((f.gaubenGruppeId ?? f.id) !== gruppeId || !f.gaubenTyp) return f;
          const eckenPx =
            f.gaubenTyp === 'satteldach' && f.gaubenSeite
              ? markierung.seiten?.[f.gaubenSeite]
              : markierung.aussen;
          if (!eckenPx || !fotoId) return f;
          const bisher = fotoZuordnungenVon(f);
          const z: FotoZuordnung = {
            fotoId,
            traufePx: null,
            eckenPx,
            markierungFertig: true,
          };
          return {
            ...f,
            fotoZuordnungen: bisher.some((x) => x.fotoId === fotoId)
              ? bisher.map((x) => (x.fotoId === fotoId ? z : x))
              : [...bisher, z],
          };
        }),
      };
    });
  };

  const aendereGaubenMasse = (
    gruppeId: string,
    flaecheId: string,
    breiteM: number,
    hoeheM: number,
    messung: NonNullable<Flaeche['gaubenMessung']>,
  ) => {
    aendereProjekt((p) => ({
      ...p,
      flaechen: p.flaechen.map((f) => {
        if ((f.gaubenGruppeId ?? f.id) !== gruppeId || !f.gaubenTyp) return f;
        // Messquelle gilt für die ganze Gaube; das konkrete Seitenmaß wird nur
        // an der gewählten Dachseite geändert.
        if (f.id !== flaecheId) return { ...f, gaubenMessung: messung };
        return patchFlaechenGeometrie(f, { breiteM, hoeheM, gaubenMessung: messung });
      }),
    }));
  };

  /** Fläche im AKTUELLEN Stand (nicht der gerenderten Closure) — für Wiederhol-Aktionen. */
  const frisch = (f: Flaeche): Flaeche => projektRef.current.flaechen.find((x) => x.id === f.id) ?? f;

  const modusArt = (f: Flaeche): WerkzeugArt | null =>
    modus?.flaecheId === f.id ? modus.art : null;

  /**
   * Werkzeug wechseln. Räumt JEDEN losen Zustand des vorherigen Werkzeugs auf —
   * beim Wechsel darf nichts Halbfertiges liegenbleiben (Genrih 16.07.). Eine
   * laufende Umriss-/Hindernis-Zeichnung ist ein Entwurf und wird verworfen; alles
   * andere (abgeschaltete Module, Felder) ist ohnehin sofort im Projekt.
   */
  const setzeModus = (f: Flaeche, art: WerkzeugArt | null) => {
    setModus(art ? { art, flaecheId: f.id } : null);
    setAuswahl(null);
    setDrag(null);
    setZeichnung(null);
  };

  /** Umriss-/Hindernis-Zeichnen starten — beendet das aktive Werkzeug sauber. */
  const starteZeichnung = (f: Flaeche, art: 'umriss' | 'hindernis') => {
    setModus(null);
    setAuswahl(null);
    setDrag(null);
    setZeichnung({ flaecheId: f.id, art, punkte: [] });
  };

  const felderVon = (f: Flaeche): BelegungsFeldM[] => f.felder ?? [];
  const auswahlVon = (f: Flaeche): number[] =>
    auswahl?.flaecheId === f.id ? auswahl.indices.filter((i) => i < felderVon(f).length) : [];

  /**
   * Welcher Ausrichtungs-Knopf leuchtet? Das, was die betroffenen Felder TATSÄCHLICH
   * haben (Auswahl, sonst alle) — bei gemischten Feldern keiner. Ohne Felder gilt die
   * Vorgabe für neue.
   */
  const ausrichtungAktiv = (f: Flaeche): 'hoch' | 'quer' | null => {
    const felder = felderVon(f);
    const indices = auswahlVon(f);
    const betroffen = indices.length ? felder.filter((_, i) => indices.includes(i)) : felder;
    if (betroffen.length === 0) return f.ausrichtung;
    if (betroffen.every((x) => x.quer)) return 'quer';
    if (betroffen.every((x) => !x.quer)) return 'hoch';
    return null; // gemischt
  };

  /**
   * Feld-Position in den Rahmen klemmen: es darf über den Rand hinausragen (dann
   * fallen Module weg — genau das wollte Genrih), aber nicht komplett verschwinden.
   */
  const klemmeFeld = (f: Flaeche, feld: BelegungsFeldM, xM: number, yM: number) => {
    const B = rahmenBreiteVon(f);
    const H = f.hoeheM;
    return {
      xM: Math.max(-feld.breiteM + MIN_SICHTBAR_M, Math.min(B - MIN_SICHTBAR_M, xM)),
      yM: Math.max(-feld.hoeheM + MIN_SICHTBAR_M, Math.min(H - MIN_SICHTBAR_M, yM)),
    };
  };

  /**
   * Fläche mit laufender Zieh-Geste (nur zum Rendern). Während des Ziehens wird
   * NICHT ins Projekt geschrieben: jede Projekt-Änderung serialisiert das ganze
   * Projekt inkl. Foto-DataURLs nach localStorage — das würde bei jedem
   * Mausschritt ruckeln. Commit passiert einmalig beim Loslassen.
   */
  const mitDrag = (f: Flaeche): Flaeche => {
    if (!drag || drag.flaecheId !== f.id) return f;
    const dx = drag.aktuell[0] - drag.start[0];
    const dy = drag.aktuell[1] - drag.start[1];
    if (drag.art === 'move') {
      return {
        ...f,
        felder: felderVon(f).map((feld, i) =>
          drag.indices.includes(i)
            ? { ...feld, ...klemmeFeld(f, feld, feld.xM + dx, feld.yM + dy) }
            : feld,
        ),
      };
    }
    if (drag.art === 'resize') {
      return {
        ...f,
        felder: felderVon(f).map((feld, i) => {
          if (i !== drag.index) return feld;
          // Schrittmaße aus der ENGINE — am Flachdach ist der Rasterschritt der
          // Gestell-Pitch (Süd 1,80/1,90 m; O/W 2,48 m = 2 Zell-Spalten je Schritt),
          // nicht das Modulmaß. Sonst verschöbe das Ziehen das ganze Gestell-Raster.
          const sm = feldSchrittmasse(felderInput(f, modul), feld.quer);
          const { rect, zellVersatz } = feldMitGriff(feld, drag.griff, dx, dy, sm.pitchXM, sm.pitchYM);
          return {
            ...feld,
            ...rect,
            leer: leerVerschoben(
              feld.leer,
              zellVersatz.col * sm.colsJeSchrittX,
              zellVersatz.row * sm.rowsJeSchrittY,
            ),
          };
        }),
      };
    }
    return f;
  };

  /**
   * Ausgewählte Felder um `schrittCm` bewegen (Pfeiltasten und Pfeil-Knöpfe).
   * Liest die Fläche über `frisch()`, damit gehaltene Pfeile jeden Schritt
   * wirklich weiterschieben statt immer wieder dieselbe Zielposition zu setzen.
   */
  const bewegeAuswahl = (fArg: Flaeche, sx: number, sy: number) => {
    const f = frisch(fArg);
    const indices = auswahlVon(f);
    if (indices.length === 0) return;
    const step = Math.max(0.01, schrittCm / 100);
    patchFlaeche(f.id, {
      felder: felderVon(f).map((feld, i) => {
        if (!indices.includes(i)) return feld;
        const k = klemmeFeld(f, feld, feld.xM + sx * step, feld.yM + sy * step);
        return { ...feld, xM: round2(k.xM), yM: round2(k.yM) };
      }),
    });
  };

  /**
   * Pfeiltasten der Tastatur bewegen die Auswahl. Gedrückthalten wiederholt sich
   * über den nativen Key-Repeat des Systems — jedes Event ist ein sichtbarer
   * Schritt, deshalb bewusst KEIN Debounce. Ohne Dep-Array registriert (wie im
   * Rest der Datei), damit die Closures immer frisch sind.
   */
  useEffect(() => {
    const f = projekt.flaechen.find((x) => x.id === auswahl?.flaecheId);
    if (!f || modusArt(f) !== null || auswahlVon(f).length === 0) return;
    const richtung: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const handler = (e: KeyboardEvent) => {
      const v = richtung[e.key];
      if (!v) return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName)) return;
      e.preventDefault();
      bewegeAuswahl(f, v[0], v[1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ---- Zeiger-Gesten im Felder-Werkzeug ----

  const onDownM = (f: Flaeche, p: PunktM) => {
    const felder = felderVon(f);
    // Griffe der AUSGEWÄHLTEN Felder haben Vorrang vor allem anderen — sie liegen
    // auf dem Feldrand, dort würde sonst sofort das Verschieben starten.
    for (const i of auswahlVon(f)) {
      const feld = felder[i];
      if (!feld) continue;
      for (const { id, p: gp } of griffPunkte(feld)) {
        if (Math.hypot(p[0] - gp[0], p[1] - gp[1]) <= GRIFF_FANG_M) {
          dragAktiv.current = true;
          setDrag({ art: 'resize', flaecheId: f.id, start: p, aktuell: p, index: i, griff: id });
          return;
        }
      }
    }
    // Oberstes Feld unter dem Zeiger gewinnt (später gezogen = weiter oben)
    let treffer = -1;
    for (let i = felder.length - 1; i >= 0; i--) {
      if (punktInRechteck(p, felder[i]!)) {
        treffer = i;
        break;
      }
    }
    dragAktiv.current = true;
    if (treffer < 0) {
      setDrag({ art: 'neu', flaecheId: f.id, start: p, aktuell: p });
      return;
    }
    // Feld aus der Auswahl angefasst → ganze Auswahl bewegen, sonst nur dieses
    const gewaehlt = auswahlVon(f);
    const indices = gewaehlt.includes(treffer) ? gewaehlt : [treffer];
    setDrag({ art: 'move', flaecheId: f.id, start: p, aktuell: p, indices });
  };

  const onUpM = (f: Flaeche, p: PunktM) => {
    if (!drag || drag.flaecheId !== f.id || !dragAktiv.current) return;
    dragAktiv.current = false;
    const weit = Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) >= KLICK_SCHWELLE_M;
    if (!weit) {
      // Klick: ins Leere = Auswahl aufheben; auf ein Feld = an-/abwählen;
      // auf einen Griff = nichts (Auswahl behalten, sonst verlöre man sie sofort)
      if (drag.art === 'neu') setAuswahl(null);
      else if (drag.art === 'move') {
        const i = drag.indices[drag.indices.length - 1]!;
        const alt = auswahlVon(f);
        const neu = alt.includes(i) ? alt.filter((x) => x !== i) : [...alt, i];
        setAuswahl(neu.length ? { flaecheId: f.id, indices: neu } : null);
      }
      setDrag(null);
      return;
    }
    if (drag.art === 'neu') {
      const rect = rechteckAus(drag.start, p);
      const { w, h } = modulMasse(modul, f.ausrichtung === 'quer');
      // Winziges Feld = Fehlgriff, kein Modul passt ohnehin rein
      if (rect.breiteM >= w / 2 && rect.hoeheM >= h / 2) {
        const felder = felderVon(f);
        patchFlaeche(f.id, {
          felder: [
            ...felder,
            {
              xM: round2(rect.xM),
              yM: round2(rect.yM),
              breiteM: round2(rect.breiteM),
              hoeheM: round2(rect.hoeheM),
              quer: f.ausrichtung === 'quer',
            },
          ],
        });
        setAuswahl({ flaecheId: f.id, indices: [felder.length] });
      }
    } else {
      // Verschieben/Größe-Ändern committen (Auswahl bleibt bestehen). Beim RESIZE
      // NICHT runden: die Kante ist exakt auf die Modulteilung eingerastet, und
      // cm-Rundung würde die Phase je Zug um Millimeter verziehen (summiert sich).
      const bewegt = mitDrag(f).felder ?? [];
      patchFlaeche(f.id, {
        felder: bewegt.map((feld, i) =>
          drag.art === 'move' && drag.indices.includes(i)
            ? { ...feld, xM: round2(feld.xM), yM: round2(feld.yM) }
            : feld,
        ),
      });
    }
    setDrag(null);
  };

  /**
   * Sicherheitsnetz gegen hängende Gesten (16.07.2026): Kommt das `pointerup`
   * nicht am SVG an — verlorener Pointer-Capture, Systemgeste, Fenster verlassen —,
   * bliebe der Drag ewig offen und die Belegung dauerhaft verschoben ANGEZEIGT,
   * obwohl der gespeicherte Stand ein anderer ist. Hier endet jede Geste, sobald
   * der Zeiger irgendwo losgelassen wird. Doppelaufruf ist über `dragAktiv` sicher.
   */
  useEffect(() => {
    if (!drag) return;
    const f = projekt.flaechen.find((x) => x.id === drag.flaecheId);
    if (!f) return;
    const ende = () => {
      if (dragAktiv.current) onUpM(f, drag.aktuell);
      else setDrag(null);
    };
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', ende);
    return () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
    };
  });

  /** Live-Vorschau beim Aufziehen: Rechteck + wie viele Module hineinpassen. */
  const vorschauFuer = (f: Flaeche) => {
    if (!drag || drag.flaecheId !== f.id || drag.art !== 'neu') return null;
    const rect = rechteckAus(drag.start, drag.aktuell);
    const probe: BelegungsFeldM = { ...rect, quer: f.ausrichtung === 'quer' };
    // Zählen lässt die ENGINE (SPEC §3.4) — die UI rechnet nicht selbst
    const anzahl = rasterFuer({ ...f, felder: [...felderVon(f), probe] }, modul).positionen.filter(
      (p) => p.feld === felderVon(f).length,
    ).length;
    return { rect, anzahl };
  };

  // ---- Aktionen ----

  const automatischFuellen = (f: Flaeche) => {
    const feld = vollFeldFuer(f, modul);
    if (feld.breiteM <= 0 || feld.hoeheM <= 0) return; // passt kein Modul
    if (felderVon(f).length > 0 && !window.confirm('Bestehende Felder ersetzen?')) return;
    patchFlaeche(f.id, { felder: [feld] });
    setAuswahl({ flaecheId: f.id, indices: [0] });
  };

  const alleFelderLoeschen = (f: Flaeche) => {
    if (!window.confirm(`Alle Belegungsfelder von „${f.name}" entfernen?`)) return;
    patchFlaeche(f.id, { felder: [] });
    setAuswahl(null);
  };

  const auswahlLoeschen = (f: Flaeche) => {
    const indices = auswahlVon(f);
    if (indices.length === 0) return;
    patchFlaeche(f.id, { felder: felderVon(f).filter((_, i) => !indices.includes(i)) });
    setAuswahl(null);
  };

  /**
   * Quer/Hochkant (16.07.2026, Genrih: „funktioniert nicht"): der Knopf dreht die
   * MODULE — sonst passiert beim Klicken sichtbar nichts. Sind Felder ausgewählt,
   * gilt es nur für die (gemischte Dächer bleiben möglich), sonst für alle. Der
   * Wert ist gleichzeitig die Ausrichtung für neu gezogene Felder.
   */
  const setzeAusrichtung = (f: Flaeche, ausrichtung: 'hoch' | 'quer') => {
    const quer = ausrichtung === 'quer';
    const indices = auswahlVon(f);
    const betroffen = (i: number) => indices.length === 0 || indices.includes(i);
    const geloeschteModule = felderVon(f).reduce(
      (sum, feld, i) => sum + (betroffen(i) && feld.quer !== quer ? (feld.leer?.length ?? 0) : 0),
      0,
    );
    if (
      geloeschteModule > 0 &&
      !window.confirm(
        `Ausrichtung ändern? ${geloeschteModule} einzeln abgeschaltete Module werden dabei wieder eingeschaltet.`,
      )
    ) return;
    patchFlaeche(f.id, {
      ausrichtung,
      felder: felderVon(f).map((feld, i) =>
        // leer verwerfen: nach dem Drehen meinen die Zellnummern andere Module
        betroffen(i) && feld.quer !== quer ? { ...feld, quer, leer: undefined } : feld,
      ),
    });
  };

  const leereZellen = (f: Flaeche, indices: number[]) =>
    indices.reduce((n, i) => n + (felderVon(f)[i]?.leer?.length ?? 0), 0);

  const zellenZurueckholen = (f: Flaeche, indices: number[]) =>
    patchFlaeche(f.id, {
      felder: felderVon(f).map((feld, i) => (indices.includes(i) ? { ...feld, leer: undefined } : feld)),
    });

  /**
   * „Module an/aus": angetipptes Modul abschalten — oder einen angetippten Geist
   * wieder anschalten (16.07.2026, Genrih). Toggle statt Einbahnstraße: vorher
   * konnte man ein versehentlich abgeschaltetes Modul nur alle-auf-einmal
   * zurückholen, weil die Lücke unsichtbar war.
   */
  const zelleToggle = (fArg: Flaeche, key: string) => {
    const f = frisch(fArg);
    const m = /^f(\d+):(-?\d+)-(-?\d+)$/.exec(key);
    if (!m) return;
    const fi = Number(m[1]);
    const zelle = `${m[2]}-${m[3]}`;
    const felder = felderVon(f);
    const feld = felder[fi];
    if (!feld) return;
    const aus = feld.leer?.includes(zelle) ?? false;
    const leer = aus
      ? (feld.leer ?? []).filter((z) => z !== zelle)
      : [...(feld.leer ?? []), zelle];
    patchFlaeche(f.id, {
      felder: felder.map((x, i) => (i === fi ? { ...x, leer: leer.length ? leer : undefined } : x)),
    });
  };

  const pfeilKlasse =
    'touch-target h-9 w-9 rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:border-akzent active:bg-akzent active:text-white disabled:opacity-40';
  const aktionKlasse =
    'touch-target inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-40';

  const klickM = (f: Flaeche, p: PunktM) => {
    if (!zeichnung || zeichnung.flaecheId !== f.id) return;
    if (zeichnung.art === 'umriss') {
      // Klick nahe am ersten Punkt schließt das Polygon (ab 3 Ecken)
      const schwelle = Math.max(0.25, 0.02 * Math.max(f.breiteM, f.hoeheM));
      const erster = zeichnung.punkte[0];
      if (
        zeichnung.punkte.length >= 3 &&
        erster &&
        Math.hypot(p[0] - erster[0], p[1] - erster[1]) <= schwelle
      ) {
        patchFlaeche(f.id, { umrissM: zeichnung.punkte });
        setZeichnung(null);
        return;
      }
      setZeichnung({ ...zeichnung, punkte: [...zeichnung.punkte, p] });
      return;
    }
    // Hindernis: 2 Klicks = gegenüberliegende Ecken; Modus bleibt aktiv für weitere
    if (zeichnung.punkte.length === 0) {
      setZeichnung({ ...zeichnung, punkte: [p] });
      return;
    }
    const [a] = zeichnung.punkte as [PunktM];
    const rect = rechteckAus(a, p);
    if (rect.breiteM > 0.02 && rect.hoeheM > 0.02) {
      patchFlaeche(f.id, { hindernisse: [...(f.hindernisse ?? []), rect] });
    }
    setZeichnung({ ...zeichnung, punkte: [] });
  };

  // Hauptdach und zugehörige Gauben bleiben im Vertriebsflow beieinander. Intern
  // sind die Gauben weiterhin eigenständige Ebenen; nur die UI-Reihenfolge wird
  // hierarchisch statt nach Erstellzeit aufgebaut (SPEC §4.3).
  const belegungsReihenfolge = flaechenInBelegungsReihenfolge(projekt.flaechen);

  return (
    <div className="space-y-4">
      <Karte className="border-akzent/30 bg-gradient-to-r from-white to-akzent/5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <span className="text-4xl font-bold text-slate-900">{fmtDe(kwp, 2)}</span>
            <span className="ml-1 text-lg font-semibold text-slate-500">kWp</span>
          </div>
          <div className="text-sm text-slate-500">
            {gesamt} Module · {modul.name}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              className="h-11 rounded-xl border border-akzent/40 bg-white px-4 text-sm font-semibold text-akzent hover:bg-akzent/5"
              onClick={fuegeHauptflaecheHinzu}
            >
              + Dachfläche
            </button>
            <ToggleButton aktiv={masseZeigen} onClick={() => setMasseZeigen((v) => !v)}>
              <IconMasse />
              {masseZeigen ? 'Maße an' : 'Maße aus'}
            </ToggleButton>
          </div>
        </div>
      </Karte>

      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) await fotoDateiGewaehlt(file);
        }}
      />

      <Karte className={projekt.fotos.length === 0 ? '!p-3' : ''}>
        <div
          className={`flex flex-wrap items-center gap-3 ${projekt.fotos.length === 0 ? '' : 'mb-3'}`}
        >
          <div>
            <KartenTitel>Belegungsfotos</KartenTitel>
            {projekt.fotos.length === 0 ? (
              <p className="text-sm text-slate-500">
                Fotos fügst du direkt bei der jeweiligen Dachfläche hinzu. Ohne Foto
                arbeitest du in der maßstäblichen Draufsicht.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Hier kannst du hochgeladene Bilder umbenennen, ersetzen oder löschen.
                Weitere Perspektiven fügst du direkt an der Dachfläche hinzu.
              </p>
            )}
          </div>
        </div>

        {projekt.fotos.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {projekt.fotos.map((foto) => {
              const verwendetVon = projekt.flaechen.filter(
                (f) =>
                  !f.gaubenTyp &&
                  fotoZuordnungenVon(f).some((z) => z.fotoId === foto.id),
              ).length;
              return (
                <section key={foto.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <input
                      value={foto.name}
                      aria-label="Name des Drohnenfotos"
                      onChange={(e) => {
                        const name = e.target.value;
                        aendereProjekt((p) => ({
                          ...p,
                          fotos: p.fotos.map((x) => (x.id === foto.id ? { ...x, name } : x)),
                        }));
                      }}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800"
                    />
                    <button
                      type="button"
                      className={aktionKlasse}
                      onClick={() => waehleFotoDatei({ art: 'ersetzen', fotoId: foto.id })}
                    >
                      Ersetzen
                    </button>
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                      onClick={() => loescheFoto(foto)}
                    >
                      Löschen
                    </button>
                  </div>

                  <div
                    className="mx-auto mb-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                    style={{
                      aspectRatio: `${foto.breitePx} / ${foto.hoehePx}`,
                      maxHeight: 300,
                      maxWidth: (300 * foto.breitePx) / foto.hoehePx,
                    }}
                  >
                    <ProjektFotoSvg projekt={projekt} foto={foto} beschriftung />
                  </div>
                  <p className="text-xs text-slate-400">
                    {verwendetVon === 0
                      ? 'Aktuell keiner Dachfläche zugeordnet'
                      : `In ${verwendetVon} ${verwendetVon === 1 ? 'Dachfläche' : 'Dachflächen'} verwendet`}
                  </p>
                </section>
              );
            })}
          </div>
        )}
      </Karte>

      {belegungsReihenfolge.map((f) => {
        const i = projekt.flaechen.indexOf(f);
        const fotoZuordnungen = fotoZuordnungenVon(f);
        const gewuenschteAnsicht = ansichtJeFlaeche[f.id];
        const fotoZuordnung =
          gewuenschteAnsicht === 'plan'
            ? undefined
            : fotoZuordnungVon(f, gewuenschteAnsicht) ?? fotoZuordnungen[0];
        const fotoId = fotoZuordnung?.fotoId;
        const fotoAsset = fotoId ? projektFotoVon(projekt, f, fotoId) : undefined;
        const foto = fotoId ? dachFotoVon(projekt, f, fotoId) : undefined;
        const fMitFoto: Flaeche = foto
          ? { ...f, foto, markierungFertig: fotoZuordnung?.markierungFertig }
          : f;
        const fEffBasis = mitDrag(f);
        const fEff: Flaeche = foto
          ? { ...fEffBasis, foto, markierungFertig: fotoZuordnung?.markierungFertig }
          : fEffBasis;
        const raster = rasterFuer(fEff, modul);
        const aktiv = aktiveModule(fEff, raster);
        const zeichneHier = zeichnung?.flaecheId === f.id ? zeichnung : null;
        // Umriss/Hindernis-Zeichnen in SchrittBelegung nur für die Draufsicht
        // (ohne Foto). Bei Foto passiert das in FotoHintergrund auf dem leeren Dach.
        const zeichenbar = !foto;
        // Belegung erst zeigen, wenn keine Foto-Markierung mehr läuft (Hindernisse
        // werden VORHER auf dem leeren Foto gesetzt, Genrih 07.07.).
        const belegungZeigen = !foto || !!fotoZuordnung?.markierungFertig || !!foto.traufePx;
        const felder = felderVon(fEff);
        const gewaehlt = auswahlVon(f);
        const gaubenAufFlaeche = projekt.flaechen.filter(
          (x) => x.elternFlaecheId === f.id && !!x.gaubenTyp,
        );
        // Felder-Werkzeug: aktiv, solange kein anderes Werkzeug und nichts gezeichnet wird
        const felderWerkzeug = modusArt(f) === null && !zeichneHier && belegungZeigen;
        const leerZahl = leereZellen(f, gewaehlt.length ? gewaehlt : felder.map((_, k) => k));

        const karte = (
          <Karte key={f.id} id={`belegung-${f.id}`}>
            {!f.gaubenTyp && (
              <FlaechenInlineEditor
                projekt={projekt}
                flaeche={f}
                index={i}
                onProjektChange={(neu) => {
                  projektRef.current = neu;
                  onChange(neu);
                  setAuswahl(null);
                  setDrag(null);
                }}
                onPatch={(patch) => patchGrunddaten(f.id, patch)}
                onFotoPruefen={
                  foto && belegungZeigen ? () => aktiviereFotoFokus(f.id) : undefined
                }
                fotoFokusAktiv={fotoFokusId === f.id}
                flaecheKwp={(aktiv * modul.pmaxW) / 1000}
                gesamtKwp={kwp}
                onLoeschen={
                  projekt.flaechen.filter((x) => !x.gaubenTyp).length > 1
                    ? () => loescheHauptflaeche(f)
                    : undefined
                }
              />
            )}
            <div
              data-testid={`arbeitsbereich-${f.id}`}
              className={belegungZeigen ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_21rem]' : ''}
            >
            <div
              role="toolbar"
              aria-label={`Werkzeuge für ${f.name}`}
              className={`${belegungZeigen ? 'sticky top-16 z-30 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:mb-0 lg:self-start' : 'relative z-10'} -mx-2 mb-3 rounded-xl border border-slate-300 bg-white/95 p-2 shadow-lg backdrop-blur`}
            >
              <div className={`min-w-0 flex flex-wrap items-center gap-2 ${belegungZeigen ? 'lg:flex-col lg:items-stretch' : ''}`}>
                {f.gaubenTyp && (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                    Gaube{f.gaubenSeite ? ` · ${f.gaubenSeite}` : ''}
                  </span>
                )}
                {f.gaubenTyp && <span className="text-sm font-semibold text-slate-800">{f.name}</span>}
                {!f.gaubenTyp && <label className="min-w-0 flex items-center gap-1.5 text-sm text-slate-500 lg:justify-between">
                  Ansicht
                  <select
                    aria-label={`Ansicht für ${f.name}`}
                    value={fotoId ?? 'plan'}
                    onChange={(e) => {
                      setAnsichtJeFlaeche((alt) => ({ ...alt, [f.id]: e.target.value }));
                      setAuswahl(null);
                      setDrag(null);
                      setZeichnung(null);
                      setModus(null);
                    }}
                    className="touch-target h-9 min-w-0 max-w-56 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700"
                  >
                    <option value="plan">Draufsicht</option>
                    {fotoZuordnungen.map((z, index) => {
                      const asset = projekt.fotos.find((x) => x.id === z.fotoId);
                      return asset ? (
                      <option key={z.fotoId} value={z.fotoId}>
                        Perspektive {index + 1} · {asset.name}
                      </option>
                      ) : null;
                    })}
                  </select>
                </label>}
                {!f.gaubenTyp && (
                  <button
                    type="button"
                    className={`touch-target inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-akzent/40 bg-akzent/5 px-3 text-sm font-semibold text-akzent hover:bg-akzent/10 ${belegungZeigen ? 'lg:w-full' : ''}`}
                    onClick={() =>
                      waehleFotoDatei({ art: 'perspektive', flaecheId: f.id })
                    }
                  >
                    <IconFoto />
                    {fotoZuordnungen.length === 0 ? 'Foto hinzufügen' : 'Weitere Perspektive'}
                  </button>
                )}
                {!f.gaubenTyp && projekt.fotos.some(
                  (x) => !fotoZuordnungen.some((z) => z.fotoId === x.id),
                ) && (
                  <select
                    value=""
                    aria-label={`Vorhandenes Foto für ${f.name} verwenden`}
                    onChange={(e) => {
                      if (e.target.value) fuegeFotoZuordnungHinzu(f.id, e.target.value);
                    }}
                    className={`touch-target h-9 max-w-60 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-600 ${belegungZeigen ? 'lg:w-full lg:max-w-none' : ''}`}
                  >
                    <option value="">Vorhandenes Foto verwenden …</option>
                    {projekt.fotos
                      .filter((x) => !fotoZuordnungen.some((z) => z.fotoId === x.id))
                      .map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                  </select>
                )}
                {!f.gaubenTyp && fotoId && (
                  <button
                    type="button"
                    className={`h-9 rounded-lg px-2 text-sm font-medium text-red-600 hover:bg-red-50 ${belegungZeigen ? 'lg:w-full' : ''}`}
                    onClick={() => loeseFotoZuordnung(f.id, fotoId)}
                  >
                    Perspektive entfernen
                  </button>
                )}
                <span className={`ml-auto rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white ${belegungZeigen ? 'lg:ml-0 lg:text-center' : 'whitespace-nowrap'}`}>
                  {aktiv} {aktiv === 1 ? 'Modul' : 'Module'} · {fmtDe((aktiv * modul.pmaxW) / 1000, 2)} kWp
                  {felder.length > 0 && ` · ${felder.length} ${felder.length === 1 ? 'Feld' : 'Felder'}`}
                </span>
              </div>

              {belegungZeigen && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 lg:flex-col lg:items-stretch">
                  <span className="hidden text-xs font-bold uppercase tracking-wide text-slate-400 lg:block">Werkzeuge</span>
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 lg:grid lg:grid-cols-2">
                    <WerkzeugKnopf
                      aktiv={modusArt(f) === null && !zeichneHier}
                      title="Felder aufziehen, auswählen und verschieben"
                      onClick={() => setzeModus(f, null)}
                    >
                      <IconFeld />
                      Bereiche
                    </WerkzeugKnopf>
                    <WerkzeugKnopf
                      aktiv={modusArt(f) === 'zellen'}
                      disabled={felder.length === 0}
                      title={felder.length === 0 ? 'Erst einen Belegungsbereich anlegen' : 'Einzelne Module an- oder ausschalten'}
                      onClick={() => setzeModus(f, modusArt(f) === 'zellen' ? null : 'zellen')}
                    >
                      <IconModulLoeschen />
                      Module
                    </WerkzeugKnopf>
                  </div>

                  {artVon(f) === 'flachdach' ? (
                    <span className="whitespace-nowrap text-sm text-slate-500 lg:text-center">
                      {f.flachdach?.aufstaenderung === 'ostwest'
                        ? `Ost-West ${f.flachdach.winkelDeg}° · quer`
                        : `Süd ${f.flachdach?.winkelDeg ?? 10}° · quer`}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 lg:grid lg:grid-cols-2">
                      <WerkzeugKnopf
                        aktiv={ausrichtungAktiv(fEff) === 'quer'}
                        title={gewaehlt.length > 0 ? `${gewaehlt.length} ausgewählte Felder quer legen` : 'Alle Module quer legen'}
                        onClick={() => setzeAusrichtung(f, 'quer')}
                      >
                        <IconModulQuer />
                        Quer
                      </WerkzeugKnopf>
                      <WerkzeugKnopf
                        aktiv={ausrichtungAktiv(fEff) === 'hoch'}
                        title={gewaehlt.length > 0 ? `${gewaehlt.length} ausgewählte Felder hochkant stellen` : 'Alle Module hochkant stellen'}
                        onClick={() => setzeAusrichtung(f, 'hoch')}
                      >
                        <IconModulHoch />
                        Hochkant
                      </WerkzeugKnopf>
                    </div>
                  )}

                  <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600 lg:justify-between">
                    Rand
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(randVon(f) * 100)}
                      onChange={(e) => {
                        const cm = Number.parseInt(e.target.value, 10);
                        if (!Number.isFinite(cm) || cm < 0) return;
                        patchFlaeche(f.id, { randM: cm / 100 });
                      }}
                      className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
                    />
                    cm
                  </label>

                  {zeichenbar && !zeichneHier && (
                    <>
                      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 lg:grid lg:grid-cols-2">
                        <WerkzeugKnopf aktiv={false} title="Dachumriss zeichnen" onClick={() => starteZeichnung(f, 'umriss')}>
                          <IconUmriss /> Umriss
                        </WerkzeugKnopf>
                        <WerkzeugKnopf aktiv={false} title="Kamin, Fenster oder SAT markieren" onClick={() => starteZeichnung(f, 'hindernis')}>
                          <IconHindernis /> Hindernis
                        </WerkzeugKnopf>
                      </div>
                      {f.umrissM && (
                        <button type="button" className={aktionKlasse} onClick={() => patchFlaeche(f.id, { umrissM: undefined })}>
                          Umriss entfernen ({f.umrissM.length})
                        </button>
                      )}
                      {(f.hindernisse ?? []).map((h, hi) => (
                        <button
                          key={hi}
                          type="button"
                          title="Hindernis entfernen"
                          className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300 lg:w-full"
                          onClick={() => patchFlaeche(f.id, { hindernisse: (f.hindernisse ?? []).filter((_, j) => j !== hi) })}
                        >
                          {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m ✕
                        </button>
                      ))}
                    </>
                  )}

                  <div className="ml-auto flex flex-wrap gap-2 lg:ml-0 lg:grid lg:grid-cols-1">
                    <button type="button" className={aktionKlasse} onClick={() => automatischFuellen(f)}>
                      <IconFeld /> Automatisch belegen
                    </button>
                    {felder.length > 0 && (
                      <button
                        type="button"
                        aria-label="Belegung entfernen"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                        title="Alle Belegungsfelder dieser Fläche entfernen"
                        onClick={() => alleFelderLoeschen(f)}
                      >
                        <IconLeeren /> Alles entfernen
                      </button>
                    )}
                  </div>
                </div>
              )}

              {belegungZeigen && zeichneHier && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-2 py-1.5 text-sm text-sky-900 lg:flex-col lg:items-stretch">
                  <strong>{zeichneHier.art === 'umriss' ? 'Umriss zeichnen' : 'Hindernis markieren'}</strong>
                  {zeichneHier.art === 'umriss' ? (
                    <button
                      type="button"
                      disabled={zeichneHier.punkte.length < 3}
                      className="h-9 rounded-lg bg-akzent px-3 font-semibold text-white disabled:opacity-40"
                      onClick={() => {
                        patchFlaeche(f.id, { umrissM: zeichneHier.punkte });
                        setZeichnung(null);
                      }}
                    >
                      ✓ Fertig ({zeichneHier.punkte.length})
                    </button>
                  ) : (
                    <button type="button" className={aktionKlasse} onClick={() => setZeichnung(null)}>✓ Fertig</button>
                  )}
                  {zeichneHier.art === 'umriss' && (
                    <button
                      type="button"
                      disabled={zeichneHier.punkte.length === 0}
                      className={aktionKlasse}
                      onClick={() => setZeichnung({ ...zeichneHier, punkte: zeichneHier.punkte.slice(0, -1) })}
                    >
                      ↶ Punkt zurück
                    </button>
                  )}
                  <button type="button" className={aktionKlasse} onClick={() => setZeichnung(null)}>Abbrechen</button>
                  <span>{zeichneHier.art === 'umriss' ? 'Ecke für Ecke am Dachrand entlang.' : zeichneHier.punkte.length === 0 ? 'Erste Ecke anklicken.' : 'Gegenüberliegende Ecke anklicken.'}</span>
                </div>
              )}

              {felderWerkzeug && felder.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-2 py-1.5 lg:flex-col lg:items-stretch">
                  <span className="text-sm font-semibold text-sky-900">
                    {gewaehlt.length > 0 ? `${gewaehlt.length} von ${felder.length} ausgewählt` : 'Feld antippen oder aufziehen'}
                  </span>
                  {gewaehlt.length < felder.length && (
                    <button
                      type="button"
                      className={aktionKlasse}
                      onClick={() => setAuswahl({ flaecheId: f.id, indices: felder.map((_, k) => k) })}
                    >
                      Alle auswählen
                    </button>
                  )}
                  {gewaehlt.length > 0 && (
                    <>
                      <div className="flex items-center gap-1 lg:justify-center" aria-label="Auswahl verschieben">
                        <HoldButton className={pfeilKlasse} title="nach links" onTrigger={() => bewegeAuswahl(f, -1, 0)}>←</HoldButton>
                        <HoldButton className={pfeilKlasse} title="nach oben" onTrigger={() => bewegeAuswahl(f, 0, -1)}>↑</HoldButton>
                        <HoldButton className={pfeilKlasse} title="nach unten" onTrigger={() => bewegeAuswahl(f, 0, 1)}>↓</HoldButton>
                        <HoldButton className={pfeilKlasse} title="nach rechts" onTrigger={() => bewegeAuswahl(f, 1, 0)}>→</HoldButton>
                      </div>
                      <label className="flex items-center gap-1 whitespace-nowrap text-sm text-slate-600 lg:justify-between">
                        Schritt
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={schrittCm}
                          onChange={(e) => {
                            const n = Number.parseInt(e.target.value, 10);
                            if (Number.isFinite(n) && n >= 1) setSchrittCm(n);
                          }}
                          className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                        />
                        cm
                      </label>
                      <button type="button" className={aktionKlasse} onClick={() => setAuswahl(null)}>Auswahl aufheben</button>
                      {leerZahl > 0 && (
                        <button type="button" className={aktionKlasse} onClick={() => zellenZurueckholen(f, gewaehlt)}>
                          Module zurückholen ({leerZahl})
                        </button>
                      )}
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                        onClick={() => auswahlLoeschen(f)}
                      >
                        🗑 Feld löschen{gewaehlt.length > 1 ? ` (${gewaehlt.length})` : ''}
                      </button>
                    </>
                  )}
                </div>
              )}

              {belegungZeigen && modusArt(f) === 'zellen' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-2 py-1.5 text-sm text-slate-700 lg:flex-col lg:items-stretch">
                  <strong>Module antippen zum An- oder Ausschalten.</strong>
                  {leerZahl > 0 && (
                    <button type="button" className={aktionKlasse} onClick={() => zellenZurueckholen(f, felder.map((_, k) => k))}>
                      Alle anschalten ({leerZahl})
                    </button>
                  )}
                  <button type="button" className={aktionKlasse} onClick={() => setzeModus(f, null)}>✓ Fertig</button>
                </div>
              )}
            </div>

            {/* Die Belegung ist das Arbeitsobjekt: Canvas vor Einstellungen und Sonderwerkzeugen. */}
            {!belegungZeigen ? null : (
              <div
                id={`foto-masse-${f.id}`}
                className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:col-start-1 lg:row-start-1 lg:mb-0"
              >
                <DachSvg
                  flaeche={fEff}
                  raster={raster}
                  modul={modul}
                  masse={masseZeigen}
                  maxHoehe={560}
                  felderAnzeige={felder.map((feld, k) => ({
                    rect: feld,
                    ausgewaehlt: gewaehlt.includes(k),
                  }))}
                  feldVorschau={vorschauFuer(f)}
                  geister={
                    modusArt(f) === 'zellen'
                      ? leerePositionenFuer(fEff, modul).map((p) => ({
                          key: posKey(p),
                          xM: p.xM,
                          yM: p.yM,
                          wM: p.wM,
                          hM: p.hM,
                        }))
                      : undefined
                  }
                  pointer={
                    felderWerkzeug
                      ? {
                          onDownM: (p) => onDownM(f, p),
                          onMoveM: (p) =>
                            setDrag((d) =>
                              !d || d.flaecheId !== f.id ? d : p ? { ...d, aktuell: p } : null,
                            ),
                          onUpM: (p) => onUpM(f, p),
                        }
                      : undefined
                  }
                  zeichnen={
                    zeichneHier
                      ? { aktiv: true, punkteM: zeichneHier.punkte, onKlickM: (p) => klickM(f, p) }
                      : undefined
                  }
                  onToggle={modusArt(f) === 'zellen' ? (key) => zelleToggle(f, key) : undefined}
                  fotoOverlay={
                    fotoAsset
                      ? (clipIdPrefix) =>
                          fotoFlaechenInhalt({
                            projekt,
                            foto: fotoAsset,
                            ausblendenId: f.id,
                            assetId: `modul-${f.id}`,
                            clipIdPrefix,
                          })
                      : undefined
                  }
                />
              </div>
            )}
            </div>

            {belegungZeigen && felder.length === 0 && !zeichneHier && (
              <p className="mb-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Ziehe einen Belegungsbereich direkt auf dem Dach auf oder nutze oben in der
                Werkzeugleiste „Automatisch belegen“.
              </p>
            )}

            {foto && !f.gaubenTyp && fotoZuordnungen[0]?.fotoId === fotoId && (
              <GaubenEditor
                eltern={fMitFoto}
                gauben={gaubenAufFlaeche}
                onErstellen={(daten) => erstelleGaube(f, fotoId, daten)}
                onLoeschen={(gruppenId) => loescheGaube(f.id, gruppenId)}
                onMasseAendern={aendereGaubenMasse}
                onMarkierungAendern={(gruppenId, markierung) =>
                  aendereGaubenMarkierung(f.id, gruppenId, markierung)
                }
              />
            )}

            {foto && fotoId && (
              <FotoHintergrund
                flaeche={fMitFoto}
                fotoVerwalten={false}
                zustandsKey={`${f.id}:${fotoAsset?.id ?? 'legacy'}`}
                geometrieBehalten={fotoZuordnungen.length > 1 || !!f.umrissM}
                onPatch={(patch) => patchFotoFlaeche(f, fotoId, patch)}
              />
            )}

            {belegungZeigen && felder.length > 0 && raster.positionen.length === 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Kein Modul passt — Feld zu klein oder außerhalb der nutzbaren Fläche (Randabstand{' '}
                {Math.round(randVon(f) * 100)} cm
                {umrissVon(f) ? ', Umriss' : ''}
                {(f.hindernisse?.length ?? 0) > 0 ? ', Hindernis' : ''}).
              </p>
            )}
            {belegungZeigen && (
              <p className="mt-2 text-xs text-slate-400">
                Randabstand {Math.round(randVon(f) * 100)} cm, Klemmfuge 20 mm
                {f.umrissM ? `, Umriss mit ${f.umrissM.length} Ecken` : ''}
                {foto ? ' · Kamin/Fenster/SAT über „✎ Markierung ändern" aufs leere Foto setzen.' : ''}
              </p>
            )}
          </Karte>
        );
        if (!f.gaubenTyp) return karte;
        const gruppenGeschwister = projekt.flaechen.filter(
          (x) =>
            x.gaubenTyp &&
            (x.gaubenGruppeId ?? x.id) === (f.gaubenGruppeId ?? f.id),
        );
        const ersteSeite = gruppenGeschwister[0]?.id === f.id;
        const gruppeId = f.gaubenGruppeId ?? f.id;
        const gaubenGruppen = Array.from(
          new Set(
            projekt.flaechen
              .filter((x) => x.gaubenTyp && x.elternFlaecheId === f.elternFlaecheId)
              .map((x) => x.gaubenGruppeId ?? x.id),
          ),
        );
        const gaubenNummer = Math.max(1, gaubenGruppen.indexOf(gruppeId) + 1);
        return (
          <details
            key={f.id}
            data-gauben-gruppe={gruppeId}
            className={`rounded-xl border border-sky-200 bg-sky-50/60 p-2 ${
              ersteSeite ? 'mt-2' : '-mt-3'
            }`}
          >
            <summary className="sticky top-16 z-20 cursor-pointer rounded-lg bg-sky-50 px-2 py-2 text-sm font-semibold text-sky-900">
              {ersteSeite
                ? `Gaube ${gaubenNummer} belegen · ${f.gaubenTyp === 'satteldach' ? 'Satteldach' : 'Flachdach'}`
                : `Gaube ${gaubenNummer} · zweite Dachseite`}{' '}
              · {aktiv} {aktiv === 1 ? 'Modul' : 'Module'} ·{' '}
              {fmtDe((aktiv * modul.pmaxW) / 1000, 2)} kWp Fläche · {fmtDe(kwp, 2)} kWp Gesamt
            </summary>
            <div className="mt-2">{karte}</div>
          </details>
        );
      })}
    </div>
  );
}
