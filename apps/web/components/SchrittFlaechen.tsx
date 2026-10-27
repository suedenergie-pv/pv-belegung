'use client';
import { MontageVorschau } from './MontageVorschau';
import { DachSkizze } from './DachSkizze';
import styles from './SchrittFlaechen.module.css';

import { useEffect, useId, useRef, useState } from 'react';
import { flachdachMindestPitch, montageGeometrie } from '@pv-belegung/engine';

import {
  AZIMUT_PRESETS,
  massFreigabe,
  modulById,
  artVon,
  farbenFuer,
  flachdachPitchDefault,
  fotoZuordnungenVon,
  naechsteZone,
  neueFlaeche,
  patchFlaechenGeometrie,
  randDefaultVon,
  zonenVon,
  type Dachform,
  type DachfarbeId,
  type Flaeche,
  type FlaechenArt,
  type Projekt,
} from '../lib/model';
import { Karte, KartenTitel, ZonenBadge } from './ui';

type SeitenAusrichtung = 'links' | 'mittig' | 'rechts' | 'frei';

function seitenAusrichtung(f: Flaeche): SeitenAusrichtung {
  const versatz = f.dachform === 'schief' ? f.firstVersatzM ?? 0 : 0;
  if (Math.abs(versatz) < 1e-7) return 'mittig';
  const einzug = (f.breiteM - (f.firstBreiteM ?? f.breiteM)) / 2;
  if (Math.abs(versatz + einzug) < 1e-7) return 'links';
  if (Math.abs(versatz - einzug) < 1e-7) return 'rechts';
  return 'frei';
}

function ausrichtungsVersatz(ausrichtung: SeitenAusrichtung, breite: number, oben: number, frei = 0): number {
  return ausrichtung === 'links' ? (oben - breite) / 2
    : ausrichtung === 'rechts' ? (breite - oben) / 2
      : ausrichtung === 'mittig' ? 0 : frei;
}

function dachrandAusFoto(f: Flaeche): boolean {
  return !!f.fotoBezugsrahmen && (f.umrissM?.length ?? 0) >= 3;
}

const kompaktInput =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-base text-slate-800 focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30';

function KompaktZahl({
  label,
  value,
  onChange,
  min,
  max,
  maxFehler,
  entwurfErhalten = false,
  standardBeiLeer = false,
  onFocus,
  step = 0.1,
  einheit,
  breite = 'w-24',
  initialLeer = false,
  fehlerAnzeigen = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  maxFehler?: string;
  entwurfErhalten?: boolean;
  standardBeiLeer?: boolean;
  onFocus?: () => void;
  step?: number;
  einheit?: string;
  breite?: string;
  initialLeer?: boolean;
  fehlerAnzeigen?: boolean;
}) {
  const [eingabe, setEingabe] = useState(initialLeer ? '' : String(value));
  const fehlerId = useId();
  const [beruehrt, setBeruehrt] = useState(false);
  const letzterWert = useRef({ value, initialLeer });
  const offeneEingabe = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (entwurfErhalten && offeneEingabe.current && letzterWert.current.initialLeer === initialLeer) {
      letzterWert.current = { value, initialLeer };
      return;
    }
    offeneEingabe.current = false;
    if (letzterWert.current.initialLeer !== initialLeer) setEingabe(initialLeer ? '' : String(value));
    else if (letzterWert.current.value !== value) setEingabe(Number.isFinite(value) ? String(value) : '');
    letzterWert.current = { value, initialLeer };
  }, [value, initialLeer]);
  const pruefe = (roh: string): { wert?: number; fehler?: string } => {
    if (!roh.trim() && standardBeiLeer) return { wert: value };
    if (!roh.trim()) return { fehler: `${label} ist erforderlich.` };
    const wert = Number(roh.replace(',', '.'));
    if (!Number.isFinite(wert)) return { fehler: `${label} muss eine Zahl sein.` };
    if (min !== undefined && wert < min) return { fehler: `${label} muss mindestens ${min} sein.` };
    if (max !== undefined && wert > max) return { fehler: maxFehler ?? `${label} darf höchstens ${max} sein.` };
    return { wert };
  };
  // Abhängige Grenzen können sich durch ein anderes Feld ändern. Den sichtbaren
  // Entwurf dann übernehmen, statt unbemerkt den alten Modellwert zu speichern.
  useEffect(() => {
    if (!offeneEingabe.current) return;
    const neu = pruefe(eingabe);
    if (neu.wert !== undefined) {
      offeneEingabe.current = false;
      if (neu.wert !== value) onChangeRef.current(neu.wert);
    }
  }, [min, max]);
  const ergebnis = pruefe(eingabe);
  const zeigeFehler = !!ergebnis.fehler && (!initialLeer || beruehrt || fehlerAnzeigen);
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          placeholder={standardBeiLeer ? 'Wie unten' : undefined}
          className={`${kompaktInput} ${breite} ${styles.zahlEingabe}`}
          data-fehler={zeigeFehler}
          value={eingabe}
          min={min}
          max={max}
          step={step}
          aria-invalid={!!ergebnis.fehler}
          aria-describedby={zeigeFehler ? fehlerId : undefined}
          onFocus={(e) => {
            onFocus?.();
            const label = e.currentTarget.closest('label');
            if (onFocus) requestAnimationFrame(() => label?.scrollIntoView?.({block:'nearest'}));
          }}
          onBlur={() => setBeruehrt(true)}
          onChange={(e) => {
            const roh = e.target.value;
            setEingabe(roh);
            setBeruehrt(true);
            const neu = pruefe(roh);
            offeneEingabe.current = neu.wert === undefined;
            if (neu.wert !== undefined) onChange(neu.wert);

          }}
        />
        {einheit && <span className="text-sm text-slate-600">{einheit}</span>}
      </span>
      {zeigeFehler && <span id={fehlerId} className="mt-1 block max-w-48 text-sm text-red-700">{ergebnis.fehler}</span>}
    </label>
  );
}

export function SchrittFlaechen({
  projekt,
  onChange,
  nurFlaecheId,
  eingebettet = false,
  onFertig,
  entwurfsModus = false,
  fehlerAnzeigen = false,
  onMontageHinweis,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
  nurFlaecheId?: string;
  eingebettet?: boolean;
  onFertig?: (flaecheId: string) => void;
  entwurfsModus?: boolean;
  fehlerAnzeigen?: boolean;
  onMontageHinweis?: (hinweis: string | null) => void;
}) {
  const [oberesMassReset, setOberesMassReset] = useState<Record<string, number>>({});
  const [massFokus, setMassFokus] = useState<{id: string; kante: 'unten' | 'oben' | 'laenge'} | null>(null);
  const [montageHinweis, setMontageHinweis] = useState<{ id: string; text: string } | null>(null);
  const meldeMontageHinweis = (id: string, text: string | null) => {
    setMontageHinweis(text ? { id, text } : null);
    onMontageHinweis?.(text);
  };
  const setFlaeche = (id: string, patch: Partial<Flaeche>) =>
    onChange({
      ...projekt,
      flaechen: projekt.flaechen.map((f) =>
        f.id === id ? patchFlaechenGeometrie(f, patch) : f,
      ),
    });

  const formAendern = (f: Flaeche, dachform: Dachform, masse: Partial<Flaeche> = {}) => {
    const altForm = f.dachform ?? 'rechteck';
    if (dachform === altForm) { setFlaeche(f.id, masse); return; }
    const felder = f.felder?.length ?? 0;
    const inaktive = f.felder?.reduce(
      (summe, feld) => summe + (feld.leer?.length ?? 0),
      0,
    ) ?? 0;
    const perspektiven = fotoZuordnungenVon(f).length;
    const folgen = [
      felder ? `${felder} Belegungsbereich${felder === 1 ? '' : 'e'} wird zurückgesetzt` : '',
      inaktive ? `${inaktive} einzeln abgeschaltete Module werden zurückgesetzt` : '',
      f.umrissM ? 'der manuelle Umriss wird entfernt' : '',
      perspektiven
        ? `die ${perspektiven === 1 ? 'Fotoperspektive bleibt zugeordnet, muss' : 'Fotoperspektiven bleiben zugeordnet, müssen'} neu bestätigt werden`
        : '',
    ].filter(Boolean);
    if (!entwurfsModus && folgen.length && !window.confirm(`Dachform ändern? ${folgen.join('; ')}.`)) return;
    const wechselReset: Partial<Flaeche> = {
      felder: [],
      inaktiv: [],
      fotoZuordnungen: fotoZuordnungenVon(f).map((zuordnung) => ({
        ...zuordnung,
        perspektiveBestaetigt: false,
        markierungFertig: false,
      })),
    };
    if (dachform === 'rechteck') {
      setFlaeche(f.id, {
        ...wechselReset,
        dachform,
        firstBreiteM: undefined,
        firstVersatzM: undefined,
        umrissM: undefined,
        ...masse,
      });
    } else if (dachform === 'trapez') {
      setFlaeche(f.id, {
        ...wechselReset,
        dachform,
        firstBreiteM: f.firstBreiteM ?? f.breiteM,
        firstVersatzM: undefined,
        umrissM: undefined,
        ...masse,
      });
    } else {
      setFlaeche(f.id, {
        ...wechselReset,
        dachform,
        firstBreiteM: f.firstBreiteM ?? f.breiteM,
        firstVersatzM: f.firstVersatzM ?? 0,
        umrissM: undefined,
        ...masse,
      });
    }
  };

  const obereBreiteAendern = (f: Flaeche, firstBreiteM: number) => {
    const dachform = f.dachform === 'schief' ? 'schief' : firstBreiteM === f.breiteM ? 'rechteck' : 'trapez';
    formAendern(f, dachform, {
      firstBreiteM: dachform === 'rechteck' ? undefined : firstBreiteM,
      ...(dachform === 'schief' ? { firstVersatzM: ausrichtungsVersatz(seitenAusrichtung(f), f.breiteM, firstBreiteM, f.firstVersatzM) } : {}),
    });
  };

  const seiteAendern = (f: Flaeche, ausrichtung: Exclude<SeitenAusrichtung, 'frei'>) => {
    const oben = f.firstBreiteM ?? f.breiteM;
    const firstVersatzM = ausrichtungsVersatz(ausrichtung, f.breiteM, oben);
    formAendern(f, firstVersatzM === 0 ? (oben === f.breiteM ? 'rechteck' : 'trapez') : 'schief', { firstBreiteM: oben, firstVersatzM });
  };

  const setArt = (f: Flaeche, art: FlaechenArt, einsatzort: Flaeche['einsatzort'] = 'gebaeude') => {
    if (artVon(f) === art && (f.einsatzort ?? 'gebaeude') === einsatzort) return;
    meldeMontageHinweis(f.id, null);
    const felder = f.felder?.length ?? 0;
    const inaktive = f.felder?.reduce(
      (summe, feld) => summe + (feld.leer?.length ?? 0),
      0,
    ) ?? 0;
    const perspektiven = fotoZuordnungenVon(f).length;
    const folgen = [
      felder ? `${felder} Belegungsbereich${felder === 1 ? '' : 'e'} wird zurückgesetzt` : '',
      inaktive ? `${inaktive} einzeln abgeschaltete Module werden zurückgesetzt` : '',
      f.umrissM ? 'der manuelle Umriss wird entfernt' : '',
      perspektiven
        ? `die ${perspektiven === 1 ? 'Fotoperspektive bleibt zugeordnet, muss' : 'Fotoperspektiven bleiben zugeordnet, müssen'} neu bestätigt werden`
        : '',
    ].filter(Boolean);
    if (!entwurfsModus && folgen.length && !window.confirm(`Flächenart ändern? ${folgen.join('; ')}.`)) return;
    const patch: Partial<Flaeche> = {
      art,
      einsatzort,
      ...(/^(Dachfläche|Hallendach|Freifläche) \d+$/.test(f.name) ? { name: f.name.replace(/^(Dachfläche|Hallendach|Freifläche)/, einsatzort === 'freiflaeche' ? 'Freifläche' : einsatzort === 'halle' ? 'Hallendach' : 'Dachfläche') } : {}),
      randM: undefined,
      dachform: 'rechteck',
      umrissM: undefined,
      felder: [],
      inaktiv: [],
      fotoZuordnungen: fotoZuordnungenVon(f).map((zuordnung) => ({
        ...zuordnung,
        perspektiveBestaetigt: false,
        markierungFertig: false,
      })),
    };
    if (art === 'flachdach') {
      patch.neigungDeg = 0;
      patch.flachdach = einsatzort === 'freiflaeche' ? { aufstaenderung: 'sued', winkelDeg: 25, modulAusrichtung: 'hoch', moduleInNeigung: 2, pitchM: 5, richtungSued: 'unten' } : f.flachdach ?? {
        aufstaenderung: 'ostwest',
        winkelDeg: 10,
        richtungSued: 'unten',
      };
      patch.dachfarbe = 'bitumen';
    } else {
      patch.flachdach = undefined;
      if (art === 'fassade') {
        patch.neigungDeg = 90;
        patch.dachfarbe = 'putz';
      } else {
        patch.neigungDeg = 35;
        patch.dachfarbe = 'anthrazit';
      }
    }
    setFlaeche(f.id, patch);
  };

  const hauptflaechen = projekt.flaechen.filter(
    (f) => !f.gaubenTyp && (!nurFlaecheId || f.id === nurFlaecheId),
  );
  const naechsteNr = () =>
    Math.max(0, ...projekt.flaechen.map((f) => Number.parseInt(f.id.slice(1), 10) || 0)) + 1;

  return (
    <div className="space-y-4">
      {hauptflaechen.map((f, i) => (
        <Karte
          key={f.id}
          className={eingebettet ? 'border-0 bg-transparent p-0 shadow-none' : ''}
        >
          {!eingebettet && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZonenBadge label={zonenVon(f, i)} />
                <KartenTitel>{f.name}</KartenTitel>
              </div>
              {hauptflaechen.length > 1 && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-700 hover:text-red-600"
                  onClick={() =>
                    onChange({
                      ...projekt,
                      flaechen: projekt.flaechen.filter(
                        (x) => x.id !== f.id && x.elternFlaecheId !== f.id,
                      ),
                      mppts: projekt.mppts.map((strings) =>
                        strings.filter(
                          (s) =>
                            s.flaecheId !== f.id &&
                            !projekt.flaechen.some(
                              (x) => x.id === s.flaecheId && x.elternFlaecheId === f.id,
                            ),
                        ),
                      ),
                    })
                  }
                >
                  Entfernen
                </button>
              )}
            </div>
          )}

          <label className={styles.flaechenName}><span>Name der Fläche</span><input className={kompaktInput} value={f.name} maxLength={80} aria-invalid={!f.name.trim()} placeholder="z. B. Hauptdach, Anbau oder Garage" onChange={e => setFlaeche(f.id,{name:e.target.value})} />
            <span className={styles.nameHilfe}>z. B. Hauptdach, Anbau oder Garage</span></label>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Art der Fläche</span>
              <select
                aria-label="Art der Fläche"
                value={f.einsatzort === 'freiflaeche' ? 'freiflaeche' : f.einsatzort === 'halle' ? `halle-${artVon(f)}` : artVon(f)}
                onChange={(e) => {
                  const wert = e.target.value;
                  if (wert === 'freiflaeche') setArt(f, 'flachdach', 'freiflaeche');
                  else if (wert.startsWith('halle-')) setArt(f, wert.slice(6) as FlaechenArt, 'halle');
                  else setArt(f, wert as FlaechenArt);
                }}
                className={`${kompaktInput} w-full max-w-full font-medium`}
              >
                <option value="dach">Schrägdach</option>
                <option value="flachdach">Flachdach · Aufständerung</option>
                <option value="halle-flachdach">Halle · Flachdach</option>
                <option value="halle-dach">Halle · Schrägdach</option>
                <option value="freiflaeche">Freifläche · Modultische</option>
            {artVon(f) === 'fassade' && <option value="fassade">Fassade · Bestand</option>}
              </select>
            </label>


            <div className={styles.masse}>
              {artVon(f) === 'dach' && <DachSkizze flaeche={f} aktiv={massFokus?.id === f.id ? massFokus.kante : undefined} />}
              <div className={styles.massZeilen}>
                <KompaktZahl fehlerAnzeigen={fehlerAnzeigen} label={dachrandAusFoto(f) ? 'Gesamtbreite' : artVon(f) === 'dach' ? 'Breite unten (Traufe)' : 'Breite'} einheit="m" value={f.breiteM}
                  initialLeer={!!f.massEingabeOffen && !f.grunddatenFertig && !massFreigabe(f).belegen} min={1}
                  onFocus={() => setMassFokus({id:f.id,kante:'unten'})} onChange={breiteM => setFlaeche(f.id,{
                    breiteM,
                    ...(f.dachform === 'schief' && !dachrandAusFoto(f) ? { firstVersatzM: ausrichtungsVersatz(seitenAusrichtung(f), breiteM, f.firstBreiteM ?? f.breiteM, f.firstVersatzM) } : {}),
                  })} />
                {artVon(f) !== 'flachdach' && !dachrandAusFoto(f) && <div>
                  <KompaktZahl key={`${f.id}-${oberesMassReset[f.id] ?? 0}`} entwurfErhalten fehlerAnzeigen={fehlerAnzeigen} label="Breite oben (First)" standardBeiLeer={(f.dachform ?? 'rechteck') === 'rechteck'} einheit="m" value={f.firstBreiteM ?? f.breiteM}
                    initialLeer={!!f.massEingabeOffen && !f.grunddatenFertig && !massFreigabe(f).belegen} min={0} max={f.breiteM}
                    maxFehler={`Oben ist länger als die eingetragene Breite unten (${f.breiteM.toLocaleString('de-DE')} m). Prüfe die untere Breite; dein oberes Maß bleibt erhalten.`}
                    onFocus={() => setMassFokus({id:f.id,kante:'oben'})}
                    onChange={firstBreiteM => obereBreiteAendern(f,firstBreiteM)} />
                  <div className={styles.obenHilfen}>
                    <button type="button" className={styles.gleichBreit} aria-pressed={(f.dachform ?? 'rechteck') === 'rechteck'} onClick={() => { formAendern(f,'rechteck'); setOberesMassReset(v => ({...v,[f.id]:(v[f.id] ?? 0)+1})); }}>Oben genauso breit</button>
                    <button type="button" className={styles.gleichBreit} aria-pressed={f.firstBreiteM === 0} onClick={() => { obereBreiteAendern(f,0); setOberesMassReset(v => ({...v,[f.id]:(v[f.id] ?? 0)+1})); }}>Oben läuft das Dach spitz zu</button>
                  </div>
                  {f.firstBreiteM === 0 && <p className={styles.massHinweis}>Bei einer Dachspitze ist die Breite oben 0 m.</p>}
                </div>}
                <KompaktZahl fehlerAnzeigen={fehlerAnzeigen} label={dachrandAusFoto(f) ? 'Tiefe auf dem Dach' : artVon(f) === 'dach' ? 'Länge auf dem Dach (Sparren)' : artVon(f) === 'fassade' ? 'Höhe' : 'Tiefe'} einheit="m" value={f.hoeheM}
                  initialLeer={!!f.massEingabeOffen && !f.grunddatenFertig && !massFreigabe(f).belegen} min={1}
                  onFocus={() => setMassFokus({id:f.id,kante:'laenge'})} onChange={hoeheM => setFlaeche(f.id,{hoeheM})} />
              </div>
              {dachrandAusFoto(f) && <p className={styles.massHinweis}>Der Dachrand wurde im Foto markiert. Die Maße gelten für seine gesamte Breite und Tiefe. Ecken änderst du mit „Dachrand bearbeiten“ im Foto.</p>}
              {artVon(f) !== 'flachdach' && !dachrandAusFoto(f) && <>
                {((f.firstBreiteM ?? f.breiteM) < f.breiteM || seitenAusrichtung(f) === 'frei') && <fieldset className={styles.seitenWahl}>
                  <legend>{f.firstBreiteM === 0 ? 'Wo liegt die Dachspitze?' : 'Welche Seite läuft gerade?'} <span>Optional</span></legend>
                  <div className={styles.seitenOptionen}>
                    {(['links','mittig','rechts'] as const).map(seite => {
                      const spitze = f.firstBreiteM === 0;
                      const links = seite === 'links' ? 7 : seite === 'rechts' ? (spitze ? 49 : 25) : (spitze ? 28 : 16);
                      const rechts = spitze ? links : links + 24;
                      return <button key={seite} type="button" aria-pressed={seitenAusrichtung(f) === seite} onClick={() => seiteAendern(f,seite)}>
                        <svg aria-hidden="true" viewBox="0 0 56 32" width="56" height="32"><path d={`M7 27 H49 L${rechts} 5 H${links} Z`} fill="none" stroke="currentColor" strokeWidth="1.5" /><path d={seite === 'links' ? `M7 27 V5` : seite === 'rechts' ? `M49 27 V5` : 'M28 27 V5'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={seite === 'mittig' ? '3 3' : undefined} /></svg>
                        <span>{spitze ? seite === 'links' ? 'Spitze links' : seite === 'rechts' ? 'Spitze rechts' : 'Mittig' : seite === 'links' ? 'Links gerade' : seite === 'rechts' ? 'Rechts gerade' : 'Mittig'}</span>
                      </button>;
                    })}
                  </div>
                  {seitenAusrichtung(f) === 'frei' && <p>Eigene seitliche Lage – unter „Seitliche Lage genauer einstellen“ anpassbar.</p>}
                </fieldset>}
                <details className={styles.besondereKanten}><summary>Seitliche Lage genauer einstellen</summary>
                  <p>Für Dächer, bei denen keine Seite gerade läuft. 0 m legt die obere Mitte genau über die untere Mitte.</p>
                  <KompaktZahl label="Obere Mitte verschieben" einheit="m" value={f.dachform === 'schief' ? f.firstVersatzM ?? 0 : 0}
                    onChange={firstVersatzM => formAendern(f,'schief',{firstVersatzM,firstBreiteM:f.firstBreiteM ?? f.breiteM})} />
                  <p>Minus verschiebt nach links, Plus nach rechts. Die Skizze zeigt die Änderung.</p>
                </details>
                <p className={styles.massHinweis}>Weitere Ecken oder Einschnitte? Den tatsächlichen Dachrand zeichnest du im Foto. Jede anders geneigte Dachseite erhält eine eigene Fläche.</p>
              </>}
            </div>
            {artVon(f) !== 'flachdach' && (
              <label>
                <span className="mb-1 block text-sm font-medium text-slate-700">Ausrichtung</span>
                <select
                  aria-label="Ausrichtung"
                  value={AZIMUT_PRESETS.some((a) => a.deg === f.azimutDeg) ? f.azimutDeg : 'frei'}
                  onChange={(e) => {
                    if (e.target.value !== 'frei') setFlaeche(f.id, { azimutDeg: Number(e.target.value) });
                  }}
                  className={`${kompaktInput} w-36 font-medium`}
                >
                  {AZIMUT_PRESETS.map((a) => <option key={a.deg} value={a.deg}>{a.label}</option>)}
                  <option value="frei" disabled>Eigener Winkel</option>
                </select>
              </label>
            )}
            {artVon(f) === 'dach' && (
              <KompaktZahl
              fehlerAnzeigen={fehlerAnzeigen}
                label="Dachneigung"
                einheit="°"
                value={f.neigungDeg}
                min={0}
                max={75}
                step={1}
                breite="w-20"
                onChange={(neigungDeg) => setFlaeche(f.id, { neigungDeg })}
              />
            )}
            {eingebettet && onFertig && (
              <button
                type="button"
                className="ml-auto h-10 rounded-lg bg-akzent px-5 text-sm font-semibold text-white hover:bg-akzent/90"
                onClick={() => onFertig(f.id)}
              >
                Dachfläche übernehmen
              </button>
            )}
          </div>

          {artVon(f) === 'flachdach' && f.flachdach && (() => {
            const m = f.flachdach;
            const modul = modulById(projekt.modulId);
            const g = montageGeometrie(modul, m);
            const pitch = m.pitchM ?? flachdachPitchDefault(m.aufstaenderung, m.winkelDeg);
            const setMontage = (patch: Partial<NonNullable<Flaeche['flachdach']>>) => {
              const neu = { ...m, ...patch };
              // Format-/Neigungswechsel darf keine geometrisch überlappenden Tische hinterlassen.
              const minimum = Math.ceil(flachdachMindestPitch(modul, neu) * 100) / 100;
              const gewuenscht = patch.pitchM ?? pitch;
              const abstand = Math.max(gewuenscht, minimum);
              if (abstand > gewuenscht) meldeMontageHinweis(f.id, `Abstand erhöht: ${gewuenscht.toLocaleString('de-DE')} → ${abstand.toLocaleString('de-DE')} m.`);
              else if (patch.pitchM !== undefined) meldeMontageHinweis(f.id, null);
              setFlaeche(f.id, { flachdach: { ...neu, pitchM: abstand } });
            };
            const vorlage = (m.moduleInNeigung ?? 1) === 1 && (m.modulAusrichtung ?? 'quer') === 'quer'
              && ['ostwest-10', 'sued-10', 'sued-15'].includes(`${m.aufstaenderung}-${m.winkelDeg}`)
                ? `${m.aufstaenderung}-${m.winkelDeg}` : 'frei';
            return <section aria-label="Montage planen" className="mt-4 space-y-4 border-t border-slate-200 pt-4">
              <div><h3 className="font-semibold text-slate-900">So stehen die Module</h3>
                <p className="mt-1 text-sm text-slate-600">Vorlage wählen. Neigung, Format und Tischgröße darunter frei anpassen.</p></div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Aufständerung</span>
                <select aria-label="Aufständerung" className={`${kompaktInput} w-full`} value={vorlage}
                  onChange={e => {
                    if (e.target.value === 'frei') return;
                    const [art, winkel] = e.target.value.split('-');
                    setMontage({ aufstaenderung: art as 'sued' | 'ostwest', winkelDeg: Number(winkel),
                      modulAusrichtung: 'quer', moduleInNeigung: 1, pitchM: flachdachPitchDefault(art as 'sued' | 'ostwest', Number(winkel)) });
                  }}>
                  <option value="ostwest-10">Ost-West · 10°</option>
                  <option value="sued-10">Süd · 10°</option>
                  <option value="sued-15">Süd · 15°</option>
                  <option value="frei" disabled>Individuell eingestellt</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="min-w-0 flex-1"><span className="mb-1 block text-sm font-medium text-slate-700">Anordnung</span>
                  <select aria-label="Anordnung der Modultische" className={`${kompaktInput} w-full`} value={m.aufstaenderung} onChange={e => setMontage({ aufstaenderung: e.target.value as 'sued' | 'ostwest' })}>
                    <option value="sued">Süd</option><option value="ostwest">Ost-West</option>
                  </select>
                </label>
                <KompaktZahl fehlerAnzeigen={fehlerAnzeigen} label="Modulneigung" value={m.winkelDeg} min={0} max={75} step={1} einheit="°" onChange={winkelDeg => setMontage({ winkelDeg })} />
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="min-w-0 flex-1"><span className="mb-1 block text-sm font-medium text-slate-700">Modulformat</span>
                  <select aria-label="Modulformat auf dem Tisch" className={`${kompaktInput} w-full`} value={m.modulAusrichtung ?? 'quer'} onChange={e => setMontage({ modulAusrichtung: e.target.value as 'hoch' | 'quer' })}>
                    <option value="quer">Querformat</option><option value="hoch">Hochformat</option>
                  </select>
                </label>
                <label className="min-w-0 flex-1"><span className="mb-1 block text-sm font-medium text-slate-700">Übereinander</span>
                  <select aria-label="Module übereinander je Tischseite" className={`${kompaktInput} w-full`} value={m.moduleInNeigung ?? 1} onChange={e => setMontage({ moduleInNeigung: Number(e.target.value) })}>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Modul' : 'Module'}</option>)}
                  </select>
                </label>
              </div>
              {!onMontageHinweis && montageHinweis?.id === f.id && <p role="status" className="text-sm text-amber-900">{montageHinweis.text}</p>}
              <p className="text-sm text-slate-600">„Übereinander“ zählt entlang der Neigung. Bei Ost-West gilt die Anzahl für jede Seite. Größere Tische können einen größeren Abstand erfordern; die automatische Anpassung verhindert Überlappungen.</p>
              <KompaktZahl fehlerAnzeigen={fehlerAnzeigen} label={m.aufstaenderung === 'ostwest' ? 'Abstand der Modulpaare' : 'Abstand der Reihen'} einheit="m" value={pitch}
                min={Math.ceil(g.mindestPitchM * 100) / 100} step={0.01} onChange={pitchM => { meldeMontageHinweis(f.id, null); setFlaeche(f.id, { flachdach: { ...m, pitchM } }); }} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <MontageVorschau geometrie={g} pitchM={pitch} ostwest={m.aufstaenderung === 'ostwest'} winkelDeg={m.winkelDeg} />
                <p className="text-sm font-semibold text-slate-800"><span aria-hidden="true" className="mr-2 inline-block w-4 border-t-2 border-slate-500 align-middle" />Freie Gasse: {Math.max(0, pitch - g.footprintM).toLocaleString('de-DE', { maximumFractionDigits: 2 })} m</p>
                <p className="mt-1 text-sm text-slate-600"><span aria-hidden="true" className="mr-2 inline-block w-4 border-t-2 border-[#b83d1e] align-middle" />Abstand von Anfang zu Anfang: {pitch.toLocaleString('de-DE')} m. Davon belegt der {m.aufstaenderung === 'ostwest' ? 'Doppeltisch' : 'Tisch'} {g.footprintM.toLocaleString('de-DE', { maximumFractionDigits: 2 })} m. Skizze schematisch.</p>
              </div>
              <p className="text-sm font-medium text-slate-700">Südrichtung im Foto über „Süden festlegen“ bzw. „Süden ändern“ einstellen. Das Foto erkennt Süden nicht automatisch.</p>
              <p className="text-sm text-slate-600">Dies sind die Vorgaben der Fläche. Für eigene Gassen ein Feld im Plan anklicken und dort den Abstand einstellen.</p>
              <p className="text-sm text-slate-600">Geometrische Vorplanung auf ebener Fläche. Gassen, Verschattung und Befestigung später mit der Montageplanung abstimmen.</p>
            </section>;
          })()}

          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">Technische Details</summary>
            {artVon(f) !== 'flachdach' && (
              <KompaktZahl
              fehlerAnzeigen={fehlerAnzeigen}
                label="Richtung in Grad"
                einheit="°"
                value={f.azimutDeg}
                min={0}
                max={359}
                step={1}
                breite="w-20"
                onChange={(azimutDeg) => setFlaeche(f.id, { azimutDeg })}
              />
            )}

            <label className="mt-3 block max-w-xs">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {artVon(f) === 'fassade' ? 'Fassaden-Oberfläche' : artVon(f) === 'flachdach' ? 'Dachbelag' : 'Dacheindeckung'}
              </span>
              <select
                aria-label="Dacheindeckung"
                value={f.dachfarbe}
                onChange={(e) => setFlaeche(f.id, { dachfarbe: e.target.value as DachfarbeId })}
                className={`${kompaktInput} w-full`}
              >
                {farbenFuer(artVon(f)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-600">
              Die Oberfläche wird in den Projektdaten gespeichert. Die Belegung wird auf dem zugeordneten Foto oder Maßplan gezeigt.
            </p>
          </details>

          {artVon(f) === 'dach' &&
            (f.neigungDeg < 0 || f.neigungDeg > 75 || !Number.isFinite(f.neigungDeg)) && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                Neigung muss zwischen 0° und 75° liegen.
              </p>
            )}
        </Karte>
      ))}

      {!nurFlaecheId && (
        <button
          type="button"
          className="h-12 w-full rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-akzent hover:text-akzent"
          onClick={() => {
            const nr = naechsteNr();
            onChange({
              ...projekt,
              flaechen: [...projekt.flaechen, neueFlaeche(nr, naechsteZone(projekt.flaechen))],
            });
          }}
        >
          + Haupt-Dachfläche
        </button>
      )}

      {!nurFlaecheId && (
        <p className="text-xs text-slate-600">
          Maße aus dem Aufmaß eingeben. Ohne Foto entsteht ein maßhaltiger Plan. Ein Dachfoto lässt sich auch später hinzufügen; Gauben werden auf der Ansicht ihres Hauptdachs angelegt.
        </p>
      )}
    </div>
  );
}
