import { rahmenBreiteVon, umrissVon, type Flaeche } from '../lib/model';
/** Orientierungshilfe, keine maßstäbliche Vorschau. */
export function DachSkizze({ ecken = false, flaeche, aktiv }: { ecken?: boolean; flaeche?: Flaeche; aktiv?: 'unten' | 'oben' | 'laenge' }) {
  if (flaeche) {
    const frei = !!flaeche.fotoBezugsrahmen && (flaeche.umrissM?.length ?? 0) >= 3;
    const b = flaeche.breiteM, oben = flaeche.firstBreiteM ?? b;
    // Der Versatz beschreibt die Mitten, nicht den Abstand der linken Ecken.
    const links = (b - oben) / 2 + (flaeche.dachform === 'schief' ? flaeche.firstVersatzM ?? 0 : 0);
    const verschiebung = Math.max(0, -links);
    const rahmen = rahmenBreiteVon(flaeche);
    const x = (v: number) => 28 + v / Math.max(1, rahmen) * 174;
    const y = (v: number) => 27 + v / Math.max(1, flaeche.hoeheM) * 64;
    const umriss = umrissVon(flaeche) ?? [[0, 0], [b, 0], [b, flaeche.hoeheM], [0, flaeche.hoeheM]];
    const farbe = (kante: string) => aktiv === kante ? '#b83d1e' : '#64717a';
    return <figure data-massskizze style={{margin:'4px 0 8px'}}>
      <svg viewBox="0 0 260 126" width="100%" height="126" role="img" aria-label={frei ? 'Markierter Dachrand: gesamte Breite und Tiefe auf der Dachfläche' : oben === 0 ? 'Dach mit Spitze: Breite unten und Länge auf der Dachfläche' : 'Dachmaße: Breite unten, Breite oben und Länge auf der Dachfläche'}>
        <path data-dachumriss d={`${umriss.map(([px,py],i) => `${i === 0 ? 'M' : 'L'}${x(px)} ${y(py)}`).join(' ')} Z`} fill="#edf0e4" stroke="#64717a" />
        <path data-kante="unten" d={`M${x(frei ? 0 : verschiebung)} 91 H${x(frei ? rahmen : verschiebung+b)}`} stroke={farbe('unten')} strokeWidth={aktiv==='unten'?4:2} />
        {!frei && (oben === 0 ? <circle data-kante="oben" cx={x(links+verschiebung)} cy="27" r={aktiv==='oben'?4:3} fill={farbe('oben')} /> : <path data-kante="oben" d={`M${x(links+verschiebung)} 27 H${x(links+verschiebung+oben)}`} stroke={farbe('oben')} strokeWidth={aktiv==='oben'?4:2} />)}
        <path data-kante="laenge" d="M221 28 V90 M217 28 H225 M217 90 H225" stroke={farbe('laenge')} strokeWidth={aktiv==='laenge'?3:1.5} />
        <text x="115" y="17" textAnchor="middle" fontSize="13" fill={farbe('oben')}>{frei ? 'Markierter Dachrand' : oben === 0 ? 'Dachspitze · oben 0 m' : 'Breite oben'}</text>
        <text x="115" y="113" textAnchor="middle" fontSize="13" fill={farbe('unten')}>{frei ? 'Gesamtbreite' : 'Breite unten'}</text>
        <text x="236" y="59" transform="rotate(-90 236 59)" textAnchor="middle" fontSize="12" fill={farbe('laenge')}>{frei ? 'Tiefe' : 'Länge'}</text>
      </svg>
      <figcaption style={{fontSize:12,color:'#52616b'}}>Auf dem Dach messen, nicht im Foto. Skizze zur Orientierung.</figcaption>
    </figure>;
  }
  return <figure style={{ margin: '8px 0 12px' }}>
    <svg viewBox="0 0 260 100" width="100%" height="100" role="img" aria-label={ecken ? 'Vier Eckpunkte am umschließenden Dachrechteck, zusätzlicher Dachumriss gestrichelt' : 'Maßskizze: Traufe entlang der unteren Dachkante, Sparrenlänge auf der Dachfläche nach oben'}>
      <path d="M35 65 L185 65 L215 12 L65 12 Z" fill="#e5e8e9" stroke="#52616b" strokeWidth="1.5" />
      {ecken ? <>
        <path d="M35 65 L185 65 L215 12 L120 12 L106 37 L51 37 Z" fill="none" stroke="#52616b" strokeWidth="2" strokeDasharray="4 3" />
        {[[35,65],[185,65],[215,12],[65,12]].map(([x,y],i) => <g key={i}><circle cx={x} cy={y} r="5" fill="#b83d1e" /><text x={x} y={y + (y === 12 ? 20 : 23)} textAnchor="middle" fontSize="13" fill="#263238">{i+1}</text></g>)}
      </> : <>
        <path d="M35 65 H185 M185 65 L215 12" fill="none" stroke="#b83d1e" strokeWidth="3" />
        <text x="105" y="88" textAnchor="middle" fontSize="14" fill="#263238">Traufe / Breite</text>
        <text x="155" y="39" textAnchor="middle" fontSize="13" fill="#263238">Sparrenlänge</text>
      </>}
    </svg>
    <figcaption style={{ fontSize: 13, lineHeight: 1.4, color: '#52616b' }}>{ecken ? 'Vier Eckpunkte bestimmen die Lage. Zusätzliche Dachecken danach mit „Umriss“ markieren.' : 'Auf der Dachfläche messen, nicht im Foto.'}</figcaption>
  </figure>;
}
