import { artVon, fotoZuordnungenVon, patchFlaechenGeometrie, type Flaeche } from './model';

const PARAMETER = ['art', 'breiteM', 'hoeheM', 'neigungDeg', 'azimutDeg', 'dachfarbe', 'dachform', 'firstBreiteM', 'firstVersatzM', 'flachdach', 'randM'] as const;

/** Nur geänderte Geometrieparameter übernehmen; jüngere Foto-/Feldänderungen erhalten. */
export function geometrieEntwurfAufStand(basis: Flaeche, entwurf: Flaeche, aktuell: Flaeche): Flaeche {
  const patch: Partial<Flaeche> = {};
  for (const key of PARAMETER) {
    if (JSON.stringify(basis[key]) !== JSON.stringify(entwurf[key])) {
      Object.assign(patch, { [key]: entwurf[key] });
    }
  }
  const neu = patchFlaechenGeometrie(aktuell, patch);
  if (artVon(basis) !== artVon(entwurf) || (basis.dachform ?? 'rechteck') !== (entwurf.dachform ?? 'rechteck')) {
    return {
      ...neu, felder: [], inaktiv: [], umrissM: undefined,
      fotoZuordnungen: fotoZuordnungenVon(aktuell).map((z) => ({ ...z, perspektiveBestaetigt: false, markierungFertig: false })),
    };
  }
  if ((basis.flachdach?.richtungSued ?? 'unten') !== (entwurf.flachdach?.richtungSued ?? 'unten')) {
    return { ...neu, felder: neu.felder?.map((feld) => ({ ...feld, leer: undefined })) };
  }
  return neu;
}
