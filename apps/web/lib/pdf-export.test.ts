// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { modulById, neuesProjekt, vollFeldFuer, type Projekt } from './model';
import {
  baueBelegungsPdf,
  istIosWebviewBrowser,
  pdfDownloadFuerBrowser,
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

describe('Vorbereiteter PDF-Download', () => {
  it('erkennt Chrome, Google-App, Firefox und Edge auf iOS', () => {
    expect(istIosWebviewBrowser('Mozilla/5.0 CriOS/140.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 GSA/384.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 FxiOS/142.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 EdgiOS/140.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 Version/18.0 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('erstellt für normale Browser einen aufräumbaren Dateilink', () => {
    const arrayBuffer = new ArrayBuffer(3);
    const doc = { output: vi.fn(() => arrayBuffer) } as unknown as import('jspdf').jsPDF;
    const createObjectURL = vi.fn(() => 'blob:pdf-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const download = pdfDownloadFuerBrowser(doc, 'belegungsplan.pdf', 'Mozilla/5.0 Safari/605.1.15');

    expect(doc.output).toHaveBeenCalledWith('arraybuffer');
    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ name: 'belegungsplan.pdf' }));
    expect(download).toMatchObject({ href: 'blob:pdf-test', dateiname: 'belegungsplan.pdf' });
    download.aufraeumen();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf-test');
  });

  it('erstellt für Chrome auf iOS einen selbstenthaltenen Dateilink', () => {
    const dataUrl = 'data:application/pdf;filename=plan.pdf;base64,JVBERi0=';
    const doc = { output: vi.fn(() => dataUrl) } as unknown as import('jspdf').jsPDF;

    const download = pdfDownloadFuerBrowser(
      doc,
      'plan.pdf',
      'Mozilla/5.0 (iPad) CriOS/140.0 Mobile/15E148',
    );

    expect(doc.output).toHaveBeenCalledWith('datauristring', { filename: 'plan.pdf' });
    expect(download).toMatchObject({ href: dataUrl, dateiname: 'plan.pdf' });
  });
});
