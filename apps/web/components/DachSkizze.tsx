/** Orientierungshilfe, keine maßstäbliche Vorschau. */
export function DachSkizze({ ecken = false }: { ecken?: boolean }) {
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
