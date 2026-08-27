// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { modulById, neuesProjekt, vollFeldFuer, type Projekt } from './model';
import { baueBelegungsPdf } from './pdf-export';

function projektMitFlaechen(anzahl = 1): Projekt {
  const projekt = neuesProjekt();
  projekt.kunde = 'PDF Test';
  projekt.adresse = 'Musterweg 1';
  projekt.erfasser = 'Test Vertrieb';
  projekt.fotos = [{
    id: 'foto-1',
    name: 'Dachfoto',
    dataUrl: 'data:image/jpeg;base64,eA==',
    breitePx: 100,
    hoehePx: 80,
  }];
  const vorlage = projekt.flaechen[0]!;
  projekt.flaechen = Array.from({ length: anzahl }, (_, index) => {
    const flaeche = structuredClone(vorlage);
    flaeche.name = `Dachfläche ${index + 1}`;
    flaeche.felder = [vollFeldFuer(flaeche, modulById(projekt.modulId))];
    flaeche.fotoZuordnungen = [{
      fotoId: 'foto-1',
      traufePx: null,
      eckenPx: [[0, 80], [100, 80], [100, 0], [0, 0]],
      perspektiveBestaetigt: true,
      markierungFertig: true,
    }];
    return flaeche;
  });
  return projekt;
}

const optionen = {
  ladeLogo: async () => null,
  rastereSvg: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,eA==',
    seitenverhaeltnis: 0.8,
  })),
  jetzt: new Date('2026-08-27T12:00:00Z'),
};

describe('PDF-Generator', () => {
  it('sperrt einen vollständig leeren 0-kWp-Plan', async () => {
    const projekt = neuesProjekt();
    projekt.kunde = 'PDF Test';
    projekt.adresse = 'Musterweg 1';
    projekt.erfasser = 'Test Vertrieb';
    await expect(baueBelegungsPdf(projekt, null, () => null, optionen)).rejects.toThrow('PDF gesperrt');
  });

  it('meldet ein fehlendes erwartetes SVG sichtbar als Exportfehler', async () => {
    await expect(
      baueBelegungsPdf(projektMitFlaechen(), null, () => null, optionen),
    ).rejects.toThrow('Exportbild für „Dachfoto“ fehlt');
  });

  it('erzeugt viele Flächen über mehrere Seiten und wiederholt den Tabellenkopf', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projektMitFlaechen(42), null, () => svg, optionen);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const inhalt = ((doc as unknown as { internal: { pages: string[][] } }).internal.pages)
      .flat(2)
      .join('\n');
    expect(inhalt).toContain('Flächenübersicht \\(Fortsetzung\\)');
    expect(inhalt).toContain('Belegungsübersicht');
  });
});
