import { describe, expect, it } from 'vitest';
import { berechneFelderRaster, type BelegungsFeldM, type FelderInput } from '../src/belegung';
import { rechteckImUmriss, rechteckeUeberlappen, type RechteckM } from '../src/geometrie';
import { JOLYWOOD_JW_HD96N_R2_460 } from '../src/catalog/modules';

/**
 * Invariante gegen „Lücken trotz Platz" (Genrih 16.07.2026: „beim Verschieben kommen
 * manchmal noch so Lücken, obwohl Module eigentlich reinpassen"). Geprüft wird nicht
 * eine feste Zahl, sondern die Regel: Innerhalb eines Feld-Rasters darf keine Zelle
 * frei bleiben, an der ein Modul gültig läge.
 *
 * Die Ursache lag damals NICHT hier, sondern im UI-Resize (die linke/obere Feldkante
 * verschob das ganze Raster) — diese Tests halten die Engine-Seite dauerhaft sauber.
 */
const M = JOLYWOOD_JW_HD96N_R2_460;
const W = 1.762;
const H = 1.134;
const FUGE = 0.02;

/** Passt an (x,y) ein Modul, ohne Zone zu verletzen oder ein anderes zu treffen? */
function passtHier(
  input: FelderInput,
  belegt: readonly { xM: number; yM: number; wM: number; hM: number }[],
  xM: number,
  yM: number,
  w: number,
  h: number,
): boolean {
  const rand = input.randM ?? 0.05;
  const rect: RechteckM = { xM, yM, breiteM: w, hoeheM: h };
  if (xM < rand - 1e-9 || yM < rand - 1e-9) return false;
  if (xM + w > input.breiteM - rand + 1e-9) return false;
  if (yM + h > input.hoeheM - rand + 1e-9) return false;
  if (input.umrissM && !rechteckImUmriss(rect, input.umrissM, rand)) return false;
  if ((input.hindernisseM ?? []).some((o) => rechteckeUeberlappen(rect, o))) return false;
  return !belegt.some((q) =>
    rechteckeUeberlappen(rect, { xM: q.xM, yM: q.yM, breiteM: q.wM, hoeheM: q.hM }),
  );
}

/** Zellen, die frei blieben, obwohl dort ein Modul läge. */
function luecken(input: FelderInput, felder: BelegungsFeldM[]): string[] {
  const belegt = berechneFelderRaster(input, felder).positionen;
  const fund: string[] = [];
  felder.forEach((feld, fi) => {
    const w = feld.quer ? W : H;
    const h = feld.quer ? H : W;
    const cols = Math.floor((feld.breiteM + FUGE + 1e-9) / (w + FUGE));
    const rows = Math.floor((feld.hoeheM + FUGE + 1e-9) / (h + FUGE));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (feld.leer?.includes(`${row}-${col}`)) continue; // bewusst abgeschaltet
        const xM = feld.xM + col * (w + FUGE);
        const yM = feld.yM + row * (h + FUGE);
        const liegtDa = belegt.some((p) => Math.abs(p.xM - xM) < 1e-6 && Math.abs(p.yM - yM) < 1e-6);
        if (!liegtDa && passtHier(input, belegt, xM, yM, w, h)) {
          fund.push(`Feld${fi} Zelle ${row}-${col} @ ${xM.toFixed(2)}/${yM.toFixed(2)}`);
        }
      }
    }
  });
  return fund;
}

describe('Keine Lücken trotz Platz (16.07.2026)', () => {
  it('ein Feld über 200 Verschiebe-Positionen: nie eine Lücke, an der ein Modul läge', () => {
    const input: FelderInput = { breiteM: 13.74, hoeheM: 6, module: M };
    const fund: string[] = [];
    for (let i = 0; i < 200; i++) {
      fund.push(
        ...luecken(input, [
          {
            xM: Math.round((0.05 + i * 0.03) * 100) / 100,
            yM: Math.round((0.05 + (i % 17) * 0.05) * 100) / 100,
            breiteM: 8.89,
            hoeheM: 3.44,
            quer: true,
          },
        ]),
      );
    }
    expect(fund).toEqual([]);
  });

  it('Feld mit Umriss (schräge Kante): keine Lücke, an der ein Modul läge', () => {
    const input: FelderInput = {
      breiteM: 13.74,
      hoeheM: 6,
      module: M,
      umrissM: [[0, 0], [13.74, 0], [13.74, 4.5], [10, 6], [0, 6]],
    };
    expect(
      luecken(input, [{ xM: 0.05, yM: 0.05, breiteM: 12, hoeheM: 5.7, quer: true }]),
    ).toEqual([]);
  });

  it('Feld mit Hindernis (Dachfenster): keine Lücke, an der ein Modul läge', () => {
    const input: FelderInput = {
      breiteM: 13.74,
      hoeheM: 6,
      module: M,
      hindernisseM: [{ xM: 8.2, yM: 2.1, breiteM: 1.1, hoeheM: 1.4 }],
    };
    expect(
      luecken(input, [{ xM: 0.05, yM: 0.05, breiteM: 12, hoeheM: 5.7, quer: true }]),
    ).toEqual([]);
  });

  it('abgeschaltete Zellen bleiben leer — aber sonst nichts', () => {
    const input: FelderInput = { breiteM: 13.74, hoeheM: 6, module: M };
    const feld: BelegungsFeldM = {
      xM: 0.05,
      yM: 0.05,
      breiteM: 8.89,
      hoeheM: 3.44,
      quer: true,
      leer: ['0-2', '1-1'],
    };
    expect(luecken(input, [feld])).toEqual([]);
    // Gegenprobe: genau 2 Module weniger als ohne leer
    const { leer: _leer, ...ohneLeer } = feld;
    const ohne = berechneFelderRaster(input, [ohneLeer]).positionen.length;
    expect(berechneFelderRaster(input, [feld]).positionen.length).toBe(ohne - 2);
  });
});
