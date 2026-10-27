import type { Ecken } from './foto-geometrie';
import { pruefeFotoReferenz, type FotoReferenz } from './foto-referenz';

/** Abstände zwischen gleichartigen Fugen, nicht Anzahl sichtbarer Randlinien. */
export interface ZiegelMessung {
  spalten: number;
  reihen: number;
  deckbreiteCm: number;
  decklaengeCm: number;
}
export function gueltigeZiegelMessung(wert: unknown): wert is ZiegelMessung {
  if (!wert || typeof wert !== 'object') return false;
  const z = wert as ZiegelMessung;
  return Number.isSafeInteger(z.spalten) && z.spalten > 0
    && Number.isSafeInteger(z.reihen) && z.reihen > 0
    && Number.isFinite(z.deckbreiteCm) && z.deckbreiteCm > 0
    && Number.isFinite(z.decklaengeCm) && z.decklaengeCm > 0
    && Number.isFinite(z.spalten * z.deckbreiteCm) && Number.isFinite(z.reihen * z.decklaengeCm);
}

/** Perspektive aus vier sichtbaren Kreuzungen im regelmäßigen Deckraster derselben Ebene. */
export function ziegelReferenz(z: ZiegelMessung & { eckenPx: Ecken }):
  { ok: true; referenz: FotoReferenz } | { ok: false; grund: string } {
  if (!Number.isSafeInteger(z.spalten) || z.spalten <= 0 || !Number.isSafeInteger(z.reihen) || z.reihen <= 0) {
    return { ok: false, grund: 'Zähle ganze Abstände zwischen gleichen Fugen: quer und von Reihe zu Reihe. Beide Anzahlen müssen größer als null sein.' };
  }
  if (!gueltigeZiegelMessung(z)) {
    return { ok: false, grund: 'Trage die bekannte Deckbreite und Decklänge in cm ein. Gemeint ist der verlegte Abstand, nicht die gesamte Größe eines einzelnen Ziegels.' };
  }
  const referenz = { breiteM: z.spalten * z.deckbreiteCm / 100, hoeheM: z.reihen * z.decklaengeCm / 100, eckenPx: z.eckenPx };
  const pruefung = pruefeFotoReferenz(referenz);
  return pruefung.ok ? { ok: true, referenz } : { ok: false, grund: pruefung.grund };
}

/** Alle vier Rasterpunkte und ihre Verbindungen müssen auf dem gezeichneten Dach liegen. */
export function ziegelFeldImDach(ecken: readonly (readonly number[])[], umriss: readonly (readonly number[])[]): boolean {
  if (ecken.length !== 4 || umriss.length < 3 || [...ecken, ...umriss].some(p => p.length !== 2 || !p.every(Number.isFinite))) return false;
  const skala = Math.max(1, ...umriss.flatMap(p => p.map(Math.abs)));
  const eps = skala * 1e-8;
  const cross = (x:number,y:number,u:number,v:number) => x*v-y*u;
  const innen = (p:readonly number[]) => {
    let ja = false;
    for (let i=0,j=umriss.length-1;i<umriss.length;j=i++) {
      const a=umriss[j]!,b=umriss[i]!;
      const dx=b[0]!-a[0]!,dy=b[1]!-a[1]!;
      if (Math.abs(cross(dx,dy,p[0]!-a[0]!,p[1]!-a[1]!)) <= eps*Math.max(1,Math.hypot(dx,dy))
        && p[0]! >= Math.min(a[0]!,b[0]!)-eps && p[0]! <= Math.max(a[0]!,b[0]!)+eps
        && p[1]! >= Math.min(a[1]!,b[1]!)-eps && p[1]! <= Math.max(a[1]!,b[1]!)+eps) return true;
      if ((a[1]!>p[1]!) !== (b[1]!>p[1]!) && p[0]! < dx*(p[1]!-a[1]!)/dy+a[0]!) ja=!ja;
    }
    return ja;
  };
  if (!ecken.every(innen)) return false;
  for (let i=0;i<4;i++) {
    const a=ecken[i]!,b=ecken[(i+1)%4]!,dx=b[0]!-a[0]!,dy=b[1]!-a[1]!;
    const ts=[0,1];
    for(let j=0;j<umriss.length;j++) {
      const c=umriss[j]!,d=umriss[(j+1)%umriss.length]!;
      const ux=d[0]!-c[0]!,uy=d[1]!-c[1]!,den=cross(dx,dy,ux,uy);
      if(Math.abs(den)<eps) continue;
      const t=cross(c[0]!-a[0]!,c[1]!-a[1]!,ux,uy)/den;
      const u=cross(c[0]!-a[0]!,c[1]!-a[1]!,dx,dy)/den;
      if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);
    }
    ts.sort((a,b)=>a-b);
    for(let j=1;j<ts.length;j++) {
      const t=(ts[j-1]!+ts[j]!)/2;
      if(!innen([a[0]!+dx*t,a[1]!+dy*t]))return false;
    }
  }
  return true;
}
