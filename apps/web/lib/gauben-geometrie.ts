import {
  inverseHomographie,
  projiziere,
  sortiereEcken,
  type Ecken,
  type Punkt,
} from './foto-geometrie';
import {
  perspektiveQuelle,
  rahmenBreiteVon,
  type Flaeche,
  type GaubenAussparung,
  type RechteckM,
} from './model';

const distanz = (a: Punkt, b: Punkt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rundeCm = (wert: number) => Math.round(wert * 100) / 100;
const positivesMass = (wert: number) => Math.max(0.1, rundeCm(wert));

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

/** Konservative rechteckige Aussparung des sichtbaren Gaubenumrisses im Hauptdach. */
export function gaubenAussparungAusFoto(
  eltern: Flaeche,
  fotoEcken: Ecken,
): RechteckM | null {
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
  };
}

/**
 * Gekoppelte Gauben-Aussparungen nach einer Perspektivkorrektur des Mutterdachs
 * neu berechnen. Altprojekte ohne gespeicherten Foto-Umriss bleiben unverändert.
 */
export function aktualisiereGaubenAussparungen(
  eltern: Flaeche,
  aussparungen: readonly GaubenAussparung[] | undefined,
): GaubenAussparung[] | undefined {
  if (!aussparungen) return undefined;
  return aussparungen.map((a) => {
    if (!a.fotoEckenPx) return a;
    const rechteck = gaubenAussparungAusFoto(eltern, a.fotoEckenPx);
    return rechteck ? { ...a, rechteck } : a;
  });
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
