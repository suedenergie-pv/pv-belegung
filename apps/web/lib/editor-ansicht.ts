import { STANDARD_ANSICHT, type EditorAnsicht } from './editor-sitzung';
export interface BildRahmen { breite: number; hoehe: number; bildBreite: number; bildHoehe: number }
export type AnsichtPunkt = { x: number; y: number };
export function bildRahmen(breite: number, hoehe: number, seitenverhaeltnis: number): BildRahmen {
  const b = Math.max(1, breite); const h = Math.max(1, hoehe);
  const ratio = Number.isFinite(seitenverhaeltnis) && seitenverhaeltnis > 0 ? seitenverhaeltnis : 1;
  const bildBreite = Math.min(b, h * ratio);
  return { breite: b, hoehe: h, bildBreite, bildHoehe: bildBreite / ratio };
}
export function begrenzeAnsicht(v: EditorAnsicht): EditorAnsicht {
  const zoom = Number.isFinite(v.zoom) ? Math.max(1, Math.min(8, v.zoom)) : 1;
  const grenze = (zoom - 1) / 2 + .45;
  return { zoom, x: Number.isFinite(v.x) ? Math.max(-grenze, Math.min(grenze, v.x)) : 0,
    y: Number.isFinite(v.y) ? Math.max(-grenze, Math.min(grenze, v.y)) : 0 };
}
/** Der Bildpunkt unter dem Gestenmittelpunkt bleibt dort, während Zoom und Mittelpunkt wandern. */
export function transformiereAnsicht(v: EditorAnsicht, rahmen: BildRahmen, von: AnsichtPunkt, nach: AnsichtPunkt, zoom: number): EditorAnsicht {
  const z = begrenzeAnsicht({ ...STANDARD_ANSICHT, zoom }).zoom;
  const ax = (von.x - rahmen.breite / 2) / rahmen.bildBreite;
  const ay = (von.y - rahmen.hoehe / 2) / rahmen.bildHoehe;
  const bx = (nach.x - rahmen.breite / 2) / rahmen.bildBreite;
  const by = (nach.y - rahmen.hoehe / 2) / rahmen.bildHoehe;
  return begrenzeAnsicht({ zoom: z, x: bx - (ax - v.x) * z / v.zoom, y: by - (ay - v.y) * z / v.zoom });
}
