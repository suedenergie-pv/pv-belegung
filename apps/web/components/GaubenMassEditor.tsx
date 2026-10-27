'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useEntwurfNavigation, type OffenerEntwurf } from '../lib/entwurf-navigation';
import { fmtDe, patchFlaechenGeometrie, rasterFuer, type Flaeche, type GaubenMessung, type GaubenGeometrie, type modulById } from '../lib/model';
import { EditorAktionen } from './EditorAktionen';
import { ToggleButton } from './ui';
import styles from './GaubenEditor.module.css';

type Eingaben = { breite: string; hoehe: string; quer: string; deck: string; reihen: string; abstand: string; neigung: string; azimut: string; first: string };
const eingabenVon = (flaeche: Flaeche): Eingaben => ({
  neigung: String(flaeche.neigungDeg), azimut: String(flaeche.azimutDeg), first: String(flaeche.firstBreiteM ?? flaeche.breiteM),
  breite: String(flaeche.breiteM), hoehe: String(flaeche.hoeheM),
  quer: String(flaeche.gaubenMessung?.ziegelQuer ?? 10), deck: String(flaeche.gaubenMessung?.deckbreiteCm ?? 30),
  reihen: String(flaeche.gaubenMessung?.ziegelReihen ?? 8), abstand: String(flaeche.gaubenMessung?.reihenabstandCm ?? 34),
});
const alsZahl = (wert: string) => wert.trim() ? Number(wert.replace(',', '.')) : NaN;

/** Ein Maßentwurf betrifft ausschließlich die ausgewählte Gaubenseite. */
export function GaubenMassEditor({ flaeche, modul, onSpeichern, onAbbrechen }: {
  flaeche: Flaeche;
  modul: ReturnType<typeof modulById>;
  onSpeichern: (breiteM: number, hoeheM: number, messung: GaubenMessung, geometrie?: GaubenGeometrie) => void;
  onAbbrechen: () => void;
}) {
  const navigation = useEntwurfNavigation();
  const formularRef = useRef<HTMLElement>(null);
  const abmelden = useRef<(() => void) | null>(null);
  const aktionen = useRef<OffenerEntwurf | null>(null);
  const [quelle, setQuelle] = useState<GaubenMessung['quelle']>(flaeche.gaubenMessung?.quelle ?? 'aufmass');
  const [eingaben, setEingaben] = useState(() => eingabenVon(flaeche));
  const formVon = (f: Flaeche) => f.dachform === 'trapez' ? f.firstBreiteM === 0 ? 'dreieck' : 'trapez' : 'rechteck';
  const [form, setForm] = useState(() => formVon(flaeche));
  const [geaendert, setGeaendert] = useState(false);
  const [rueckmeldung, setRueckmeldung] = useState<string | null>(null);
  const [quelleBestaetigt, setQuelleBestaetigt] = useState(false);
  const alt = flaeche.gaubenMessung;
  const ziegel = quelle === 'ziegel';
  const felder: { key: keyof Eingaben; label: string; einheit: string; min: number; max?: number }[] = ziegel ? [
    { key: 'quer', label: 'Ziegel quer', einheit: 'Stk.', min: 1 },
    { key: 'deck', label: 'Deckbreite', einheit: 'cm', min: 1 },
    { key: 'reihen', label: 'Reihen', einheit: 'Stk.', min: 1 },
    { key: 'abstand', label: 'Reihenabstand', einheit: 'cm', min: 1 },
  ] : [
    { key: 'breite', label: 'Breite', einheit: 'm', min: 0.1 },
    { key: 'hoehe', label: 'Tiefe auf dem Gaubendach', einheit: 'm', min: 0.1 },
  ];
  const winkelFelder: typeof felder = [
    { key: 'neigung', label: 'Neigung der Gaubenseite', einheit: '°', min: 0, max: 75 },
    { key: 'azimut', label: 'Ausrichtung der Gaubenseite', einheit: '°', min: 0, max: 359 },
    ...(form === 'trapez' ? [{ key: 'first' as const, label: 'Obere Breite', einheit: 'm', min: 0, max: ziegel ? alsZahl(eingaben.quer) * alsZahl(eingaben.deck) / 100 : alsZahl(eingaben.breite) }] : []),
  ];
  const fehlerVon = (feld: typeof felder[number]) => {
    const text = eingaben[feld.key];
    if (!text.trim()) return `${feld.label} ist erforderlich.`;
    const wert = alsZahl(text);
    if (!Number.isFinite(wert)) return `${feld.label} muss eine Zahl sein.`;
    if (wert < feld.min) return `${feld.label} muss mindestens ${fmtDe(feld.min, 1)} ${feld.einheit} betragen.`;
    if (feld.max !== undefined && wert > feld.max) return `${feld.label} darf höchstens ${fmtDe(feld.max, 2)} ${feld.einheit} betragen.`;
    return null;
  };
  const breiteM = ziegel ? alsZahl(eingaben.quer) * alsZahl(eingaben.deck) / 100 : alsZahl(eingaben.breite);
  const hoeheM = ziegel ? alsZahl(eingaben.reihen) * alsZahl(eingaben.abstand) / 100 : alsZahl(eingaben.hoehe);
  const gueltigeEingaben = [...felder, ...winkelFelder].every((feld) => !fehlerVon(feld)) && Number.isFinite(breiteM) && Number.isFinite(hoeheM);
  const gueltig = () => {
    if (gueltigeEingaben) return true;
    formularRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
    return false;
  };
  const abmeldenJetzt = () => { abmelden.current?.(); abmelden.current = null; };
  const zuruecksetzen = () => {
    abmeldenJetzt();
    setEingaben(eingabenVon(flaeche)); setForm(formVon(flaeche)); setQuelle(alt?.quelle ?? 'aufmass');
    setGeaendert(false); setQuelleBestaetigt(false);
  };
  const formGeaendert = form !== formVon(flaeche) || (form === 'trapez' && alsZahl(eingaben.first) !== flaeche.firstBreiteM);
  const geometrie: GaubenGeometrie = { neigungDeg: alsZahl(eingaben.neigung), azimutDeg: alsZahl(eingaben.azimut),
    fotoBezugsrahmen: formGeaendert ? true : flaeche.fotoBezugsrahmen, dachform: form === 'rechteck' ? 'rechteck' : 'trapez', firstBreiteM: form === 'dreieck' ? 0 : form === 'trapez' ? alsZahl(eingaben.first) : undefined };
  const geometrieGeaendert = form !== formVon(flaeche) || geometrie.neigungDeg !== flaeche.neigungDeg || geometrie.azimutDeg !== flaeche.azimutDeg || (form === 'trapez' && geometrie.firstBreiteM !== flaeche.firstBreiteM);
  const speichern = () => {
    if (!gueltig()) return;
    // Ein vorhandener Schätzwert wird durch bloßes Öffnen/Übernehmen nicht zum Aufmaß.
    const qualitaet = quelle === 'nachbardach' ? 'geschaetzt' : !quelleBestaetigt
      ? alt?.qualitaet ?? 'geschaetzt'
      : quelle === 'aufmass' ? 'bestaetigt' : 'gemessen';
    abmeldenJetzt(); setGeaendert(false);
    setRueckmeldung('Maße und Neigung übernommen. Du kannst direkt weiterarbeiten.');
    onSpeichern(Math.round(breiteM * 100) / 100, Math.round(hoeheM * 100) / 100, {
      quelle, qualitaet,
      ...(ziegel ? { ziegelQuer: alsZahl(eingaben.quer), deckbreiteCm: alsZahl(eingaben.deck), ziegelReihen: alsZahl(eingaben.reihen), reihenabstandCm: alsZahl(eingaben.abstand) } : {}),
    }, ...(geometrieGeaendert ? [geometrie] : []));
  };
  const abbrechen = () => { zuruecksetzen(); setRueckmeldung('Nicht übernommene Änderungen verworfen.'); onAbbrechen(); };
  aktionen.current = { name: `${flaeche.name} · Maße`, gueltig, uebernehmen: speichern, verwerfen: zuruecksetzen };
  useEffect(() => {
    if (!geaendert) return;
    const ende = navigation.registriere(`gauben-mass-${flaeche.id}`, {
      name: `${flaeche.name} · Maße`, gueltig: () => aktionen.current!.gueltig(),
      uebernehmen: () => aktionen.current!.uebernehmen(), verwerfen: () => aktionen.current!.verwerfen(),
    });
    abmelden.current = ende;
    return ende;
  }, [geaendert, flaeche.id, flaeche.name, navigation]);
  useEffect(() => {
    if (!geaendert) { setEingaben(eingabenVon(flaeche)); setForm(formVon(flaeche)); setQuelle(flaeche.gaubenMessung?.quelle ?? 'aufmass'); setQuelleBestaetigt(false); }
  }, [flaeche.id, flaeche.breiteM, flaeche.hoeheM, flaeche.gaubenMessung, flaeche.neigungDeg, flaeche.azimutDeg, flaeche.dachform, flaeche.firstBreiteM]);
  const vorher = rasterFuer(flaeche, modul).positionen.length;
  const nachher = gueltigeEingaben ? rasterFuer(patchFlaechenGeometrie(flaeche, { breiteM, hoeheM, ...(geometrieGeaendert ? { ...geometrie, ...(formGeaendert ? { umrissM: undefined } : {}) } : {}) }), modul).positionen.length : null;
  const entwurfGeaendert = () => { setGeaendert(true); setRueckmeldung(null); };
  const waehleQuelle = (neu: GaubenMessung['quelle']) => { setQuelle(neu); setQuelleBestaetigt(true); entwurfGeaendert(); };
  return <section ref={formularRef} aria-label="Dachmaße der Gaubenseite" className="space-y-4">
    <p className="text-sm text-slate-700">{flaeche.gaubenSeite ? `Du bearbeitest die ${flaeche.gaubenSeite === 'links' ? 'linke' : 'rechte'} Dachseite. Die andere Seite bleibt unverändert.` : 'Breite, Tiefe und Neigung dieses Gaubendachs eingeben.'}</p>
    {rueckmeldung && <p role="status" className="text-sm text-slate-700">{rueckmeldung}</p>}
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-slate-800">Woher stammen die Maße?</legend>
      <div className="flex flex-wrap gap-2">
        {alt?.quelle === 'nachbardach' && <ToggleButton aktiv={quelle === 'nachbardach'} onClick={() => waehleQuelle('nachbardach')}>Bisherige Schätzung</ToggleButton>}
        <ToggleButton aktiv={quelle === 'aufmass'} onClick={() => waehleQuelle('aufmass')}>Aufmaß</ToggleButton>
        <ToggleButton aktiv={quelle === 'ziegel'} onClick={() => waehleQuelle('ziegel')}>Ziegel zählen</ToggleButton>
      </div>
    </fieldset>
    {quelle === 'nachbardach' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Diese Maße sind vom Hauptdach geschätzt. Mit Aufmaß oder Ziegelwerten kannst du sie genauer festlegen.</p>}
    <div className="grid grid-cols-1 gap-3 min-[320px]:grid-cols-2">
      {felder.map((feld) => <MassEingabe key={feld.key} label={feld.label} einheit={feld.einheit} min={feld.min} value={eingaben[feld.key]} fehler={fehlerVon(feld)} onChange={(value) => { setEingaben((alt) => ({ ...alt, [feld.key]: value })); entwurfGeaendert(); }} />)}
    </div>
    <div className="border-t border-slate-200 pt-3">
      <label className="mb-3 block text-sm font-medium text-slate-700">Form dieser Dachseite
        <select aria-label="Form der Gaubenseite" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          value={form} onChange={e => { setForm(e.target.value); entwurfGeaendert(); }}>
          <option value="rechteck">Oben und unten gleich breit</option><option value="trapez">Oben schmaler</option><option value="dreieck">Oben eine Spitze</option>
        </select>
      </label>
      <div className={styles.formErklaerung}>
        <svg viewBox="0 0 100 64" aria-hidden="true"><polygon points={form === 'dreieck' ? '12,53 50,11 88,53' : form === 'trapez' ? '12,53 32,13 68,13 88,53' : '14,53 14,13 86,13 86,53'} fill="#edf0f1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
        <span>Dachseite von oben: {form === 'dreieck' ? 'Die beiden schrägen Ränder treffen sich an der Spitze.' : form === 'trapez' ? 'Die obere Kante ist kürzer. Ihre Breite unten eingeben.' : 'Die seitlichen Ränder verlaufen parallel.'}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[320px]:grid-cols-2">
        {winkelFelder.map(feld => <MassEingabe key={feld.key} label={feld.label} einheit={feld.einheit} min={feld.min} value={eingaben[feld.key]} fehler={fehlerVon(feld)} onChange={value => { setEingaben(alt => ({ ...alt, [feld.key]: value })); entwurfGeaendert(); }} />)}
      </div>
      <p className="mt-2 text-sm text-slate-600">0° Neigung = waagerecht. Die Module liegen auf dem Gaubendach, ohne Aufständerung. Breite und Tiefe direkt auf der Dachfläche messen.</p>
      <p className="mt-2 text-sm text-slate-600">Ausrichtung: 0° Nord · 90° Ost · 180° Süd · 270° West.</p>
    </div>
    {gueltigeEingaben && <p className="text-sm font-semibold text-slate-800">{fmtDe(breiteM, 2)} × {fmtDe(hoeheM, 2)} m</p>}
    <p aria-live="polite" className="text-sm text-slate-700">{nachher === null ? 'Vorschau nach Eingabe gültiger Maße.' : `Vorschau: ${vorher} → ${nachher} Module auf dieser Gaubenseite.`}</p>
    <EditorAktionen><div data-foto-abschluss data-gauben-mass-abschluss>
      <span data-fehler={!gueltigeEingaben}>{gueltigeEingaben ? rueckmeldung ?? 'Die neuen Maße werden erst beim Übernehmen gespeichert.' : 'Bitte die markierten Maße korrigieren.'}</span>
      <button type="button" disabled={!gueltigeEingaben} className="min-h-11 rounded-lg bg-akzent px-4 font-semibold text-white disabled:opacity-50" onClick={speichern}>Maße übernehmen</button>
      <button type="button" data-sekundaer className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-medium text-slate-800" onClick={abbrechen}>Änderungen verwerfen</button>
    </div></EditorAktionen>
  </section>;
}

function MassEingabe({ label, einheit, value, min, fehler, onChange }: {
  label: string; einheit: string; value: string; min: number; fehler: string | null; onChange: (value: string) => void;
}) {
  const fehlerId = useId();
  return <label className="block min-w-0 text-sm text-slate-700">
    <span className="mb-1 block font-medium">{label}</span>
    <span className="flex items-center gap-2">
      <input type="text" inputMode="decimal" min={min} step={einheit === 'm' ? '0.1' : '1'} value={value} aria-invalid={!!fehler} aria-describedby={fehler ? fehlerId : undefined}
        onFocus={event => {
          if (!window.matchMedia?.('(max-width: 900px), (max-height: 500px) and (orientation: landscape)')?.matches) return;
          const input = event.currentTarget;
          window.requestAnimationFrame(() => {
            if (!input.isConnected) return;
            const scroller = input.closest<HTMLElement>('[data-inspektor-inhalt]');
            if (!scroller) return;
            const rahmen = scroller.getBoundingClientRect();
            const kopf = input.closest('[aria-label="Editor-Einstellungen"]')?.firstElementChild;
            const oben = kopf && getComputedStyle(kopf).position === 'sticky' ? Math.max(rahmen.top, kopf.getBoundingClientRect().bottom) : rahmen.top;
            const rect = input.getBoundingClientRect();
            if (rect.bottom > rahmen.bottom - 8) scroller.scrollTop += rect.bottom - rahmen.bottom + 8;
            else if (rect.top < oben + 8) scroller.scrollTop -= oben + 8 - rect.top;
          });
        }}
        onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30" />
      <span>{einheit}</span>
    </span>
    {fehler && <span id={fehlerId} className="mt-1 block text-sm text-red-700">{fehler}</span>}
  </label>;
}
