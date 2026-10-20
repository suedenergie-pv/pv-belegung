'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useEntwurfNavigation, type OffenerEntwurf } from '../lib/entwurf-navigation';
import { fmtDe, patchFlaechenGeometrie, rasterFuer, type Flaeche, type GaubenMessung, type modulById } from '../lib/model';
import { EditorAktionen } from './EditorAktionen';
import { ToggleButton } from './ui';

type Eingaben = { breite: string; hoehe: string; quer: string; deck: string; reihen: string; abstand: string };
const eingabenVon = (flaeche: Flaeche): Eingaben => ({
  breite: String(flaeche.breiteM), hoehe: String(flaeche.hoeheM),
  quer: String(flaeche.gaubenMessung?.ziegelQuer ?? 10), deck: String(flaeche.gaubenMessung?.deckbreiteCm ?? 30),
  reihen: String(flaeche.gaubenMessung?.ziegelReihen ?? 8), abstand: String(flaeche.gaubenMessung?.reihenabstandCm ?? 34),
});
const alsZahl = (wert: string) => wert.trim() ? Number(wert) : NaN;

/** Ein Maßentwurf betrifft ausschließlich die ausgewählte Gaubenseite. */
export function GaubenMassEditor({ flaeche, modul, onSpeichern, onAbbrechen }: {
  flaeche: Flaeche;
  modul: ReturnType<typeof modulById>;
  onSpeichern: (breiteM: number, hoeheM: number, messung: GaubenMessung) => void;
  onAbbrechen: () => void;
}) {
  const navigation = useEntwurfNavigation();
  const formularRef = useRef<HTMLElement>(null);
  const abmelden = useRef<(() => void) | null>(null);
  const aktionen = useRef<OffenerEntwurf | null>(null);
  const [quelle, setQuelle] = useState<GaubenMessung['quelle']>(flaeche.gaubenMessung?.quelle ?? 'aufmass');
  const [eingaben, setEingaben] = useState(() => eingabenVon(flaeche));
  const [geaendert, setGeaendert] = useState(false);
  const [quelleBestaetigt, setQuelleBestaetigt] = useState(false);
  const alt = flaeche.gaubenMessung;
  const ziegel = quelle === 'ziegel';
  const felder: { key: keyof Eingaben; label: string; einheit: string; min: number }[] = ziegel ? [
    { key: 'quer', label: 'Ziegel quer', einheit: 'Stk.', min: 1 },
    { key: 'deck', label: 'Deckbreite', einheit: 'cm', min: 1 },
    { key: 'reihen', label: 'Reihen', einheit: 'Stk.', min: 1 },
    { key: 'abstand', label: 'Reihenabstand', einheit: 'cm', min: 1 },
  ] : [
    { key: 'breite', label: 'Breite', einheit: 'm', min: 0.1 },
    { key: 'hoehe', label: 'Traufe bis First', einheit: 'm', min: 0.1 },
  ];
  const fehlerVon = (feld: typeof felder[number]) => {
    const text = eingaben[feld.key];
    if (!text.trim()) return `${feld.label} ist erforderlich.`;
    const wert = alsZahl(text);
    if (!Number.isFinite(wert)) return `${feld.label} muss eine Zahl sein.`;
    if (wert < feld.min) return `${feld.label} muss mindestens ${fmtDe(feld.min, 1)} ${feld.einheit} betragen.`;
    return null;
  };
  const breiteM = ziegel ? alsZahl(eingaben.quer) * alsZahl(eingaben.deck) / 100 : alsZahl(eingaben.breite);
  const hoeheM = ziegel ? alsZahl(eingaben.reihen) * alsZahl(eingaben.abstand) / 100 : alsZahl(eingaben.hoehe);
  const gueltigeEingaben = felder.every((feld) => !fehlerVon(feld)) && Number.isFinite(breiteM) && Number.isFinite(hoeheM);
  const gueltig = () => {
    if (gueltigeEingaben) return true;
    formularRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
    return false;
  };
  const abmeldenJetzt = () => { abmelden.current?.(); abmelden.current = null; };
  const zuruecksetzen = () => {
    abmeldenJetzt();
    setEingaben(eingabenVon(flaeche)); setQuelle(alt?.quelle ?? 'aufmass');
    setGeaendert(false); setQuelleBestaetigt(false);
  };
  const speichern = () => {
    if (!gueltig()) return;
    // Ein vorhandener Schätzwert wird durch bloßes Öffnen/Übernehmen nicht zum Aufmaß.
    const qualitaet = quelle === 'nachbardach' ? 'geschaetzt' : !quelleBestaetigt
      ? alt?.qualitaet ?? 'geschaetzt'
      : quelle === 'aufmass' ? 'bestaetigt' : 'gemessen';
    abmeldenJetzt(); setGeaendert(false);
    onSpeichern(Math.round(breiteM * 100) / 100, Math.round(hoeheM * 100) / 100, {
      quelle, qualitaet,
      ...(ziegel ? { ziegelQuer: alsZahl(eingaben.quer), deckbreiteCm: alsZahl(eingaben.deck), ziegelReihen: alsZahl(eingaben.reihen), reihenabstandCm: alsZahl(eingaben.abstand) } : {}),
    });
  };
  const abbrechen = () => { zuruecksetzen(); onAbbrechen(); };
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
    if (!geaendert) { setEingaben(eingabenVon(flaeche)); setQuelle(flaeche.gaubenMessung?.quelle ?? 'aufmass'); setQuelleBestaetigt(false); }
  }, [flaeche.id, flaeche.breiteM, flaeche.hoeheM, flaeche.gaubenMessung]);
  const vorher = rasterFuer(flaeche, modul).positionen.length;
  const nachher = gueltigeEingaben ? rasterFuer(patchFlaechenGeometrie(flaeche, { breiteM, hoeheM }), modul).positionen.length : null;
  const waehleQuelle = (neu: GaubenMessung['quelle']) => { setQuelle(neu); setQuelleBestaetigt(true); setGeaendert(true); };
  return <section ref={formularRef} aria-label="Dachmaße der Gaubenseite" className="space-y-4">
    <p className="text-sm text-slate-700">Die Maße gelten nur für diese Dachseite. Die andere Gaubenseite bleibt unverändert.</p>
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
      {felder.map((feld) => <MassEingabe key={feld.key} label={feld.label} einheit={feld.einheit} min={feld.min} value={eingaben[feld.key]} fehler={fehlerVon(feld)} onChange={(value) => { setEingaben((alt) => ({ ...alt, [feld.key]: value })); setGeaendert(true); }} />)}
    </div>
    {gueltigeEingaben && <p className="text-sm font-semibold text-slate-800">{fmtDe(breiteM, 2)} × {fmtDe(hoeheM, 2)} m</p>}
    <p aria-live="polite" className="text-sm text-slate-700">{nachher === null ? 'Vorschau nach Eingabe gültiger Maße.' : `Vorschau: ${vorher} → ${nachher} Module auf dieser Gaubenseite.`}</p>
    <EditorAktionen><div data-foto-abschluss data-gauben-mass-abschluss>
      <span data-fehler={!gueltigeEingaben}>{gueltigeEingaben ? 'Die neuen Maße werden erst beim Übernehmen gespeichert.' : 'Bitte die markierten Maße korrigieren.'}</span>
      <button type="button" disabled={!gueltigeEingaben} className="min-h-11 rounded-lg bg-akzent px-4 font-semibold text-white disabled:opacity-50" onClick={speichern}>Maße übernehmen</button>
      <button type="button" data-sekundaer className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-medium text-slate-800" onClick={abbrechen}>Abbrechen</button>
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
      <input type="number" inputMode="decimal" min={min} step={einheit === 'm' ? '0.1' : '1'} value={value} aria-invalid={!!fehler} aria-describedby={fehler ? fehlerId : undefined}
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
