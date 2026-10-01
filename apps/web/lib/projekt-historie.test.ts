import { describe, expect, it } from 'vitest';
import { neuesProjekt, type Projekt } from './model';
import { ProjektHistorien } from './projekt-historie';

describe('Projektweite Sitzungshistorie', () => {
  it('hält genau die letzten 20 abgeschlossenen Änderungen', () => {
    const historie = new ProjektHistorien();
    let stand = neuesProjekt();
    for (let i = 1; i <= 25; i++) {
      const neu = { ...stand, kunde: `Kunde ${i}` };
      historie.record('a', stand, neu);
      stand = neu;
    }
    expect(historie.status('a')).toEqual({ undoCount: 20, redoCount: 0 });
    for (let i = 0; i < 20; i++) stand = historie.undo('a', stand)!;
    expect(stand.kunde).toBe('Kunde 5');
    expect(historie.undo('a', stand)).toBeUndefined();
  });

  it('fasst eine gehaltene Bewegung und eine abgeschlossene Eingabe jeweils zusammen', () => {
    const historie = new ProjektHistorien();
    const basis = neuesProjekt();
    let stand = basis;
    historie.begin('a', 'halten');
    for (let i = 1; i <= 32; i++) {
      const neu = { ...stand, kunde: `Wert ${i}` };
      historie.record('a', stand, neu);
      stand = neu;
    }
    historie.end('a', 'halten');
    expect(historie.status('a').undoCount).toBe(1);
    expect(historie.undo('a', stand)).toBe(basis);
    expect(historie.redo('a', basis)).toBe(stand);
  });

  it('hält Projektverläufe getrennt und verwirft den Redo-Zweig nur bei neuer Änderung', () => {
    const historie = new ProjektHistorien();
    const a = neuesProjekt();
    const b = neuesProjekt();
    const a1 = { ...a, kunde: 'A' };
    const b1 = { ...b, kunde: 'B' };
    historie.record('a', a, a1);
    historie.record('b', b, b1);
    expect(historie.undo('a', a1)).toBe(a);
    historie.begin('a', 'eingabe');
    historie.record('a', a, { ...a }); // no actual edit
    historie.end('a');
    expect(historie.status('a').redoCount).toBe(1);
    historie.record('a', a, { ...a, kunde: 'C' });
    expect(historie.status('a').redoCount).toBe(0);
    expect(historie.undo('b', b1)).toBe(b);
  });

  it('stellt Fotoersatz, Zuordnungen, Gauben und Modulwahl als vollständige Stände wieder her', () => {
    const historie = new ProjektHistorien();
    const basis: Projekt = {
      ...neuesProjekt(),
      fotos: [{ id: 'foto', name: 'Original', dataUrl: 'data:image/jpeg;base64,ALT', breitePx: 1000, hoehePx: 600 }],
    };
    const neu: Projekt = {
      ...basis,
      modulId: 'anderes-modul',
      fotos: [{ ...basis.fotos[0]!, dataUrl: 'data:image/jpeg;base64,NEU' }],
      flaechen: [{ ...basis.flaechen[0]!, fotoZuordnungen: [{ fotoId: 'foto', traufePx: null }] },
        { ...basis.flaechen[0]!, id: 'gaube', gaubenTyp: 'flachdach', elternFlaecheId: 'p1' }],
    };
    historie.record('a', basis, neu);
    const zurueck = historie.undo('a', neu)!;
    expect(zurueck).toBe(basis);
    expect(zurueck.fotos[0]).toBe(basis.fotos[0]);
    expect(historie.redo('a', zurueck)).toBe(neu);
  });

  it('erzeugt für abgebrochene oder wirkungslose Gesten keine Einträge', () => {
    const historie = new ProjektHistorien();
    const basis = neuesProjekt();
    const entwurf = { ...basis, kunde: 'Entwurf' };
    historie.begin('a', 'eingabe');
    historie.record('a', basis, entwurf);
    historie.record('a', entwurf, basis);
    historie.end('a');
    expect(historie.status('a').undoCount).toBe(0);
  });
});
