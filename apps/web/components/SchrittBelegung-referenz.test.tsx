// @vitest-environment jsdom
import React, {useState} from 'react';
import {cleanup,fireEvent,render} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {neuesProjekt,neueFlaeche,neueGaubenFlaeche,type Projekt,type Flaeche} from '../lib/model';
import {SchrittBelegung} from './SchrittBelegung';
import {EntwurfNavigationProvider} from '../lib/entwurf-navigation';
import type {ReferenzDach} from './FotoReferenzEditor';

const aufmass:ReferenzDach={name:'Hauptdach neu gemessen',neigungDeg:37,azimutDeg:225,
  ergebnis:{ok:true,breiteM:8,hoeheM:4,umrissM:[[0,4],[8,4],[4,0]],eckenPx:[[100,500],[900,500],[900,100],[100,100]],ursprungM:[-2,-.5],extrapolationsFaktor:2,qualitaet:'ok',meldungen:[],massstabVerhaeltnis:1},
  messung:{breiteM:4,hoeheM:1.5,eckenPx:[[300,450],[700,450],[700,300],[300,300]],umrissPx:[[100,500],[900,500],[500,100]],rahmenBreiteM:8,rahmenHoeheM:4,rahmenEckenPx:[[100,500],[900,500],[900,100],[100,100]]}};

// Den geprüften Editor-Ausgang gezielt an die echte Projektänderung anschließen.
// Die Eingabe- und Bestätigungsschritte sind in FotoReferenzEditor.test.tsx geprüft.
vi.mock('./FotoReferenzEditor',()=>({FotoReferenzEditor:({onUebernehmen}:{onUebernehmen:(dach:ReferenzDach)=>void})=><button onClick={()=>onUebernehmen(aufmass)}>Geprüftes Neuaufmaß übernehmen</button>}));

beforeEach(()=>{
  vi.stubGlobal('React',React);
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

function bestand():Projekt {
  const basis=neuesProjekt();
  const flaechen:Flaeche[]=Array.from({length:5},(_,i)=>({...neueFlaeche(i+1,String.fromCharCode(65+i)),
    name:`Dachseite ${i+1}`,massStatus:'bestaetigt',massEingabeOffen:false,grunddatenFertig:true,
    azimutDeg:45*i,neigungDeg:25+i,felder:[{xM:1,yM:1,breiteM:3,hoeheM:2,quer:false,leer:['0-0']}],
    hindernisse:[{xM:5,yM:3,breiteM:.6,hoeheM:.7}],inaktiv:['0-1'],
    fotoZuordnungen:[{fotoId:'foto-1',traufePx:null,eckenPx:[[0,600],[1000,600],[1000,0],[0,0]],perspektiveBestaetigt:true,markierungFertig:true}]}));
  flaechen[0]!.fotoZuordnungen!.push({fotoId:'foto-2',traufePx:null,eckenPx:[[0,600],[1000,600],[1000,0],[0,0]],perspektiveBestaetigt:true,markierungFertig:true});
  const gaube:Flaeche={...neueGaubenFlaeche(6,'F','schleppdach','p1'),name:'Gaube Hauptdach',breiteM:2,hoeheM:2,massStatus:'bestaetigt',grunddatenFertig:true,
    felder:[{xM:.2,yM:.2,breiteM:1.6,hoeheM:1.6,quer:false}],
    fotoZuordnungen:[{fotoId:'foto-1',traufePx:null,eckenPx:[[350,450],[550,450],[550,250],[350,250]],perspektiveBestaetigt:true,markierungFertig:true}]};
  flaechen[0]!.gaubenAussparungen=[{gaubenGruppeId:gaube.gaubenGruppeId??gaube.id,fotoId:'foto-1',rechteck:{xM:3.5,yM:2.5,breiteM:2,hoeheM:2},fotoEckenPx:[[350,450],[550,450],[550,250],[350,250]]}];
  return {...basis,fotos:[1,2].map(i=>({id:`foto-${i}`,name:`Bild ${i}`,dataUrl:'data:image/gif;base64,R0lGODlhAQABAAAAACw=',breitePx:1000,hoehePx:600})),flaechen:[...flaechen,gaube]};
}

describe('Neuaufmaß im Mehrflächenprojekt',()=>{
  it('ersetzt nur die ausgewählte Dachfläche und stellt ihren vollständigen alten Stand mit einem Undo wieder her',()=>{
    const start=bestand(); let letzterStand=start;
    function TestApp(){const[projekt,setProjekt]=useState(start);return <EntwurfNavigationProvider><SchrittBelegung projekt={projekt} onChange={neu=>{letzterStand=neu;setProjekt(neu);}} /></EntwurfNavigationProvider>;}
    const ui=render(<TestApp />);
    fireEvent.click(ui.getByRole('button',{name:'Dachmaße'}));
    fireEvent.click(ui.getByText('Erweiterte Fotoeinrichtung'));
    fireEvent.click(ui.getByRole('button',{name:'Dachrand frei markieren'}));
    expect(letzterStand).toBe(start);
    fireEvent.click(ui.getByRole('button',{name:'Geprüftes Neuaufmaß übernehmen'}));
    const neu=letzterStand.flaechen[0]!;
    expect(neu).toMatchObject({name:aufmass.name,breiteM:8,hoeheM:4,neigungDeg:37,azimutDeg:225,fotoBezugsrahmen:true,dachform:'rechteck',felder:[],hindernisse:[],inaktiv:[],umrissM:aufmass.ergebnis.umrissM});
    expect(neu.fotoZuordnungen![0]).toMatchObject({referenzMessung:aufmass.messung,eckenPx:aufmass.ergebnis.eckenPx,perspektiveBestaetigt:true,markierungFertig:false});
    expect(neu.fotoZuordnungen![1]).toMatchObject({fotoId:'foto-2',perspektiveBestaetigt:false,markierungFertig:false});
    expect(neu.fotoZuordnungen![1]!.eckenPx).toBeUndefined();
    expect(neu.gaubenAussparungen).toHaveLength(1);
    expect(neu.gaubenAussparungen![0]!.fotoEckenPx).toEqual(start.flaechen[0]!.gaubenAussparungen![0]!.fotoEckenPx);
    for(const i of [1,2,3,4,5]) expect(letzterStand.flaechen[i]).toBe(start.flaechen[i]);
    expect(letzterStand.fotos).toBe(start.fotos);
    expect(ui.getByRole('button',{name:'↶ Rückgängig (1)'})).toBeTruthy();
    fireEvent.click(ui.getByRole('button',{name:/Rückgängig/}));
    expect(letzterStand).toEqual(start);
    fireEvent.click(ui.getByRole('button',{name:/Wiederherstellen/}));
    expect(letzterStand.flaechen[0]).toEqual(neu);
    for(const i of [1,2,3,4,5]) expect(letzterStand.flaechen[i]).toEqual(start.flaechen[i]);
  });
});


describe('Südrichtung nach Neuaufmaß von Halle und Freifläche',()=>{
  it.each([
    ['halle','sued'],['halle','ostwest'],['freiflaeche','sued'],['freiflaeche','ostwest'],
  ] as const)('verlangt in %s mit %s nur die Kompassbestätigung neu und erhält Montage, Nachbarn und Undo', (einsatzort,aufstaenderung)=>{
    const start=bestand();
    start.flaechen=start.flaechen.filter(f=>!f.gaubenTyp);
    const montage:NonNullable<Flaeche['flachdach']>={aufstaenderung,winkelDeg:17,pitchM:12,modulAusrichtung:'quer',moduleInNeigung:2,firstspaltM:.15,richtungSued:'links',suedWinkelDeg:217};
    start.flaechen[0]={...start.flaechen[0]!,art:'flachdach',einsatzort,neigungDeg:0,flachdach:montage,gaubenAussparungen:undefined};
    let letzterStand=start;
    function TestApp(){const[projekt,setProjekt]=useState(start);return <EntwurfNavigationProvider><SchrittBelegung projekt={projekt} onChange={neu=>{letzterStand=neu;setProjekt(neu);}} /></EntwurfNavigationProvider>;}
    const ui=render(<TestApp />);
    fireEvent.click(ui.getByRole('button',{name:einsatzort==='freiflaeche'?'Flächenmaße':'Dachmaße'}));
    fireEvent.click(ui.getByText('Erweiterte Fotoeinrichtung'));
    fireEvent.click(ui.getByRole('button',{name:'Dachrand frei markieren'}));
    fireEvent.click(ui.getByRole('button',{name:'Geprüftes Neuaufmaß übernehmen'}));
    expect(letzterStand.flaechen[0]!.flachdach).toEqual({...montage,suedWinkelDeg:undefined});
    expect(letzterStand.flaechen[0]!.felder).toEqual([]);
    for(const i of [1,2,3,4]) expect(letzterStand.flaechen[i]).toBe(start.flaechen[i]);
    fireEvent.click(ui.getByRole('button',{name:'↶ Rückgängig (1)'}));
    expect(letzterStand).toEqual(start);
    expect(letzterStand.flaechen[0]!.flachdach!.suedWinkelDeg).toBe(217);
    fireEvent.click(ui.getByRole('button',{name:/Wiederherstellen/}));
    expect(letzterStand.flaechen[0]!.flachdach).toEqual({...montage,suedWinkelDeg:undefined});
    fireEvent.click(ui.getByRole('button',{name:'Keine Aussparungen – weiter'}));
    fireEvent.click(ui.getByRole('button',{name:'Belegung vorschlagen'}));
    expect(ui.getByRole('heading',{name:'Wo liegt Süden?'})).toBeTruthy();
    expect((ui.getByRole('button',{name:'Südrichtung übernehmen'}) as HTMLButtonElement).disabled).toBe(true);
    expect(letzterStand.flaechen[0]!.felder).toEqual([]);
    for(const i of [1,2,3,4]) expect(letzterStand.flaechen[i]).toEqual(start.flaechen[i]);
  });
});


describe('Fotoeinrichtung mit normalen Dachmaßen',()=>{
  it.each(['rechteck','trapez','schief'] as const)('beginnt bei %s mit Dachmaßen und hält die Spezialreferenz geschlossen',dachform=>{
    const start=bestand();
    Object.assign(start.flaechen[0]!,{dachform,firstBreiteM:dachform==='rechteck'?undefined:6,firstVersatzM:dachform==='schief'?-2:undefined});
    const onChange=vi.fn();
    const ui=render(<EntwurfNavigationProvider><SchrittBelegung projekt={start} onChange={onChange} /></EntwurfNavigationProvider>);
    fireEvent.click(ui.getByRole('button',{name:'Dachmaße'}));
    expect(ui.getByLabelText(/^Breite unten/)).toBeTruthy();
    expect(ui.queryByText('Dachspitze, einseitig schräg oder mit Einschnitt?')).toBeNull();
    const details=ui.getByText('Erweiterte Fotoeinrichtung').closest('details')!;
    expect(details.open).toBe(false);
    expect(details.contains(ui.getByRole('button',{name:'Dachrand frei markieren',hidden:true}))).toBe(true);
    fireEvent.click(ui.getByText('Erweiterte Fotoeinrichtung'));
    expect(details.open).toBe(true);
    fireEvent.click(ui.getByRole('button',{name:'Dachrand frei markieren'}));
    expect(ui.getByRole('button',{name:'Geprüftes Neuaufmaß übernehmen'})).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lässt das vorhandene Referenzaufmaß direkt korrigieren und erhält bis zur Übernahme alle Daten',()=>{
    const start=bestand();
    Object.assign(start.flaechen[0]!,{fotoBezugsrahmen:true,umrissM:aufmass.ergebnis.umrissM});
    start.flaechen[0]!.fotoZuordnungen![0]!.referenzMessung=aufmass.messung;
    const onChange=vi.fn();
    const ui=render(<EntwurfNavigationProvider><SchrittBelegung projekt={start} onChange={onChange} /></EntwurfNavigationProvider>);
    fireEvent.click(ui.getByRole('button',{name:'Dachmaße'}));
    const korrektur=ui.getByRole('button',{name:'Referenz und Dachrand neu prüfen'});
    expect(korrektur.closest('details')).toBeNull();
    expect(ui.queryByText('Erweiterte Fotoeinrichtung')).toBeNull();
    fireEvent.click(korrektur);
    expect(ui.getByRole('button',{name:'Geprüftes Neuaufmaß übernehmen'})).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
