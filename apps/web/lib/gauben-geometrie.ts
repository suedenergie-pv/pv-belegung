import {
  inverseHomographie,
  projiziere,
  sortiereEcken,
  type Ecken,
  type Punkt,
} from './foto-geometrie';
import {
  fotoZuordnungenVon,
  perspektiveQuelle,
  rahmenBreiteVon,
  type Flaeche,
  type FotoZuordnung,
  type GaubenAussparung,
  type Projekt,
  type RechteckM,
} from './model';

const distanz = (a: Punkt, b: Punkt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rundeCm = (wert: number) => Math.round(wert * 100) / 100;
const positivesMass = (wert: number) => Math.max(0.1, rundeCm(wert));

export interface GaubenMarkierung {
  aussen: Ecken;
  seiten?: { links: Ecken; rechts: Ecken };
  aussparung: RechteckM;
}

export type RekonstruierteGaubenPunkte =
  | { ok: true; punkte: Punkt[] }
  | { ok: false; grund: string };

export type GaubenMarkierungAngewendet =
  | { ok: true; projekt: Projekt }
  | { ok: false; grund: string };

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
 * Gespeicherte Flachdach-/Satteldach-Markierungen wieder in ihre gemeinsamen
 * vier bzw. sechs Kontrollpunkte zerlegen. Die beiden Firstpunkte einer
 * Satteldachgaube werden als Schnittmenge beider Seiten rekonstruiert.
 */
export function rekonstruiereGaubenPunkte(
  eltern: Flaeche,
  flaechen: readonly Flaeche[],
  gruppenId: string,
): RekonstruierteGaubenPunkte {
  const gruppe = flaechen.filter((f) => (f.gaubenGruppeId ?? f.id) === gruppenId && !!f.gaubenTyp);
  const erste = gruppe[0];
  if (!erste) return { ok: false, grund: 'Die Gaubengruppe enthält keine Dachfläche.' };
  const fotoId = fotoZuordnungenVon(eltern)[0]?.fotoId;
  const aussparung = eltern.gaubenAussparungen?.find((a) => a.gaubenGruppeId === gruppenId);
  const gespeichertesAussen = aussparung?.fotoEckenPx;

  if (erste.gaubenTyp === 'flachdach') {
    const ecken = gespeichertesAussen ?? fotoZuordnungenVon(erste).find((z) => !fotoId || z.fotoId === fotoId)?.eckenPx;
    return ecken
      ? { ok: true, punkte: ecken.map(([x, y]) => [x, y]) }
      : { ok: false, grund: 'Die vier gespeicherten Gaubenecken fehlen.' };
  }

  const links = gruppe.find((f) => f.gaubenSeite === 'links');
  const rechts = gruppe.find((f) => f.gaubenSeite === 'rechts');
  const linksEcken = links && fotoZuordnungenVon(links).find((z) => !fotoId || z.fotoId === fotoId)?.eckenPx;
  const rechtsEcken = rechts && fotoZuordnungenVon(rechts).find((z) => !fotoId || z.fotoId === fotoId)?.eckenPx;
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
  if (gruppe.some((f) => f.gaubenTyp === 'satteldach') && !markierung.seiten) {
    return { ok: false, grund: 'Die gemeinsame Firstlinie der Satteldachgaube ist ungültig.' };
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
                    ? { ...a, rechteck: markierung.aussparung, fotoEckenPx: markierung.aussen }
                    : a,
                )
              : [...bisher, {
                  gaubenGruppeId: gruppenId,
                  rechteck: markierung.aussparung,
                  fotoEckenPx: markierung.aussen,
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
