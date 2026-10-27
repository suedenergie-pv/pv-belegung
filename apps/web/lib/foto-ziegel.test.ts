import { describe, it, expect } from 'vitest';
import { ziegelReferenz, ziegelFeldImDach } from './foto-ziegel';
import { dachAusFotoReferenz, pruefeFotoUmriss } from './foto-referenz';
import { homographie, projiziere, type Ecken, type Punkt } from './foto-geometrie';
import { migriereProjekt, neuesProjekt, neueFlaeche } from './model';

const raster:Ecken=[[100,500],[500,500],[500,100],[100,100]];
const z={spalten:10,reihen:12,deckbreiteCm:30,decklaengeCm:33,eckenPx:raster};
describe('Ziegelzählung ohne vorgetäuschte Metermaße',()=>{
  it('rechnet die Anzahl verlegter Abstände, nicht die Anzahl der Randlinien',()=>{
    expect(ziegelReferenz(z)).toEqual({ok:true,referenz:{breiteM:3,hoeheM:3.96,eckenPx:raster}});
  });
  it.each(['spalten','reihen','deckbreiteCm','decklaengeCm'] as const)('weist fehlendes oder ungültiges %s zurück',feld=>{
    for(const v of [NaN,Infinity,-1,0])expect(ziegelReferenz({...z,[feld]:v}).ok).toBe(false);
  });
  it('zählt vollständige Intervalle und lässt gebrochene cm-Maße zu',()=>{
    expect(ziegelReferenz({...z,spalten:10.5}).ok).toBe(false);
    expect(ziegelReferenz({...z,reihen:3.3}).ok).toBe(false);
    expect(ziegelReferenz({...z,deckbreiteCm:30.25}).ok).toBe(true);
  });
  it('weist zusammengefallene und überkreuzte Rasterpunkte zurück',()=>{
    expect(ziegelReferenz({...z,eckenPx:[[100,100],[100,100],[200,200],[200,100]]}).ok).toBe(false);
    expect(ziegelReferenz({...z,eckenPx:[raster[0],raster[2],raster[1],raster[3]]}).ok).toBe(false);
  });
  it('prüft echten Dachrand vor Maßstab und verbietet überkreuzte oder doppelte Eckpunkte',()=>{
    expect(pruefeFotoUmriss([[0,0],[10,10],[0,10],[10,0]])).not.toBeNull();
    expect(pruefeFotoUmriss([[0,0],[10,0],[0,0]])).not.toBeNull();
    expect(pruefeFotoUmriss([[0,10],[10,10],[5,0]])).toBeNull();
  });
  it('verhindert Raster über anderen Dachseiten und über einem Einschnitt trotz innen liegender Ecken',()=>{
    const u=[[0,0],[10,0],[10,10],[7,10],[7,4],[3,4],[3,10],[0,10]];
    expect(ziegelFeldImDach([[1,3],[9,3],[9,1],[1,1]],u)).toBe(true);
    expect(ziegelFeldImDach([[1,9],[9,9],[9,1],[1,1]],u)).toBe(false);
    expect(ziegelFeldImDach([[0,4],[3,4],[3,0],[0,0]],u)).toBe(true);
    expect(ziegelFeldImDach([[9,9],[11,9],[11,1],[9,1]],u)).toBe(false);
  });
});
const formen:Punkt[][]=[[[0,8],[16,8],[8,0]],[[0,8],[16,8],[16,0],[6,0]],[[0,8],[16,8],[11,0],[5,0]],[[0,8],[16,8],[16,3],[11,0],[0,0]],[[0,8],[16,8],[16,0],[10,0],[10,3],[0,3]]];
// Unabhängige feste Projektionsgleichung, keine rückwärts aus der Produktion gewonnenen Sollpunkte.
function bild(p:Punkt,winkel:number):Punkt {
 const [x,y]=p,den=1+.012*x+.018*y;
 const u=(40*x+4*y+180)/den,v=(3*x+32*y+100)/den;
 const a=winkel*Math.PI/180;
 return [600+Math.cos(a)*u-Math.sin(a)*v,600+Math.sin(a)*u+Math.cos(a)*v];
}
for(const winkel of [0,37,90,180,217,270])for(const [i,form]of formen.entries())it(`Dachform ${i+1}, Foto ${winkel}°: wirkliche Kontur und interne Rasterlinien bleiben korrekt`,()=>{
 const ref:Ecken=[[6,7],[10,7],[10,4],[6,4]].map(p=>bild(p as Punkt,winkel)) as Ecken;
 const zz=ziegelReferenz({spalten:20,reihen:10,deckbreiteCm:20,decklaengeCm:30,eckenPx:ref});
 expect(zz.ok).toBe(true);if(!zz.ok)return;
 const d=dachAusFotoReferenz(zz.referenz,form.map(p=>bild(p,winkel)));
 expect(d.ok).toBe(true);if(!d.ok)return;
 expect(d.breiteM).toBeCloseTo(16,7);expect(d.hoeheM).toBeCloseTo(8,7);
 expect(d.umrissM.length).toBe(form.length);
 const h=homographie(d.breiteM,d.hoeheM,d.eckenPx)!;
 for(let x=0;x<=16;x+=2)for(let y=0;y<=8;y+=2){
   const ist=projiziere(h,[x,y]),soll=bild([x,y],winkel);
   expect(Math.hypot(ist[0]-soll[0],ist[1]-soll[1])).toBeLessThan(1e-7);
 }
});
it('bewahrt Zählung im importierten Projekt und verwirft nur widersprüchliche Zusatzangaben',()=>{
 const p=neuesProjekt();const ref={breiteM:3,hoeheM:3.96,eckenPx:raster};
 const umriss:Punkt[]=[[100,500],[500,500],[500,100],[100,100]];
 const d=dachAusFotoReferenz(ref,umriss);if(!d.ok)throw Error(d.grund);
 p.fotos=[{id:'bild',name:'Test',dataUrl:'data:image/png;base64,AA',breitePx:1000,hoehePx:600}];
 p.flaechen=[{...neueFlaeche(1,'A'),breiteM:d.breiteM,hoeheM:d.hoeheM,fotoBezugsrahmen:true,umrissM:d.umrissM,fotoZuordnungen:[{fotoId:'bild',traufePx:null,eckenPx:d.eckenPx,referenzMessung:{...ref,umrissPx:umriss,rahmenBreiteM:d.breiteM,rahmenHoeheM:d.hoeheM,rahmenEckenPx:d.eckenPx,ziegel:{spalten:10,reihen:12,deckbreiteCm:30,decklaengeCm:33}}}]}];
 const neu=migriereProjekt(JSON.parse(JSON.stringify(p)));
 expect(neu.flaechen[0]!.fotoZuordnungen![0]!.referenzMessung!.ziegel).toEqual({spalten:10,reihen:12,deckbreiteCm:30,decklaengeCm:33});
 p.flaechen[0]!.fotoZuordnungen![0]!.referenzMessung!.ziegel!.spalten=11;
 const falsch=migriereProjekt(p).flaechen[0]!.fotoZuordnungen![0]!.referenzMessung!;
 expect(falsch.ziegel).toBeUndefined();expect(falsch.breiteM).toBe(3);
});
