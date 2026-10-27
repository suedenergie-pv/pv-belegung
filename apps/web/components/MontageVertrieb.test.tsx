// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { SchrittFlaechen } from './SchrittFlaechen';
import { neuesProjekt,bauePayload,modulById,rasterFuer,vollFeldFuer } from '../lib/model';
beforeEach(()=>vi.stubGlobal('React',React));afterEach(()=>{cleanup();vi.unstubAllGlobals()});
function editor(){
 let stand=neuesProjekt();
 function Test(){const[p,setP]=useState(stand);return <SchrittFlaechen projekt={p} entwurfsModus onChange={neu=>{stand=neu;setP(neu)}}/>}
 return {...render(<Test/>),stand:()=>stand};
}
describe('Montage im Vertrieb',()=>{
 it('wechselt vom Hallen-Flachdach zur Freifläche und zurück zum Hallen-Schrägdach',()=>{
  const ui=editor(),art=ui.getByLabelText('Art der Fläche');
  fireEvent.change(art,{target:{value:'halle-flachdach'}});expect(ui.stand().flaechen[0]!.einsatzort).toBe('halle');
  fireEvent.change(art,{target:{value:'freiflaeche'}});
  expect(ui.stand().flaechen[0]!).toMatchObject({art:'flachdach',einsatzort:'freiflaeche',flachdach:{winkelDeg:25,moduleInNeigung:2,modulAusrichtung:'hoch'}});
  fireEvent.change(art,{target:{value:'halle-dach'}});
  expect(ui.stand().flaechen[0]!).toMatchObject({art:'dach',einsatzort:'halle'});
  expect(ui.stand().flaechen[0]!.flachdach).toBeUndefined();
 });
 it('akzeptiert Dezimalkomma und hält einen ungültigen Winkel als sichtbaren Entwurf',()=>{
  const ui=editor();fireEvent.change(ui.getByLabelText('Art der Fläche'),{target:{value:'freiflaeche'}});
  const winkel=ui.getByLabelText(/^Modulneigung/);
  fireEvent.change(winkel,{target:{value:'17,5'}});expect(ui.stand().flaechen[0]!.flachdach!.winkelDeg).toBe(17.5);
  fireEvent.change(winkel,{target:{value:'90'}});expect(winkel.getAttribute('aria-invalid')).toBe('true');
  expect(ui.stand().flaechen[0]!.flachdach!.winkelDeg).toBe(17.5);
  expect(ui.getByText(/darf höchstens 75/)).toBeTruthy();
 });
 it('erklärt automatisch vergrößerte Reihenabstände bis zur bewussten Abstandskorrektur',()=>{
  const ui=editor();fireEvent.change(ui.getByLabelText('Art der Fläche'),{target:{value:'freiflaeche'}});
  fireEvent.change(ui.getByLabelText('Module übereinander je Tischseite'),{target:{value:'6'}});
  expect(ui.getByRole('status').textContent).toMatch(/Abstand erhöht: 5 → 9,69 m/);
  fireEvent.change(ui.getByLabelText('Module übereinander je Tischseite'),{target:{value:'2'}});
  expect(ui.getByRole('status').textContent).toMatch(/9,69/);
  expect(ui.stand().flaechen[0]!.flachdach!.pitchM).toBe(9.69);
  fireEvent.change(ui.getByLabelText(/^Abstand der Reihen/),{target:{value:'5'}});
  expect(ui.queryByRole('status')).toBeNull();
  expect(ui.stand().flaechen[0]!.flachdach!.pitchM).toBe(5);
 });
 it('verhindert überlappende Tische bei Formatwechsel, zeigt freie Gasse und exportiert die tatsächliche Konfiguration',()=>{
  const ui=editor();fireEvent.change(ui.getByLabelText('Art der Fläche'),{target:{value:'freiflaeche'}});
  fireEvent.change(ui.getByLabelText('Anordnung der Modultische'),{target:{value:'ostwest'}});
  fireEvent.change(ui.getByLabelText('Module übereinander je Tischseite'),{target:{value:'4'}});
  expect(ui.stand().flaechen[0]!.flachdach!.pitchM).toBeGreaterThan(12);
  expect(ui.getByText(/Freie Gasse:/)).toBeTruthy();
  const p=ui.stand(),f=p.flaechen[0]!,m=modulById(p.modulId);f.breiteM=40;f.hoeheM=20;f.massStatus='bestaetigt';f.felder=[vollFeldFuer(f,m)];
  const payload=bauePayload(p,null) as {flaechen:{einsatzort:string;flachdach_montage:{module_in_neigung:number;modul_ausrichtung:string};module:{anzahl_hochkant:number}}[]};
  expect(payload.flaechen[0]!.einsatzort).toBe('freiflaeche');
  expect(payload.flaechen[0]!.flachdach_montage).toMatchObject({module_in_neigung:4,modul_ausrichtung:'hoch'});
  expect(payload.flaechen[0]!.module.anzahl_hochkant).toBe(rasterFuer(f,m).positionen.length);
 });
});

describe('Maßstäbliche Seitenansicht', () => {
 it.each(['sued','ostwest'].flatMap(art => [0,25,75].flatMap(winkel => [1,6].map(n => ({art,winkel,n})))))(
  '$art $winkel Grad mit $n Modulen je Seite', ({art,winkel,n}) => {
   const ui=editor();fireEvent.change(ui.getByLabelText('Art der Fläche'),{target:{value:'freiflaeche'}});
   fireEvent.change(ui.getByLabelText('Anordnung der Modultische'),{target:{value:art}});
   fireEvent.change(ui.getByLabelText(/^Modulneigung/),{target:{value:String(winkel)}});
   fireEvent.change(ui.getByLabelText('Module übereinander je Tischseite'),{target:{value:String(n)}});
   const bild=ui.getByRole('img',{name:/Seitenansicht/}),linien=bild.querySelectorAll('[data-montage-modul]');
   expect(linien.length).toBe(2*n*(art==='ostwest'?2:1));
   for(const line of linien){
    const dx=Number(line.getAttribute('x2'))-Number(line.getAttribute('x1'));
    const dy=Number(line.getAttribute('y1'))-Number(line.getAttribute('y2'));
    expect(Math.abs(dy/dx)).toBeCloseTo(Math.tan(winkel*Math.PI/180),8);
   }
 });
});
