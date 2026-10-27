import { fotoZuordnungenVon, neueFotoId, massFreigabe, perspektiveQuelle, rahmenBreiteVon, type Projekt, type ProjektFoto, type FotoZuordnung } from './model';
import type { Ecken } from './foto-geometrie';

/**
 * Maßhaltige 2D-Zeichenunterlage für die bestehende Foto/Plan-Komposition.
 * Keine Aufnahme, kein Luftbild, keine 3D-Schätzung. Bestätigte Maße sind die Quelle.
 * Das gleiche SVG wird im unveränderten PDF-Bildslot verwendet.
 */
export function mitMassplan(projekt: Projekt, flaecheId: string): Projekt {
  const f = projekt.flaechen.find(f => f.id === flaecheId);
  if (!f || f.gaubenTyp || !massFreigabe(f).belegen) return projekt;
  const zuordnungen = fotoZuordnungenVon(f);
  const bisher = projekt.fotos.find(foto => foto.massplanFlaecheId === f.id && zuordnungen.some(z => z.fotoId === foto.id));
  if (!bisher && zuordnungen.length) return projekt; // echte Fotos immer respektieren
  const B = rahmenBreiteVon(f), H = f.hoeheM, rand = 64, scale = 1200 / Math.max(B, H);
  const breitePx = Math.ceil(B * scale + 2 * rand), hoehePx = Math.ceil(H * scale + 2 * rand);
  const quelle: Ecken = perspektiveQuelle(f) ?? [[0,H],[B,H],[B,0],[0,0]];
  const eckenPx = quelle.map(([x,y])=>[rand+x*scale,rand+y*scale]) as Ecken;
  const name = f.einsatzort === 'freiflaeche' ? 'Maßplan · Freifläche' : f.einsatzort === 'halle' ? 'Maßplan · Hallendach' : 'Maßplan · Dachfläche';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${breitePx}" height="${hoehePx}" viewBox="0 0 ${breitePx} ${hoehePx}">
    <defs><pattern id="grid" x="${rand}" y="${rand}" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><path d="M${scale} 0H0V${scale}" fill="none" stroke="#d6dadd" stroke-width=".7"/></pattern></defs>
    <rect width="100%" height="100%" fill="#f4f6f8"/><rect x="${rand}" y="${rand}" width="${B*scale}" height="${H*scale}" fill="url(#grid)" stroke="#68777e" stroke-width="2"/>
    <g fill="#263238" font-family="Arial,sans-serif" font-size="18"><text x="${rand}" y="32">${name} · schematische Draufsicht</text>
    <text x="${breitePx/2}" y="${hoehePx-20}" text-anchor="middle">${B.toLocaleString('de-DE')} m</text>
    <text x="22" y="${hoehePx/2}" transform="rotate(-90 22 ${hoehePx/2})" text-anchor="middle">${H.toLocaleString('de-DE')} m</text></g></svg>`;
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  // Eine gemeinsam verwendete Zeichenunterlage ist für die anderen Ebenen ein Foto:
  // beim Neuaufmaß nur für den Eigentümer eine neue Version anlegen.
  const geteilt = bisher && projekt.flaechen.some(p => p.id !== f.id && fotoZuordnungenVon(p).some(z => z.fotoId === bisher.id));
  const ersetzen = bisher && (!geteilt || bisher.dataUrl === dataUrl);
  const foto: ProjektFoto = { id: ersetzen ? bisher.id : `massplan-${f.id}-${neueFotoId()}`, name, breitePx, hoehePx, dataUrl, massplanFlaecheId:f.id };
  const z: FotoZuordnung = { fotoId:foto.id,eckenPx,traufePx:null,perspektiveBestaetigt:true,markierungFertig:true };
  return {...projekt,fotos:ersetzen?projekt.fotos.map(p=>p.id===foto.id?foto:p):[...projekt.fotos,foto],
    flaechen:projekt.flaechen.map(p=>p.id===f.id?{...p,fotoZuordnungen:bisher?zuordnungen.map(a=>a.fotoId===bisher.id?z:a):[z]}:p)};
}

/** Ein nachgereichtes Foto ersetzt nur den automatisch erzeugten, ungeteilten Startplan. */
export function ohneStartMassplan(projekt: Projekt, flaecheId: string): Projekt {
  const ids = new Set(projekt.fotos.filter(foto => foto.massplanFlaecheId === flaecheId &&
    !projekt.flaechen.some(f => f.id !== flaecheId && fotoZuordnungenVon(f).some(z => z.fotoId === foto.id))).map(f => f.id));
  if (!ids.size) return projekt;
  return { ...projekt, fotos: projekt.fotos.filter(f => !ids.has(f.id)),
    flaechen: projekt.flaechen.map(f => f.id === flaecheId ? { ...f, fotoZuordnungen: fotoZuordnungenVon(f).filter(z => !ids.has(z.fotoId)) } : f) };
}
