'use client';

import { useRef, useState } from 'react';
import { dateiZuBild } from '../lib/bild';
import {
  belegungsCheck,
  hindernisAusKlicks,
  homographie,
  orientiereEcken,
  projiziere,
  sortiereEcken,
  traufeWechseln,
  umrissAusKlicks,
  type Punkt,
} from '../lib/foto-geometrie';
import { artVon, DACHFARBEN, fmtDe, perspektiveQuelle, rahmenBreiteVon, type DachFoto, type Flaeche } from '../lib/model';
import { IconFoto } from './icons';

/**
 * Drohnenfoto-Hintergrund je Dachfläche (Foto bleibt lokal, SPEC §8.1).
 *
 * Ablauf (07.07.2026, nach Genrih-Feedback):
 * 1. FIRST: eine Linie entlang First/Traufe ziehen → legt die Traufe-Achse fest
 *    (behebt vertauschte Hoch/Quer-Ausrichtung bei schrägen Dächern). Überspringbar.
 * 2. PERSPEKTIVE: die 4 Ecken des Dach-Rechtecks markieren (auch wenn eine in der
 *    Luft liegt) → Homographie. Ein Fadenkreuz am Mauszeiger hilft beim Zielen.
 * 3. UMRISS (optional): den echten Rand der Dachfläche einzeichnen (beliebig viele
 *    Ecken; rechteckiges Dach → überspringen). Wieder mit Fadenkreuz + Vorschaulinie.
 * 4. HINDERNIS: Kamin/Fenster/SAT aufs noch leere Dach setzen.
 * 5. „Dach belegen".
 * „Ziegel zählen" liefert den Maßstab für den Belegungs-Check.
 */

async function dateiZuFoto(file: File): Promise<DachFoto> {
  const bild = await dateiZuBild(file);
  return { ...bild, traufePx: null };
}

function deckbreiteDefaultCm(f: Flaeche): number {
  const art = DACHFARBEN.find((d) => d.id === f.dachfarbe)?.art;
  return art === 'blech' ? 53 : 30;
}

type Modus = 'first' | 'perspektive' | 'umriss' | 'hindernis' | 'ziegel';

/** Ziehbarer Griff: eine Foto-Ecke, ein Trauflinien-Punkt oder ein Draft-Punkt. */
type Griff = { art: 'punkt' | 'ecke' | 'first'; i: number };

const knopfKlasse =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

function modusKnopfKlasse(aktiv: boolean): string {
  return `h-9 rounded-lg border px-3 text-sm font-medium ${
    aktiv ? 'border-akzent bg-akzent text-white' : 'border-slate-300 bg-white text-slate-700'
  }`;
}

/**
 * Schritt-Chip der Markier-Kette ①–④ (U3, 08.07.): zeigt Fortschritt (✓),
 * aktiven Schritt und gesperrte Schritte — die Vertriebler sehen, WO im Ablauf
 * sie sind, statt lose Modus-Knöpfe zu raten.
 */
function SchrittChip({
  nr,
  label,
  aktiv,
  erledigt,
  gesperrt,
  titel,
  onClick,
}: {
  nr: string;
  label: string;
  aktiv: boolean;
  erledigt: boolean;
  gesperrt?: boolean;
  titel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={gesperrt}
      title={titel}
      onClick={onClick}
      className={`h-9 rounded-lg border px-3 text-sm font-medium ${
        aktiv
          ? 'border-akzent bg-akzent text-white'
          : gesperrt
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
            : erledigt
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
      }`}
    >
      {erledigt && !aktiv ? '✓ ' : ''}
      {nr} {label}
    </button>
  );
}

export function FotoHintergrund({
  flaeche,
  onPatch,
  fotoVerwalten = true,
}: {
  flaeche: Flaeche;
  onPatch: (patch: Partial<Flaeche>) => void;
  /** false: Upload/Ersetzen/Löschen übernimmt die übergeordnete Foto-Gruppe. */
  fotoVerwalten?: boolean;
}) {
  const foto = flaeche.foto;
  const flaechenArt = artVon(flaeche);
  const istSchraegdach = flaechenArt === 'dach';
  const istFlachdach = flaechenArt === 'flachdach';
  const kantenName = istSchraegdach ? 'Traufe' : istFlachdach ? 'Referenzkante' : 'Unterkante';
  const flaechenName = istSchraegdach ? 'Dach' : istFlachdach ? 'Flachdach' : 'Fassade';
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [modus, setModus] = useState<Modus>('first');
  const [anzahlZiegel, setAnzahlZiegel] = useState(10);
  const [deckbreiteCm, setDeckbreiteCm] = useState<number | null>(null);
  const [mausPx, setMausPx] = useState<Punkt | null>(null);
  // Referenzlinie First/Traufe → legt die Traufe-Achse fest (transient, nur beim Markieren)
  const [firstLinie, setFirstLinie] = useState<[Punkt, Punkt] | null>(null);
  // Gerade gezogener Punkt (Ecke/Trauflinie/Draft) — freies Nachjustieren per Drag.
  // In einem Ref, damit das Ziehen sofort greift (nicht erst nach dem Re-Render).
  const ziehtRef = useRef<{ art: 'punkt' | 'ecke' | 'first'; i: number } | null>(null);
  const [greift, setGreift] = useState(false); // nur für den Cursor
  // Startete der Maus-Druck auf einem Griff? Dann den folgenden Klick NICHT als „neuen Punkt" werten.
  const aufHandle = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const B = flaeche.breiteM; // Traufe (Referenzstrecke für den Maß-Check)
  const rahmenB = rahmenBreiteVon(flaeche); // Rahmen (Homographie/Umriss/Hindernis)
  const H = flaeche.hoeheM;
  const deckCm = deckbreiteCm ?? deckbreiteDefaultCm(flaeche);
  const onFoto = (f: DachFoto | undefined) => onPatch({ foto: f });

  const markiert = !!(foto && (foto.eckenPx || foto.traufePx));
  const inMarkierung = !!foto && !flaeche.markierungFertig;
  // Parametrische Form (Trapez/Schief): Quell-Ecken bekannt → Nutzer klickt die
  // echten Dach-Ecken, kein Umriss nötig. Rechteck/manueller Umriss → undefined.
  const quelle = perspektiveQuelle(flaeche);
  const parametrisch = quelle !== undefined;
  const firstBreiteEff =
    flaeche.dachform === 'trapez' || flaeche.dachform === 'schief'
      ? flaeche.firstBreiteM ?? B
      : undefined;
  const erwFirstAnteil = firstBreiteEff !== undefined ? firstBreiteEff / B : 1;
  const hom = foto?.eckenPx ? homographie(rahmenB, H, foto.eckenPx, quelle) : null;
  const check =
    foto?.eckenPx != null
      ? belegungsCheck(
          foto.eckenPx,
          B,
          H,
          flaeche.neigungDeg,
          foto.pxProM,
          erwFirstAnteil,
          flaechenArt,
        )
      : null;

  // Fadenkreuz-Vorschau nur in den Punkt-Setz-Modi
  const zeigtKreuz =
    modus === 'first' || modus === 'perspektive' || modus === 'umriss' || modus === 'hindernis';

  const wechsleModus = (m: Modus) => {
    setModus(m);
    setPunkte([]);
  };

  const perspektiveAbschliessen = (pts: Punkt[]) => {
    if (!foto || pts.length < 4) return;
    const vier: [Punkt, Punkt, Punkt, Punkt] = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
    // Firstlinie (falls gezogen) legt die Traufe-Achse fest; sonst alter Heuristik-Fallback
    const ecken = firstLinie ? orientiereEcken(vier, firstLinie) : sortiereEcken(vier);
    // Perspektive neu → Umriss (Rechteck) zurücksetzen, danach optional zeichnen
    onPatch({ foto: { ...foto, eckenPx: ecken, traufePx: null }, umrissM: undefined, markierungFertig: false, inaktiv: [] });
    setPunkte([]);
    setModus('umriss');
  };

  const umrissAbschliessen = (pts: Punkt[]) => {
    if (!foto?.eckenPx) return;
    const umrissM = umrissAusKlicks(pts, rahmenB, H, foto.eckenPx, quelle);
    if (!umrissM) return;
    onPatch({ umrissM, inaktiv: [] });
    setPunkte([]);
    setModus('hindernis');
  };

  const hindernisSetzen = (p1: Punkt, p2: Punkt) => {
    if (!foto?.eckenPx) return;
    const rect = hindernisAusKlicks(p1, p2, rahmenB, H, foto.eckenPx, quelle);
    if (rect) onPatch({ hindernisse: [...(flaeche.hindernisse ?? []), rect], inaktiv: [] });
  };

  const svgKoord = (e: React.MouseEvent<SVGSVGElement>): Punkt | null => {
    if (!foto) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return [
      ((e.clientX - rect.left) / rect.width) * foto.breitePx,
      ((e.clientY - rect.top) / rect.height) * foto.hoehePx,
    ];
  };

  /**
   * Ziehbare Griffe (Genrih 08.07.): die 4 Ecken lassen sich nach dem Setzen frei
   * verschieben (grob klicken, dann exakt auf die Dachecke ziehen), ebenso die
   * Trauflinie. Nur in den Modi „perspektive"/„first" — im Umriss/Hindernis bleibt
   * der Klick fürs Zeichnen/Schließen. Draft-Punkte sind auch ziehbar.
   */
  const handles = (): { x: number; y: number; z: Griff }[] => {
    if (!foto) return [];
    const arr: { x: number; y: number; z: Griff }[] = [];
    if (modus === 'perspektive') {
      punkte.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'punkt', i } }));
      if (foto.eckenPx) foto.eckenPx.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'ecke', i } }));
    } else if (modus === 'first') {
      punkte.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'punkt', i } }));
      if (firstLinie) firstLinie.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'first', i } }));
    }
    return arr;
  };

  const naheHandle = (k: Punkt) => {
    const schwelle = foto ? foto.breitePx * 0.022 : 0;
    return handles().find((h) => Math.hypot(h.x - k[0], h.y - k[1]) <= schwelle);
  };

  /** Griff auf neue Position setzen (Ecke im Foto, Trauflinien-Punkt oder Draft-Punkt). */
  const setzeHandle = (z: Griff, k: Punkt) => {
    if (!foto) return;
    if (z.art === 'punkt') {
      setPunkte(punkte.map((p, i) => (i === z.i ? [k[0], k[1]] : p)));
    } else if (z.art === 'ecke' && foto.eckenPx) {
      const e = foto.eckenPx.map((p, i) => (i === z.i ? [k[0], k[1]] : p)) as typeof foto.eckenPx;
      onFoto({ ...foto, eckenPx: e });
    } else if (z.art === 'first' && firstLinie) {
      setFirstLinie(firstLinie.map((p, i) => (i === z.i ? [k[0], k[1]] : p)) as [Punkt, Punkt]);
    }
  };

  const klick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Kam der Klick vom Loslassen eines Griffs? Dann keinen neuen Punkt setzen.
    if (aufHandle.current) {
      aufHandle.current = false;
      return;
    }
    const k = svgKoord(e);
    if (!k || !foto) return;
    const [x, y] = k;

    if (modus === 'first') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      setFirstLinie([neu[0]!, neu[1]!]);
      setPunkte([]);
      return setModus('perspektive');
    }

    if (modus === 'ziegel') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      const [[x1, y1], [x2, y2]] = neu as [Punkt, Punkt];
      const distPx = Math.hypot(x2 - x1, y2 - y1);
      const streckeM = (anzahlZiegel * deckCm) / 100;
      if (distPx > 0 && streckeM > 0) onFoto({ ...foto, pxProM: distPx / streckeM });
      setPunkte([]);
      return setModus(foto.eckenPx ? 'hindernis' : 'perspektive');
    }

    if (modus === 'hindernis') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      hindernisSetzen(neu[0]!, neu[1]!);
      return setPunkte([]);
    }

    if (modus === 'perspektive') {
      // Sind die 4 Ecken schon gesetzt, fügt ein Klick KEINE neue an — man justiert
      // dann nur noch per Ziehen. Neu setzen geht über „Ecken neu".
      if (foto.eckenPx) return;
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length >= 4) return perspektiveAbschliessen(neu);
      return setPunkte(neu);
    }

    // umriss: Klick nahe erstem Punkt schließt (ab 3 Ecken)
    if (punkte.length >= 3) {
      const [fx, fy] = punkte[0]!;
      if (Math.hypot(x - fx, y - fy) <= foto.breitePx * 0.025) return umrissAbschliessen(punkte);
    }
    setPunkte([...punkte, [x, y]]);
  };

  const zurueckAufAnfang = () => {
    setPunkte([]);
    setFirstLinie(null);
    setModus('first');
  };

  const px = (v: number) => (foto ? foto.breitePx * v : 0);
  const letzter = punkte[punkte.length - 1];

  return (
    <div className="mb-3">
      {fotoVerwalten && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            zurueckAufAnfang();
            onFoto(await dateiZuFoto(file));
          }}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {fotoVerwalten && (
          <button type="button" className={knopfKlasse} onClick={() => inputRef.current?.click()}>
            <IconFoto />
            {foto ? 'Anderes Foto' : 'Drohnenfoto als Hintergrund'}
          </button>
        )}
        {foto && (
          <>
            {flaeche.markierungFertig && (
              <button
                type="button"
                className={knopfKlasse}
                title="Zurück aufs leere Foto, um Hindernisse zu setzen oder den Umriss zu ändern"
                onClick={() => {
                  setPunkte([]);
                  setModus('hindernis');
                  onPatch({ markierungFertig: false });
                }}
              >
                ✎ Markierung ändern
              </button>
            )}
            {markiert && (
              <button
                type="button"
                className={knopfKlasse}
                title={`Ausrichtung neu: ${istSchraegdach ? 'First-/Trauflinie' : `${kantenName} als Referenz`} setzen, dann die 4 Ecken`}
                onClick={() => {
                  const { eckenPx: _e, ...rest } = foto;
                  onPatch({
                    foto: { ...rest, traufePx: null },
                    umrissM: undefined,
                    markierungFertig: false,
                    inaktiv: [],
                  });
                  setPunkte([]);
                  setFirstLinie(null);
                  setModus('first');
                }}
              >
                Ausrichtung neu ({istSchraegdach ? 'First' : kantenName} + 4 Ecken)
              </button>
            )}
            {foto.eckenPx && (
              <button
                type="button"
                className={knopfKlasse}
                title={`Falls die falsche Kante als ${kantenName} angenommen wurde: Zuordnung weiterdrehen`}
                onClick={() => onFoto({ ...foto, eckenPx: traufeWechseln(foto.eckenPx!) })}
              >
                ↻ {kantenName} wechseln
              </button>
            )}
            {modus === 'perspektive' && foto.eckenPx && (
              <button
                type="button"
                className={knopfKlasse}
                title="Alle 4 Ecken verwerfen und neu anklicken"
                onClick={() => {
                  setPunkte([]);
                  onFoto({ ...foto, eckenPx: undefined });
                }}
              >
                Ecken neu
              </button>
            )}
            {foto.pxProM !== undefined && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() => {
                  const { pxProM: _weg, ...rest } = foto;
                  setPunkte([]);
                  onFoto(rest);
                }}
              >
                {istSchraegdach ? 'Ziegel-Maßstab' : 'Foto-Maßstab'} löschen ({fmtDe(foto.pxProM, 1)} px/m)
              </button>
            )}
            {check?.vorschlag && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() =>
                  onPatch({ breiteM: check.vorschlag!.breiteM, hoeheM: check.vorschlag!.hoeheM, inaktiv: [] })
                }
              >
                Maße aus Foto übernehmen ({fmtDe(check.vorschlag.breiteM, 1)} ×{' '}
                {fmtDe(check.vorschlag.hoeheM, 1)} m)
              </button>
            )}
            {fotoVerwalten && (
              <button
                type="button"
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-red-500 hover:border-red-300"
                onClick={() => {
                  zurueckAufAnfang();
                  onFoto(undefined);
                }}
              >
                Foto entfernen
              </button>
            )}
          </>
        )}
      </div>

      {check && (
        <div
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${
            check.status === 'ok'
              ? 'bg-emerald-50 text-emerald-800'
              : check.status === 'warnung'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-700'
          }`}
        >
          <strong>Belegungs-Check:</strong>{' '}
          {check.meldungen.map((m, i) => (
            <span key={i}>{m} </span>
          ))}
        </div>
      )}

      {foto && inMarkierung && (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {/* Schrittanzeige ①–④: immer sichtbar, ✓ = erledigt, grau = noch gesperrt */}
            <SchrittChip
              nr="①"
              label="Ausrichtung"
              aktiv={modus === 'first'}
              erledigt={!!firstLinie || !!foto.eckenPx}
              onClick={() => wechsleModus('first')}
            />
            <SchrittChip
              nr="②"
              label="4 Ecken"
              aktiv={modus === 'perspektive'}
              erledigt={!!foto.eckenPx}
              onClick={() => wechsleModus('perspektive')}
            />
            <SchrittChip
              nr="③"
              label="Umriss"
              aktiv={modus === 'umriss'}
              erledigt={!!flaeche.umrissM || (parametrisch && !!foto.eckenPx)}
              gesperrt={!foto.eckenPx}
              titel={
                !foto.eckenPx
                  ? 'Erst die 4 Ecken setzen'
                  : parametrisch
                    ? 'Form (Trapez/Parallelogramm) kommt automatisch — Umriss nur für Sonderformen'
                    : 'Nur nötig, wenn das Dach kein Rechteck ist'
              }
              onClick={() => wechsleModus('umriss')}
            />
            <SchrittChip
              nr="④"
              label="Hindernisse"
              aktiv={modus === 'hindernis'}
              erledigt={(flaeche.hindernisse ?? []).length > 0}
              gesperrt={!foto.eckenPx}
              titel={!foto.eckenPx ? 'Erst die 4 Ecken setzen' : 'Kamin/Fenster/SAT einrahmen'}
              onClick={() => wechsleModus('hindernis')}
            />
            {modus === 'first' && (
              <button type="button" className={knopfKlasse} onClick={() => wechsleModus('perspektive')}>
                ➡ Überspringen ({kantenName} ist unten)
              </button>
            )}
            {istSchraegdach && (
              <button type="button" className={modusKnopfKlasse(modus === 'ziegel')} onClick={() => wechsleModus('ziegel')}>
                Ziegel zählen (Maßstab)
              </button>
            )}

            {(modus === 'perspektive' || modus === 'first') && (
              <button
                type="button"
                disabled={punkte.length === 0}
                className={`${knopfKlasse} disabled:opacity-40`}
                onClick={() => setPunkte(punkte.slice(0, -1))}
              >
                ↶ Punkt zurück
              </button>
            )}
            {modus === 'umriss' && (
              <>
                <button
                  type="button"
                  disabled={punkte.length < 3}
                  className="h-9 rounded-lg bg-akzent px-3 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={() => umrissAbschliessen(punkte)}
                >
                  ✓ Umriss fertig ({punkte.length} Ecken)
                </button>
                <button
                  type="button"
                  disabled={punkte.length === 0}
                  className={`${knopfKlasse} disabled:opacity-40`}
                  onClick={() => setPunkte(punkte.slice(0, -1))}
                >
                  ↶ Punkt zurück
                </button>
              </>
            )}
            {modus === 'ziegel' && istSchraegdach && (
              <>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={100}
                    value={anzahlZiegel}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n >= 1) setAnzahlZiegel(n);
                    }}
                    className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                  />
                  Ziegel à
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={80}
                    value={deckCm}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n > 0) setDeckbreiteCm(n);
                    }}
                    className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                  />
                  cm Deckbreite
                </label>
              </>
            )}
            {foto.eckenPx && (
              <button
                type="button"
                className="ml-auto h-9 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => {
                  setPunkte([]);
                  onPatch({ markierungFertig: true });
                }}
              >
                ✓ {flaechenName} belegen →
              </button>
            )}
          </div>

          {modus === 'first' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {istSchraegdach ? (
                <>
                  <strong>Trauflinie (2 Klicks entlang der Traufe/Dachrinne):</strong> die{' '}
                  <strong>unterste waagerechte Dachkante</strong> anklicken. Damit weiß das Programm,
                  wo unten ist — die 4 Ecken danach sind in <strong>beliebiger Reihenfolge</strong>{' '}
                  klickbar. Traufe bereits unten im Bild? <strong>„Überspringen“</strong> genügt.
                </>
              ) : (
                <>
                  <strong>{kantenName} festlegen:</strong> mit 2 Klicks eine gut erkennbare Kante
                  markieren. Sie bestimmt nur, wie die Fläche im Foto gedreht ist. Liegt diese Kante
                  bereits unten im Bild? <strong>„Überspringen“</strong> genügt.
                </>
              )}
            </p>
          ) : modus === 'perspektive' ? (
            parametrisch ? (
              <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <strong>
                  Perspektive – 4 Ecken ({flaeche.dachform === 'schief' ? 'Parallelogramm/schief' : 'Trapez/Walm'}):
                </strong>{' '}
                die 4 <strong>echten Dach-Ecken</strong> anklicken — 2 an der Traufe, 2 am First
                oben. <strong>Keine Ecken in die Luft verlängern!</strong> Das Tool kennt die Form
                (Firstbreite {fmtDe(firstBreiteEff ?? B, 1)} m
                {flaeche.dachform === 'schief' && flaeche.firstVersatzM
                  ? `, Versatz ${fmtDe(flaeche.firstVersatzM, 1)} m`
                  : ''}
                ) aus Schritt 2 und rechnet sie automatisch — kein Umriss nötig. Reihenfolge egal.{' '}
                <strong>Ecke nicht genau getroffen? Einfach mit der Maus draufziehen.</strong>
              </p>
            ) : (
              <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                {istSchraegdach ? (
                  <>
                    <strong>Perspektive – 4 Ecken:</strong> die 4 Ecken des
                    Dach-<strong>Rechtecks</strong> anklicken (Traufe + First),{' '}
                    <strong>Reihenfolge egal</strong>. Liegt eine Ecke in der Luft, am{' '}
                    <strong>Fadenkreuz</strong> ausrichten. Sitzt die Belegung verdreht:{' '}
                    <strong>↻ Traufe wechseln</strong>.
                  </>
                ) : (
                  <>
                    <strong>Perspektive – 4 Ecken:</strong> die vier äußeren Ecken der{' '}
                    {istFlachdach ? 'Flachdachfläche' : 'Fassade'} anklicken,{' '}
                    <strong>Reihenfolge egal</strong>. Das Fadenkreuz hilft bei verdeckten oder
                    schwer sichtbaren Ecken. Sitzt die Belegung verdreht:{' '}
                    <strong>↻ {kantenName} wechseln</strong>.
                  </>
                )}
              </p>
            )
          ) : modus === 'umriss' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Umriss zeichnen:</strong> den echten Rand der Fläche der Reihe nach
              anklicken (Fadenkreuz hilft beim Zielen). Schließen: ersten Punkt oder „Umriss fertig".{' '}
              <strong>Rechteckige Fläche → einfach „{flaechenName} belegen"</strong>.{' '}
              <em>Warum zwei Schritte? Die 4 Ecken sagen dem Tool, WIE die Fläche im Foto liegt — der
              Umriss sagt ihm die FORM.</em>
            </p>
          ) : modus === 'hindernis' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Hindernis markieren:</strong>{' '}
              {istSchraegdach ? 'Kamin, Dachfenster oder SAT' : istFlachdach ? 'Lichtkuppel, Lüfter oder Technik' : 'Fenster, Türen oder Anbauten'} mit{' '}
              <strong>2 Klicks</strong> einrahmen — solange die Fläche noch leer ist. Diese Bereiche
              bleiben frei. Mehrere möglich.
            </p>
          ) : (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Ziegel zählen:</strong> Anfang und Ende über {anzahlZiegel} Ziegelbreiten{' '}
              <strong>entlang einer Reihe</strong> anklicken (quer zur Falllinie). Beton: 30 cm ist
              Standard; Ton je Modell 18–30 cm.
            </p>
          )}

          <div
            className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
            style={{
              aspectRatio: `${foto.breitePx} / ${foto.hoehePx}`,
              maxHeight: 480,
              maxWidth: (480 * foto.breitePx) / foto.hoehePx,
            }}
          >
            <svg
              viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
              className={`block h-full w-full ${greift ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              preserveAspectRatio="xMidYMid meet"
              onClick={klick}
              onMouseDown={(e) => {
                const k = svgKoord(e);
                const h = k ? naheHandle(k) : undefined;
                aufHandle.current = !!h;
                if (h) {
                  ziehtRef.current = h.z;
                  setGreift(true);
                  e.preventDefault();
                }
              }}
              onMouseMove={(e) => {
                const k = svgKoord(e);
                setMausPx(k);
                if (ziehtRef.current && k) setzeHandle(ziehtRef.current, k);
              }}
              onMouseUp={() => {
                ziehtRef.current = null;
                setGreift(false);
              }}
              onMouseLeave={() => {
                setMausPx(null);
                ziehtRef.current = null;
                setGreift(false);
              }}
            >
              <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />

              {/* Firstlinie (Achs-Referenz) — bleibt als Guide sichtbar */}
              {firstLinie && (
                <g>
                  <line
                    x1={firstLinie[0][0]}
                    y1={firstLinie[0][1]}
                    x2={firstLinie[1][0]}
                    y2={firstLinie[1][1]}
                    stroke="#0d9488"
                    strokeWidth={px(0.003)}
                    strokeLinecap="round"
                  />
                  {firstLinie.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r={px(0.008)} fill="#0d9488" stroke="#fff" strokeWidth={px(0.002)} />
                  ))}
                </g>
              )}

              {/* Bereits gesetzter Umriss / Perspektiv-Rechteck */}
              {foto.eckenPx && (
                <polygon
                  points={(flaeche.umrissM && hom
                    ? flaeche.umrissM.map((p) => projiziere(hom, [p[0], p[1]]))
                    : foto.eckenPx
                  )
                    .map(([qx, qy]) => `${qx.toFixed(1)},${qy.toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={px(0.002)}
                  strokeDasharray={`${px(0.01)} ${px(0.006)}`}
                />
              )}

              {/* Ziehbare Ecken-Griffe: nur im Perspektive-Modus, zum exakten Nachjustieren */}
              {modus === 'perspektive' &&
                foto.eckenPx?.map((p, i) => (
                  <g key={i} style={{ cursor: 'grab' }}>
                    <circle cx={p[0]} cy={p[1]} r={px(0.018)} fill="rgba(249,115,22,0.18)" />
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={px(0.01)}
                      fill="#f97316"
                      stroke="#ffffff"
                      strokeWidth={px(0.0028)}
                    />
                  </g>
                ))}

              {/* Bereits markierte Hindernisse */}
              {hom &&
                (flaeche.hindernisse ?? []).map((r, i) => (
                  <polygon
                    key={i}
                    points={[
                      [r.xM, r.yM],
                      [r.xM + r.breiteM, r.yM],
                      [r.xM + r.breiteM, r.yM + r.hoeheM],
                      [r.xM, r.yM + r.hoeheM],
                    ]
                      .map((p) => projiziere(hom, p as Punkt))
                      .map(([qx, qy]) => `${qx.toFixed(1)},${qy.toFixed(1)}`)
                      .join(' ')}
                    fill="rgba(239,68,68,0.4)"
                    stroke="#ef4444"
                    strokeWidth={px(0.002)}
                  />
                ))}

              {/* Fadenkreuz am Mauszeiger — kräftig, mit weißem Halo + Zielring (auf
                  jedem Fotohintergrund gut sichtbar) */}
              {zeigtKreuz && mausPx && (
                <g style={{ pointerEvents: 'none' }}>
                  <g stroke="#ffffff" strokeOpacity={0.85} strokeWidth={px(0.0045)} fill="none">
                    <line x1={0} y1={mausPx[1]} x2={foto.breitePx} y2={mausPx[1]} />
                    <line x1={mausPx[0]} y1={0} x2={mausPx[0]} y2={foto.hoehePx} />
                    <circle cx={mausPx[0]} cy={mausPx[1]} r={px(0.013)} />
                  </g>
                  <g stroke="#0284c7" strokeOpacity={0.95} strokeWidth={px(0.002)} fill="none">
                    <line x1={0} y1={mausPx[1]} x2={foto.breitePx} y2={mausPx[1]} />
                    <line x1={mausPx[0]} y1={0} x2={mausPx[0]} y2={foto.hoehePx} />
                    <circle cx={mausPx[0]} cy={mausPx[1]} r={px(0.013)} />
                  </g>
                </g>
              )}

              {/* Vorschaulinie: letzter Punkt → Mauszeiger */}
              {(modus === 'first' || modus === 'perspektive' || modus === 'umriss') && letzter && mausPx && (
                <line
                  x1={letzter[0]}
                  y1={letzter[1]}
                  x2={mausPx[0]}
                  y2={mausPx[1]}
                  stroke="#f97316"
                  strokeOpacity={0.7}
                  strokeWidth={px(0.0022)}
                  strokeDasharray={`${px(0.008)} ${px(0.005)}`}
                />
              )}

              {/* Bisher gesetzte Punkte + Verbindung */}
              {punkte.length >= 2 && (
                <polyline
                  points={punkte.map(([qx, qy]) => `${qx},${qy}`).join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={px(0.0025)}
                  strokeDasharray={`${px(0.008)} ${px(0.005)}`}
                />
              )}
              {modus === 'umriss' && punkte.length >= 3 && (
                <line
                  x1={punkte[punkte.length - 1]![0]}
                  y1={punkte[punkte.length - 1]![1]}
                  x2={punkte[0]![0]}
                  y2={punkte[0]![1]}
                  stroke="#f97316"
                  strokeOpacity={0.4}
                  strokeWidth={px(0.0016)}
                  strokeDasharray={`${px(0.004)} ${px(0.004)}`}
                />
              )}
              {punkte.map(([qx, qy], i) => (
                <circle
                  key={i}
                  cx={qx}
                  cy={qy}
                  r={px(i === 0 && modus === 'umriss' && punkte.length >= 3 ? 0.011 : 0.007)}
                  fill={modus === 'first' ? '#0d9488' : modus === 'ziegel' ? '#0ea5e9' : modus === 'hindernis' ? '#ef4444' : i === 0 && modus === 'umriss' ? '#ea580c' : '#f97316'}
                  stroke="#ffffff"
                  strokeWidth={px(0.002)}
                />
              ))}
            </svg>
          </div>

          {modus === 'hindernis' && (flaeche.hindernisse ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(flaeche.hindernisse ?? []).map((h, i) => (
                <button
                  key={i}
                  type="button"
                  title="Hindernis entfernen"
                  className="h-8 rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm font-medium text-red-700 hover:border-red-300"
                  onClick={() =>
                    onPatch({ hindernisse: (flaeche.hindernisse ?? []).filter((_, j) => j !== i), inaktiv: [] })
                  }
                >
                  {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m ✕
                </button>
              ))}
            </div>
          )}

          <p className="mt-1 text-xs text-slate-500">
            {modus === 'first'
              ? punkte.length === 0
                ? `Anfang der ${istSchraegdach ? 'First-/Trauflinie' : kantenName} anklicken.`
                : 'Ende der Linie anklicken.'
              : modus === 'perspektive'
              ? `Ecke ${punkte.length + 1} von 4 anklicken (${flaechenName}).`
              : modus === 'umriss'
                ? punkte.length < 3
                  ? `Ecke ${punkte.length + 1} anklicken (mind. 3) — oder „${flaechenName} belegen“ für ein Rechteck.`
                  : 'Weitere Ecken — oder ersten Punkt / „Umriss fertig" zum Schließen.'
                : modus === 'hindernis'
                  ? punkte.length === 0
                    ? 'Erste Ecke des Hindernisses anklicken.'
                    : 'Gegenüberliegende Ecke anklicken.'
                  : punkte.length === 0
                    ? 'Anfang der Ziegel-Strecke anklicken.'
                    : `Ende der ${anzahlZiegel}-Ziegel-Strecke anklicken.`}
          </p>
        </div>
      )}
    </div>
  );
}
