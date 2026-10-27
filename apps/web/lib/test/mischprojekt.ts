import { neueFlaeche, neueGaubenFlaeche, neuesProjekt, type Flaeche, type Projekt, type PunktM } from '../model';
import { synchronisiereGaubenKontur } from '../gauben-geometrie';
import { mitMassplan } from '../massplan';
import type { Ecken } from '../foto-geometrie';

/** Rein synthetischer Mischbestand: neun Hauptflächen, eine Gaube, drei Bildunterlagen. */
export function mischprojekt(): Projekt {
  let p=neuesProjekt();p.kunde='QA Mischprojekt';p.adresse='Synthetischer Testbestand';p.erfasser='Automatisierte Abnahme';
  const basis=(nr:number,name:string,patch:Partial<Flaeche>={}):Flaeche=>({...neueFlaeche(nr,String.fromCharCode(64+nr)),name,breiteM:20,hoeheM:14,randM:.05,massStatus:'bestaetigt',grunddatenFertig:true,fotoBezugsrahmen:true,...patch});
  p.flaechen=[
    basis(1,'Haus Sued',{azimutDeg:180,neigungDeg:35}),
    basis(2,'Haus Suedwest Trapez',{azimutDeg:225,neigungDeg:42,dachform:'trapez',firstBreiteM:8}),
    basis(3,'Halle Sued',{art:'flachdach',einsatzort:'halle',breiteM:36,hoeheM:24,neigungDeg:0,flachdach:{aufstaenderung:'sued',winkelDeg:15,pitchM:3,modulAusrichtung:'quer',moduleInNeigung:1}}),
    basis(4,'Halle Ost-West',{art:'flachdach',einsatzort:'halle',breiteM:36,hoeheM:24,neigungDeg:0,flachdach:{aufstaenderung:'ostwest',winkelDeg:10,pitchM:7.2,modulAusrichtung:'hoch',moduleInNeigung:2}}),
    basis(5,'Freiland Sued',{art:'flachdach',einsatzort:'freiflaeche',breiteM:40,hoeheM:28,neigungDeg:0,flachdach:{aufstaenderung:'sued',winkelDeg:25,pitchM:5,modulAusrichtung:'hoch',moduleInNeigung:2}}),
    basis(6,'Freiland Ost-West',{art:'flachdach',einsatzort:'freiflaeche',breiteM:40,hoeheM:28,neigungDeg:0,flachdach:{aufstaenderung:'ostwest',winkelDeg:20,pitchM:5,modulAusrichtung:'quer',moduleInNeigung:2}}),
    basis(7,'Walm Dreieck',{azimutDeg:270,neigungDeg:40,dachform:'trapez',firstBreiteM:0}),
    basis(8,'Halle Schraeg',{einsatzort:'halle',azimutDeg:135,neigungDeg:18,dachform:'schief',firstBreiteM:17,firstVersatzM:3}),
    basis(9,'Anbau L-Form',{azimutDeg:315,neigungDeg:28,hoeheM:20,umrissM:[[0,0],[20,0],[20,9],[12,9],[12,20],[0,20]]}),
  ];
  for(const [i,f] of p.flaechen.entries()){
    const gross=f.breiteM>25;
    f.felder=[{xM:gross?3:2,yM:gross?3:5,breiteM:gross?12:7,hoeheM:gross?11:7,quer:false,drehungDeg:i===1?45:i===5?-30:0,leer:['0-0']},
      {xM:gross?21:10,yM:gross?11:5,breiteM:gross?12:7,hoeheM:gross?11:7,quer:true,drehungDeg:i===3?17.5:0}];
    f.hindernisse=[{xM:f.breiteM*.45,yM:f.hoeheM*.55,breiteM:1.2,hoeheM:1.2}];
  }
  const haupt=p.flaechen.filter(f=>f.einsatzort!=='freiflaeche');
  const teile:string[]=[];
  haupt.forEach((f,i)=>{
    const x=70+(i%3)*1160,y=80+Math.floor(i/3)*700,w=1020,h=600;
    const e:Ecken=[[x,y+h],[x+w,y+h],[x+w,y],[x,y]];
    f.fotoZuordnungen=[{fotoId:'uebersicht',eckenPx:e,traufePx:null,perspektiveBestaetigt:true,markierungFertig:true}];
    teile.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${i%2?'#8d7666':'#a5afb1'}"/><text x="${x}" y="${y-16}" fill="#263238" font-size="27">${f.name}</text>`);
  });
  p.fotos=[{id:'uebersicht',name:'Synthetischer Lageplan',breitePx:3600,hoehePx:2200,dataUrl:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="3600" height="2200"><rect width="100%" height="100%" fill="#e5e9e1"/>${teile.join('')}</svg>`)}];
  const parent=p.flaechen[0]!,ecken:Ecken=[[70+6/20*1020,80+5/14*600],[70+12/20*1020,80+5/14*600],[70+12/20*1020,80+1/14*600],[70+6/20*1020,80+1/14*600]];
  const umriss:PunktM[]=[[6,1],[12,1],[12,5],[6,5]];
  parent.gaubenAussparungen=[{gaubenGruppeId:'gaube-1',fotoId:'uebersicht',fotoEckenPx:ecken,fotoUmrissPx:ecken,rechteck:{xM:6,yM:1,breiteM:6,hoeheM:4,umrissM:umriss}}];
  p.flaechen.push({...neueGaubenFlaeche(10,'J','schleppdach',parent.id,undefined,'gaube-1'),name:'Schleppgaube',breiteM:6,hoeheM:4,azimutDeg:225,neigungDeg:15,massStatus:'bestaetigt',gaubenMessung:{quelle:'aufmass',qualitaet:'bestaetigt'},felder:[{xM:2,yM:1,breiteM:2,hoeheM:2,quer:false}],fotoZuordnungen:[{fotoId:'uebersicht',eckenPx:ecken,traufePx:null,perspektiveBestaetigt:true,markierungFertig:true}]});
  p=mitMassplan(p,'p5');p=mitMassplan(p,'p6');return p;
}

export const MISCHFAELLE = [
 {name:'01-haus-sued-suedwest',ids:[1,2]},
 {name:'02-vier-himmelsrichtungen',ids:[1,2,7,8]},
 {name:'03-alle-dachformen',ids:[1,2,7,8,9]},
 {name:'04-flachdachgaube',ids:[1,2,10],gaube:'flachdach'},
 {name:'05-schleppgaube',ids:[1,2,10],gaube:'schleppdach'},
 {name:'06-satteldachgaube',ids:[1,2,10],gaube:'satteldach'},
 {name:'07-walmgaube',ids:[1,7,10],gaube:'walmdach'},
 {name:'08-spitzgaube',ids:[1,8,10],gaube:'spitzdach'},
 {name:'09-halle-sued-schraeg',ids:[3,8]},
 {name:'10-halle-ostwest-schraeg',ids:[4,8]},
 {name:'11-hallen-mischung',ids:[3,4,8]},
 {name:'12-freiland-sued',ids:[5]},
 {name:'13-freiland-ostwest',ids:[6]},
 {name:'14-freiland-mischung',ids:[5,6]},
 {name:'15-haus-halle-freiland',ids:[1,3,5]},
 {name:'16-alle-varianten',ids:[1,2,3,4,5,6,7,8,9,10],gaube:'schleppdach'},
 {name:'17-gemeinsames-foto',ids:[1,2,3,4,7,8,9,10],gaube:'walmdach'},
 {name:'18-gemeinsamer-massplan',ids:[5,6],geteilt:true},
] as const;
export type Mischfall = typeof MISCHFAELLE[number];
export function projektFall(fall:Mischfall):Projekt {
 let p=mischprojekt();p.kunde=fall.name;
 p.flaechen=p.flaechen.filter(f=>(fall.ids as readonly number[]).some(n=>f.id===`p${n}`));
 if(!p.flaechen.some(f=>f.gaubenTyp))p.flaechen=p.flaechen.map(f=>({...f,gaubenAussparungen:undefined}));
 if('gaube' in fall){
  const f=p.flaechen.find(f=>f.gaubenTyp)!;f.gaubenTyp=fall.gaube;
  f.name=fall.gaube==='satteldach'?'Sattel links':fall.gaube;
  if(fall.gaube==='walmdach'||fall.gaube==='spitzdach')Object.assign(f,{dachform:'trapez',firstBreiteM:fall.gaube==='spitzdach'?0:3,fotoBezugsrahmen:true});
  if(fall.gaube==='satteldach'){
   f.gaubenSeite='links';f.azimutDeg=90;
   const e=f.fotoZuordnungen![0]!.eckenPx!,mitteU:[number,number]=[(e[0][0]+e[1][0])/2,e[0][1]],mitteO:[number,number]=[(e[2][0]+e[3][0])/2,e[3][1]];
   const rechts={...structuredClone(f),id:'p11',zone:'K',name:'Sattel rechts',gaubenSeite:'rechts' as const,azimutDeg:270};
   f.fotoZuordnungen![0]!.eckenPx=[e[0],mitteU,mitteO,e[3]];
   rechts.fotoZuordnungen![0]!.eckenPx=[mitteU,e[1],e[2],mitteO];p.flaechen.push(rechts);
  }else p=synchronisiereGaubenKontur(p,'gaube-1');
 }
 if('geteilt' in fall){const f=p.flaechen[0]!;p.flaechen[1]!.fotoZuordnungen=structuredClone(f.fotoZuordnungen);}
 const ids=new Set(p.flaechen.flatMap(f=>f.fotoZuordnungen?.map(z=>z.fotoId)??[]));p.fotos=p.fotos.filter(f=>ids.has(f.id));
 return p;
}
