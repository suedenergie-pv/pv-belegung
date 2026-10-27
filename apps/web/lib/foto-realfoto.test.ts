import { describe, expect, it } from 'vitest';
import { homographie, inverseHomographie, projiziere, type Ecken, type Punkt } from './foto-geometrie';

/**
 * Echte Foto-Beobachtungen, unabhängig von einer generierten Projektionsmatrix.
 * Quelle: https://www.goriske.si/novice/stirikapnica-v-mirnu
 * Foto: https://www.goriske.si/image/original/1180 (1024 × 576, Goriške Opekarne).
 * Keine Bilddatei im Produkt/Repo. Gezählt: ca. 73 (+/-1) Bahnen unten, 29 oben.
 * Zwei separate Strecken umfassen je 20 Wiederholungsabstände.
 * Koordinaten visuell gezählt; keine Vermessung, kein bekanntes Meter-Deckmaß.
 * Die Tiefe 24 ist eine freie Achsenskalierung in diesem Richtungs-/Breitentest.
 */
const foto:Ecken = [[305,456],[827,438],[669,284],[457,289]];
const dach:Ecken = [[0,24],[73,24],[51,0],[22,0]];
const zaehlstrecken:[Punkt,Punkt][] = [[[353,447],[497,442]],[[461,300],[609,294]]];
const drehen=(p:Punkt,grad:number):Punkt=>{
  const a=grad*Math.PI/180;return [512+Math.cos(a)*(p[0]-512)-Math.sin(a)*(p[1]-288),288+Math.sin(a)*(p[0]-512)+Math.cos(a)*(p[1]-288)];
};
describe('Reales Walmdach: unabhängige gezählte Ziegelstrecken',()=>{
  for(const grad of [0,90,217])it(`erhält die 20er-Ziegelabstände nahe Traufe und First bei ${grad}° Bilddrehung`,()=>{
    const ecken=foto.map(p=>drehen(p,grad)) as Ecken;
    const inv=inverseHomographie(73,24,ecken,dach)!;expect(inv).not.toBeNull();
    const breiten=zaehlstrecken.map(s=>{
      const [a,b]=s.map(p=>projiziere(inv,drehen(p,grad))) as [Punkt,Punkt];
      expect(Math.abs(b[1]-a[1])).toBeLessThan(.5);
      const breite=Math.abs(b[0]-a[0]);expect(breite).toBeGreaterThan(19);expect(breite).toBeLessThan(21);return breite;
    });
    expect(Math.abs(breiten[1]!/breiten[0]!-1)).toBeLessThan(.05);
    // Der bekannte frühere Fehler: dieselben Fotoecken wie ein Rechteck behandeln.
    // Ein solcher Renderer muss an diesem realen Innenraster scheitern.
    const falsch=inverseHomographie(73,24,ecken)!;
    const falscheBreiten=zaehlstrecken.map(s=>{
      const [a,b]=s.map(p=>projiziere(falsch,drehen(p,grad))) as [Punkt,Punkt];return Math.abs(b[0]-a[0]);
    });
    expect(Math.abs(falscheBreiten[1]!/falscheBreiten[0]!-1)).toBeGreaterThan(.5);
    const h=homographie(73,24,ecken,dach)!;
    for(let i=0;i<4;i++){const q=projiziere(h,dach[i]!);expect(Math.hypot(q[0]-ecken[i]![0],q[1]-ecken[i]![1])).toBeLessThan(.001);}
  });
});


/**
 * ERLUS Monaco Umbra, echte Herstelleraufnahme 2880 × 2160.
 * https://www.erlus.com/rooftilemodels?pid=7975
 * Foto: https://www.erlus.com/01-DACHKERAMIK/01-BILDER/01_Produktfotos/01-Standardziegel%20und%20Zubehoer/Monaco%20-%20Modellreihe/03_Referenzbilder/Umbra/0230202075%20-%20Monaco%20Umbra/image-thumb__20282__ReferenzbilderWebFull/ref_monaco_umbra_0230202075_6%402x.jpg
 * Vier äußere Fugen bestimmen die Abbildung. Die zusätzlich abgelesenen
 * inneren Stöße wurden NICHT aus dieser Abbildung erzeugt. Zehn vollständige
 * Deckbreiten und sechs Deckreihen, keine einzelnen Wellen als ganze Ziegel.
 * Toleranz berücksichtigt ca. 2–3 Originalpixel manuelle Ableseunsicherheit.
 * Rein dimensionslose Prüfung; verlegte Metermaße des Gebäudes sind unbekannt.
 */
const erlusRaster: Ecken = [[1680,1752],[1974,1758],[1988,1491],[1688,1490]];
const erlusSpalten: Punkt[] = [[1680,1752],[1709.5,1752],[1739,1753],[1768.5,1753],[1797.8,1753.5],[1827,1754],[1856.5,1754.5],[1885.8,1755.5],[1915.1,1756.5],[1944.3,1757],[1974,1758]];
const erlusReihen: Punkt[] = [[1839,1490],[1837,1534],[1835,1579],[1833,1623],[1831,1668],[1829,1712],[1827,1754]];
const dreheErlus = ([x,y]:Punkt, grad:number):Punkt => {
  const a=grad*Math.PI/180;return [1440+Math.cos(a)*(x-1440)-Math.sin(a)*(y-1080),1080+Math.sin(a)*(x-1440)+Math.cos(a)*(y-1080)];
};
describe('Reales Pyramidendach: zusätzlich abgelesene innere Ziegelfugen',()=>{
  it.each([0,90,180,270])('prüft ganze Spalten und Reihen unabhängig von den vier Ankern bei %s°', grad=>{
    const inv=inverseHomographie(10,6,erlusRaster.map(p=>dreheErlus(p,grad)) as Ecken);
    expect(inv).not.toBeNull();
    // Nur die INNEREN Grenzen prüfen: diese gingen nicht in die Kalibrierung ein.
    for(let i=1;i<erlusSpalten.length-1;i++){
      const [x,y]=projiziere(inv!,dreheErlus(erlusSpalten[i]!,grad));
      expect(Math.abs(x-i)).toBeLessThan(.12);
      expect(Math.abs(y-6)).toBeLessThan(.10);
    }
    for(let i=1;i<erlusReihen.length-1;i++){
      const [x,y]=projiziere(inv!,dreheErlus(erlusReihen[i]!,grad));
      expect(Math.abs(x-5)).toBeLessThan(.12);
      expect(Math.abs(y-i)).toBeLessThan(.10);
    }
  });
});
