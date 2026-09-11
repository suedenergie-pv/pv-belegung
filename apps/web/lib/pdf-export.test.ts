// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { modulById, neuesProjekt, vollFeldFuer, type Projekt } from './model';
import {
  baueBelegungsPdf,
  istAppleMobilgeraet,
  speichereBelegungsPdf,
  type PdfAusgabeVorbereitung,
} from './pdf-export';

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

afterEach(() => vi.unstubAllGlobals());

describe('PDF-Generator', () => {
  it('sperrt einen vollständig leeren 0-kWp-Plan', async () => {
    const projekt = neuesProjekt();
    await expect(baueBelegungsPdf(projekt, null, () => null, optionen)).rejects.toThrow(
      'PDF gesperrt: Mindestens ein aktives Modul muss belegt sein.',
    );
  });

  it('meldet ein fehlendes erwartetes SVG sichtbar als Exportfehler', async () => {
    await expect(
      baueBelegungsPdf(projektMitFlaechen(), null, () => null, optionen),
    ).rejects.toThrow('Exportbild für „Dachfoto“ fehlt');
  });

  it('erzeugt einen nackten PDF-Plan ohne Projektstammdaten', async () => {
    const projekt = projektMitFlaechen();
    projekt.kunde = '';
    projekt.adresse = '';
    projekt.erfasser = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    const { doc, dateiname } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const inhalt = ((doc as unknown as { internal: { pages: string[][] } }).internal.pages)
      .flat(2)
      .join('\n');
    expect(dateiname).toMatch(/^belegungsplan-projekt-\d+,\d{2}-kwp\.pdf$/);
    expect(inhalt).not.toContain('Kunde:');
    expect(inhalt).not.toContain('Adresse:');
    expect(inhalt).not.toContain('Erfasser:');
    expect(inhalt).toContain('Datum: 27.08.2026');
    expect(inhalt).toContain('A - Dachfläche 1');
    expect(inhalt).not.toContain('A · Dachfläche 1');
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

describe('PDF-Ausgabe auf Apple-Mobilgeräten', () => {
  it('erkennt iPadOS auch mit Desktop-Kennung', () => {
    expect(istAppleMobilgeraet({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })).toBe(true);
    expect(istAppleMobilgeraet({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    })).toBe(false);
  });

  it('behält auf Desktop den direkten jsPDF-Download bei', () => {
    const doc = { save: vi.fn() } as unknown as import('jspdf').jsPDF;
    speichereBelegungsPdf(doc, 'plan.pdf');
    expect(doc.save).toHaveBeenCalledWith('plan.pdf');
  });

  it('öffnet das fertige PDF auf dem bereits reservierten iPad-Tab', () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const doc = { output: vi.fn(() => blob), save: vi.fn() } as unknown as import('jspdf').jsPDF;
    const replace = vi.fn();
    const fenster = {
      closed: false,
      location: { replace },
    } as unknown as Window;
    const ausgabe: PdfAusgabeVorbereitung = { appleMobil: true, fenster };
    const createObjectURL = vi.fn(() => 'blob:pdf-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));

    speichereBelegungsPdf(doc, 'belegungsplan.pdf', ausgabe);

    expect(doc.output).toHaveBeenCalledWith('blob');
    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ name: 'belegungsplan.pdf' }));
    expect(replace).toHaveBeenCalledWith('blob:pdf-test');
    expect(doc.save).not.toHaveBeenCalled();
  });
});
