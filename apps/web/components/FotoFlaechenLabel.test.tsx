// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { FotoFlaechenLabel } from './FotoFlaechenLabel';

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
const box=(x:number,y:number,w:number,h:number)=>({x,y,width:w,height:h,left:x,top:y,right:x+w,bottom:y+h,toJSON:()=>({})} as DOMRect);
describe('Flächennamen lassen aktive Feldbedienung frei',()=>{
 it.each(['data-feld-ebene','data-feld-drehen','data-feld-griff'])('%s wird nicht von einem fremden Namen verdeckt',attribut=>{
  vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(this:Element){return this.tagName==='BUTTON'?box(90,90,100,44):box(100,100,30,30)});
  const {container,queryByRole}=render(<div><span {...{[attribut]:attribut==='data-feld-ebene'?'flaeche':'0'}}/><FotoFlaechenLabel name="Nachbardach" className="" style={{}} onClick={()=>{}}/></div>);
  expect(container.querySelector('button')!.style.visibility).toBe('hidden');expect(queryByRole('button',{name:'Nachbardach im Foto auswählen'})).toBeNull();
 });
 it('freie Namen bleiben klickbar; bei Zoom/Resize wird die Abdeckung erneut geprüft',()=>{
  let ziel=box(300,300,40,40),resize=()=>{};
  class Observer {constructor(fn:()=>void){resize=fn}observe(){}disconnect(){}}
  vi.stubGlobal('ResizeObserver',Observer);
  vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(this:Element){return this.tagName==='BUTTON'?box(90,90,100,44):ziel});
  const click=vi.fn(),{getByRole,container,rerender}=render(<div><span data-feld-ebene="flaeche"/><FotoFlaechenLabel name="Nachbardach" className="" style={{left:'20%'}} onClick={click}/></div>);
  fireEvent.click(getByRole('button'));expect(click).toHaveBeenCalledOnce();
  ziel=box(100,100,40,40);rerender(<div><span data-feld-ebene="flaeche"/><FotoFlaechenLabel name="Nachbardach" className="" style={{left:'30%'}} onClick={click}/></div>);
  expect(container.querySelector('button')!.style.visibility).toBe('hidden');
  ziel=box(300,300,40,40);act(()=>resize());expect(getByRole('button').style.visibility).toBe('');
 });
});
