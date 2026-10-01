import type { Ecken, Punkt } from './foto-geometrie';

const gleich = (a: Punkt, b: Punkt) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4;

/** Außenkanten beider Gaubenseiten: gemeinsame Firstkante fällt weg, Firstenden bleiben. */
export function gaubenFotoUmriss(aussen: Ecken, seiten?: { links: Ecken; rechts: Ecken }): Punkt[] {
  if (!seiten) return aussen.map(([x, y]) => [x, y]);
  const kanten = [seiten.links, seiten.rechts].flatMap((ecken) => ecken.map((p, i) => [p, ecken[(i + 1) % ecken.length]!] as [Punkt, Punkt]));
  const rand = kanten.filter(([a, b], i) => !kanten.some(([c, d], j) => i !== j && ((gleich(a, c) && gleich(b, d)) || (gleich(a, d) && gleich(b, c)))));
  const erste = rand.shift();
  if (!erste) return aussen.map(([x, y]) => [x, y]);
  const ring = [erste[0], erste[1]];
  while (rand.length) {
    const ende = ring[ring.length - 1]!;
    const index = rand.findIndex(([a, b]) => gleich(a, ende) || gleich(b, ende));
    if (index < 0) return aussen.map(([x, y]) => [x, y]);
    const [a, b] = rand.splice(index, 1)[0]!;
    const weiter = gleich(a, ende) ? b : a;
    if (gleich(weiter, ring[0]!)) break;
    ring.push(weiter);
  }
  return ring.map(([x, y]) => [x, y]);
}
