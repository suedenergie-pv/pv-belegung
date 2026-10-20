import {
  inverseHomographie,
  eckenPlausibel,
  projiziere,
  pruefePerspektive,
  sortiereEcken,
  type Ecken,
  type Punkt,
} from './foto-geometrie';
import type { HindernisM } from '@pv-belegung/engine';
import { gaubenFotoUmriss } from './gauben-umriss';
import {
  fotoZuordnungenVon,
  perspektiveQuelle,
  rahmenBreiteVon,
  type Flaeche,
  type FotoZuordnung,
  type GaubenAussparung,
  type Projekt,
} from './model';

const distanz = (a: Punkt, b: Punkt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rundeCm = (wert: number) => Math.round(wert * 100) / 100;
const positivesMass = (wert: number) => Math.max(0.1, rundeCm(wert));

export interface GaubenMarkierung {
  aussen: Ecken;
  seiten?: { links: Ecken; rechts: Ecken };
  aussparung: HindernisM;
}

export type RekonstruierteGaubenPunkte =
  | { ok: true; punkte: Punkt[] }
  | { ok: false; grund: string };

export type GaubenMarkierungAngewendet =
  | { ok: true; projekt: Projekt }
  | { ok: false; grund: string };

/** Eine Gaube, Kante oder Firstlinie bewegen, ohne ihre Form am Fotorand zu stauchen. */
export function verschiebeGaubenPunkte(
  punkte: readonly Punkt[],
  dx: number,
  dy: number,
  breitePx: number,
  hoehePx: number,
  indizes?: readonly number[],
): Punkt[] {
  const kopie = punkte.map(([x, y]) => [x, y] as Punkt);
  if (
    ![dx, dy, breitePx, hoehePx].every(Number.isFinite) ||
    breitePx <= 0 || hoehePx <= 0 ||
    !punkte.every((p) => p.every(Number.isFinite))
  ) return kopie;
  const auswahl = [...new Set(indizes ?? punkte.map((_, i) => i))];
  if (
    auswahl.length === 0 ||
    auswahl.some((i) => !Number.isInteger(i) || i < 0 || i >= punkte.length)
  ) return kopie;
  const xs = auswahl.map((i) => punkte[i]![0]);
  const ys = auswahl.map((i) => punkte[i]![1]);
  const minDx = -Math.min(...xs);
  const maxDx = breitePx - Math.max(...xs);
  const minDy = -Math.min(...ys);
  const maxDy = hoehePx - Math.max(...ys);
  // Eine größere Auswahl passt auch mit gemeinsamer Verschiebung nicht ins Foto.
  if (minDx > maxDx || minDy > maxDy) return kopie;
  const deltaX = Math.max(minDx, Math.min(maxDx, dx));
  const deltaY = Math.max(minDy, Math.min(maxDy, dy));
  for (const i of auswahl) {
    kopie[i] = [punkte[i]![0] + deltaX, punkte[i]![1] + deltaY];
  }
  return kopie;
}

/** Foto-Punkte lokal und deterministisch in die Ebene des Hauptdachs zurückrechnen. */
export function gaubenPunkteAufElternflaeche(
  eltern: Flaeche,
  fotoPunkte: readonly Punkt[],
): Punkt[] | null {
  const ecken = eltern.foto?.eckenPx;
  if (!ecken || fotoPunkte.length === 0) return null;
  const inv = inverseHomographie(
    rahmenBreiteVon(eltern),
    eltern.hoeheM,
    ecken,
    perspektiveQuelle(eltern),
  );
  if (!inv) return null;
  const punkte = fotoPunkte.map((p) => projiziere(inv, p));
  return punkte.every((p) => p.every(Number.isFinite)) ? punkte : null;
}

/**
 * Schätzwert aus der Eltern-Homographie. Weil die Gaube eine andere Ebene ist,
 * ist das ausdrücklich keine bestätigte Messung (SPEC §4.3).
 */
export function gaubenMasseAusElternfoto(
  eltern: Flaeche,
  fotoEcken: Ecken,
): { breiteM: number; hoeheM: number } | null {
  const sortiert = sortiereEcken(fotoEcken);
  const p = gaubenPunkteAufElternflaeche(eltern, sortiert);
  if (!p || p.length !== 4) return null;
  return {
    breiteM: positivesMass((distanz(p[0]!, p[1]!) + distanz(p[3]!, p[2]!)) / 2),
    hoeheM: positivesMass((distanz(p[0]!, p[3]!) + distanz(p[1]!, p[2]!)) / 2),
  };
}

/** Exakte Gaubenkontur im Hauptdach; der alte Rechteckrahmen bleibt nur Metadatum. */
export function gaubenAussparungAusFoto(
  eltern: Flaeche,
  fotoEcken: readonly Punkt[],
): HindernisM | null {
  const p = gaubenPunkteAufElternflaeche(eltern, fotoEcken);
  if (!p) return null;
  const xs = p.map((x) => x[0]);
  const ys = p.map((x) => x[1]);
  const links = Math.max(0, Math.min(...xs));
  const oben = Math.max(0, Math.min(...ys));
  const rechts = Math.min(rahmenBreiteVon(eltern), Math.max(...xs));
  const unten = Math.min(eltern.hoeheM, Math.max(...ys));
  if (rechts <= links || unten <= oben) return null;
  return {
    xM: rundeCm(links),
    yM: rundeCm(oben),
    breiteM: positivesMass(rechts - links),
    hoeheM: positivesMass(unten - oben),
    umrissM: p,
  };
}

/**
 * Gekoppelte Gauben-Aussparungen nach einer Perspektivkorrektur des Mutterdachs
 * neu berechnen. Altprojekte ohne gespeicherten Foto-Umriss bleiben unverändert.
 */
export function aktualisiereGaubenAussparungen(
  eltern: Flaeche,
  aussparungen: readonly GaubenAussparung[] | undefined,
  fotoId?: string,
): GaubenAussparung[] | undefined {
  if (!aussparungen) return undefined;
  return aussparungen.map((a) => {
    if (fotoId && (a.fotoId ?? fotoZuordnungenVon(eltern)[0]?.fotoId) !== fotoId) return a;
    const fotoUmriss = a.fotoUmrissPx ?? a.fotoEckenPx;
    if (!fotoUmriss) return a;
    const rechteck = gaubenAussparungAusFoto(eltern, fotoUmriss);
    return rechteck ? { ...a, rechteck } : a;
  });
}

const gleicherPunkt = (a: Punkt, b: Punkt, toleranzPx = 1) => distanz(a, b) <= toleranzPx;

const eindeutigePunkte = (punkte: readonly Punkt[], toleranzPx = 1) => {
  const ergebnis: Punkt[] = [];
  for (const punkt of punkte) {
    if (!ergebnis.some((x) => gleicherPunkt(x, punkt, toleranzPx))) {
      ergebnis.push([punkt[0], punkt[1]]);
    }
  }
  return ergebnis;
};

/**
 * Zwei konvexe Gaubenseiten müssen dieselbe Firstkante von gegenüberliegenden
 * Seiten begrenzen. Gültige sechsseitige, auch konkave Außenkonturen bleiben
 * erlaubt; ein Firstende darf außerhalb des Vierpunkt-Hilfsrahmens liegen.
 */
export function pruefeGaubenTopologie(
  aussen: Ecken,
  seiten?: { links: Ecken; rechts: Ecken },
): string | null {
  const endlich = (punkte: readonly Punkt[]) => punkte.every((p) => p.every(Number.isFinite));
  if (!endlich(aussen)) return 'Die Gaubenpunkte enthalten ungültige Koordinaten.';
  if (!seiten) {
    return eckenPlausibel(aussen) ? null : 'Die Gaubenecken bilden keine gültige Dachfläche.';
  }
  const { links, rechts } = seiten;
  if (!endlich(links) || !endlich(rechts) || !eckenPlausibel(links) || !eckenPlausibel(rechts)) {
    return 'Die Gaubenseiten müssen kreuzungsfreie, gültige Dachflächen bilden.';
  }
  // Dieselbe Toleranz wie beim Zusammenführen der Kontur in gaubenFotoUmriss.
  const gleich = (a: Punkt, b: Punkt) => gleicherPunkt(a, b, 1e-4);
  const gemeinsam = links.filter((p) => rechts.some((q) => gleich(p, q)));
  if (gemeinsam.length !== 2) return 'Beide Gaubenseiten müssen genau eine gemeinsame Firstlinie haben.';
  const [r0, r1] = gemeinsam as [Punkt, Punkt];
  const istFirstkante = (ecken: Ecken) => ecken.some((p, i) => {
    const q = ecken[(i + 1) % 4]!;
    return (gleich(p, r0) && gleich(q, r1)) || (gleich(p, r1) && gleich(q, r0));
  });
  if (!istFirstkante(links) || !istFirstkante(rechts)) {
    return 'Die Firstlinie muss beide Gaubenseiten an ihrer Kante verbinden.';
  }
  const ohneFirst = (ecken: Ecken) => ecken.filter((p) => !gleich(p, r0) && !gleich(p, r1));
  const linksAussen = ohneFirst(links);
  const rechtsAussen = ohneFirst(rechts);
  const alleAussen = [...linksAussen, ...rechtsAussen];
  if (
    eindeutigePunkte(aussen, 1e-4).length !== 4 ||
    alleAussen.length !== 4 ||
    aussen.some((p) => !alleAussen.some((q) => gleich(p, q)))
  ) return 'Die Gaubenseiten passen nicht zu den vier äußeren Gaubenecken.';
  const firstLaenge = distanz(r0, r1);
  const abstandZurFirstlinie = (p: Punkt) =>
    ((r1[0] - r0[0]) * (p[1] - r0[1]) - (r1[1] - r0[1]) * (p[0] - r0[0])) / firstLaenge;
  const linksAbstand = linksAussen.map(abstandZurFirstlinie);
  const rechtsAbstand = rechtsAussen.map(abstandZurFirstlinie);
  if (
    !linksAbstand.every((d) => Math.abs(d) > 1e-4 && Math.sign(d) === Math.sign(linksAbstand[0]!)) ||
    !rechtsAbstand.every((d) => Math.abs(d) > 1e-4 && Math.sign(d) === -Math.sign(linksAbstand[0]!))
  ) return 'Die Gaubenseiten überlappen. Die Firstlinie muss zwischen beiden Dachseiten liegen.';
  return null;
}

/**
 * Gespeicherte Flachdach-/Satteldach-Markierungen wieder in ihre gemeinsamen
 * vier bzw. sechs Kontrollpunkte zerlegen. Die beiden Firstpunkte einer
 * Satteldachgaube werden als Schnittmenge beider Seiten rekonstruiert.
 */
export function rekonstruiereGaubenPunkte(
  eltern: Flaeche,
  flaechen: readonly Flaeche[],
  gruppenId: string,
  fotoId?: string,
): RekonstruierteGaubenPunkte {
  const gruppe = flaechen.filter((f) => (f.gaubenGruppeId ?? f.id) === gruppenId && !!f.gaubenTyp);
  const erste = gruppe[0];
  if (!erste) return { ok: false, grund: 'Die Gaubengruppe enthält keine Dachfläche.' };
  const ersteFotoId = fotoZuordnungenVon(eltern)[0]?.fotoId;
  const quellFotoId = fotoId ?? ersteFotoId;
  if (fotoId && !fotoZuordnungenVon(eltern).some((z) => z.fotoId === fotoId)) {
    return { ok: false, grund: 'Die gewählte Fotoperspektive gehört nicht zum Hauptdach.' };
  }
  const aussparung = eltern.gaubenAussparungen?.find((a) => a.gaubenGruppeId === gruppenId);
  const gespeichertesAussen = (aussparung?.fotoId ?? ersteFotoId) === quellFotoId
    ? aussparung?.fotoEckenPx
    : undefined;

  if (erste.gaubenTyp === 'flachdach') {
    const ecken = gespeichertesAussen ?? fotoZuordnungenVon(erste).find((z) => !quellFotoId || z.fotoId === quellFotoId)?.eckenPx;
    return ecken
      ? { ok: true, punkte: ecken.map(([x, y]) => [x, y]) }
      : { ok: false, grund: 'Die vier gespeicherten Gaubenecken fehlen.' };
  }

  const links = gruppe.find((f) => f.gaubenSeite === 'links');
  const rechts = gruppe.find((f) => f.gaubenSeite === 'rechts');
  const linksEcken = links && fotoZuordnungenVon(links).find((z) => !quellFotoId || z.fotoId === quellFotoId)?.eckenPx;
  const rechtsEcken = rechts && fotoZuordnungenVon(rechts).find((z) => !quellFotoId || z.fotoId === quellFotoId)?.eckenPx;
  if (!linksEcken || !rechtsEcken) {
    return { ok: false, grund: 'Mindestens eine gespeicherte Gaubenseite ist unvollständig.' };
  }
  const gemeinsam = eindeutigePunkte(
    linksEcken.filter((p) => rechtsEcken.some((q) => gleicherPunkt(p, q))),
  );
  if (gemeinsam.length < 2) {
    return { ok: false, grund: 'Die gemeinsame Firstlinie beider Gaubenseiten fehlt.' };
  }
  let first: [Punkt, Punkt] = [gemeinsam[0]!, gemeinsam[1]!];
  for (let i = 0; i < gemeinsam.length; i++) {
    for (let j = i + 1; j < gemeinsam.length; j++) {
      if (distanz(gemeinsam[i]!, gemeinsam[j]!) > distanz(first[0], first[1])) {
        first = [gemeinsam[i]!, gemeinsam[j]!];
      }
    }
  }
  const aussen = gespeichertesAussen ?? (() => {
    const einzigartig = eindeutigePunkte(
      [...linksEcken, ...rechtsEcken].filter((p) => !first.some((r) => gleicherPunkt(p, r))),
    );
    return einzigartig.length === 4
      ? sortiereEcken(einzigartig as [Punkt, Punkt, Punkt, Punkt])
      : undefined;
  })();
  if (!aussen) {
    return { ok: false, grund: 'Der gemeinsame Außenumriss der Satteldachgaube fehlt.' };
  }
  return {
    ok: true,
    punkte: [...aussen.map(([x, y]) => [x, y] as Punkt), [first[0][0], first[0][1]], [first[1][0], first[1][1]]],
  };
}

/**
 * Einziger Schreibpfad für eine korrigierte Gaubenmarkierung. Vorschau und
 * endgültiges Speichern rufen dieselbe reine Funktion auf; Maße, Felder,
 * abgeschaltete Module und Hindernisse bleiben unverändert.
 */
export function wendeGaubenMarkierungAn(
  projekt: Projekt,
  elternId: string,
  gruppenId: string,
  fotoId: string,
  markierung: GaubenMarkierung,
): GaubenMarkierungAngewendet {
  const eltern = projekt.flaechen.find((f) => f.id === elternId);
  const gruppe = projekt.flaechen.filter(
    (f) => (f.gaubenGruppeId ?? f.id) === gruppenId && !!f.gaubenTyp,
  );
  if (!eltern) return { ok: false, grund: 'Das Hauptdach der Gaube fehlt.' };
  if (gruppe.length === 0) return { ok: false, grund: 'Die Gaubengruppe fehlt.' };
  if (!fotoZuordnungenVon(eltern).some((z) => z.fotoId === fotoId)) {
    return { ok: false, grund: 'Die gewählte Fotoperspektive gehört nicht zum Hauptdach.' };
  }
  if (gruppe.some((f) => f.elternFlaecheId !== elternId || f.gaubenTyp !== gruppe[0]!.gaubenTyp)) {
    return { ok: false, grund: 'Die Gaubengruppe gehört nicht vollständig zu diesem Hauptdach.' };
  }
  if (gruppe.some((f) => f.gaubenTyp === 'satteldach') && !markierung.seiten) {
    return { ok: false, grund: 'Die gemeinsame Firstlinie der Satteldachgaube ist ungültig.' };
  }
  if (gruppe[0]!.gaubenTyp === 'satteldach' && (
    gruppe.length !== 2 || !gruppe.some((f) => f.gaubenSeite === 'links') || !gruppe.some((f) => f.gaubenSeite === 'rechts')
  )) {
    return { ok: false, grund: 'Die Satteldachgaube benötigt eine linke und eine rechte Dachseite.' };
  }
  if (gruppe[0]!.gaubenTyp === 'flachdach' && (gruppe.length !== 1 || markierung.seiten)) {
    return { ok: false, grund: 'Eine Flachdachgaube hat genau eine Dachfläche.' };
  }
  const topologieFehler = pruefeGaubenTopologie(markierung.aussen, markierung.seiten);
  if (topologieFehler) return { ok: false, grund: topologieFehler };
  for (const f of gruppe) {
    const ecken = f.gaubenTyp === 'satteldach' && f.gaubenSeite
      ? markierung.seiten?.[f.gaubenSeite]
      : markierung.aussen;
    if (!ecken || pruefePerspektive(rahmenBreiteVon(f), f.hoeheM, ecken, perspektiveQuelle(f)).status === 'fehler') {
      return { ok: false, grund: 'Die Gaubenpunkte bilden keine gültige Dachperspektive.' };
    }
  }

  return {
    ok: true,
    projekt: {
      ...projekt,
      flaechen: projekt.flaechen.map((f) => {
        if (f.id === elternId) {
          const bisher = f.gaubenAussparungen ?? [];
          const vorhanden = bisher.some((a) => a.gaubenGruppeId === gruppenId);
          return {
            ...f,
            gaubenAussparungen: vorhanden
              ? bisher.map((a) =>
                  a.gaubenGruppeId === gruppenId
                    ? { ...a, rechteck: markierung.aussparung, fotoEckenPx: markierung.aussen, fotoId, fotoUmrissPx: gaubenFotoUmriss(markierung.aussen, markierung.seiten) }
                    : a,
                )
              : [...bisher, {
                  gaubenGruppeId: gruppenId,
                  rechteck: markierung.aussparung,
                  fotoEckenPx: markierung.aussen,
                  fotoId, fotoUmrissPx: gaubenFotoUmriss(markierung.aussen, markierung.seiten),
                }],
          };
        }
        if ((f.gaubenGruppeId ?? f.id) !== gruppenId || !f.gaubenTyp) return f;
        const eckenPx =
          f.gaubenTyp === 'satteldach' && f.gaubenSeite
            ? markierung.seiten?.[f.gaubenSeite]
            : markierung.aussen;
        if (!eckenPx) return f;
        const bisher = fotoZuordnungenVon(f);
        const vorhanden = bisher.find((z) => z.fotoId === fotoId);
        const z: FotoZuordnung = {
          ...(vorhanden ?? { fotoId, traufePx: null }),
          fotoId,
          traufePx: null,
          eckenPx,
          markierungFertig: true,
          perspektiveBestaetigt: true,
        };
        return {
          ...f,
          fotoZuordnungen: bisher.some((x) => x.fotoId === fotoId)
            ? bisher.map((x) => (x.fotoId === fotoId ? z : x))
            : [...bisher, z],
        };
      }),
    },
  };
}

const mittelX = (punkte: readonly Punkt[]) =>
  punkte.reduce((summe, p) => summe + p[0], 0) / punkte.length;

/**
 * Äußerer Vierpunkt-Umriss + Firstlinie in zwei sichtbare Gaubenseiten teilen.
 * Mit Mutterdach folgt links/rechts dessen Traufenachse; das bleibt auch bei
 * einem gedrehten Foto stabil. Ohne Mutterdach gilt der alte Foto-X-Fallback.
 */
export function satteldachSeitenEcken(
  aussen: Ecken,
  first: readonly [Punkt, Punkt],
  eltern?: Flaeche,
): { links: Ecken; rechts: Ecken } | null {
  const [r0, r1] = first;
  const dx = r1[0] - r0[0];
  const dy = r1[1] - r0[1];
  if (Math.hypot(dx, dy) < 1) return null;

  const nachSeite = [...aussen]
    .map((punkt) => ({ punkt, wert: dx * (punkt[1] - r0[1]) - dy * (punkt[0] - r0[0]) }))
    .sort((a, b) => a.wert - b.wert);
  const gruppeA = [nachSeite[0]!.punkt, nachSeite[1]!.punkt] as [Punkt, Punkt];
  const gruppeB = [nachSeite[2]!.punkt, nachSeite[3]!.punkt] as [Punkt, Punkt];
  const eckenA = sortiereEcken([gruppeA[0], gruppeA[1], r0, r1]);
  const eckenB = sortiereEcken([gruppeB[0], gruppeB[1], r0, r1]);
  // Nicht nach der globalen Foto-X-Achse ordnen: Ein Drohnenfoto kann beliebig
  // gedreht sein. Mit Mutterdach werden die Seiten in dessen metrischer X-Achse
  // (Traufe links → rechts) einsortiert; nur Altaufrufe nutzen den Foto-Fallback.
  const gruppeAM = eltern ? gaubenPunkteAufElternflaeche(eltern, gruppeA) : null;
  const gruppeBM = eltern ? gaubenPunkteAufElternflaeche(eltern, gruppeB) : null;
  const aLinksVonB = gruppeAM && gruppeBM
    ? mittelX(gruppeAM) <= mittelX(gruppeBM)
    : mittelX(gruppeA) <= mittelX(gruppeB);
  return aLinksVonB
    ? { links: eckenA, rechts: eckenB }
    : { links: eckenB, rechts: eckenA };
}

export interface GaubenSeitenMass {
  breiteM: number;
  hoeheM: number;
}

/**
 * Lokale Schätzung je Satteldach-Seite. Die Breite folgt First/Traufe, die Länge
 * nur dem jeweiligen Weg von der Traufe zum First – nicht der gesamten Gaubentiefe.
 */
export function satteldachMasseAusElternfoto(
  eltern: Flaeche,
  seiten: { links: Ecken; rechts: Ecken },
  first: readonly [Punkt, Punkt],
): { links: GaubenSeitenMass; rechts: GaubenSeitenMass } | null {
  const firstM = gaubenPunkteAufElternflaeche(eltern, first);
  if (!firstM || firstM.length !== 2) return null;

  const jeSeite = (ecken: Ecken): GaubenSeitenMass | null => {
    const traufeFoto = ecken.filter(
      (p) => !first.some((r) => Math.abs(p[0] - r[0]) < 0.01 && Math.abs(p[1] - r[1]) < 0.01),
    );
    const traufeM = gaubenPunkteAufElternflaeche(eltern, traufeFoto);
    if (!traufeM || traufeM.length !== 2) return null;
    const zuordnungA = distanz(traufeM[0]!, firstM[0]!) + distanz(traufeM[1]!, firstM[1]!);
    const zuordnungB = distanz(traufeM[0]!, firstM[1]!) + distanz(traufeM[1]!, firstM[0]!);
    const laengen =
      zuordnungA <= zuordnungB
        ? [distanz(traufeM[0]!, firstM[0]!), distanz(traufeM[1]!, firstM[1]!)]
        : [distanz(traufeM[0]!, firstM[1]!), distanz(traufeM[1]!, firstM[0]!)];
    return {
      breiteM: positivesMass((distanz(traufeM[0]!, traufeM[1]!) + distanz(firstM[0]!, firstM[1]!)) / 2),
      hoeheM: positivesMass((laengen[0]! + laengen[1]!) / 2),
    };
  };

  const links = jeSeite(seiten.links);
  const rechts = jeSeite(seiten.rechts);
  return links && rechts ? { links, rechts } : null;
}
