// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FotoReferenzEditor } from './FotoReferenzEditor';
import type { FotoArbeitsbereich } from './FotoHintergrund';
import { neueFlaeche, type DachFoto, type Flaeche } from '../lib/model';
import { EntwurfNavigationProvider, useEntwurfNavigation } from '../lib/entwurf-navigation';

const foto: DachFoto = {dataUrl:'data:image/png;base64,eA==',breitePx:1000,hoehePx:600,traufePx:null};
const refPunkte: [number,number][] = [[300,450],[700,450],[700,300],[300,300]];
const dachPunkte: [number,number][] = [[100,500],[900,500],[500,100]];
const matrix = {a:1,b:0,inverse:()=>matrix};
const screenCTM = Object.getOwnPropertyDescriptor(SVGElement.prototype,'getScreenCTM');
const pointerCapture = Object.getOwnPropertyDescriptor(Element.prototype,'setPointerCapture');

beforeEach(() => {
  vi.stubGlobal('React',React);
  vi.stubGlobal('ResizeObserver',class {observe() {} disconnect() {}});
  vi.stubGlobal('DOMPoint',class {constructor(public x:number, public y:number) {} matrixTransform() {return {x:this.x,y:this.y};}});
  vi.stubGlobal('matchMedia',vi.fn(() => ({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  Object.defineProperty(SVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>matrix});
  Object.defineProperty(Element.prototype,'setPointerCapture',{configurable:true,value:vi.fn()});
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  if(screenCTM) Object.defineProperty(SVGElement.prototype,'getScreenCTM',screenCTM); else delete (SVGElement.prototype as unknown as {getScreenCTM?:unknown}).getScreenCTM;
  if(pointerCapture) Object.defineProperty(Element.prototype,'setPointerCapture',pointerCapture); else delete (Element.prototype as unknown as {setPointerCapture?:unknown}).setPointerCapture;
});

function editor(projektFoto: DachFoto = foto, flaeche: Flaeche = neueFlaeche(1,'A')) {
  let bereich: FotoArbeitsbereich;
  const speichern = vi.fn(), abbrechen = vi.fn(), navigationAktion = vi.fn();
  function Weiter() {const nav=useEntwurfNavigation(); return <button onClick={()=>nav.weiter(navigationAktion)}>Andere Aktion</button>;}
  const ui = render(<EntwurfNavigationProvider><Weiter /><FotoReferenzEditor foto={projektFoto} flaeche={flaeche} ansichtZoom={1} onUebernehmen={speichern} onAbbrechen={abbrechen} renderArbeitsbereich={b=>{bereich=b;return <>{b.bild}<h2>{b.aufgabe?.titel}</h2>{b.steuerung}<p>{b.hinweis}</p></>;}} /></EntwurfNavigationProvider>);
  const bild=ui.getByRole('img',{name:'Referenz und Dachrand im Foto markieren'});
  const klick=(p:readonly[number,number])=>fireEvent.click(bild,{clientX:p[0],clientY:p[1]});
  const referenz=()=>{
    fireEvent.change(ui.getByLabelText('Referenzbreite in m'),{target:{value:'4'}});
    fireEvent.change(ui.getByLabelText('Referenztiefe in m'),{target:{value:'1,5'}});
    refPunkte.forEach(klick);
    fireEvent.click(ui.getByRole('button',{name:'Referenz bestätigen'}));
  };
  const touchPunkt=(p:readonly[number,number])=>{
    act(()=>bereich.punktSteuerung!.onBewegen([p[0],p[1]]));
    act(()=>bereich.punktSteuerung!.onBestaetigen());
  };
  return {...ui,bild,klick,referenz,touchPunkt,speichern,abbrechen,navigationAktion,get bereich(){return bereich!;}};
}
function pointer(ziel: Element, art:string, x:number,y:number,button=0) {
  const event=new MouseEvent(art,{bubbles:true,clientX:x,clientY:y,button});
  Object.defineProperties(event,{pointerType:{value:'mouse'},pointerId:{value:1}});
  fireEvent(ziel,event);
}

describe('Referenz und tatsächlicher Dachrand',()=>{
  it('speichert eine Dreiecksfläche erst nach Referenz, echtem Umriss und ausdrücklicher Messbestätigung',()=>{
    const ui=editor(); ui.referenz();
    expect(ui.getByRole('heading',{name:'Echten Dachrand nachzeichnen'})).toBeTruthy();
    dachPunkte.forEach(ui.klick);
    fireEvent.click(ui.getByRole('button',{name:'Dachrand prüfen'}));
    expect(ui.getByRole('heading',{name:'Dachfläche prüfen'})).toBeTruthy();
    const speichern=ui.getByRole('button',{name:'Dachfläche übernehmen'}) as HTMLButtonElement;
    expect(speichern.disabled).toBe(true); expect(ui.speichern).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('checkbox'));
    fireEvent.click(speichern);
    expect(ui.speichern).toHaveBeenCalledOnce();
    const dach=ui.speichern.mock.calls[0]![0];
    expect(dach.ergebnis.breiteM).toBeCloseTo(8);
    expect(dach.ergebnis.hoeheM).toBeCloseTo(4);
    expect(dach.ergebnis.umrissM).toHaveLength(3);
    expect(dach.messung).toMatchObject({breiteM:4,hoeheM:1.5,eckenPx:refPunkte,umrissPx:dachPunkte});
  });

  it('weist fehlende Referenzmaße und einen selbst schneidenden Dachrand mit konkreter Korrektur zurück',()=>{
    const ui=editor(); refPunkte.forEach(ui.klick);
    fireEvent.click(ui.getByRole('button',{name:'Referenz bestätigen'}));
    expect(ui.getByRole('alert').textContent).toMatch(/gemessene Breite und Tiefe/);
    fireEvent.change(ui.getByLabelText('Referenzbreite in m'),{target:{value:'4'}});
    fireEvent.change(ui.getByLabelText('Referenztiefe in m'),{target:{value:'1,5'}});
    fireEvent.click(ui.getByRole('button',{name:'Referenz bestätigen'}));
    [[100,500],[900,100],[100,100],[900,500]].forEach(p=>ui.klick(p as [number,number]));
    fireEvent.click(ui.getByRole('button',{name:'Dachrand prüfen'}));
    expect(ui.getByRole('alert').textContent).toMatch(/kreuzt|berührt/);
    expect(ui.speichern).not.toHaveBeenCalled();
  });

  it('entfernt nur die letzte Ecke des aktuellen Schrittes und erhält die gemessene Referenz',()=>{
    const ui=editor(); ui.referenz(); dachPunkte.forEach(ui.klick);
    fireEvent.click(ui.getByRole('button',{name:'Letzte Ecke zurück'}));
    expect(ui.getAllByRole('button',{name:/Dachrand Ecke/})).toHaveLength(2);
    expect((ui.getByRole('button',{name:'Dachrand prüfen'}) as HTMLButtonElement).disabled).toBe(true);
    ui.klick(dachPunkte[2]!);
    fireEvent.click(ui.getByRole('button',{name:'Dachrand prüfen'}));
    fireEvent.click(ui.getByRole('checkbox')); fireEvent.click(ui.getByRole('button',{name:'Dachfläche übernehmen'}));
    expect(ui.speichern.mock.calls[0]![0].messung.eckenPx).toEqual(refPunkte);
  });

  it('verlangt nach einer Umrisskorrektur eine neue ausdrückliche Bestätigung',()=>{
    const ui=editor(); ui.referenz(); dachPunkte.forEach(ui.klick);
    fireEvent.click(ui.getByRole('button',{name:'Dachrand prüfen'})); fireEvent.click(ui.getByRole('checkbox'));
    fireEvent.click(ui.getByRole('button',{name:'Dachrand korrigieren'}));
    fireEvent.keyDown(ui.getByRole('button',{name:'Dachrand Ecke 3 verschieben'}),{key:'ArrowRight',shiftKey:true});
    fireEvent.click(ui.getByRole('button',{name:'Dachrand prüfen'}));
    expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect((ui.getByRole('button',{name:'Dachfläche übernehmen'}) as HTMLButtonElement).disabled).toBe(true);
  });
});

it('lädt vorhandene Referenzpunkte als eigenen Entwurf, ohne die gespeicherte Messung zu verändern',()=>{
  const gespeichert: DachFoto = {...foto,referenzMessung:{breiteM:4,hoeheM:1.5,eckenPx:refPunkte as [[number,number],[number,number],[number,number],[number,number]],umrissPx:dachPunkte,rahmenBreiteM:8,rahmenHoeheM:4,rahmenEckenPx:[[100,500],[900,500],[900,100],[100,100]]}};
  const vorher=JSON.stringify(gespeichert);
  const ui=editor(gespeichert);
  expect((ui.getByLabelText('Referenzbreite in m') as HTMLInputElement).value).toBe('4');
  expect((ui.getByLabelText('Referenztiefe in m') as HTMLInputElement).value).toBe('1.5');
  expect(ui.getAllByRole('button',{name:/Referenz Ecke/})).toHaveLength(4);
  fireEvent.keyDown(ui.getByRole('button',{name:'Referenz Ecke 1 verschieben'}),{key:'ArrowRight',shiftKey:true});
  fireEvent.click(ui.getByRole('button',{name:'Abbrechen'}));
  fireEvent.click(ui.getByRole('button',{name:'Verwerfen',hidden:true}));
  expect(ui.speichern).not.toHaveBeenCalled();
  expect(ui.abbrechen).toHaveBeenCalled();
  expect(JSON.stringify(gespeichert)).toBe(vorher);
});

describe('Neuaufmaß mit vorhandenen Inhalten',()=>{
  it.each(['felder','hindernisse','beide'] as const)('verlangt bei %s eine separate ausdrückliche Freigabe zum Zurücksetzen',art=>{
    const f:Flaeche={...neueFlaeche(1,'A'),name:'Hauptdach West',neigungDeg:37,azimutDeg:257,
      felder:art==='hindernisse'?[]:[{xM:1,yM:1,breiteM:3,hoeheM:2,quer:false,leer:['0-0']}],
      hindernisse:art==='felder'?[]:[{xM:2,yM:2,breiteM:.6,hoeheM:.7}]};
    const vorher=JSON.stringify(f);
    const ui=editor(foto,f); ui.referenz(); dachPunkte.forEach(ui.klick);
    fireEvent.click(ui.getByRole('button',{name:'Dachrand prüfen'}));
    const speichern=ui.getByRole('button',{name:'Dachfläche übernehmen'}) as HTMLButtonElement;
    const messung=ui.getByRole('checkbox',{name:'Referenz liegt auf dieser Dachfläche und ihre Maße sind gemessen'});
    const reset=ui.getByRole('checkbox',{name:'Belegung und Aussparungen dieser Dachfläche neu anlegen'});
    expect(speichern.disabled).toBe(true);
    fireEvent.click(messung); expect(speichern.disabled).toBe(true);
    fireEvent.click(speichern); expect(ui.speichern).not.toHaveBeenCalled();
    expect(JSON.stringify(f)).toBe(vorher);
    fireEvent.click(reset); expect(speichern.disabled).toBe(false);
    fireEvent.click(reset); expect(speichern.disabled).toBe(true);
    fireEvent.click(reset); fireEvent.click(speichern);
    expect(ui.speichern).toHaveBeenCalledOnce();
    expect(ui.speichern.mock.calls[0]![0]).toMatchObject({name:'Hauptdach West',neigungDeg:37,azimutDeg:257,messung:{breiteM:4,hoeheM:1.5,eckenPx:refPunkte,umrissPx:dachPunkte}});
    expect(JSON.stringify(f)).toBe(vorher);
  });
});

describe('Präzise Punktbedienung',()=>{
  it('übernimmt genaue Pointer-Koordinaten und ignoriert das nachfolgende gerundete Klickereignis',()=>{
    const ui=editor();
    pointer(ui.bild,'pointerup',300.375,450.625);
    fireEvent.click(ui.bild,{clientX:300,clientY:451});
    const griffe=ui.getAllByRole('button',{name:/Referenz Ecke/});
    expect(griffe).toHaveLength(1);
    expect(griffe[0]!.querySelector('circle')!.getAttribute('cx')).toBe('300.375');
    expect(griffe[0]!.querySelector('circle')!.getAttribute('cy')).toBe('450.625');
  });

  it('verschiebt mit Maus und Pfeiltasten und verwirft eine abgebrochene Ziehgeste',()=>{
    const ui=editor(); refPunkte.forEach(ui.klick);
    const griff=ui.getByRole('button',{name:'Referenz Ecke 1 verschieben'});
    fireEvent.keyDown(griff,{key:'ArrowRight',shiftKey:true});
    expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('310');
    pointer(griff,'pointerdown',310,450); pointer(ui.bild,'pointermove',350,400);
    expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('350');
    act(()=>ui.bereich.abbrechen!());
    expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('310');
    expect(griff.querySelector('circle')!.getAttribute('cy')).toBe('450');
    expect(ui.speichern).not.toHaveBeenCalled();
  });

  it('startet durch rechte oder mittlere Maustaste keine Modell-Ziehgeste',()=>{
    const ui=editor(); refPunkte.forEach(ui.klick);
    const griff=ui.getByRole('button',{name:'Referenz Ecke 1 verschieben'});
    for(const button of [1,2]) {
      pointer(griff,'pointerdown',300,450,button); pointer(ui.bild,'pointermove',350,400,button); pointer(ui.bild,'pointerup',350,400,button);
      expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('300');
      expect(griff.querySelector('circle')!.getAttribute('cy')).toBe('450');
    }
  });

  it('setzt und verschiebt Touchpunkte ausschließlich über Greifen und Ablegen am Fadenkreuz',()=>{
    const ui=editor(); act(()=>ui.bereich.punktSteuerung!.aktivieren());
    ui.klick([300,450]); expect(ui.queryByRole('button',{name:'Referenz Ecke 1 verschieben'})).toBeNull();
    refPunkte.forEach(ui.touchPunkt);
    act(()=>ui.bereich.punktSteuerung!.onBewegen([300,450]));
    expect(ui.bereich.punktSteuerung!.aktion).toBe('Ecke greifen');
    act(()=>ui.bereich.punktSteuerung!.onBestaetigen());
    expect(ui.bereich.punktSteuerung!.aktion).toBe('Ecke hier ablegen');
    act(()=>ui.bereich.punktSteuerung!.onBewegen([350,400]));
    const griff=ui.getByRole('button',{name:'Referenz Ecke 1 verschieben'});
    expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('300');
    act(()=>ui.bereich.punktSteuerung!.onBestaetigen());
    expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('350');
    expect(griff.querySelector('circle')!.getAttribute('cy')).toBe('400');
  });

  it('beendet einen verworfenen Entwurf auch wenn die nachfolgende Aktion ihn nicht automatisch unmountet',()=>{
    const ui=editor(); ui.klick([300,450]);
    fireEvent.click(ui.getByRole('button',{name:'Andere Aktion'}));
    expect(ui.getByRole('heading',{name:'Maßentwurf noch offen',hidden:true})).toBeTruthy();
    fireEvent.click(ui.getByRole('button',{name:'Verwerfen',hidden:true}));
    expect(ui.abbrechen).toHaveBeenCalledOnce();
    expect(ui.navigationAktion).toHaveBeenCalledOnce();
    expect(ui.speichern).not.toHaveBeenCalled();
  });
});


describe('Nahe Ecken im kleinen Querformat',()=>{
  function kleinerBildschirm() {
    const faktor=.03;
    const bildMatrix={a:faktor,b:0,inverse:()=>({a:1/faktor})};
    Object.defineProperty(SVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>bildMatrix});
    vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){} matrixTransform(m:{a:number}){return {x:this.x*m.a,y:this.y*m.a};}});
    const ui=editor();
    return {...ui,get bereich(){return ui.bereich;},klickBild:(p:readonly[number,number])=>ui.klick([p[0]*faktor,p[1]*faktor])};
  }
  const kleineReferenz:[number,number][]=[[300,450],[340,450],[340,430],[300,430]];
  const lUmriss:[number,number][]=[[280,470],[380,470],[380,400],[350,400],[350,430],[280,430]];

  it('erhält alle sechs L-Ecken einschließlich einer 3-m-Kante bei CTM .03 und ignoriert nur identische Punkte',()=>{
    const ui=kleinerBildschirm();
    fireEvent.change(ui.getByLabelText('Referenzbreite in m'),{target:{value:'4'}});
    fireEvent.change(ui.getByLabelText('Referenztiefe in m'),{target:{value:'2'}});
    ui.klickBild(kleineReferenz[0]!);ui.klickBild(kleineReferenz[0]!);
    expect(ui.getAllByRole('button',{name:/Referenz Ecke/})).toHaveLength(1);
    kleineReferenz.slice(1).forEach(ui.klickBild);
    expect(ui.getAllByRole('button',{name:/Referenz Ecke/})).toHaveLength(4);
    fireEvent.click(ui.getByRole('button',{name:'Referenz bestätigen'}));
    lUmriss.forEach((p,i)=>{
      ui.klickBild(p);
      expect(ui.getAllByRole('button',{name:/Dachrand Ecke/})).toHaveLength(i+1);
    });
    ui.klickBild(lUmriss[0]!);
    expect(ui.getAllByRole('button',{name:/Dachrand Ecke/})).toHaveLength(6);
    fireEvent.click(ui.getByRole('button',{name:'Dachrand prüfen'}));
    fireEvent.click(ui.getByRole('checkbox'));
    fireEvent.click(ui.getByRole('button',{name:'Dachfläche übernehmen'}));
    expect(ui.speichern).toHaveBeenCalledOnce();
    const dach=ui.speichern.mock.calls[0]![0];
    expect(dach.ergebnis.umrissM).toHaveLength(6);
    expect(dach.ergebnis.breiteM).toBeCloseTo(10,7);
    expect(dach.ergebnis.hoeheM).toBeCloseTo(7,7);
    expect(Math.abs(dach.ergebnis.umrissM[2][0]-dach.ergebnis.umrissM[3][0])).toBeCloseTo(3,7);
    dach.messung.umrissPx.forEach((p:number[],i:number)=>p.forEach((v,j)=>expect(v).toBeCloseTo(lUmriss[i]![j]!,7)));
  });

  it('hält Trefferflächen beim Erstzeichnen inaktiv und aktiviert sie nur im passenden Korrekturschritt',()=>{
    const ui=editor();
    refPunkte.forEach((p,i)=>{
      ui.klick(p);
      for(const griff of ui.getAllByRole('button',{name:/Referenz Ecke/})) expect(griff.style.pointerEvents).toBe(i===3?'':'none');
    });
    fireEvent.change(ui.getByLabelText('Referenzbreite in m'),{target:{value:'4'}});
    fireEvent.change(ui.getByLabelText('Referenztiefe in m'),{target:{value:'1.5'}});
    fireEvent.click(ui.getByRole('button',{name:'Referenz bestätigen'}));
    dachPunkte.forEach(ui.klick);
    const griffe=()=>ui.getAllByRole('button',{name:/Dachrand Ecke/});
    for(const griff of griffe()) expect(griff.style.pointerEvents).toBe('none');
    fireEvent.click(ui.getByRole('button',{name:'Gesetzte Ecken verschieben'}));
    expect(ui.getByRole('button',{name:'Weitere Ecke hinzufügen'}).getAttribute('aria-pressed')).toBe('true');
    for(const griff of griffe()) expect(griff.style.pointerEvents).toBe('');
    ui.klick([300,250]);expect(griffe()).toHaveLength(3);
    fireEvent.click(ui.getByRole('button',{name:'Weitere Ecke hinzufügen'}));
    for(const griff of griffe()) expect(griff.style.pointerEvents).toBe('none');
    ui.klick([300,250]);expect(griffe()).toHaveLength(4);
  });

  it('greift bei überlappenden Touchzielen die nächste Ecke statt die zuerst gezeichnete',()=>{
    const ui=kleinerBildschirm();act(()=>ui.bereich.punktSteuerung!.aktivieren());
    kleineReferenz.forEach(ui.touchPunkt);
    act(()=>ui.bereich.punktSteuerung!.onBewegen(kleineReferenz[3]!));
    act(()=>ui.bereich.punktSteuerung!.onBestaetigen());
    act(()=>ui.bereich.punktSteuerung!.onBewegen([299,429]));
    act(()=>ui.bereich.punktSteuerung!.onBestaetigen());
    const erster=ui.getByRole('button',{name:'Referenz Ecke 1 verschieben'}).querySelector('circle')!;
    const vierter=ui.getByRole('button',{name:'Referenz Ecke 4 verschieben'}).querySelector('circle')!;
    expect(erster.getAttribute('cx')).toBe('300');expect(erster.getAttribute('cy')).toBe('450');
    expect(vierter.getAttribute('cx')).toBe('299');expect(vierter.getAttribute('cy')).toBe('429');
  });

  it('verwechselt beim Touch-Erstzeichnen nahe Referenz- und Randecken nicht mit bereits gesetzten Griffen',()=>{
    const ui=kleinerBildschirm();act(()=>ui.bereich.punktSteuerung!.aktivieren());
    fireEvent.change(ui.getByLabelText('Referenzbreite in m'),{target:{value:'4'}});
    fireEvent.change(ui.getByLabelText('Referenztiefe in m'),{target:{value:'2'}});
    kleineReferenz.forEach((p,i)=>{ui.touchPunkt(p);expect(ui.getAllByRole('button',{name:/Referenz Ecke/})).toHaveLength(i+1);});
    fireEvent.click(ui.getByRole('button',{name:'Referenz bestätigen'}));
    lUmriss.forEach((p,i)=>{ui.touchPunkt(p);expect(ui.getAllByRole('button',{name:/Dachrand Ecke/})).toHaveLength(i+1);});
    fireEvent.click(ui.getByRole('button',{name:'Gesetzte Ecken verschieben'}));
    act(()=>ui.bereich.punktSteuerung!.onBewegen(lUmriss[0]!));
    expect(ui.bereich.punktSteuerung!.aktion).toBe('Ecke greifen');
    act(()=>ui.bereich.punktSteuerung!.onBestaetigen());
    expect(ui.bereich.punktSteuerung!.aktion).toBe('Ecke hier ablegen');
  });
});


it('verlässt beim Rückweg vom Rand-Verschieben den Korrekturmodus und erlaubt eine entfernte Referenzecke neu zu setzen',()=>{
  const ui=editor();ui.referenz();dachPunkte.forEach(ui.klick);
  fireEvent.click(ui.getByRole('button',{name:'Gesetzte Ecken verschieben'}));
  expect(ui.getByRole('button',{name:'Weitere Ecke hinzufügen'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(ui.getByRole('button',{name:'Referenz korrigieren'}));
  fireEvent.click(ui.getByRole('button',{name:'Letzte Ecke zurück'}));
  expect(ui.getAllByRole('button',{name:/Referenz Ecke/})).toHaveLength(3);
  ui.klick(refPunkte[3]!);
  expect(ui.getAllByRole('button',{name:/Referenz Ecke/})).toHaveLength(4);
  expect((ui.getByRole('button',{name:'Referenz bestätigen'}) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(ui.getByRole('button',{name:'Referenz bestätigen'}));
  expect(ui.getAllByRole('button',{name:/Dachrand Ecke/})).toHaveLength(3);
  expect(ui.getByRole('button',{name:'Gesetzte Ecken verschieben'}).getAttribute('aria-pressed')).toBe('false');
  expect(ui.speichern).not.toHaveBeenCalled();
});
