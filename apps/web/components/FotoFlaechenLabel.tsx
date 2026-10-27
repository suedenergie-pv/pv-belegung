'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Namen anderer Flächen dürfen aktive Felder und ihre Griffe nicht verdecken.
 * Die vollständige Flächenauswahl bleibt im Kopf und in der Ebenenliste erreichbar. */
export function FotoFlaechenLabel({ name, kuerzel, className, style, onClick }: {
 name: string; kuerzel?: string; className: string; style: CSSProperties; onClick: () => void;
}) {
 const ref=useRef<HTMLButtonElement>(null);
 const [verdeckt,setVerdeckt]=useState(false);
 useLayoutEffect(()=>{
  const button=ref.current, rahmen=button?.parentElement;
  if(!button||!rahmen)return;
  const pruefen=()=>{
   const b=button.getBoundingClientRect();
   const trifft=b.width>0&&b.height>0&&Array.from(rahmen.querySelectorAll('[data-feld-ebene="flaeche"], [data-feld-drehen], [data-feld-griff]')).some(feld=>{
    const f=feld.getBoundingClientRect();
    return f.width>0&&f.height>0&&b.left<f.right+4&&b.right>f.left-4&&b.top<f.bottom+4&&b.bottom>f.top-4;
   });
   setVerdeckt(trifft);
  };
  pruefen();
  if(typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(pruefen);observer.observe(rahmen);observer.observe(button);
  return ()=>observer.disconnect();
 });
 return <button ref={ref} type="button" className={className}
  style={{...style,visibility:verdeckt?'hidden':undefined}}
  title={kuerzel ? `${kuerzel} · ${name}` : name} aria-label={`${name} im Foto auswählen`} onPointerDown={e=>e.stopPropagation()} onClick={onClick}>{kuerzel ? <span aria-hidden="true">{kuerzel}</span> : name}</button>;
}
