'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { useTouchBedienung } from '../lib/touch-bedienung';
import type { FotoPunktSteuerung } from './EditorViewport';
import {
  gaubenAussparungAusFoto,
  gaubenMasseAusElternfoto,
  rekonstruiereGaubenPunkte,
  pruefeGaubenTopologie,
  satteldachMasseAusElternfoto,
  satteldachSeitenEcken,
  wendeGaubenMarkierungAn,
  verschiebeGaubenPunkte,
  type GaubenMarkierung,
  type GaubenSeitenMass,
} from '../lib/gauben-geometrie';
import { gaubenFotoUmriss } from '../lib/gauben-umriss';
import type { HindernisM } from '@pv-belegung/engine';
import {
  pruefePerspektive,
  sortiereEcken,
  type Ecken,
  type PerspektivPruefung,
  type Punkt,
} from '../lib/foto-geometrie';
import {
  fmtDe,
  fotoZuordnungenVon,
  modulById,
  perspektiveQuelle,
  type Flaeche,
  type GaubenMessung,
  type GaubenTyp,
  type Projekt,
} from '../lib/model';
import { ModulAsset } from './DachSvg';
import { fotoFlaechenInhalt } from './GesamtSvg';
import { ToggleButton } from './ui';
import { EditorAktionen } from './EditorAktionen';
import { GaubenMassEditor } from './GaubenMassEditor';
import styles from './GaubenEditor.module.css';
import { useEntwurfNavigation, type OffenerEntwurf } from '../lib/entwurf-navigation';

export interface NeueGaubeAusFoto {
  typ: GaubenTyp;
  aussen: Ecken;
  seiten?: { links: Ecken; rechts: Ecken };
  seitenMasse?: { links: GaubenSeitenMass; rechts: GaubenSeitenMass };
  seitenMessung?: { links?: GaubenMessung; rechts?: GaubenMessung };
  breiteM: number;
  hoeheM: number;
  messung: GaubenMessung;
  aussparung: HindernisM;
}

export type AktualisierteGaubenMarkierung = GaubenMarkierung;

function ZahlenEingabe({
  label,
  value,
  onChange,
  einheit,
  min = 0.1,
}: {
  label: string;
  value: number;
  onChange: (wert: number) => void;
  einheit: string;
  min?: number;
}) {
  const [eingabe, setEingabe] = useState(String(value));
  const fehlerId = useId();
  useEffect(() => setEingabe(Number.isFinite(value) ? String(value) : ''), [value]);
  const pruefe = (roh: string): { wert?: number; fehler?: string } => {
    if (!roh.trim()) return { fehler: `${label} ist erforderlich.` };
    const wert = Number(roh);
    if (!Number.isFinite(wert)) return { fehler: `${label} muss eine Zahl sein.` };
    if (wert < min) return { fehler: `${label} muss mindestens ${min} sein.` };
    return { wert };
  };
  const ergebnis = pruefe(eingabe);
  return (
    <label className="block text-sm text-slate-600">
      <span className="mb-1 block font-medium">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={einheit === 'm' ? 0.1 : 1}
          value={eingabe}
          aria-invalid={!!ergebnis.fehler}
          aria-describedby={ergebnis.fehler ? fehlerId : undefined}
          onChange={(e) => {
            const roh = e.target.value;
            setEingabe(roh);
            const neu = pruefe(roh);
            if (neu.wert !== undefined) onChange(neu.wert);
          }}
          className="h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
        />
        <span>{einheit}</span>
      </span>
      {ergebnis.fehler && (
        <span id={fehlerId} className="mt-1 block text-xs text-red-600">
          {ergebnis.fehler}
        </span>
      )}
    </label>
  );
}

export function GaubenEditor({
  eltern,
  gauben,
  projekt,
  bearbeiteGruppenId,
  onBearbeitungGestartet,
  onBearbeitungBeendet,
  onErstellen,
  onLoeschen,
  onMasseAendern,
  onMarkierungAendern,
  renderArbeitsbereich,
  onBelegungOeffnen,
  initialOffen = false,
  aktiveFotoId,
}: {
  eltern: Flaeche;
  gauben: Flaeche[];
  projekt: Projekt;
  renderArbeitsbereich?: (inhalt: { bild: ReactNode; steuerung: ReactNode; hinweis: ReactNode; bildSeitenverhaeltnis: number; aufgabe?: { titel: string; phase: string }; abbrechen: () => void; punktSteuerung?: FotoPunktSteuerung }) => ReactNode;
  onBelegungOeffnen?: (flaecheId: string) => void;
  /** Erste Gaube direkt anlegen, ohne einen weiteren Aufklappschritt. */
  initialOffen?: boolean;
  aktiveFotoId?: string;
  /** Startsignal von einer sichtbaren Gaubenkarte. */
  bearbeiteGruppenId?: string | null;
  onBearbeitungGestartet?: () => void;
  onBearbeitungBeendet?: () => void;
  onErstellen: (gaube: NeueGaubeAusFoto) => void;
  onLoeschen: (gruppenId: string) => void;
  onMasseAendern: (
    gruppenId: string,
    flaecheId: string,
    breiteM: number,
    hoeheM: number,
    messung: GaubenMessung,
  ) => void;
  onMarkierungAendern: (
    gruppenId: string,
    markierung: AktualisierteGaubenMarkierung,
  ) => boolean | void;
}) {
  const foto = eltern.foto;
  const navigation = useEntwurfNavigation();
  const entwurfAktionen = useRef<OffenerEntwurf | null>(null);
  const startPunkte = useRef('[]');
  const formularRef = useRef<HTMLElement>(null);
  const [offen, setOffen] = useState(initialOffen);
  const [typ, setTyp] = useState<GaubenTyp>('flachdach');
  const [quelle, setQuelle] = useState<GaubenMessung['quelle']>('nachbardach');
  const [breiteM, setBreiteM] = useState(3);
  const [hoeheM, setHoeheM] = useState(2.5);
  const [ziegelQuer, setZiegelQuer] = useState(10);
  const [deckbreiteCm, setDeckbreiteCm] = useState(30);
  const [ziegelReihen, setZiegelReihen] = useState(8);
  const [reihenabstandCm, setReihenabstandCm] = useState(34);
  const [markieren, setMarkieren] = useState(false);
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [letzteGueltigePunkte, setLetzteGueltigePunkte] = useState<Punkt[]>([]);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState(0);
  const [werkzeug, setWerkzeug] = useState<'position' | 'form'>('form');
  const [element, setElement] = useState('punkt:0');
  const [massId, setMassId] = useState<string | null>(null);
  const [kopieVon, setKopieVon] = useState<string | null>(null);
  const [moduleZeigen, setModuleZeigen] = useState(true);
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<Punkt | null>(null);
  const ziehAuswahl = useRef<{ start: Punkt; indizes?: number[] } | null>(null);
  const [fallbackGrund, setFallbackGrund] = useState<string | null>(null);
  const [zieht, setZieht] = useState(false);
  const [touchBedienung, aktiviereTouch, deaktiviereTouch] = useTouchBedienung();
  const fensterGeste = useRef<{ ende: () => void; abbrechen: () => void } | null>(null);
  const ziehStart = useRef<{ punkte: Punkt[]; gueltige: Punkt[] } | null>(null);
  const ziehFrame = useRef<number | null>(null);
  const vorgemerkteZiehPunkte = useRef<Punkt[] | null>(null);
  const [tastaturPunkt, setTastaturPunkt] = useState<Punkt>([
    foto?.breitePx ? foto.breitePx / 2 : 0,
    foto?.hoehePx ? foto.hoehePx / 2 : 0,
  ]);

  const gruppen = useMemo(() => {
    const map = new Map<string, Flaeche[]>();
    for (const gaube of gauben) {
      const id = gaube.gaubenGruppeId ?? gaube.id;
      map.set(id, [...(map.get(id) ?? []), gaube]);
    }
    return [...map.entries()];
  }, [gauben]);

  const fotoId = aktiveFotoId ?? fotoZuordnungenVon(eltern)[0]?.fotoId;
  const svgInstanzId = useId().replace(/[^a-zA-Z0-9_-]/g, '-');

  const bearbeitungStarten = (gruppenId: string, flaechen: Flaeche[], aufgabe: 'position' | 'form' = 'position') => {
    setMassId(null); setKopieVon(null); setSpeicherFehler(null); setTouchStart(null);
    setWerkzeug(aufgabe); setElement('punkt:0');
    const erster = flaechen[0];
    if (!erster) return;
    setTyp(erster.gaubenTyp ?? 'flachdach');
    setQuelle(erster.gaubenMessung?.quelle ?? 'aufmass');
    setBearbeiteId(gruppenId);
    setOffen(true);
    setMarkieren(true);
    setAusgewaehlt(0);
    const rekonstruiert = rekonstruiereGaubenPunkte(eltern, flaechen, gruppenId, fotoId);
    if (rekonstruiert.ok) {
      const kopie = rekonstruiert.punkte.map(([x, y]) => [x, y] as Punkt);
      startPunkte.current = JSON.stringify(kopie);
      setPunkte(kopie);
      setLetzteGueltigePunkte(kopie);
      setFallbackGrund(null);
    } else {
      setPunkte([]);
      setLetzteGueltigePunkte([]);
      setFallbackGrund(rekonstruiert.grund);
    }
  };

  useEffect(() => {
    if (!bearbeiteGruppenId) return;
    const flaechen = gruppen.find(([id]) => id === bearbeiteGruppenId)?.[1];
    if (flaechen) bearbeitungStarten(bearbeiteGruppenId, flaechen);
    onBearbeitungGestartet?.();
    // Das Signal wird vom Eltern-Editor direkt quittiert; die lokale Bearbeitung
    // bleibt bis Speichern/Abbrechen bestehen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearbeiteGruppenId]);

  useEffect(() => () => {
    if (ziehFrame.current !== null) window.cancelAnimationFrame(ziehFrame.current);
  }, []);
  useEffect(() => {
    const ende = () => fensterGeste.current?.ende();
    const abbrechen = () => fensterGeste.current?.abbrechen();
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', abbrechen);
    window.addEventListener('blur', abbrechen);
    return () => { window.removeEventListener('pointerup', ende); window.removeEventListener('pointercancel', abbrechen); window.removeEventListener('blur', abbrechen); };
  }, []);

  const geaendert = markieren && punkte.length > 0 && JSON.stringify(punkte) !== startPunkte.current;
  useEffect(() => {
    if (!geaendert) return;
    return navigation.registriere(`gaube-${eltern.id}`, {
      name: `${eltern.name} · Gaubenmarkierung`,
      gueltig: () => entwurfAktionen.current?.gueltig() ?? false,
      uebernehmen: () => entwurfAktionen.current?.uebernehmen(),
      verwerfen: () => entwurfAktionen.current?.verwerfen(),
    });
  }, [geaendert, eltern.id, eltern.name, navigation]);

  if (!foto?.eckenPx) return null;

  const erwartet = typ === 'satteldach' ? 6 : 4;
  const markierungAusPunkten = (kontrollpunkte: readonly Punkt[]): GaubenMarkierung | null => {
    if (kontrollpunkte.length < erwartet) return null;
    const aussen = kontrollpunkte.slice(0, 4).map(([x, y]) => [x, y] as Punkt) as Ecken;
    const seiten = typ === 'satteldach'
      ? satteldachSeitenEcken(aussen, [kontrollpunkte[4]!, kontrollpunkte[5]!], eltern)
      : undefined;
    if (typ === 'satteldach' && !seiten) return null;
    const aussparung = gaubenAussparungAusFoto(eltern, gaubenFotoUmriss(aussen, seiten ?? undefined));
    if (!aussparung) return null;
    return { aussen, ...(seiten ? { seiten } : {}), aussparung };
  };

  const pruefungAusPunkten = (kontrollpunkte: readonly Punkt[]): PerspektivPruefung => {
    const markierung = markierungAusPunkten(kontrollpunkte);
    if (!markierung) {
      return {
        status: 'fehler',
        meldungen: [kontrollpunkte.length < erwartet ? `Es fehlen ${erwartet - kontrollpunkte.length} Kontrollpunkte.` : 'Die Gaubenmarkierung ist überkreuzt oder entartet.'],
        massstabVerhaeltnis: null,
      };
    }
    const topologieFehler = pruefeGaubenTopologie(markierung.aussen, markierung.seiten);
    if (topologieFehler) return { status: 'fehler', meldungen: [topologieFehler], massstabVerhaeltnis: null };
    const gruppe = bearbeiteId
      ? gauben.filter((f) => (f.gaubenGruppeId ?? f.id) === bearbeiteId)
      : [];
    const zuPruefen = typ === 'satteldach'
      ? (['links', 'rechts'] as const).map((seite) => {
          const flaeche = gruppe.find((f) => f.gaubenSeite === seite);
          return {
            breiteM: flaeche?.breiteM ?? breiteM,
            hoeheM: flaeche?.hoeheM ?? hoeheM,
            ecken: markierung.seiten![seite],
            quelle: flaeche ? perspektiveQuelle(flaeche) : undefined,
          };
        })
      : [{
          breiteM: gruppe[0]?.breiteM ?? breiteM,
          hoeheM: gruppe[0]?.hoeheM ?? hoeheM,
          ecken: markierung.aussen,
          quelle: gruppe[0] ? perspektiveQuelle(gruppe[0]) : undefined,
        }];
    const ergebnisse = zuPruefen.map((x) =>
      pruefePerspektive(x.breiteM, x.hoeheM, x.ecken, x.quelle),
    );
    const fehler = ergebnisse.find((x) => x.status === 'fehler');
    if (fehler) return fehler;
    const warnungen = ergebnisse.filter((x) => x.status === 'warnung');
    return warnungen.length > 0
      ? {
          status: 'warnung',
          meldungen: [...new Set(warnungen.flatMap((x) => x.meldungen))],
          massstabVerhaeltnis: Math.max(...warnungen.map((x) => x.massstabVerhaeltnis ?? 0)),
        }
      : { status: 'ok', meldungen: [], massstabVerhaeltnis: 1 };
  };

  const setzePunkteKontrolliert = (neu: Punkt[], normalisiereVierten = false) => {
    setSpeicherFehler(null);
    let naechste = neu.map(([x, y]) => [x, y] as Punkt);
    if (normalisiereVierten && naechste.length === 4) {
      naechste = [...sortiereEcken(naechste as [Punkt, Punkt, Punkt, Punkt])];
    }
    setPunkte(naechste);
    if (naechste.length >= erwartet && pruefungAusPunkten(naechste).status !== 'fehler') {
      setLetzteGueltigePunkte(naechste.map(([x, y]) => [x, y] as Punkt));
    }
  };

  /** Maximal ein Geometrie-/SVG-Neuaufbau pro Browserbild. */
  const planeZiehPunkte = (neu: Punkt[]) => {
    vorgemerkteZiehPunkte.current = neu;
    if (ziehFrame.current !== null || typeof window.requestAnimationFrame !== 'function') return;
    ziehFrame.current = window.requestAnimationFrame(() => {
      ziehFrame.current = null;
      const naechste = vorgemerkteZiehPunkte.current;
      vorgemerkteZiehPunkte.current = null;
      if (naechste) setzePunkteKontrolliert(naechste);
    });
  };

  /** Beim Loslassen garantiert den letzten Zeigerstand uebernehmen. */
  const uebernehmeVorgemerkteZiehPunkte = () => {
    if (ziehFrame.current !== null) {
      window.cancelAnimationFrame(ziehFrame.current);
      ziehFrame.current = null;
    }
    const naechste = vorgemerkteZiehPunkte.current;
    vorgemerkteZiehPunkte.current = null;
    if (naechste) setzePunkteKontrolliert(naechste);
  };

  const verwerfeVorgemerkteZiehPunkte = () => {
    if (ziehFrame.current !== null) {
      window.cancelAnimationFrame(ziehFrame.current);
      ziehFrame.current = null;
    }
    vorgemerkteZiehPunkte.current = null;
    setZieht(false);
    ziehAuswahl.current = null;
  };

  const ziehgesteAbbrechen = () => {
    verwerfeVorgemerkteZiehPunkte();
    if (ziehStart.current) {
      setPunkte(ziehStart.current.punkte);
      setLetzteGueltigePunkte(ziehStart.current.gueltige);
      ziehStart.current = null;
    }
  };

  const markierungAktuell = markierungAusPunkten(punkte);
  const pruefungAktuell = pruefungAusPunkten(punkte);
  const vorschauPunkte =
    markierungAktuell && pruefungAktuell.status !== 'fehler' ? punkte : letzteGueltigePunkte;
  const markierungVorschau = markierungAusPunkten(vorschauPunkte);
  const vorschauAnwendung =
    bearbeiteId && fotoId && markierungVorschau
      ? wendeGaubenMarkierungAn(projekt, eltern.id, bearbeiteId, fotoId, markierungVorschau)
      : null;
  const vorschauProjekt = vorschauAnwendung?.ok ? vorschauAnwendung.projekt : projekt;
  const projektFoto = fotoId ? projekt.fotos.find((f) => f.id === fotoId) : undefined;
  const modul = modulById(projekt.modulId);

  const aussen = markierungAktuell?.aussen ?? null;
  const schaetzung = aussen ? gaubenMasseAusElternfoto(eltern, aussen) : null;
  const seiten = markierungAktuell?.seiten;
  const seitenSchaetzung =
    seiten && punkte.length >= 6
      ? satteldachMasseAusElternfoto(eltern, seiten, [punkte[4]!, punkte[5]!])
      : null;
  const sichtbareSchaetzung =
    typ === 'satteldach' && seitenSchaetzung
      ? {
          breiteM: (seitenSchaetzung.links.breiteM + seitenSchaetzung.rechts.breiteM) / 2,
          hoeheM: (seitenSchaetzung.links.hoeheM + seitenSchaetzung.rechts.hoeheM) / 2,
        }
      : typ === 'flachdach'
        ? schaetzung
        : null;

  const reset = () => {
    setModuleZeigen(true);
    setMassId(null); setKopieVon(null); setSpeicherFehler(null); setTouchStart(null);
    startPunkte.current = '[]';
    verwerfeVorgemerkteZiehPunkte();
    setOffen(false);
    setMarkieren(false);
    setPunkte([]);
    setLetzteGueltigePunkte([]);
    setBearbeiteId(null);
    setFallbackGrund(null);
    onBearbeitungBeendet?.();
  };

  const starten = () => {
    const fehler = formularRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]');
    if (fehler) { fehler.focus(); return; }
    setMassId(null); setKopieVon(null); setSpeicherFehler(null); setTouchStart(null);
    startPunkte.current = '[]';
    setPunkte([]);
    setLetzteGueltigePunkte([]);
    setFallbackGrund(null);
    setWerkzeug('form');
    setMarkieren(true);
  };

  const markierungKomplettNeu = (gruppenId: string, flaechen: Flaeche[]) => {
    setWerkzeug('form'); setTouchStart(null);
    startPunkte.current = '[]';
    setTyp(flaechen[0]?.gaubenTyp ?? 'flachdach');
    setQuelle(flaechen[0]?.gaubenMessung?.quelle ?? 'aufmass');
    setBearbeiteId(gruppenId);
    setPunkte([]);
    setLetzteGueltigePunkte([]);
    setFallbackGrund('Die vorhandenen Punkte werden verworfen und vollständig neu gesetzt.');
    setOffen(true);
    setMarkieren(true);
  };

  const gleicheGaubeMarkieren = (flaechen: Flaeche[]) => {
    startPunkte.current = '[]';
    const erste = flaechen[0];
    if (!erste) return;
    const messung = erste.gaubenMessung;
    setTyp(erste.gaubenTyp ?? 'flachdach');
    setQuelle(messung?.quelle ?? 'aufmass');
    setBreiteM(erste.breiteM);
    setHoeheM(erste.hoeheM);
    setZiegelQuer(messung?.ziegelQuer ?? 10);
    setDeckbreiteCm(messung?.deckbreiteCm ?? 30);
    setZiegelReihen(messung?.ziegelReihen ?? 8);
    setReihenabstandCm(messung?.reihenabstandCm ?? 34);
    setBearbeiteId(null);
    setPunkte([]);
    setLetzteGueltigePunkte([]);
    setFallbackGrund(null);
    setOffen(true);
    setMarkieren(true);
  };

  const belegungOeffnen = (gruppenId: string) => {
    const flaeche = gauben.find((f) => (f.gaubenGruppeId ?? f.id) === gruppenId);
    if (onBelegungOeffnen && flaeche) { onBelegungOeffnen(flaeche.id); return; }
    const details = Array.from(
      document.querySelectorAll<HTMLDetailsElement>('details[data-gauben-gruppe]'),
    ).filter((element) => element.dataset.gaubenGruppe === gruppenId);
    details.forEach((element) => {
      element.open = true;
    });
    details[0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const erstellen = (weitereGleiche = false) => {
    if (touchStart || !markierungAktuell || pruefungAktuell.status === 'fehler') return;
    const { aussen, aussparung, seiten } = markierungAktuell;

    if (bearbeiteId) {
      const gespeichert = onMarkierungAendern(bearbeiteId, {
        aussen,
        ...(seiten ? { seiten } : {}),
        aussparung,
      });
      if (gespeichert === false) { setSpeicherFehler('Die Änderung konnte nicht übernommen werden. Bitte Foto und Dachseiten prüfen.'); return; }
      reset();
      return;
    }

    const masse =
      kopieVon ? { breiteM, hoeheM } : quelle === 'ziegel'
        ? {
            breiteM: (ziegelQuer * deckbreiteCm) / 100,
            hoeheM: (ziegelReihen * reihenabstandCm) / 100,
          }
        : quelle === 'nachbardach'
          ? sichtbareSchaetzung
          : { breiteM, hoeheM };
    if (!masse || masse.breiteM <= 0 || masse.hoeheM <= 0) return;

    onErstellen({
      typ,
      aussen,
      ...(seiten ? { seiten } : {}),
      ...(kopieVon && typ === 'satteldach' ? { seitenMasse: Object.fromEntries(gauben.filter(f => (f.gaubenGruppeId ?? f.id) === kopieVon && f.gaubenSeite).map(f => [f.gaubenSeite!, { breiteM: f.breiteM, hoeheM: f.hoeheM }])) as { links: GaubenSeitenMass; rechts: GaubenSeitenMass } } : quelle === 'nachbardach' && seitenSchaetzung ? { seitenMasse: seitenSchaetzung } : {}),
      ...(kopieVon ? { seitenMessung: Object.fromEntries(gauben.filter(f => (f.gaubenGruppeId ?? f.id) === kopieVon && f.gaubenSeite).map(f => [f.gaubenSeite!, f.gaubenMessung ?? { quelle: 'nachbardach', qualitaet: 'geschaetzt' }])) } : {}),
      breiteM: Math.round(masse.breiteM * 100) / 100,
      hoeheM: Math.round(masse.hoeheM * 100) / 100,
      messung: kopieVon ? gauben.find(f => (f.gaubenGruppeId ?? f.id) === kopieVon)?.gaubenMessung ?? { quelle: 'nachbardach', qualitaet: 'geschaetzt' } : {
        quelle,
        qualitaet:
          quelle === 'aufmass' ? 'bestaetigt' : quelle === 'ziegel' ? 'gemessen' : 'geschaetzt',
        ...(quelle === 'ziegel'
          ? { ziegelQuer, deckbreiteCm, ziegelReihen, reihenabstandCm }
          : {}),
      },
      aussparung,
    });
    if (weitereGleiche) {
      setPunkte([]);
      setBearbeiteId(null);
      setWerkzeug('form');
      setMarkieren(true);
      setOffen(true);
    } else {
      reset();
    }
  };

  entwurfAktionen.current = {
    name: `${eltern.name} · Gaubenmarkierung`,
    gueltig: () => !touchStart && !!markierungAktuell && pruefungAktuell.status !== 'fehler' && (!!bearbeiteId || !!kopieVon || quelle !== 'nachbardach' || !!sichtbareSchaetzung),
    uebernehmen: () => erstellen(false),
    verwerfen: reset,
  };

  const gruppe = gruppen.find(([id]) => id === bearbeiteId);
  const gaubenName = gruppe ? `Gaube ${gruppen.findIndex(([id]) => id === bearbeiteId) + 1}` : kopieVon ? 'Gaubenkopie' : 'Neue Gaube';
  const massFlaeche = gauben.find(f => f.id === massId);
  const massGruppe = massFlaeche ? gruppen.find(([, fs]) => fs.some(f => f.id === massFlaeche.id)) : undefined;
  const indizesFuer = (wert = element): number[] | undefined => {
    if (werkzeug === 'position') return undefined;
    const [art, nr] = wert.split(':');
    const i = Number(nr);
    return art === 'first' ? [4, 5] : art === 'kante' ? [i, (i + 1) % 4] : [i];
  };
  const elementName = werkzeug === 'position' ? 'Gaube' : element.startsWith('first') ? 'First' : element.startsWith('kante') ? 'Kante' : 'Ecke';
  const waehleWerkzeug = (neu: 'position' | 'form') => {
    ziehgesteAbbrechen(); setTouchStart(null); setWerkzeug(neu);
  };
  const waehleElement = (wert: string) => {
    setElement(wert); setTouchStart(null);
    if (wert.startsWith('punkt:')) setAusgewaehlt(Number(wert.split(':')[1]));
  };
  const verschiebe = (dx: number, dy: number, indizes = indizesFuer()) => {
    setzePunkteKontrolliert(verschiebeGaubenPunkte(punkte, dx, dy, foto.breitePx, foto.hoehePx, indizes));
  };
  const fotoPunkt = (e: { clientX: number; clientY: number }, svg: SVGSVGElement): Punkt => {
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * foto.breitePx, (e.clientY - r.top) / r.height * foto.hoehePx];
  };
  const beginneZug = (e: ReactPointerEvent<SVGElement>, indizes?: number[]) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || !svg.getBoundingClientRect().width) return;
    e.preventDefault(); e.stopPropagation();
    ziehStart.current = { punkte, gueltige: letzteGueltigePunkte };
    ziehAuswahl.current = { start: fotoPunkt(e, svg), indizes };
    setTouchStart(null); setZieht(true); svg.focus({ preventScroll: true });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Fensterabbruch bleibt verfügbar. */ }
  };
  const bewegeZug = (e: ReactPointerEvent<SVGElement>) => {
    const drag = ziehAuswahl.current, basis = ziehStart.current, svg = e.currentTarget.ownerSVGElement;
    if (!drag || !basis || !svg) return;
    const p = fotoPunkt(e, svg);
    planeZiehPunkte(verschiebeGaubenPunkte(basis.punkte, p[0] - drag.start[0], p[1] - drag.start[1], foto.breitePx, foto.hoehePx, drag.indizes));
  };
  const endeZug = (e: ReactPointerEvent<SVGElement>) => {
    if (!ziehAuswahl.current) return;
    bewegeZug(e); uebernehmeVorgemerkteZiehPunkte();
    ziehAuswahl.current = null; ziehStart.current = null; setZieht(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const zugAbbrechen = () => { ziehAuswahl.current = null; ziehgesteAbbrechen(); };
  fensterGeste.current = { abbrechen: zugAbbrechen, ende: () => {
    if (!ziehAuswahl.current) return;
    uebernehmeVorgemerkteZiehPunkte(); ziehAuswahl.current = null; ziehStart.current = null; setZieht(false);
  } };
  const griffAmKreuz = punkte.findIndex(p => Math.hypot(p[0] - tastaturPunkt[0], p[1] - tastaturPunkt[1]) < foto.breitePx * .022);
  const punktBestaetigen = () => {
    if (punkte.length < erwartet) {
      setzePunkteKontrolliert([...punkte, [...tastaturPunkt]], punkte.length === 3);
      setAusgewaehlt(punkte.length); setElement(`punkt:${punkte.length}`);
    } else if (touchStart) {
      verschiebe(tastaturPunkt[0] - touchStart[0], tastaturPunkt[1] - touchStart[1]);
      setTouchStart(null);
    } else {
      if (werkzeug === 'form' && element.startsWith('punkt:') && griffAmKreuz >= 0) {
        setAusgewaehlt(griffAmKreuz); setElement(`punkt:${griffAmKreuz}`);
      }
      setTouchStart([...tastaturPunkt]);
    }
  };
  const kopiereGaube = (id: string, fs: Flaeche[]) => {
    gleicheGaubeMarkieren(fs); setMassId(null); setKopieVon(id); setTouchStart(null); setSpeicherFehler(null);
    const rekonstruiert = rekonstruiereGaubenPunkte(eltern, fs, id, fotoId);
    if (rekonstruiert.ok) {
      const neu = verschiebeGaubenPunkte(rekonstruiert.punkte, foto.breitePx * .04, foto.hoehePx * .04, foto.breitePx, foto.hoehePx);
      setPunkte(neu); setLetzteGueltigePunkte(neu); setWerkzeug('position');
    } else {
      setWerkzeug('form'); setFallbackGrund('Maße übernommen. In dieser Fotoansicht fehlen passende Gaubenecken: bitte die Kopie neu markieren.');
    }
  };
  const oeffneMasse = (id: string) => navigation.weiter(() => { reset(); setMassId(id); });
  const kontur = markierungVorschau ? gaubenFotoUmriss(markierungVorschau.aussen, markierungVorschau.seiten) : punkte.slice(0, 4);
  const modulProjekt = moduleZeigen ? vorschauProjekt : { ...vorschauProjekt, flaechen: vorschauProjekt.flaechen.map(f => ({ ...f, felder: [] })) };
  const hintergrund = <>
    <defs><ModulAsset id={`gauben-modul-${svgInstanzId}`} modul={modul} /></defs>
    <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
    {projektFoto && <g pointerEvents="none">{fotoFlaechenInhalt({ projekt: modulProjekt, foto: projektFoto, beschriftung: false, assetId: `gauben-modul-${svgInstanzId}`, clipIdPrefix: `${svgInstanzId}-gauben`, modulDarstellung: zieht ? 'kontur' : 'vorschau' })}</g>}
  </>;
  const bild = <svg viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`} role="img"
    aria-label={markieren ? 'Gaube im Dachfoto markieren' : 'Gauben im Dachfoto'} tabIndex={0}
    className={styles.bild} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Escape"
    onKeyDown={e => {
      const v: Record<string, Punkt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (!markieren) return;
      if (v[e.key]) {
        e.preventDefault(); const schritt = e.shiftKey ? 10 : 1;
        if (punkte.length >= erwartet) verschiebe(v[e.key]![0] * schritt, v[e.key]![1] * schritt);
        else setTastaturPunkt(([x, y]) => [Math.max(0, Math.min(foto.breitePx, x + v[e.key]![0] * schritt)), Math.max(0, Math.min(foto.hoehePx, y + v[e.key]![1] * schritt))]);
      } else if (e.key === 'Enter' && punkte.length < erwartet) { e.preventDefault(); punktBestaetigen(); }
      else if (e.key === 'Escape') { e.preventDefault(); if (zieht) zugAbbrechen(); else if (touchStart) setTouchStart(null); else if (bearbeiteId || kopieVon) reset(); else { setPunkte([]); setLetzteGueltigePunkte([]); setMarkieren(false); } }
    }}
    onClick={e => {
      if (!markieren || punkte.length >= erwartet || touchBedienung) return;
      setzePunkteKontrolliert([...punkte, fotoPunkt(e, e.currentTarget)], punkte.length === 3);
      setAusgewaehlt(punkte.length); setElement(`punkt:${punkte.length}`);
    }}>
    {hintergrund}
    {massFlaeche && (() => {
      const ecken = fotoZuordnungenVon(massFlaeche).find(z => z.fotoId === fotoId)?.eckenPx;
      return ecken ? <polygon data-testid="gauben-mass-seite" points={ecken.map(p => p.join(',')).join(' ')} fill="rgba(184,61,30,.1)" stroke="#e8603a" strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null;
    })()}
    {!markieren && gruppen.map(([id, fs], index) => {
      const r = rekonstruiereGaubenPunkte(eltern, fs, id, fotoId);
      if (!r.ok) return null;
      const m = fs[0]!.gaubenTyp === 'satteldach' ? satteldachSeitenEcken(r.punkte.slice(0, 4) as Ecken, [r.punkte[4]!, r.punkte[5]!], eltern) : undefined;
      const ps = gaubenFotoUmriss(r.punkte.slice(0, 4) as Ecken, m ?? undefined);
      return <polygon key={id} points={ps.map(p => p.join(',')).join(' ')} role="button" tabIndex={0}
        aria-label={`Gaube ${index + 1} im Foto bearbeiten`} className={styles.auswahlKontur}
        onClick={e => { e.stopPropagation(); navigation.weiter(() => bearbeitungStarten(id, fs)); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigation.weiter(() => bearbeitungStarten(id, fs)); } }} />;
    })}
    {markieren && <>
      {kontur.length >= 3 && <polygon data-testid="gauben-gruppe" points={kontur.map(p => p.join(',')).join(' ')}
        fill="rgba(184,61,30,.08)" stroke={pruefungAktuell.status === 'fehler' && punkte.length >= erwartet ? '#dc2626' : '#e8603a'} strokeWidth={2} vectorEffect="non-scaling-stroke"
        role={punkte.length >= erwartet && werkzeug === 'position' ? 'button' : undefined}
        aria-label={punkte.length >= erwartet && werkzeug === 'position' ? 'Gaube verschieben' : undefined}
        tabIndex={punkte.length >= erwartet && werkzeug === 'position' ? 0 : undefined}
        style={{ cursor: werkzeug === 'position' ? 'grab' : undefined }}
        onPointerDown={e => { if (punkte.length >= erwartet && werkzeug === 'position') beginneZug(e); }} onPointerMove={bewegeZug} onPointerUp={endeZug} onPointerCancel={zugAbbrechen} />}
      {punkte.length >= 2 && punkte.length < 4 && <polyline points={punkte.map(p => p.join(',')).join(' ')} fill="none" stroke="#e8603a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
      {punkte.length >= 5 && <line x1={punkte[4]![0]} y1={punkte[4]![1]} x2={punkte[5]?.[0] ?? punkte[4]![0]} y2={punkte[5]?.[1] ?? punkte[4]![1]} stroke="#0284c7" strokeWidth="2" strokeDasharray="8 5" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      {punkte.length >= erwartet && werkzeug === 'form' && [...[0, 1, 2, 3].map(i => ({ ps: [i, (i + 1) % 4], name: `Gaubenkante ${i + 1}`, wert: `kante:${i}` })), ...(typ === 'satteldach' ? [{ ps: [4, 5], name: 'Firstlinie', wert: 'first:0' }] : [])].map(({ ps, name, wert }) => {
        const p = punkte[ps[0]!]!, q = punkte[ps[1]!]!;
        return <g key={wert}>
          <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="transparent" strokeWidth="22" vectorEffect="non-scaling-stroke"
            role="button" tabIndex={0} aria-label={`${name} verschieben`} aria-pressed={element === wert} style={{ cursor: 'grab' }}
            onFocus={() => waehleElement(wert)} onClick={e => e.stopPropagation()}
            onPointerDown={e => { waehleElement(wert); beginneZug(e, ps); }} onPointerMove={bewegeZug} onPointerUp={endeZug} onPointerCancel={zugAbbrechen} />
          <rect x={(p[0] + q[0]) / 2 - foto.breitePx * .004} y={(p[1] + q[1]) / 2 - foto.breitePx * .004} width={foto.breitePx * .008} height={foto.breitePx * .008} fill={element === wert ? '#263238' : 'white'} stroke={wert.startsWith('first') ? '#0284c7' : '#b83d1e'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </g>;
      })}
      {punkte.map((p, i) => <g key={i}>
        <circle cx={p[0]} cy={p[1]} r={Math.max(5, foto.breitePx * .006)} fill="transparent" stroke="transparent" strokeWidth="44" vectorEffect="non-scaling-stroke"
          role="button" tabIndex={0} aria-label={`Gaubenpunkt ${i + 1}`} aria-pressed={werkzeug === 'form' && element === `punkt:${i}`} style={{ cursor: 'grab', touchAction: 'none' }}
          onFocus={() => { if (werkzeug === 'form') waehleElement(`punkt:${i}`); }} onClick={e => e.stopPropagation()}
          onPointerDown={e => { if (werkzeug === 'form') { setAusgewaehlt(i); setElement(`punkt:${i}`); } beginneZug(e, werkzeug === 'position' ? undefined : [i]); }}
          onPointerMove={bewegeZug} onPointerUp={endeZug} onPointerCancel={zugAbbrechen} />
        <circle cx={p[0]} cy={p[1]} r={Math.max(5, foto.breitePx * .008)} fill={i >= 4 ? '#0284c7' : werkzeug === 'form' && element === `punkt:${i}` ? '#263238' : '#b83d1e'} stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <text x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={Math.max(10, foto.breitePx * .012)} fontWeight="700" pointerEvents="none">{i + 1}</text>
      </g>)}
      {(!renderArbeitsbereich || !touchBedienung) && <g aria-hidden="true" pointerEvents="none" data-testid="foto-fadenkreuz" data-x={tastaturPunkt[0]} data-y={tastaturPunkt[1]}>
        <path d={`M${tastaturPunkt[0]},0 V${foto.hoehePx} M0,${tastaturPunkt[1]} H${foto.breitePx}`} fill="none" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <path d={`M${tastaturPunkt[0]},0 V${foto.hoehePx} M0,${tastaturPunkt[1]} H${foto.breitePx}`} fill="none" stroke="#0284c7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>}
    </>}
  </svg>;

  const fehler = speicherFehler ?? (punkte.length >= erwartet && pruefungAktuell.status === 'fehler' ? pruefungAktuell.meldungen.join(' ') : null);
  const gueltig = punkte.length >= erwartet && !fehler && (!!bearbeiteId || !!kopieVon || quelle !== 'nachbardach' || !!sichtbareSchaetzung);
  const korrektur = <>
    <div className={styles.aufgaben} role="group" aria-label="Gaube bearbeiten">
      <button type="button" aria-pressed={werkzeug === 'position'} onClick={() => waehleWerkzeug('position')} disabled={punkte.length < erwartet}>Position ändern</button>
      <button type="button" aria-pressed={werkzeug === 'form'} onClick={() => waehleWerkzeug('form')}>Form korrigieren</button>
    </div>
    <p>{punkte.length < 4 ? `Gaubenumriss: noch ${4 - punkte.length} Ecke(n) setzen.` : typ === 'satteldach' && punkte.length < 6 ? `Jetzt die Firstlinie: noch ${6 - punkte.length} Punkt(e) setzen.` : werkzeug === 'position' ? touchBedienung ? 'Gaube greifen, Fadenkreuz zum Ziel bewegen und dort ablegen.' : 'Innerhalb der Gaube ziehen. Alle Ecken und die Aussparung bewegen sich mit.' : touchBedienung ? `${elementName} wählen, greifen und am Ziel ablegen.` : 'Ecken einzeln ziehen. Kanten und Firstlinie lassen sich gemeinsam verschieben.'}</p>
    {punkte.length >= erwartet && <>
      {werkzeug === 'form' && <label className={styles.feld}>Was möchtest du korrigieren?<select value={element} onChange={e => waehleElement(e.target.value)} aria-label="Gaubenelement">
        {punkte.map((_, i) => <option key={`p${i}`} value={`punkt:${i}`}>{i >= 4 ? `Firstende ${i - 3}` : `Ecke ${i + 1}`}</option>)}
        {[0, 1, 2, 3].map(i => <option key={`k${i}`} value={`kante:${i}`}>Kante {i + 1}</option>)}
        {typ === 'satteldach' && <option value="first:0">Ganze Firstlinie</option>}
      </select></label>}
      <div className={styles.feinkorrektur} role="group" aria-label={`${elementName} fein verschieben`}>
        <span>Fein verschieben</span>
        {([[-1, 0, '←', 'links'], [0, -1, '↑', 'oben'], [0, 1, '↓', 'unten'], [1, 0, '→', 'rechts']] as const).map(([x, y, zeichen, name]) => <button key={name} type="button" aria-label={`${elementName} nach ${name}`} disabled={!!touchStart} onClick={() => verschiebe(x, y)}>{zeichen}</button>)}
      </div>
      {werkzeug === 'form' && <p className={styles.nebenhinweis}>Die Dachmaße bleiben unverändert.</p>}
    </>}
    <label className={styles.check}><input type="checkbox" checked={moduleZeigen} onChange={e => setModuleZeigen(e.target.checked)} />Module im Foto anzeigen</label>
    {fallbackGrund && <p className={styles.warnung} role="status">{fallbackGrund}</p>}
    {punkte.length >= erwartet && pruefungAktuell.status === 'warnung' && <p className={styles.warnung} role="status">{pruefungAktuell.meldungen.join(' ')}</p>}
    {quelle === 'nachbardach' && !bearbeiteId && !kopieVon && sichtbareSchaetzung && <p className={styles.warnung}>Maße geschätzt: {fmtDe(sichtbareSchaetzung.breiteM, 2)} × {fmtDe(sichtbareSchaetzung.hoeheM, 2)} m je Dachseite. Später mit Aufmaß prüfen.</p>}
    {kopieVon && <p className={styles.nebenhinweis}>Kopie übernimmt Typ, Seitenmaße und Messquelle. Die Modulbelegung wird neu erzeugt. Vor dem Anlegen im Foto platzieren und prüfen.</p>}
    {bearbeiteId ? <details className={styles.zusatz}><summary>Markierung neu beginnen</summary><p>Alle Fotoecken neu setzen. Maße und Belegung bleiben erhalten.</p><button type="button" onClick={() => markierungKomplettNeu(bearbeiteId, gruppe?.[1] ?? [])}>Komplett neu markieren</button></details> : <div className={styles.nebenAktionen}>
      <button type="button" disabled={!punkte.length} onClick={() => { setWerkzeug('form'); setzePunkteKontrolliert(punkte.slice(0, -1)); }}>Punkt zurück</button>
      {!kopieVon && <button type="button" disabled={!gueltig} onClick={() => erstellen(true)}>Anlegen & nächste gleiche markieren</button>}
    </div>}
    <EditorAktionen><div data-gauben-abschluss>
      <span role={fehler ? 'alert' : 'status'}>{fehler ?? (touchStart ? `${elementName} gegriffen – zuerst ablegen oder die Bewegung abbrechen.` : punkte.length < erwartet ? `${punkte.length} von ${erwartet} Punkten gesetzt` : `${gaubenName} · ${bearbeiteId ? 'Änderung prüfen' : 'Bereit zum Anlegen'}`)}</span>
      <button type="button" disabled={!gueltig || !!touchStart} onClick={() => erstellen(false)}>{bearbeiteId ? 'Änderungen übernehmen' : kopieVon ? 'Gaubenkopie anlegen' : 'Gaube anlegen & fertig'}</button>
      {touchStart ? <button type="button" onClick={() => setTouchStart(null)}>Bewegung abbrechen</button> : <button type="button" onClick={reset}>Abbrechen</button>}
    </div></EditorAktionen>
  </>;

  const steuerung = <section ref={formularRef} data-gauben-steuerung className={styles.editor}>
    {massFlaeche ? <>
      <div className={styles.kurzKopf}><strong>{`Gaube ${gruppen.findIndex(([id]) => id === massGruppe?.[0]) + 1}`}</strong><span>{massFlaeche.gaubenTyp === 'satteldach' ? massFlaeche.gaubenSeite === 'links' ? 'Linke Dachseite' : 'Rechte Dachseite' : 'Gaubendach'}</span></div>
      <GaubenMassEditor key={massFlaeche.id} flaeche={massFlaeche} modul={modul} onSpeichern={(b, h, messung) => { onMasseAendern(massFlaeche.gaubenGruppeId ?? massFlaeche.id, massFlaeche.id, b, h, messung); setMassId(null); }} onAbbrechen={() => setMassId(null)} />
      {massGruppe && massGruppe[1].length > 1 && <div className={styles.nebenAktionen}>{massGruppe[1].filter(f => f.id !== massFlaeche.id).map(f => <button type="button" key={f.id} onClick={() => oeffneMasse(f.id)}>{f.gaubenSeite === 'links' ? 'Linke' : 'Rechte'} Dachseite bearbeiten</button>)}</div>}
    </> : markieren ? <>
      <div className={styles.kurzKopf}><strong>{gaubenName}</strong><span>{typ === 'satteldach' ? 'Satteldachgaube' : 'Flachdachgaube · Stehfalz'}</span></div>
      {korrektur}
    </> : offen ? <>
      <div className={styles.aufgaben} role="group" aria-label="Gaubentyp">
        <ToggleButton aktiv={typ === 'flachdach'} onClick={() => setTyp('flachdach')}>Flachdachgaube · Stehfalz</ToggleButton>
        <ToggleButton aktiv={typ === 'satteldach'} onClick={() => setTyp('satteldach')}>Satteldachgaube</ToggleButton>
      </div>
      <p>Wie kommen die Maße zustande?</p>
      <div className={styles.aufgaben} role="group" aria-label="Messquelle">
        <ToggleButton aktiv={quelle === 'aufmass'} onClick={() => setQuelle('aufmass')}>Aufmaß vorhanden</ToggleButton>
        <ToggleButton aktiv={quelle === 'ziegel'} onClick={() => setQuelle('ziegel')}>Ziegel zählen</ToggleButton>
        <ToggleButton aktiv={quelle === 'nachbardach'} onClick={() => setQuelle('nachbardach')}>Aus Nachbardach schätzen</ToggleButton>
      </div>
      {quelle === 'aufmass' ? <div className={styles.zweiSpalten}><ZahlenEingabe label="Breite der belegbaren Fläche" value={breiteM} onChange={setBreiteM} einheit="m" /><ZahlenEingabe label="Länge Traufe bis First" value={hoeheM} onChange={setHoeheM} einheit="m" /></div> : quelle === 'ziegel' ? <div className={styles.zweiSpalten}>
        <ZahlenEingabe label="Ziegel quer" value={ziegelQuer} onChange={setZiegelQuer} einheit="Stk." min={1} /><ZahlenEingabe label="Deckbreite" value={deckbreiteCm} onChange={setDeckbreiteCm} einheit="cm" min={1} />
        <ZahlenEingabe label="Ziegelreihen" value={ziegelReihen} onChange={setZiegelReihen} einheit="Stk." min={1} /><ZahlenEingabe label="Reihenabstand" value={reihenabstandCm} onChange={setReihenabstandCm} einheit="cm" min={1} />
      </div> : <p className={styles.warnung}>Das Hauptdach liefert einen Schätzwert. Die Gaube liegt auf einer anderen Ebene; für genaue Maße später Aufmaß oder Ziegelwerte verwenden.</p>}
      {typ === 'satteldach' && quelle !== 'nachbardach' && <p className={styles.nebenhinweis}>Diese Maße gelten zunächst für beide Dachseiten. Unterschiede kannst du danach je Seite ändern.</p>}
      <EditorAktionen><div data-gauben-abschluss><button type="button" onClick={starten}>Im Foto markieren →</button><button type="button" onClick={reset}>Abbrechen</button></div></EditorAktionen>
    </> : <>
      <p>{gruppen.length ? `${gruppen.length} ${gruppen.length === 1 ? 'Gaube angelegt' : 'Gauben angelegt'}. Im Foto oder hier auswählen.` : 'Gaube im selben Foto anlegen. Die Aussparung im Hauptdach wird automatisch mitgeführt.'}</p>
      <div className={styles.gruppenListe}>{gruppen.map(([id, fs], index) => <div key={id} className={styles.gruppe} data-gaubengruppe={id}>
        <div className={styles.gruppenKopf}><strong>Gaube {index + 1}</strong><span>{fs[0]!.gaubenTyp === 'satteldach' ? 'Satteldach' : 'Flachdach · Stehfalz'}</span></div>
        <div className={styles.aufgaben}>
          <button type="button" onClick={() => navigation.weiter(() => bearbeitungStarten(id, fs, 'position'))}>Position ändern</button>
          <button type="button" onClick={() => navigation.weiter(() => bearbeitungStarten(id, fs, 'form'))}>Form korrigieren</button>
        </div>
        <div className={styles.seiten}>{fs.map(f => <div key={f.id}>
          <strong>{fs.length > 1 ? f.gaubenSeite === 'links' ? 'Linke Dachseite' : 'Rechte Dachseite' : 'Gaubendach'}</strong>
          <span>{fmtDe(f.breiteM, 2)} × {fmtDe(f.hoeheM, 2)} m · {f.gaubenMessung?.qualitaet === 'bestaetigt' ? 'Aufmaß bestätigt' : f.gaubenMessung?.qualitaet === 'gemessen' ? 'Ziegel gemessen' : f.gaubenMessung?.qualitaet === 'geschaetzt' ? 'geschätzt' : 'Maße aus Altprojekt'}</span>
          <div className={styles.aufgaben}><button type="button" onClick={() => oeffneMasse(f.id)} aria-label={fs.length > 1 ? `${f.gaubenSeite === 'links' ? 'Linke' : 'Rechte'} Dachmaße ändern` : 'Dachmaße ändern'}>Dachmaße ändern</button>
          <button type="button" onClick={() => navigation.weiter(() => onBelegungOeffnen ? onBelegungOeffnen(f.id) : belegungOeffnen(id))} aria-label={fs.length > 1 ? `${f.gaubenSeite === 'links' ? 'Linke' : 'Rechte'} Module bearbeiten` : 'Module bearbeiten'}>Module bearbeiten</button></div>
        </div>)}</div>
        <div className={styles.nebenAktionen}><button type="button" onClick={() => navigation.weiter(() => kopiereGaube(id, fs))}>Gaube kopieren</button><button type="button" onClick={() => navigation.weiter(() => onLoeschen(id))}>Entfernen …</button></div>
      </div>)}</div>
      <EditorAktionen><div data-gauben-abschluss><button type="button" onClick={() => { reset(); setOffen(true); }}>+ Gaube</button></div></EditorAktionen>
    </>}
    {!renderArbeitsbereich && bild}
  </section>;
  const aktuelleAufgabe = massFlaeche ? 'Dachmaße ändern' : markieren ? punkte.length < erwartet ? 'Gaube im Foto markieren' : werkzeug === 'position' ? 'Gaube verschieben' : 'Gaubenform korrigieren' : offen ? 'Gaube anlegen' : 'Gauben bearbeiten';
  const hinweis = massFlaeche ? `${massFlaeche.gaubenSeite === 'links' ? 'Linke Dachseite' : massFlaeche.gaubenSeite === 'rechts' ? 'Rechte Dachseite' : 'Gaubendach'}: tatsächliche Maße eingeben.` : markieren ? punkte.length < erwartet ? `${punkte.length} von ${erwartet} Punkten · ${punkte.length < 4 ? 'Dachecken' : 'Firstenden'} ${touchBedienung ? 'mit dem Fadenkreuz setzen' : 'anklicken'}.` : werkzeug === 'position' ? `${gaubenName}: ${touchBedienung ? 'greifen und am Ziel ablegen' : 'innerhalb der Gaube ziehen'}. Dachmaße bleiben unverändert.` : `${gaubenName}: Ecken, Kanten oder First korrigieren.` : 'Gaube im Foto oder in der Liste auswählen.';
  return renderArbeitsbereich ? renderArbeitsbereich({
    bild, steuerung, hinweis, aufgabe: { titel: aktuelleAufgabe, phase: massFlaeche ? `Gaube ${gruppen.findIndex(([id]) => id === massGruppe?.[0]) + 1}` : markieren ? gaubenName : eltern.name },
    bildSeitenverhaeltnis: foto.breitePx / foto.hoehePx,
    abbrechen: zugAbbrechen,
    punktSteuerung: markieren ? {
      aktiv: touchBedienung, aktivieren: aktiviereTouch,
      deaktivieren: () => { deaktiviereTouch(); setTouchStart(null); },
      punkt: tastaturPunkt, breitePx: foto.breitePx, hoehePx: foto.hoehePx,
      onBewegen: setTastaturPunkt, onBestaetigen: punktBestaetigen,
      aktion: punkte.length < erwartet ? 'Punkt setzen' : `${elementName} ${touchStart ? 'hier ablegen' : 'greifen'}`,
    } : undefined,
  }) : steuerung;
}
