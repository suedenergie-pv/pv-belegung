import { describe, expect, it } from 'vitest';
import { homographie, inverseHomographie, projiziere, pruefePerspektive, type Ecken } from './foto-geometrie';
import { gaubenSeitenKontur, synchronisiereGaubenKontur, wendeGaubenMarkierungAn, rekonstruiereGaubenPunkte, gaubenAussparungAusFoto } from './gauben-geometrie';
import { neueGaubenFlaeche, neuesProjekt, modulById, rasterFuer, vollFeldFuer, perspektiveQuelle, umrissVon, migriereProjekt, type GaubenTyp } from './model';
import { punktInPolygon } from '@pv-belegung/engine';

const typen: GaubenTyp[] = ['flachdach','schleppdach','satteldach','walmdach','spitzdach'];
const fotoEcken: Ecken = [[240,720],[920,670],[850,230],[300,270]];
const faelle = typen.flatMap(typ => [0,5,15,30,45,60,75].flatMap(neigung => [0,90,180,270].map(azimut => ({typ,neigung,azimut}))));
describe('Gaubenmatrix: Typ, eigene Dachneigung, Ausrichtung und Foto', () => {
  it.each(faelle)('$typ $neigung° / $azimut° behält wahre Maße und maskiert exakt', ({typ,neigung,azimut}) => {
    const p = neuesProjekt(), m = modulById(p.modulId);
    const f = { ...neueGaubenFlaeche(2,'B',typ,'p1',typ === 'satteldach' ? 'links' : undefined,'g'),
      breiteM:6, hoeheM:4, neigungDeg:neigung, azimutDeg:azimut, massStatus:'bestaetigt' as const,
      ...(typ === 'walmdach' || typ === 'spitzdach' ? { dachform:'trapez' as const, firstBreiteM:typ === 'spitzdach' ? 0 : 3, fotoBezugsrahmen:true } : {}) };
    f.felder = [vollFeldFuer(f,m)];
    const r = rasterFuer(f,m), ebene = rasterFuer({...f,neigungDeg:0,azimutDeg:0},m);
    expect(r.positionen).toEqual(ebene.positionen);
    expect(r.positionen.length).toBeGreaterThan(0);
    const polygon = umrissVon(f);
    for (const z of r.positionen) {
      expect(z.wM*z.hM).toBeCloseTo(m.lengthMm*m.widthMm/1e6,10);
      if (polygon) for (const punkt of [[z.xM,z.yM],[z.xM+z.wM,z.yM],[z.xM+z.wM,z.yM+z.hM],[z.xM,z.yM+z.hM]] as [number,number][]) expect(punktInPolygon(punkt,polygon)).toBe(true);
    }
    expect(pruefePerspektive(6,4,fotoEcken,perspektiveQuelle(f)).status).not.toBe('fehler');
    const h=homographie(6,4,fotoEcken,perspektiveQuelle(f))!, inv=inverseHomographie(6,4,fotoEcken,perspektiveQuelle(f))!;
    for (const punkt of [[0,0],[6,0],[6,4],[0,4],[3,2]] as [number,number][]) {
      const zurueck=projiziere(inv,projiziere(h,punkt)); expect(zurueck[0]).toBeCloseTo(punkt[0],7);expect(zurueck[1]).toBeCloseTo(punkt[1],7);
    }
    if (f.fotoBezugsrahmen) {
      expect(perspektiveQuelle(f)).toBeUndefined();
      const kontur=gaubenSeitenKontur(f,fotoEcken);
      const lokal=kontur.map(q=>projiziere(inv,q));
      expect(Math.abs(lokal.reduce((sum,a,i)=>{const b=lokal[(i+1)%lokal.length]!;return sum+a[0]*b[1]-a[1]*b[0]},0))/2).toBeCloseTo(typ==='spitzdach'?12:18,7);
    }
    p.flaechen.push(f);
    const geladen=migriereProjekt(JSON.parse(JSON.stringify(p)));
    expect(rasterFuer(geladen.flaechen[1]!,m).positionen).toEqual(r.positionen);
    expect(geladen.flaechen[1]!.neigungDeg).toBe(neigung);
  });
  it.each(['schleppdach','walmdach','spitzdach'] as const)('%s: Hauptdach-Aussparung, Verschieben, Rückladen und separate Maßquelle', typ=>{
    let p=neuesProjekt(); const parent=p.flaechen[0]!;
    Object.assign(parent,{breiteM:16,hoeheM:9,neigungDeg:50,massStatus:'bestaetigt',fotoZuordnungen:[{fotoId:'foto',traufePx:null,eckenPx:[[0,900],[1600,900],[1600,0],[0,0]],perspektiveBestaetigt:true,markierungFertig:true}]});
    p.fotos=[{id:'foto',name:'Aufmaß',breitePx:1600,hoehePx:900,dataUrl:'data:image/png;base64,test'}];
    const kind={...neueGaubenFlaeche(2,'B',typ,parent.id,undefined,'g'),breiteM:6,hoeheM:4,
      dachform:'trapez' as const,firstBreiteM:typ==='spitzdach'?0:3,fotoBezugsrahmen:true,
      gaubenMessung:{quelle:'nachbardach' as const,qualitaet:'geschaetzt' as const},
      fotoZuordnungen:[{fotoId:'foto',traufePx:null,eckenPx:fotoEcken,perspektiveBestaetigt:true,markierungFertig:true}]};
    parent.gaubenAussparungen=[{gaubenGruppeId:'g',fotoId:'foto',fotoEckenPx:fotoEcken,rechteck:{xM:2,yM:2,breiteM:7,hoeheM:5}}];
    p.flaechen.push(kind);p=synchronisiereGaubenKontur(p,'g');
    expect(p.flaechen[0]!.gaubenAussparungen![0]!.fotoUmrissPx).toEqual(gaubenSeitenKontur(kind,fotoEcken));
    const verschoben= fotoEcken.map(([x,y])=>[x+50,y-20]) as Ecken;
    const parentMitFoto={...p.flaechen[0]!,foto:{...p.fotos[0]!,...p.flaechen[0]!.fotoZuordnungen![0]!}};
    const a=gaubenAussparungAusFoto(parentMitFoto,verschoben)!;
    const ergebnis=wendeGaubenMarkierungAn(p,parent.id,'g','foto',{aussen:verschoben,aussparung:a});
    expect(ergebnis.ok).toBe(true);if(!ergebnis.ok)return;
    expect(ergebnis.projekt.flaechen[1]!.gaubenMessung?.qualitaet).toBe('geschaetzt');
    expect(ergebnis.projekt.flaechen[0]!.gaubenAussparungen![0]!.fotoUmrissPx).toEqual(gaubenSeitenKontur(kind,verschoben));
    expect(rekonstruiereGaubenPunkte(ergebnis.projekt.flaechen[0]!,[ergebnis.projekt.flaechen[1]!],'g','foto')).toEqual({ok:true,punkte:verschoben});
  });
});
