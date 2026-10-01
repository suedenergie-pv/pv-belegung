'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from 'react';
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
  massFreigabe,
  modulById,
  modulMasse,
  naechsteZone,
  neueFlaeche,
  neueGaubenFlaeche,
  neueFotoId,
  patchFlaechenGeometrie,
  projektFotoVon,
  perspektiveQuelle,
  rahmenBreiteVon,
  randVon,
  rasterFuer,
  umrissVon,
  vollFeldFuer,
  type Flaeche,
  type FotoZuordnung,
  type Projekt,
  type ProjektFoto,
  type PunktM,
  type RechteckM,
} from '../lib/model';
import { DachSvg, ModulAsset, griffPunkte, type GriffId } from './DachSvg';
import { FlaechenInlineEditor } from './FlaechenInlineEditor';
import { FotoHintergrund } from './FotoHintergrund';
import { useTouchBedienung } from '../lib/touch-bedienung';
import {
  aktualisiereGaubenAussparungen,
  wendeGaubenMarkierungAn,
} from '../lib/gauben-geometrie';
import {
  pruefePerspektive,
  traufeWechseln,
  type Ecken,
  type PerspektivPruefung,
} from '../lib/foto-geometrie';
import {
  GaubenEditor,
  type AktualisierteGaubenMarkierung,
  type NeueGaubeAusFoto,
} from './GaubenEditor';
import { fotoFlaechenInhalt } from './GesamtSvg';
import {
  IconFoto,
  IconModulHoch,
  IconModulQuer,
} from './icons';
import { HoldButton } from './ui';
import { LokaleProjektHistorie, useProjektHistorie } from '../lib/projekt-historie-context';
import { useEditorSitzung, STANDARD_ANSICHT } from '../lib/editor-sitzung';
import { useEntwurfNavigation } from '../lib/entwurf-navigation';
import { EditorViewport, type FotoPunktSteuerung } from './EditorViewport';
import { WorkbenchIcon } from './WorkbenchIcon';
import styles from './FotoEditor.module.css';

/**
 * Werkzeuge der Belegung (16.07.2026, Genrih: „Belegungsautomatismus mildern").
 * null = AUSWAHL (Standard): ausschließlich Felder auswählen und verschieben.
 * 'feld_neu' = ein weiteres Feld aufziehen, auch über einem bestehenden Feld.
 * 'zellen' = einzelne Module im Feld antippen und dauerhaft entfernen.
 */
type WerkzeugArt = 'feld_neu' | 'zellen';

type FotoUploadZiel =
  | { art: 'ersetzen'; fotoId: string }
  | { art: 'perspektive'; flaecheId: string };

type FotoUploadStatus =
  | { status: 'bereit' }
  | { status: 'laden'; ziel: FotoUploadZiel }
  | { status: 'fehler'; ziel: FotoUploadZiel; grund: string }
  | { status: 'erfolg'; meldung: string };

/** Nicht gespeicherter Hauptdach-Entwurf; Module verwenden nur `letzteGueltige`. */
interface PerspektivEntwurf {
  flaecheId: string;
  fotoId: string;
  roh: Ecken;
  letzteGueltige: Ecken;
  pruefung: PerspektivPruefung;
  ausgewaehlt: number;
}

const kopiereEcken = (ecken: Ecken): Ecken =>
  ecken.map(([x, y]) => [x, y] as [number, number]) as Ecken;

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

export function SchrittBelegung(props: { projekt: Projekt; onChange: (p: Projekt) => void }) {
  const historie = useProjektHistorie();
  return historie ? <SchrittBelegungInhalt {...props} /> : (
    <LokaleProjektHistorie {...props}>
      {(onChange) => <SchrittBelegungInhalt {...props} onChange={onChange} />}
    </LokaleProjektHistorie>
  );
}

function SchrittBelegungInhalt({ projekt, onChange }: { projekt: Projekt; onChange: (p: Projekt) => void }) {
  const historie = useProjektHistorie()!;
  const navigation = useEntwurfNavigation();
  const [touchBedienung, aktiviereTouch, deaktiviereTouch] = useTouchBedienung();
  const [perspektivCursor, setPerspektivCursor] = useState<[number, number]>([0, 0]);
  const [perspektivGriff, setPerspektivGriff] = useState<number | null>(null);
  const [sitzung, patchSitzung] = useEditorSitzung();
  const { ansichtJeFlaeche, modus, auswahl } = sitzung;
  const setAnsichtJeFlaeche = (aktion: SetStateAction<Record<string, string>>) => patchSitzung((alt) => ({ ansichtJeFlaeche: typeof aktion === 'function' ? aktion(alt.ansichtJeFlaeche) : aktion }));
  const setModus = (modus: { art: WerkzeugArt; flaecheId: string } | null) => patchSitzung({ modus, verschieben: false });
  const setAuswahl = (auswahl: { flaecheId: string; indices: number[] } | null) => patchSitzung({ auswahl });
  const modul = modulById(projekt.modulId);
  // Maße einblenden — beim Kunden vor Ort abschaltbar (Genrih 07.07.)
  const [masseZeigen, setMasseZeigen] = useState(false);
  const [massVorschlag, setMassVorschlag] = useState<{ flaecheId: string; masse: { breiteM: number; hoeheM: number } } | null>(null);
  /** Aktive Foto-Perspektive je Fläche. */
  // Aktives Werkzeug (exklusiv je Fläche); null = Felder-Werkzeug (Standard)
  // Schrittweite der Pfeil-Bewegung in cm
  const [schrittCm, setSchrittCm] = useState(10);
  // Ausgewählte Felder (Indices in Flaeche.felder) — Mehrfachauswahl per Antippen
  const [geometrieVorschau, setGeometrieVorschau] = useState<Flaeche | null>(null);
  const [zweiPunkte, setZweiPunkte] = useState(false);
  const [ersteFeldEcke, setErsteFeldEcke] = useState<PunktM | null>(null);
  const [gesteAbbruchRevision, setGesteAbbruchRevision] = useState(0);
  const [markierungsRevision, setMarkierungsRevision] = useState(0);
  // Laufende Zeiger-Geste (Aufziehen/Verschieben) — NICHT im Projekt, s. mitDrag()
  const [drag, setDrag] = useState<Drag | null>(null);
  const [perspektivEntwurf, setPerspektivEntwurf] = useState<PerspektivEntwurf | null>(null);
  const [gaubenBearbeitung, setGaubenBearbeitung] = useState<{ elternId: string; gruppenId: string } | null>(null);
  const [gaubenStatus, setGaubenStatus] = useState('');
  /**
   * Läuft gerade eine Geste? Als Ref, damit `onUpM` doppelt aufgerufen werden darf
   * (SVG-Handler + Sicherheitsnetz unten) und trotzdem genau EINMAL committet — ein
   * zweiter Commit würde das Delta ein zweites Mal aufaddieren.
   */
  const dragAktiv = useRef(false);
  /** Letzter gültiger Zeigerpunkt; bleibt auch zwischen zwei gedrosselten Renders frisch. */
  const dragPunkt = useRef<PunktM | null>(null);
  /** Höchstens ein React-Render je Browserframe, auch bei hochfrequenten Pointer-Events. */
  const dragFrame = useRef<number | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const fotoZielRef = useRef<FotoUploadZiel | null>(null);
  const [fotoUpload, setFotoUpload] = useState<FotoUploadStatus>({ status: 'bereit' });

  const { gesamt, kwp } = useMemo(() => {
    const anzahl = projekt.flaechen.reduce(
      (sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)),
      0,
    );
    return { gesamt: anzahl, kwp: (anzahl * modul.pmaxW) / 1000 };
  }, [projekt, modul]);

  const stoppeDragFrame = () => {
    if (dragFrame.current !== null && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(dragFrame.current);
    }
    dragFrame.current = null;
  };

  const verwerfeGeste = () => {
    stoppeDragFrame();
    dragAktiv.current = false;
    dragPunkt.current = null;
    setDrag(null);
    setErsteFeldEcke(null);
  };

  const starteDrag = (neu: Drag) => {
    stoppeDragFrame();
    dragPunkt.current = neu.aktuell;
    dragAktiv.current = true;
    setDrag(neu);
  };

  const aktualisiereDrag = (flaecheId: string, p: PunktM) => {
    dragPunkt.current = p;
    const render = () => {
      dragFrame.current = null;
      const aktuell = dragPunkt.current;
      if (!aktuell) return;
      setDrag((alt) =>
        !alt || alt.flaecheId !== flaecheId ? alt : { ...alt, aktuell },
      );
    };
    if (typeof window.requestAnimationFrame !== 'function') {
      render();
      return;
    }
    if (dragFrame.current === null) dragFrame.current = window.requestAnimationFrame(render);
  };

  useEffect(() => () => stoppeDragFrame(), []);

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
    const vorher = projektRef.current;
    const neu = fn(vorher);
    projektRef.current = neu;
    onChange(neu);
  };

  const letzteHistorienRevision = useRef(historie.revision);
  useEffect(() => {
    if (letzteHistorienRevision.current === historie.revision) return;
    letzteHistorienRevision.current = historie.revision;
    setAuswahl(null);
    verwerfeGeste();
    setModus(null);
    setPerspektivEntwurf(null);
    setGaubenBearbeitung(null);
  }, [historie.revision]);

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
    patchSitzung({ aktiveFlaecheId: neu.id, panel: 'fotos', auswahl: null, modus: null });
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

  const waehleFotoDatei = (ziel: FotoUploadZiel) => {
    if (fotoUpload.status === 'laden') return;
    fotoZielRef.current = ziel;
    fotoInputRef.current?.click();
  };

  const fotoDateiGewaehlt = async (file: File) => {
    const ziel = fotoZielRef.current;
    if (!ziel) return;
    setFotoUpload({ status: 'laden', ziel });
    let bild: Awaited<ReturnType<typeof dateiZuBild>>;
    try {
      bild = await dateiZuBild(file);
    } catch (fehler) {
      setFotoUpload({
        status: 'fehler',
        ziel,
        grund: fehler instanceof Error ? fehler.message : 'Das Foto konnte nicht geladen werden.',
      });
      return;
    }
    fotoZielRef.current = null;
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
                  ? {
                      fotoId: zielId,
                      traufePx: null,
                      markierungFertig: false,
                      perspektiveBestaetigt: false,
                    }
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
              {
                fotoId: id,
                traufePx: null,
                markierungFertig: false,
                perspektiveBestaetigt: false,
              },
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
      setModus(null);
    }
    if (ziel.art === 'perspektive') patchSitzung({ panel: '' });
    setFotoUpload({ status: 'erfolg', meldung: 'Foto wurde verarbeitet und dem Projekt hinzugefügt.' });
  };

  /** Eine weitere Perspektive derselben Fläche anlegen. */
  const fuegeFotoZuordnungHinzu = (flaecheId: string, fotoId: string) => {
    setAuswahl(null);
    setDrag(null);
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
          : [...bisher, {
              fotoId,
              traufePx: null,
              markierungFertig: false,
              perspektiveBestaetigt: false,
            }];
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
    setAnsichtJeFlaeche((alt) => ({ ...alt, [flaecheId]: '' }));
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
        if (foto?.perspektiveBestaetigt !== undefined) {
          z.perspektiveBestaetigt = foto.perspektiveBestaetigt;
        } else if (foto) {
          delete z.perspektiveBestaetigt;
        }
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
      const geometrieGeaendert =
        rest.breiteM !== undefined ||
        rest.hoeheM !== undefined ||
        rest.dachform !== undefined ||
        rest.firstBreiteM !== undefined ||
        rest.firstVersatzM !== undefined;
      const aktualisiert = geometrieGeaendert
        ? patchFlaechenGeometrie(aktuell, neu)
        : { ...aktuell, ...neu };
      return {
        ...p,
        flaechen: p.flaechen.map((x) => (x.id === aktuell.id ? aktualisiert : x)),
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
        massStatus: 'bestaetigt' as const,
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
            perspektiveBestaetigt: !!eckenPx,
            ...(eckenPx ? { eckenPx } : {}),
          }],
        };
        // Sofortige Vorschau: ein Feld über die ganze neue Gaubenfläche.
        const feld = vollFeldFuer(kind, modul);
        kind.felder =
          feld.breiteM > 0 && feld.hoeheM > 0 && rasterFuer({ ...kind, felder: [feld] }, modul).positionen.length > 0
            ? [feld]
            : [];
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
    const stand = projektRef.current;
    const gruppe = stand.flaechen.filter(
      (f) => (f.gaubenGruppeId ?? f.id) === gruppeId && !!f.gaubenTyp,
    );
    if (gruppe.length === 0) return;
    const satteldach = gruppe.some((f) => f.gaubenTyp === 'satteldach');
    const modulzahl = gruppe.reduce(
      (summe, f) => summe + aktiveModule(f, rasterFuer(f, modul)),
      0,
    );
    const stringzahl = stand.mppts
      .flat()
      .filter((s) => gruppe.some((f) => f.id === s.flaecheId)).length;
    const text = satteldach
      ? `Satteldachgaube vollständig löschen? Beide Dachseiten, ${modulzahl} aktive Module, Belegungsfelder, die gekoppelte Aussparung im Hauptdach und ${stringzahl} Stringzuordnung${stringzahl === 1 ? '' : 'en'} werden entfernt. Das gemeinsame Foto bleibt erhalten. Rückgängig ist danach möglich.`
      : `Flachdachgaube vollständig löschen? ${modulzahl} aktive Module, Belegungsfelder, die gekoppelte Aussparung im Hauptdach und ${stringzahl} Stringzuordnung${stringzahl === 1 ? '' : 'en'} werden entfernt. Das gemeinsame Foto bleibt erhalten. Rückgängig ist danach möglich.`;
    if (!window.confirm(text)) return;
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
                }
              : f,
          ),
        mppts: p.mppts.map((strings) => strings.filter((s) => !ids.has(s.flaecheId))),
      };
    });
    setGaubenBearbeitung(null);
    setGaubenStatus('Gaube gelöscht. Rückgängig stellt die vollständige Gaubengruppe wieder her.');
  };

  const aendereGaubenMarkierung = (
    elternId: string,
    gruppeId: string,
    markierung: AktualisierteGaubenMarkierung,
  ) => {
    aendereProjekt((p) => {
      const eltern = p.flaechen.find((f) => f.id === elternId);
      const fotoId = eltern ? fotoZuordnungenVon(eltern)[0]?.fotoId : undefined;
      if (!fotoId) return p;
      const angewendet = wendeGaubenMarkierungAn(p, elternId, gruppeId, fotoId, markierung);
      return angewendet.ok ? angewendet.projekt : p;
    });
  };

  const starteGaubenBearbeitung = (elternId: string, gruppenId: string) => {
    setGaubenBearbeitung({ elternId, gruppenId });
    window.setTimeout(() => {
      document.getElementById(`gauben-editor-${elternId}`)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 0);
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
        // Eine bestätigte Seite ist kein Messnachweis für ihre Nachbarseite.
        if (f.id !== flaecheId) return f;
        const neu = patchFlaechenGeometrie(f, { breiteM, hoeheM, gaubenMessung: messung });
        return massFreigabe(neu).gueltig ? { ...neu, massStatus: 'bestaetigt' } : f;
      }),
    }));
  };

  /** Fläche im AKTUELLEN Stand (nicht der gerenderten Closure) — für Wiederhol-Aktionen. */
  const frisch = (f: Flaeche): Flaeche => projektRef.current.flaechen.find((x) => x.id === f.id) ?? f;

  const modusArt = (f: Flaeche): WerkzeugArt | null =>
    modus?.flaecheId === f.id ? modus.art : null;

  /**
   * Werkzeug wechseln. Laufende Feldgesten verwerfen, Auswahl aufheben.
   * Geometrieentwürfe werden vor dem Aufruf durch EntwurfNavigation geschützt.
   */
  const setzeModus = (f: Flaeche, art: WerkzeugArt | null) => {
    setModus(art ? { art, flaecheId: f.id } : null);
    setAuswahl(null);
    verwerfeGeste();
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
    const betroffen = felder.filter((_, i) => indices.includes(i));
    if (betroffen.length === 0) return f.ausrichtung;
    if (betroffen.every((x) => x.quer)) return 'quer';
    if (betroffen.every((x) => !x.quer)) return 'hoch';
    return null; // gemischt
  };

  const perspektivePruefen = (flaeche: Flaeche, ecken: Ecken) =>
    pruefePerspektive(
      rahmenBreiteVon(flaeche),
      flaeche.hoeheM,
      ecken,
      perspektiveQuelle(flaeche),
    );

  const startePerspektivBearbeitung = (flaeche: Flaeche, fotoId: string) => {
    const ecken = fotoZuordnungVon(flaeche, fotoId)?.eckenPx;
    if (!ecken) return;
    const bild = dachFotoVon(projektRef.current, flaeche, fotoId);
    setPerspektivCursor([bild ? bild.breitePx / 2 : ecken[0][0], bild ? bild.hoehePx / 2 : ecken[0][1]]);
    setPerspektivGriff(null);
    const roh = kopiereEcken(ecken);
    setPerspektivEntwurf({
      flaecheId: flaeche.id,
      fotoId,
      roh,
      letzteGueltige: kopiereEcken(ecken),
      pruefung: perspektivePruefen(flaeche, roh),
      ausgewaehlt: 0,
    });
    setAuswahl(null);
    setDrag(null);
    setModus(null);
  };

  const aenderePerspektivEntwurf = (ecken: Ecken) => {
    setPerspektivEntwurf((alt) => {
      if (!alt) return alt;
      const flaeche = projektRef.current.flaechen.find((f) => f.id === alt.flaecheId);
      if (!flaeche) return null;
      const roh = kopiereEcken(ecken);
      const pruefung = perspektivePruefen(flaeche, roh);
      return {
        ...alt,
        roh,
        pruefung,
        letzteGueltige:
          pruefung.status === 'fehler' ? alt.letzteGueltige : kopiereEcken(roh),
      };
    });
  };

  const speicherePerspektivEntwurf = () => {
    const entwurf = perspektivEntwurf;
    if (!entwurf || entwurf.pruefung.status === 'fehler') return;
    const flaeche = projektRef.current.flaechen.find((f) => f.id === entwurf.flaecheId);
    const foto = flaeche ? dachFotoVon(projektRef.current, flaeche, entwurf.fotoId) : undefined;
    const zuordnung = flaeche ? fotoZuordnungVon(flaeche, entwurf.fotoId) : undefined;
    if (!flaeche || !foto || !zuordnung) return;
    patchFotoFlaeche(flaeche, entwurf.fotoId, {
      foto: {
        ...foto,
        eckenPx: kopiereEcken(entwurf.roh),
        perspektiveBestaetigt: true,
      },
      markierungFertig: zuordnung.markierungFertig,
    });
    setPerspektivEntwurf(null);
  };

  const markierePerspektiveKomplettNeu = () => {
    const entwurf = perspektivEntwurf;
    if (!entwurf) return;
    if (!window.confirm('Perspektive komplett neu markieren? Die aktuelle Vierpunkt-Markierung wird erst jetzt entfernt; Belegungsfelder und Hindernisse bleiben erhalten.')) return;
    const flaeche = projektRef.current.flaechen.find((f) => f.id === entwurf.flaecheId);
    const foto = flaeche ? dachFotoVon(projektRef.current, flaeche, entwurf.fotoId) : undefined;
    if (!flaeche || !foto) return;
    setPerspektivEntwurf(null);
    patchFotoFlaeche(flaeche, entwurf.fotoId, {
      foto: { ...foto, eckenPx: undefined, perspektiveBestaetigt: false },
      markierungFertig: false,
    });
  };

  /**
   * Fläche mit laufender Zieh-Geste (nur zum Rendern). Während des Ziehens wird
   * NICHT ins Projekt geschrieben: so entstehen weder Speicherarbeit noch ein
   * eigener Rückgängig-Schritt für jedes Pointer-Event. Der Commit passiert
   * einmalig beim Loslassen.
   */
  const mitDrag = (f: Flaeche, dragStand: Drag | null = drag): Flaeche => {
    if (!dragStand || dragStand.flaecheId !== f.id) return f;
    const dx = dragStand.aktuell[0] - dragStand.start[0];
    const dy = dragStand.aktuell[1] - dragStand.start[1];
    if (dragStand.art === 'move') {
      return {
        ...f,
        felder: felderVon(f).map((feld, i) =>
          dragStand.indices.includes(i)
            ? { ...feld, xM: feld.xM + dx, yM: feld.yM + dy }
            : feld,
        ),
      };
    }
    if (dragStand.art === 'resize') {
      return {
        ...f,
        felder: felderVon(f).map((feld, i) => {
          if (i !== dragStand.index) return feld;
          // Schrittmaße aus der ENGINE — am Flachdach ist der Rasterschritt der
          // Gestell-Pitch (Süd 1,80/1,90 m; O/W 2,48 m = 2 Zell-Spalten je Schritt),
          // nicht das Modulmaß. Sonst verschöbe das Ziehen das ganze Gestell-Raster.
          const sm = feldSchrittmasse(felderInput(f, modul), feld.quer);
          const { rect, zellVersatz } = feldMitGriff(feld, dragStand.griff, dx, dy, sm.pitchXM, sm.pitchYM);
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
        return {
          ...feld,
          xM: round2(feld.xM + sx * step),
          yM: round2(feld.yM + sy * step),
        };
      }),
    });
  };

  /** Shift + Pfeil ändert die rechte/untere Kante der ausgewählten Felder. */
  const skaliereAuswahl = (fArg: Flaeche, sx: number, sy: number) => {
    const f = frisch(fArg);
    const indices = auswahlVon(f);
    if (indices.length === 0) return;
    const step = Math.max(0.01, schrittCm / 100);
    patchFlaeche(f.id, {
      felder: felderVon(f).map((feld, index) => {
        if (!indices.includes(index)) return feld;
        return {
          ...feld,
          breiteM: Math.max(MIN_FELD_M, feld.breiteM + sx * step),
          hoeheM: Math.max(MIN_FELD_M, feld.hoeheM + sy * step),
        };
      }),
    });
  };

  // ---- Zeiger-Gesten im Felder-Werkzeug ----

  const onDownM = (f: Flaeche, p: PunktM, nurNeuesFeld = false) => {
    if (!massFreigabe(f).belegen) return;
    // Der ausdrückliche Zeichenmodus muss auch dann ein neues Feld beginnen,
    // wenn der Startpunkt in einem vorhandenen Feld liegt. Sonst wäre bei einem
    // großen ersten Feld kein zweites Rechteck mehr möglich.
    if (nurNeuesFeld) {
      starteDrag({ art: 'neu', flaecheId: f.id, start: p, aktuell: p });
      return;
    }
    const felder = felderVon(f);
    // Griffe der AUSGEWÄHLTEN Felder haben Vorrang vor allem anderen — sie liegen
    // auf dem Feldrand, dort würde sonst sofort das Verschieben starten.
    for (const i of auswahlVon(f)) {
      const feld = felder[i];
      if (!feld) continue;
      for (const { id, p: gp } of griffPunkte(feld)) {
        if (Math.hypot(p[0] - gp[0], p[1] - gp[1]) <= GRIFF_FANG_M) {
          starteDrag({ art: 'resize', flaecheId: f.id, start: p, aktuell: p, index: i, griff: id });
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
    if (treffer < 0) {
      setAuswahl(null);
      return;
    }
    // Feld aus der Auswahl angefasst → ganze Auswahl bewegen, sonst nur dieses
    const gewaehlt = auswahlVon(f);
    const indices = gewaehlt.includes(treffer) ? gewaehlt : [treffer];
    starteDrag({ art: 'move', flaecheId: f.id, start: p, aktuell: p, indices });
  };

  const onUpM = (f: Flaeche, p: PunktM) => {
    if (!drag || drag.flaecheId !== f.id || !dragAktiv.current) return;
    dragAktiv.current = false;
    stoppeDragFrame();
    dragPunkt.current = p;
    const dragAmEnde = { ...drag, aktuell: p } as Drag;
    const weit = Math.hypot(p[0] - dragAmEnde.start[0], p[1] - dragAmEnde.start[1]) >= KLICK_SCHWELLE_M;
    if (!weit) {
      // Klick: ins Leere = Auswahl aufheben; auf ein Feld = an-/abwählen;
      // auf einen Griff = nichts (Auswahl behalten, sonst verlöre man sie sofort)
      if (dragAmEnde.art === 'neu') setAuswahl(null);
      else if (dragAmEnde.art === 'move') {
        const i = dragAmEnde.indices[dragAmEnde.indices.length - 1]!;
        const alt = auswahlVon(f);
        const neu = alt.includes(i) ? alt.filter((x) => x !== i) : [...alt, i];
        setAuswahl(neu.length ? { flaecheId: f.id, indices: neu } : null);
      }
      dragPunkt.current = null;
      setDrag(null);
      return;
    }
    if (dragAmEnde.art === 'neu') {
      const rect = rechteckAus(dragAmEnde.start, p);
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
        // Nach dem Aufziehen direkt zurück zur Auswahl: Das neue Feld lässt sich
        // sofort verschieben/vergrößern; für das nächste genügt erneut „+ Feld“.
        setModus(null);
      }
    } else {
      // Verschieben/Größe-Ändern committen (Auswahl bleibt bestehen). Beim RESIZE
      // NICHT runden: die Kante ist exakt auf die Modulteilung eingerastet, und
      // cm-Rundung würde die Phase je Zug um Millimeter verziehen (summiert sich).
      const bewegt = mitDrag(f, dragAmEnde).felder ?? [];
      patchFlaeche(f.id, {
        felder: bewegt.map((feld, i) =>
          dragAmEnde.art === 'move' && dragAmEnde.indices.includes(i)
            ? { ...feld, xM: round2(feld.xM), yM: round2(feld.yM) }
            : feld,
        ),
      });
    }
    dragPunkt.current = null;
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
      if (dragAktiv.current) onUpM(f, dragPunkt.current ?? drag.aktuell);
      else setDrag(null);
    };
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', verwerfeGeste);
    return () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', verwerfeGeste);
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
    if (!massFreigabe(f).belegen) return;
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
   * MODULE ausschließlich in der ausdrücklich ausgewählten Feldmenge.
   * Die Vorgabe neuer Felder bleibt davon unabhängig.
   */
  const setzeAusrichtung = (f: Flaeche, ausrichtung: 'hoch' | 'quer') => {
    const quer = ausrichtung === 'quer';
    const indices = auswahlVon(f);
    if (indices.length === 0) return;
    const betroffen = (i: number) => indices.includes(i);
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

  // Hauptdach und zugehörige Gauben bleiben im Vertriebsflow beieinander. Intern
  // sind die Gauben weiterhin eigenständige Ebenen; nur die UI-Reihenfolge wird
  // hierarchisch statt nach Erstellzeit aufgebaut (SPEC §4.3).
  const belegungsReihenfolge = useMemo(
    () => flaechenInBelegungsReihenfolge(projekt.flaechen),
    [projekt.flaechen],
  );

  const f = belegungsReihenfolge.find((x) => x.id === sitzung.aktiveFlaecheId) ?? belegungsReihenfolge[0];
  const wechsleFlaeche = (id: string) => navigation.weiter(() => {
    verwerfeGeste();
    setGeometrieVorschau(null);
    setPerspektivEntwurf(null);
    patchSitzung({ aktiveFlaecheId: id, panel: '', auswahl: null, modus: null, verschieben: false });
  });
  const oeffnePanel = (panel: string, werkzeugStart = false) => navigation.weiter(() => {
    verwerfeGeste();
    setGeometrieVorschau(null);
    setPerspektivEntwurf(null);
    if (werkzeugStart) setMarkierungsRevision((revision) => revision + 1);
    patchSitzung({ panel: !werkzeugStart && sitzung.panel === panel ? '' : panel, verschieben: false, auswahl: null, modus: null });
  });

  useEffect(() => {
    if (!['gauben', 'umriss', 'aussparungen'].includes(sitzung.panel)) return;
    if (window.matchMedia('(max-width: 600px), (max-height: 500px)').matches) {
      document.getElementById('belegung-start')?.scrollIntoView({ block: 'start' });
    }
  }, [sitzung.panel, markierungsRevision]);

  useEffect(() => {
    if (!perspektivEntwurf) return;
    const flaeche = projekt.flaechen.find((x) => x.id === perspektivEntwurf.flaecheId);
    if (!flaeche) return;
    const ecken = fotoZuordnungVon(flaeche, perspektivEntwurf.fotoId)?.eckenPx;
    if (JSON.stringify(ecken) === JSON.stringify(perspektivEntwurf.roh)) return;
    return navigation.registriere('hauptdach-perspektive', {
      name: 'Perspektive',
      gueltig: () => perspektivEntwurf.pruefung.status !== 'fehler',
      uebernehmen: speicherePerspektivEntwurf,
      verwerfen: () => setPerspektivEntwurf(null),
    });
  }, [perspektivEntwurf, projekt.flaechen, navigation]);

  if (!f) return <button className={aktionKlasse} onClick={fuegeHauptflaecheHinzu}>+ Dachfläche</button>;
  const fotoZuordnungen = fotoZuordnungenVon(f);
  const fotoZuordnung = fotoZuordnungVon(f, ansichtJeFlaeche[f.id]) ?? fotoZuordnungen[0];
  const fotoId = fotoZuordnung?.fotoId;
  const fotoAsset = fotoId ? projektFotoVon(projekt, f, fotoId) : undefined;
  const foto = fotoId ? dachFotoVon(projekt, f, fotoId) : undefined;
  const fMitFoto: Flaeche = foto ? { ...f, foto, markierungFertig: fotoZuordnung?.markierungFertig } : f;
  const perspektiveHier = perspektivEntwurf?.flaecheId === f.id && perspektivEntwurf.fotoId === fotoId ? perspektivEntwurf : null;
  const perspektivGriffAmKreuz = perspektiveHier && foto ? perspektiveHier.roh.findIndex((p) => Math.hypot(p[0] - perspektivCursor[0], p[1] - perspektivCursor[1]) < foto.breitePx * .022) : -1;
  const perspektivPunktSteuerung: FotoPunktSteuerung | undefined = perspektiveHier && foto ? {
    aktiv: touchBedienung, aktivieren: aktiviereTouch, punkt: perspektivCursor,
    deaktivieren: () => { deaktiviereTouch(); setPerspektivGriff(null); },
    breitePx: foto.breitePx, hoehePx: foto.hoehePx, onBewegen: setPerspektivCursor,
    aktion: perspektivGriff !== null ? 'Ecke hier ablegen' : 'Ecke greifen',
    deaktiviert: perspektivGriff === null && perspektivGriffAmKreuz < 0,
    onBestaetigen: () => {
      if (perspektivGriff !== null) {
        const neu = kopiereEcken(perspektiveHier.roh);
        neu[perspektivGriff] = [...perspektivCursor];
        aenderePerspektivEntwurf(neu);
        setPerspektivGriff(null);
      } else if (perspektivGriffAmKreuz >= 0) setPerspektivGriff(perspektivGriffAmKreuz);
    },
  } : undefined;
  const fotoEff = foto && perspektiveHier ? { ...foto, eckenPx: perspektiveHier.letzteGueltige, perspektiveBestaetigt: true } : foto;
  const fEffBasis = mitDrag(geometrieVorschau?.id === f.id ? geometrieVorschau : f);
  let fEff: Flaeche = fotoEff ? { ...fEffBasis, foto: fotoEff, markierungFertig: fotoZuordnung?.markierungFertig } : fEffBasis;
  if (perspektiveHier && !f.gaubenTyp) fEff = { ...fEff, gaubenAussparungen: aktualisiereGaubenAussparungen(fEff, f.gaubenAussparungen) };
  const raster = rasterFuer(fEff, modul);
  const aktiv = aktiveModule(fEff, raster);
  const mass = massFreigabe(f);
  const markierungsWerkzeug = sitzung.panel === 'umriss' ? 'umriss' : sitzung.panel === 'aussparungen' ? 'hindernis' : undefined;
  const markierungOffen = sitzung.panel === 'markierung' || !!markierungsWerkzeug;
  const belegungZeigen = mass.belegen && (foto ? !!fotoZuordnung?.markierungFertig || !!foto.traufePx : !!f.felder?.length);
  const felder = felderVon(fEff);
  const gewaehlt = auswahlVon(f);
  // Die Vorschau projiziert mit Entwurfsmaßen. Ihr Bild darf keine Aktionen auf
  // die gespeicherte Geometrie auslösen, bevor der Maßentwurf übernommen wurde.
  const geometrieEntwurfAktiv = geometrieVorschau?.id === f.id;
  const feldNeuWerkzeug = modusArt(f) === 'feld_neu' && belegungZeigen && !perspektiveHier && !geometrieEntwurfAktiv;
  const felderWerkzeug = modusArt(f) === null && belegungZeigen && !perspektiveHier && !geometrieEntwurfAktiv;
  const ziehtHier = drag?.flaecheId === f.id;
  const leerZahl = leereZellen(f, gewaehlt.length ? gewaehlt : felder.map((_, k) => k));
  const ansichtKey = `${f.id}:${fotoId ?? 'ohne-foto'}`;
  const bildFlaechen = fotoId ? belegungsReihenfolge.filter((x) => fotoZuordnungVon(x, fotoId)?.eckenPx) : [];
  const eltern = f.gaubenTyp ? projekt.flaechen.find((x) => x.id === f.elternFlaecheId) : f;
  const elternFoto = eltern ? dachFotoVon(projekt, eltern, fotoZuordnungenVon(eltern)[0]?.fotoId) : undefined;
  const elternMitFoto = eltern && elternFoto ? { ...eltern, foto: elternFoto } : undefined;

  const beendeZweiPunkte = (p: PunktM) => {
    if (!ersteFeldEcke) { setErsteFeldEcke(p); return; }
    const rect = rechteckAus(ersteFeldEcke, p);
    const { w, h } = modulMasse(modul, f.ausrichtung === 'quer');
    if (rect.breiteM < w / 2 || rect.hoeheM < h / 2) return;
    const vorher = felderVon(frisch(f));
    patchFlaeche(f.id, { felder: [...vorher, { ...rect, quer: f.ausrichtung === 'quer' }] });
    setAuswahl({ flaecheId: f.id, indices: [vorher.length] });
    setModus(null);
    setErsteFeldEcke(null);
  };
  const wechsleAnsicht = (id: string) => navigation.weiter(() => {
    verwerfeGeste();
    patchSitzung({ ansichtJeFlaeche: { ...sitzung.ansichtJeFlaeche, [f.id]: id }, auswahl: null, modus: null });
  });
  const panelSchliessen = () => navigation.weiter(() => {
    setGeometrieVorschau(null);
    setPerspektivEntwurf(null);
    patchSitzung({ panel: '' });
  });

  const fotosPanel = <>
    <div className={styles.kontextAktionen}>
      <button type="button" className={aktionKlasse} onClick={() => waehleFotoDatei({ art: 'perspektive', flaecheId: f.id })}>
        <IconFoto />{fotoZuordnungen.length ? 'Weitere Perspektive' : 'Foto hinzufügen'}
      </button>
      {projekt.fotos.some((x) => !fotoZuordnungen.some((z) => z.fotoId === x.id)) && <select aria-label={`Vorhandenes Foto für ${f.name} verwenden`} value="" className={aktionKlasse}
        onChange={(e) => { if (e.target.value) navigation.weiter(() => fuegeFotoZuordnungHinzu(f.id, e.target.value)); }}>
        <option value="">Vorhandenes Foto verwenden …</option>
        {projekt.fotos.filter((x) => !fotoZuordnungen.some((z) => z.fotoId === x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>}
      {fotoId && <button type="button" className={aktionKlasse} onClick={() => navigation.weiter(() => loeseFotoZuordnung(f.id, fotoId))}>Perspektive entfernen</button>}
    </div>
    {projekt.fotos.map((asset) => <div className={styles.fotoZeile} key={asset.id}>
      <input aria-label="Name des Drohnenfotos" value={asset.name} onChange={(e) => {
        const name = e.target.value;
        aendereProjekt((p) => ({ ...p, fotos: p.fotos.map((x) => x.id === asset.id ? { ...x, name } : x) }));
      }} />
      <div className={styles.kontextAktionen}>
        <button type="button" className={aktionKlasse} onClick={() => navigation.weiter(() => waehleFotoDatei({ art: 'ersetzen', fotoId: asset.id }))}>Ersetzen</button>
        <button type="button" className={aktionKlasse} onClick={() => navigation.weiter(() => loescheFoto(asset))}>Löschen</button>
      </div>
      <p>{projekt.flaechen.filter((x) => fotoZuordnungVon(x, asset.id)).length} zugeordnete Flächen</p>
    </div>)}
  </>;
  const detailsPanel = f.gaubenTyp ? <div className={styles.kontextAktionen}>
    <p>{f.name} · {fmtDe(f.breiteM, 2)} × {fmtDe(f.hoeheM, 2)} m</p>
    <button className={aktionKlasse} onClick={() => oeffnePanel('gauben')}>Maß verbessern</button>
    <button className={aktionKlasse} onClick={() => navigation.weiter(() => {
      patchSitzung({ panel: 'gauben' });
      if (f.elternFlaecheId) starteGaubenBearbeitung(f.elternFlaecheId, f.gaubenGruppeId ?? f.id);
    })}>Perspektive bearbeiten</button>
    <button className={aktionKlasse} onClick={() => navigation.weiter(() => { if (f.elternFlaecheId) loescheGaube(f.elternFlaecheId, f.gaubenGruppeId ?? f.id); })}>Gaube löschen</button>
  </div> : <FlaechenInlineEditor key={f.id} projekt={projekt} flaeche={f} index={projekt.flaechen.indexOf(f)} kompakt initialOffen
    massVorschlag={massVorschlag?.flaecheId === f.id ? massVorschlag.masse : undefined}
    onVorschau={setGeometrieVorschau} onSchliessen={panelSchliessen}
    onProjektChange={(neu) => { projektRef.current = neu; onChange(neu); setAuswahl(null); verwerfeGeste(); }}
    onPatch={(patch) => patchFlaeche(f.id, patch)} flaecheKwp={(aktiv * modul.pmaxW) / 1000} gesamtKwp={kwp}
    onLoeschen={projekt.flaechen.filter((x) => !x.gaubenTyp).length > 1 ? () => loescheHauptflaeche(f) : undefined} />;

  const perspektivPanel = perspektiveHier && <div data-testid="perspektiv-editor-steuerung">
    <p className={styles.hinweis} role="status">{perspektiveHier.pruefung.status === 'ok' ? touchBedienung ? 'Fadenkreuz auf eine Ecke schieben, „Ecke greifen“ drücken und am Ziel ablegen. Anschließend speichern.' : 'Ecken ziehen oder mit den Pfeiltasten verschieben. Änderungen erst nach Übernehmen gespeichert.' : perspektiveHier.pruefung.meldungen.join(' ')}</p>
    <div className={styles.kontextAktionen}>
      <button className="rounded-lg bg-akzent px-3 text-sm font-semibold text-white disabled:opacity-40" disabled={perspektiveHier.pruefung.status === 'fehler'} onClick={speicherePerspektivEntwurf}>Speichern</button>
      <button className={aktionKlasse} onClick={() => setPerspektivEntwurf(null)}>Abbrechen</button>
      <button className={aktionKlasse} onClick={() => aenderePerspektivEntwurf(traufeWechseln(perspektiveHier.roh))}>Traufe wechseln</button>
      <button className={aktionKlasse} onClick={markierePerspektiveKomplettNeu}>Komplett neu markieren</button>
    </div>
  </div>;

  const auswahlPanel = <>
    <p className="mb-3 text-sm font-semibold">{gewaehlt.length} von {felder.length} ausgewählt</p>
    <div className={styles.kontextAktionen}>
      {artVon(f) !== 'flachdach' && <>
        <WerkzeugKnopf aktiv={ausrichtungAktiv(fEff) === 'quer'} title={`${gewaehlt.length} ausgewählte Felder quer legen`} onClick={() => setzeAusrichtung(f, 'quer')}><IconModulQuer />Quer</WerkzeugKnopf>
        <WerkzeugKnopf aktiv={ausrichtungAktiv(fEff) === 'hoch'} title={`${gewaehlt.length} ausgewählte Felder hochkant stellen`} onClick={() => setzeAusrichtung(f, 'hoch')}><IconModulHoch />Hochkant</WerkzeugKnopf>
      </>}
      <div className="flex gap-1" aria-label={`${gewaehlt.length} ausgewählte Felder verschieben`}>
        <HoldButton className={pfeilKlasse} title="nach links" onTrigger={() => bewegeAuswahl(f, -1, 0)}>←</HoldButton>
        <HoldButton className={pfeilKlasse} title="nach oben" onTrigger={() => bewegeAuswahl(f, 0, -1)}>↑</HoldButton>
        <HoldButton className={pfeilKlasse} title="nach unten" onTrigger={() => bewegeAuswahl(f, 0, 1)}>↓</HoldButton>
        <HoldButton className={pfeilKlasse} title="nach rechts" onTrigger={() => bewegeAuswahl(f, 1, 0)}>→</HoldButton>
      </div>
      <label>Schritt<input type="number" min={1} max={100} value={schrittCm} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 1) setSchrittCm(n); }} />cm</label>
      {leerZahl > 0 && <button className={aktionKlasse} onClick={() => zellenZurueckholen(f, gewaehlt)}>Module zurückholen ({leerZahl})</button>}
      <button className={aktionKlasse} onClick={() => auswahlLoeschen(f)}>Feld löschen{gewaehlt.length > 1 ? ` (${gewaehlt.length})` : ''}</button>
      <button className={aktionKlasse} onClick={() => setAuswahl(null)}>Auswahl aufheben</button>
    </div>
    <p className="mt-3 text-sm text-slate-600">Aktionen gelten für {gewaehlt.length === 1 ? 'das ausgewählte Feld' : `alle ${gewaehlt.length} ausgewählten Felder`}. Griffe ändern die Größe; Shift + Pfeil ebenfalls.</p>
  </>;
  const mehrPanel = <div className={styles.kontextAktionen}>
    <button className={aktionKlasse} disabled={!felder.length} onClick={() => { patchSitzung({ panel: '', modus: null, verschieben: false }); setAuswahl({ flaecheId: f.id, indices: felder.map((_, k) => k) }); }}>Alle auswählen</button>
    <button className={aktionKlasse} disabled={!belegungZeigen || !felder.length} onClick={() => { patchSitzung({ panel: '' }); setzeModus(f, 'zellen'); }}>Module aus-/einblenden</button>
    {belegungZeigen && <button className={aktionKlasse} onClick={() => { automatischFuellen(f); patchSitzung({ panel: '' }); }}>Automatisch belegen</button>}
    <button className={aktionKlasse} aria-pressed={sitzung.verschieben} onClick={() => navigation.weiter(() => { verwerfeGeste(); patchSitzung({ verschieben: !sitzung.verschieben, panel: '' }); })}>Ansicht verschieben</button>
    <button className={aktionKlasse} aria-pressed={masseZeigen} onClick={() => setMasseZeigen(!masseZeigen)}>Maße {masseZeigen ? 'ausblenden' : 'einblenden'}</button>
    {fotoZuordnung?.eckenPx && !f.gaubenTyp && <button className={aktionKlasse} onClick={() => { patchSitzung({ panel: '' }); startePerspektivBearbeitung(f, fotoId!); }}>Perspektive bearbeiten</button>}
    {foto && <button className={aktionKlasse} onClick={() => oeffnePanel('markierung')}>Aussparungen & Dachrand</button>}
    {elternMitFoto?.foto?.eckenPx && <button className={aktionKlasse} onClick={() => oeffnePanel('gauben')}>Gauben verwalten</button>}
    <label>Rand<input type="number" min={0} max={100} value={Math.round(randVon(f) * 100)} onChange={(e) => { const cm = Number(e.target.value); if (Number.isFinite(cm) && cm >= 0) patchFlaeche(f.id, { randM: cm / 100 }); }} />cm</label>
    {!!felder.length && <button className={aktionKlasse} aria-label="Belegung entfernen" onClick={() => alleFelderLoeschen(f)}>Alle {felder.length} Felder entfernen</button>}
    <button className={aktionKlasse} onClick={() => navigation.weiter(fuegeHauptflaecheHinzu)}>+ Dachfläche</button>
  </div>;

  const feldPanel = <div className={styles.werkzeugOptionen}>
    <p>{zweiPunkte ? ersteFeldEcke ? 'Gegenüberliegende Ecke antippen.' : 'Erste Ecke antippen.' : 'Feld von einer Ecke zur gegenüberliegenden ziehen.'}</p>
    <button className={aktionKlasse} aria-pressed={zweiPunkte} onClick={() => { verwerfeGeste(); setZweiPunkte(!zweiPunkte); }}>{zweiPunkte ? 'Mit Ziehen zeichnen' : 'Mit zwei Punkten zeichnen'}</button>
    <label>Neue Felder<select aria-label="Ausrichtung neuer Felder" className={aktionKlasse} value={f.ausrichtung} disabled={artVon(f) === 'flachdach'} onChange={(e) => patchFlaeche(f.id, { ausrichtung: e.target.value as 'hoch' | 'quer' })}><option value="hoch">Hochkant</option><option value="quer">Quer</option></select></label>
    <button className={aktionKlasse} onClick={() => setzeModus(f, null)}>Abbrechen</button>
  </div>;
  const zellenPanel = <div className={styles.werkzeugOptionen}><p>Module der aktiven Fläche antippen, um sie aus- oder einzublenden.</p>
    {leerZahl > 0 && <button className={aktionKlasse} onClick={() => zellenZurueckholen(f, felder.map((_, k) => k))}>Alle anschalten ({leerZahl})</button>}
    <button className={aktionKlasse} onClick={() => setzeModus(f, null)}>Fertig</button></div>;
  const bedienPanel = perspektiveHier ? perspektivPanel : sitzung.panel === 'fotos' ? fotosPanel : sitzung.panel === 'details' ? detailsPanel : sitzung.panel === 'mehr' ? mehrPanel : feldNeuWerkzeug ? feldPanel : modusArt(f) === 'zellen' ? zellenPanel : gewaehlt.length && felderWerkzeug ? auswahlPanel : null;
  const panelTitel = perspektiveHier ? 'Perspektive bearbeiten' : sitzung.panel === 'fotos' ? 'Fotos & Perspektiven' : sitzung.panel === 'details' ? 'Dachdetails & Maße' : sitzung.panel === 'mehr' ? 'Weitere Werkzeuge' : feldNeuWerkzeug ? 'Feld zeichnen' : modusArt(f) === 'zellen' ? 'Module bearbeiten' : 'Ausgewählte Felder';
  const standardPanel = <div className={styles.eigenschaften}>
    <div className={styles.flaechenErgebnis}><strong>{aktiv}<small>Module</small></strong><strong>{fmtDe(aktiv * modul.pmaxW / 1000, 2)}<small>kWp · {f.name}</small></strong></div>
    <dl><div><dt>Abmessungen</dt><dd>{fmtDe(f.breiteM, 2)} × {fmtDe(f.hoeheM, 2)} m</dd></div><div><dt>Modul</dt><dd>{modul.pmaxW} Wp</dd></div><div><dt>Belegungsfelder</dt><dd>{felder.length}</dd></div></dl>
    {!mass.belegen && <p className={styles.hinweis}>{mass.meldung} <button className={aktionKlasse} onClick={() => oeffnePanel(f.gaubenTyp ? 'gauben' : 'details')}>Maße bestätigen</button></p>}
    {belegungZeigen && !felder.length && <><p>Die Fläche ist bereit für die erste Belegung.</p><button className={styles.primaer} onClick={() => setzeModus(f, 'feld_neu')}>+ Belegungsbereich zeichnen</button><button className={aktionKlasse} onClick={() => automatischFuellen(f)}>Automatisch belegen</button></>}
    {belegungZeigen && !!felder.length && !raster.positionen.length && <p className={styles.hinweis}>Kein Modul passt in die nutzbare Fläche. Feldgröße, Rand und Aussparungen prüfen.</p>}
    {sitzung.verschieben && <p>Im Foto ziehen. Zwei Finger verschieben und zoomen immer nur die Ansicht.</p>}
  </div>;
  const renderArbeitsbereich = ({ bild, steuerung, hinweis, bildSeitenverhaeltnis, abbrechen, punktSteuerung }: { bild: ReactNode; steuerung?: ReactNode; hinweis?: ReactNode; bildSeitenverhaeltnis: number; abbrechen?: () => void; punktSteuerung?: FotoPunktSteuerung }) => <>
    <div className={styles.arbeitsbereich} data-kontext-offen={!!(bedienPanel || steuerung)} data-testid={`arbeitsbereich-${f.id}`}>
      <div className={styles.bildBereich}>
      {hinweis && <div className={styles.anleitung}>{hinweis}</div>}
      <div className={styles.canvas} id={`foto-masse-${f.id}`}>
        <EditorViewport ansicht={sitzung.ansichten[ansichtKey] ?? STANDARD_ANSICHT} bildSeitenverhaeltnis={bildSeitenverhaeltnis}
          punktSteuerung={punktSteuerung}
          verschieben={sitzung.verschieben} onGesteAbbrechen={() => { verwerfeGeste(); setGesteAbbruchRevision((wert) => wert + 1); abbrechen?.(); }}
          onAnsichtChange={(ansicht) => patchSitzung((alt) => ({ ansichten: { ...alt.ansichten, [ansichtKey]: ansicht } }))}>
          {bild}
          {belegungZeigen && !steuerung && !perspektiveHier && bildFlaechen.filter((x) => x.id !== f.id).map((x) => {
            const ecken = fotoZuordnungVon(x, fotoId)!.eckenPx!;
            const links = ecken.reduce((sum, p) => sum + p[0], 0) / 4 / foto!.breitePx * 100;
            const oben = ecken.reduce((sum, p) => sum + p[1], 0) / 4 / foto!.hoehePx * 100;
            return <button key={x.id} type="button" className={styles.bildLabel} style={{ left: `${links}%`, top: `${oben}%` }} aria-label={`${x.name} im Foto auswählen`}
              onPointerDown={(e) => e.stopPropagation()} onClick={() => wechsleFlaeche(x.id)}>{x.name}</button>;
          })}
        </EditorViewport>
      </div>
      </div>
      <aside className={styles.inspektor} aria-label="Dachflächen und Eigenschaften">
        <details className={styles.ebenen} open={!bedienPanel && !steuerung}>
          <summary><WorkbenchIcon symbol="flaeche" />Dachflächen <span>{projekt.flaechen.length}</span></summary>
          <div className={styles.ebenenListe} aria-label="Dachflächen im Projekt">
            {belegungsReihenfolge.map((x) => <button key={x.id} type="button" aria-label={`${x.name} auswählen`} aria-pressed={x.id === f.id} className={`${styles.ebene} ${x.gaubenTyp ? styles.kindEbene : ''}`} onClick={() => wechsleFlaeche(x.id)}><WorkbenchIcon symbol={x.gaubenTyp ? 'gaube' : 'umriss'} /><span>{x.name}</span><span className={styles.ebenenPunkt} aria-hidden="true" /></button>)}
            <button type="button" className={styles.neueEbene} onClick={() => navigation.weiter(fuegeHauptflaecheHinzu)}>+ Dachfläche hinzufügen</button>
          </div>
        </details>
        <div className={styles.kontext} role="complementary" aria-label="Editor-Einstellungen">
          <div className={styles.kontextKopf}><div><span>{f.name}</span><h3>{bedienPanel ? panelTitel : steuerung ? sitzung.panel === 'gauben' ? 'Gauben' : markierungOffen ? 'Dach bearbeiten' : 'Fläche einrichten' : 'Eigenschaften'}</h3></div>{(bedienPanel || steuerung) && <button type="button" className={aktionKlasse} aria-label="Bereich schließen" onClick={() => { if (bedienPanel === auswahlPanel) setAuswahl(null); else if (feldNeuWerkzeug || modusArt(f) === 'zellen') setzeModus(f, null); else panelSchliessen(); }}>×</button>}</div>
          <div className={styles.kontextInhalt}>{bedienPanel ?? steuerung ?? standardPanel}</div>
        </div>
      </aside>
    </div>
  </>;

  const belegungsBild = <DachSvg flaeche={fEff} raster={raster} modul={modul} masse={masseZeigen} maxHoehe={2000} modulDarstellung={ziehtHier ? 'kontur' : 'detail'}
    cancelRevision={gesteAbbruchRevision}
    felderAnzeige={felder.map((feld, k) => ({ rect: feld, ausgewaehlt: gewaehlt.includes(k) }))} feldVorschau={vorschauFuer(f)}
    geister={modusArt(f) === 'zellen' ? leerePositionenFuer(fEff, modul).map((p) => ({ key: posKey(p), xM: p.xM, yM: p.yM, wM: p.wM, hM: p.hM })) : undefined}
    pointer={!sitzung.verschieben && (felderWerkzeug || feldNeuWerkzeug) ? {
      onGriffDownM: felderWerkzeug ? (index, griff, p) => starteDrag({ art: 'resize', flaecheId: f.id, start: p, aktuell: p, index, griff }) : undefined,
      onDownM: (p) => { if (!(feldNeuWerkzeug && zweiPunkte)) onDownM(f, p, feldNeuWerkzeug); },
      onMoveM: (p) => { if (p && dragAktiv.current) aktualisiereDrag(f.id, p); },
      onUpM: (p) => feldNeuWerkzeug && zweiPunkte ? beendeZweiPunkte(p) : onUpM(f, p),
    } : undefined}
    perspektivEditor={perspektiveHier ? { ecken: perspektiveHier.roh, pruefung: perspektiveHier.pruefung, ausgewaehlt: perspektiveHier.ausgewaehlt,
      onAuswaehlen: (ausgewaehlt) => setPerspektivEntwurf((alt) => alt ? { ...alt, ausgewaehlt } : alt), onAendern: aenderePerspektivEntwurf, onAbbrechen: () => setPerspektivEntwurf(null) } : undefined}
    tastatur={{ onPfeil: felderWerkzeug && gewaehlt.length ? (sx, sy, skalieren) => skalieren ? skaliereAuswahl(f, sx, sy) : bewegeAuswahl(f, sx, sy) : undefined,
      onEscape: () => { verwerfeGeste(); setAuswahl(null); setModus(null); } }}
    onToggle={!geometrieEntwurfAktiv && !sitzung.verschieben && modusArt(f) === 'zellen' ? (key) => zelleToggle(f, key) : undefined}
    fotoOverlay={fotoAsset ? (clipIdPrefix) => fotoFlaechenInhalt({ projekt, foto: fotoAsset, ausblendenId: f.id, assetId: `modul-${f.id}`, clipIdPrefix, modulDarstellung: ziehtHier ? 'kontur' : 'detail' }) : undefined} />;

  return <section id="belegung-start" className={styles.editor} aria-label="Gemeinsamer Fotoeditor">
    <p className="sr-only" aria-live="polite">{gaubenStatus}</p>
    <div className={styles.kopf}>
      <label className="sr-only" htmlFor="aktive-dachflaeche">Aktive Dachfläche</label>
      <select id="aktive-dachflaeche" className={aktionKlasse} value={f.id} onChange={(e) => wechsleFlaeche(e.target.value)}>
        {belegungsReihenfolge.map((x) => <option key={x.id} value={x.id}>{x.gaubenTyp ? '↳ ' : ''}{x.name}{x.gaubenSeite ? ` · ${x.gaubenSeite}` : ''}</option>)}
      </select>
      <button className={aktionKlasse} aria-expanded={sitzung.panel === 'details'} onClick={() => oeffnePanel('details')}><WorkbenchIcon symbol="details" />Dachdetails</button>
      <button className={aktionKlasse} aria-expanded={sitzung.panel === 'fotos'} onClick={() => oeffnePanel('fotos')}><WorkbenchIcon symbol="foto" />Fotos</button>
      {!foto && belegungZeigen && <button className={aktionKlasse} onClick={() => waehleFotoDatei({ art: 'perspektive', flaecheId: f.id })}>Foto hinzufügen</button>}
      {fotoZuordnungen.length > 1 && <select className={`${aktionKlasse} ${styles.perspektiven}`} aria-label={`Ansicht für ${f.name}`} value={fotoId} onChange={(e) => wechsleAnsicht(e.target.value)}>
        {fotoZuordnungen.map((z, i) => <option key={z.fotoId} value={z.fotoId}>Perspektive {i + 1} · {projekt.fotos.find((x) => x.id === z.fotoId)?.name}</option>)}
      </select>}
      <span className={styles.ergebnis}><strong>{fmtDe(kwp, 2)} <small>kWp</small></strong><span>{gesamt} Module gesamt</span></span>
    </div>
    <div className={styles.werkzeugZeile}>
    <div className={styles.werkzeuge} role="toolbar" aria-label={`Werkzeuge für ${f.name}`}>
      <button type="button" aria-label="Auswählen" aria-pressed={belegungZeigen && !sitzung.verschieben && modusArt(f) === null && !markierungOffen && sitzung.panel !== 'gauben' && !perspektiveHier} disabled={!belegungZeigen} onClick={() => navigation.weiter(() => { patchSitzung({ panel: '', verschieben: false }); setPerspektivEntwurf(null); setGeometrieVorschau(null); setzeModus(f, null); })}><WorkbenchIcon symbol="auswahl" /><span>Auswählen</span></button>
      <button type="button" aria-label="+ Feld zeichnen" aria-pressed={feldNeuWerkzeug} disabled={!belegungZeigen} onClick={() => navigation.weiter(() => { patchSitzung({ panel: '', verschieben: false }); setzeModus(f, 'feld_neu'); })}><WorkbenchIcon symbol="feld" /><span>Feld zeichnen</span></button>
      {!historie.zentral && <>
        <button className={aktionKlasse} disabled={!historie.canUndo} onClick={() => navigation.weiter(historie.undo)}>↶ Rückgängig{historie.undoCount ? ` (${historie.undoCount})` : ''}</button>
        <button className={aktionKlasse} disabled={!historie.canRedo} onClick={() => navigation.weiter(historie.redo)}>↷ Wiederherstellen</button>
      </>}
    </div>
    <div className={styles.dachWerkzeuge} role="group" aria-label="Dach bearbeiten">
      <button type="button" aria-label="Umriss" aria-expanded={sitzung.panel === 'umriss'} disabled={!foto?.eckenPx || !mass.belegen} title="Dachumriss zeichnen oder ändern · benötigt bestätigte Maße und Dachecken" onClick={() => oeffnePanel('umriss', true)}><WorkbenchIcon symbol="umriss" /><span>Umriss</span></button>
      <button type="button" aria-label="Aussparungen" aria-expanded={sitzung.panel === 'aussparungen'} disabled={!foto?.eckenPx || !mass.belegen} title="Fenster, Kamin oder andere Aussparungen markieren · benötigt bestätigte Maße und Dachecken" onClick={() => oeffnePanel('aussparungen', true)}><WorkbenchIcon symbol="aussparung" /><span>Aussparung</span></button>
      <button type="button" aria-label="Gauben" aria-expanded={sitzung.panel === 'gauben'} disabled={!elternMitFoto?.foto?.eckenPx || !massFreigabe(elternMitFoto).belegen} title="Gauben im Foto anlegen oder bearbeiten · benötigt bestätigte Maße und Dachecken" onClick={() => oeffnePanel('gauben')}><WorkbenchIcon symbol="gaube" /><span>Gauben</span></button>
    </div>
    <div className={styles.weitereWerkzeuge}>
      <button type="button" className={styles.panWerkzeug} aria-label="Foto verschieben" aria-pressed={sitzung.verschieben} onClick={() => navigation.weiter(() => { verwerfeGeste(); patchSitzung({ verschieben: !sitzung.verschieben, panel: '' }); })}><WorkbenchIcon symbol="hand" /><span>Verschieben</span></button>
      <button type="button" aria-label="Mehr" aria-expanded={sitzung.panel === 'mehr'} onClick={() => oeffnePanel('mehr')}><WorkbenchIcon symbol="mehr" /><span>Mehr</span></button>
    </div>
    </div>
    <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Drohnenfoto auswählen" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) await fotoDateiGewaehlt(file); }} />
    <div className={styles.meldungen} aria-live="polite" aria-atomic="true">
      {fotoUpload.status === 'laden' && <p className={styles.hinweis}>Foto wird geprüft und verkleinert …</p>}
      {fotoUpload.status === 'fehler' && <div role="alert" className={styles.hinweis}><strong>Foto nicht geladen:</strong> {fotoUpload.grund}<button className={aktionKlasse} onClick={() => waehleFotoDatei(fotoUpload.ziel)}>Andere Datei wählen</button></div>}
      {fotoUpload.status === 'erfolg' && <span className="sr-only">{fotoUpload.meldung}</span>}
    </div>
    <div className={styles.bereich} id={`belegung-${f.id}`}>
      {sitzung.panel === 'gauben' && elternMitFoto && eltern ? <GaubenEditor eltern={elternMitFoto} projekt={projekt}
        initialOffen={!projekt.flaechen.some((x) => x.elternFlaecheId === eltern.id && !!x.gaubenTyp)}
        gauben={projekt.flaechen.filter((x) => x.elternFlaecheId === eltern.id && !!x.gaubenTyp)}
        bearbeiteGruppenId={gaubenBearbeitung?.elternId === eltern.id ? gaubenBearbeitung.gruppenId : null}
        onBearbeitungGestartet={() => setGaubenBearbeitung(null)}
        onBelegungOeffnen={wechsleFlaeche}
        onErstellen={(daten) => erstelleGaube(eltern, fotoZuordnungenVon(eltern)[0]!.fotoId, daten)}
        onLoeschen={(gruppenId) => loescheGaube(eltern.id, gruppenId)} onMasseAendern={aendereGaubenMasse}
        onMarkierungAendern={(gruppenId, markierung) => aendereGaubenMarkierung(eltern.id, gruppenId, markierung)}
        renderArbeitsbereich={renderArbeitsbereich} />
      : foto && fotoId && !perspektiveHier && (!belegungZeigen || markierungOffen) ? <FotoHintergrund key={`${f.id}:${fotoId}:${markierungsRevision}`} flaeche={fMitFoto} fotoVerwalten={false} kompakt initialWerkzeug={markierungsWerkzeug}
        zustandsKey={`${f.id}:${fotoId}`} geometrieBehalten={fotoZuordnungen.length > 1 || !!f.umrissM}
        onPatch={(patch) => { patchFotoFlaeche(f, fotoId, patch); if (patch.markierungFertig) patchSitzung({ panel: '' }); }} onMasseBearbeiten={() => oeffnePanel('details')}
        onMassVorschlag={!f.gaubenTyp ? (masse) => { setMassVorschlag({ flaecheId: f.id, masse }); patchSitzung({ panel: 'details' }); } : undefined}
        fotoOverlay={fotoAsset ? (clipIdPrefix) => <><defs><ModulAsset id={`setup-modul-${f.id}`} modul={modul} /></defs>{fotoFlaechenInhalt({ projekt, foto: fotoAsset, ausblendenId: f.id, assetId: `setup-modul-${f.id}`, clipIdPrefix })}</> : undefined}
        renderArbeitsbereich={renderArbeitsbereich} />
      : foto || belegungZeigen ? renderArbeitsbereich({ bild: belegungsBild, bildSeitenverhaeltnis: foto ? foto.breitePx / foto.hoehePx : rahmenBreiteVon(f) / f.hoeheM, punktSteuerung: perspektivPunktSteuerung })
      : renderArbeitsbereich({ bild: <div className={styles.canvasLeer}><strong>Foto für {f.name} hinzufügen</strong><p>Danach Dachmaße bestätigen und die Fläche im Bild markieren.</p><button className="rounded-lg bg-akzent px-4 font-semibold text-white" onClick={() => waehleFotoDatei({ art: 'perspektive', flaecheId: f.id })}>Foto hinzufügen</button></div>, bildSeitenverhaeltnis: 1.6 })}
    </div>
    <div className={styles.status}><span data-testid="flaechen-status">{f.name}: {aktiv} Module · {felder.length} {felder.length === 1 ? 'Feld' : 'Felder'} · {fmtDe(aktiv * modul.pmaxW / 1000, 2)} kWp</span><span>Maße: {mass.status === 'bestaetigt' ? 'bestätigt' : mass.status === 'bestand' ? 'Bestand' : 'offen'}</span><span>Perspektive: {fotoZuordnung?.perspektiveBestaetigt ? 'bestätigt' : 'offen'}</span></div>
  </section>;
}
