import { describe,it,expect } from 'vitest';
import { mitMassplan, ohneStartMassplan } from './massplan';
import { neuesProjekt,migriereProjekt,modulById,vollFeldFuer,projektFreigabe } from './model';
import { homographie,projiziere } from './foto-geometrie';
describe('Maßplan ohne Foto',()=>{
 it.each(['gebaeude','halle','freiflaeche'] as const)('%s erzeugt einen maßhaltigen und exportfähigen Plan',einsatzort=>{
  let p=neuesProjekt();Object.assign(p.flaechen[0]!,{einsatzort,art:'flachdach',breiteM:36,hoeheM:24,massStatus:'bestaetigt',grunddatenFertig:true});
  p=mitMassplan(p,'p1');const f=p.flaechen[0]!,foto=p.fotos[0]!,z=f.fotoZuordnungen![0]!;
  expect(foto.name).toContain('Maßplan');expect(foto.massplanFlaecheId).toBe('p1');expect(z.markierungFertig).toBe(true);
  const h=homographie(36,24,z.eckenPx!)!,a=projiziere(h,[0,0]),b=projiziere(h,[1,0]),c=projiziere(h,[0,1]);
  expect(Math.hypot(b[0]-a[0],b[1]-a[1])).toBeCloseTo(Math.hypot(c[0]-a[0],c[1]-a[1]),7);
  f.felder=[vollFeldFuer(f,modulById(p.modulId))];expect(projektFreigabe(p).pdfFehler).toEqual([]);
  expect(migriereProjekt(JSON.parse(JSON.stringify(p))).fotos[0]!.massplanFlaecheId).toBe('p1');
  const vorher=foto.id;p.flaechen[0]!.breiteM=40;p=mitMassplan(p,'p1');expect(p.fotos).toHaveLength(1);expect(p.fotos[0]!.id).toBe(vorher);
 });
 it('übernimmt weder unbestätigte Maße noch ersetzt es echte Fotos',()=>{
  const p=neuesProjekt();expect(mitMassplan(p,'p1')).toBe(p);
  p.flaechen[0]!.massStatus='bestaetigt';p.flaechen[0]!.fotoZuordnungen=[{fotoId:'echt',traufePx:null}];
  expect(mitMassplan(p,'p1')).toBe(p);
 });
});

it('ersetzt nur ungeteilte Startpläne, keine echten Fotos oder Pläne zugehöriger Dachseiten',()=>{
 let p=neuesProjekt();p.flaechen[0]!.massStatus='bestaetigt';p=mitMassplan(p,'p1');
 const plan=p.fotos[0]!.id;
 p.fotos.push({id:'echt',name:'Foto',dataUrl:'data:image/jpeg;base64,test',breitePx:1000,hoehePx:800});
 const ersetzt=ohneStartMassplan(p,'p1');
 expect(ersetzt.fotos.map(f=>f.id)).toEqual(['echt']);expect(ersetzt.flaechen[0]!.fotoZuordnungen).toEqual([]);
 p.flaechen.push({...p.flaechen[0]!,id:'p2',elternFlaecheId:'p1',gaubenTyp:'schleppdach'});
 expect(ohneStartMassplan(p,'p1').fotos.some(f=>f.id===plan)).toBe(true);
});
