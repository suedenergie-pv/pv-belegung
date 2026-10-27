import type { montageGeometrie } from '@pv-belegung/engine';

/** Kompositor: Meterkoordinaten aus der Engine, in beiden Achsen gleich skaliert. */
export function MontageVorschau({ geometrie: g, pitchM, ostwest, winkelDeg }: {
  geometrie: ReturnType<typeof montageGeometrie>; pitchM: number; ostwest: boolean; winkelDeg: number;
}) {
  if (!g.gueltig || !Number.isFinite(pitchM)) return null;
  const breite = pitchM + g.footprintM;
  const scale = Math.min(244 / breite, g.hoeheM > 0 ? 64 / g.hoeheM : Infinity);
  const x = (m: number) => 18 + (244 - breite * scale) / 2 + m * scale;
  const y = (m: number) => 78 - m * scale;
  const segmente = [0, 1].flatMap(tisch => [0, ...(ostwest ? [1] : [])].flatMap(seite =>
    Array.from({ length: g.n }, (_, i) => {
      const start = tisch * pitchM;
      const a = i * g.schrittM, b = a + g.modulTiefeM;
      const spiegel = (m: number) => seite ? start + g.footprintM - m : start + m;
      return { x1: x(spiegel(a)), y1: y(i * g.schrittHoeheM), x2: x(spiegel(b)), y2: y(i * g.schrittHoeheM + g.modulHoeheM) };
    })));
  const masslinie = (von: number, bis: number, h: number) => `M${x(von)} ${h - 4}V${h + 4}M${x(von)} ${h}H${x(bis)}M${x(bis)} ${h - 4}V${h + 4}`;
  return <svg viewBox="0 0 280 118" className="w-full" role="img"
    aria-label={`Seitenansicht ${ostwest ? 'Ost-West' : 'Süd'}: ${winkelDeg} Grad, ${g.n} ${g.n === 1 ? 'Modul' : 'Module'} je Seite. Grau: freie Gasse. Grün: Abstand Anfang zu Anfang.`}>
    <path d="M8 80H272" stroke="#c7ced3" />
    {segmente.map((s, i) => <g key={i}>
      <line {...s} stroke="#263238" strokeWidth="4" data-montage-modul="" />
      <circle cx={s.x1} cy={s.y1} r="1.5" fill="#f8fafc" />
      <circle cx={s.x2} cy={s.y2} r="1.5" fill="#f8fafc" />
    </g>)}
    <path d={masslinie(g.footprintM, pitchM, 92)} stroke="#64748b" strokeWidth="2" />
    <path d={masslinie(0, pitchM, 110)} stroke="#b83d1e" strokeWidth="2" />
  </svg>;
}
