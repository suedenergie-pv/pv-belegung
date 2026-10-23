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
    flaeche.massStatus = 'bestaetigt';
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
  registriereSchrift: async () => 'helvetica',
  ladeLogo: async () => null,
  rastereSvg: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,eA==',
    seitenverhaeltnis: 0.8,
  })),
  jetzt: new Date('2026-08-27T12:00:00Z'),
};

afterEach(() => vi.unstubAllGlobals());

describe('PDF-Generator', () => {
  it('trennt bei gedrehten Flachdachfeldern Grundraster, Feldwinkel und Gestellneigung', async () => {
    const projekt = projektMitFlaechen();
    Object.assign(projekt.flaechen[0]!, { art: 'flachdach', neigungDeg: 0,
      flachdach: { aufstaenderung: 'ostwest', winkelDeg: 10 },
      felder: [{ xM: 2, yM: 2, breiteM: 4, hoeheM: 3, quer: true, drehungDeg: 15 }],
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const inhalt = ((doc as unknown as { internal: { pages: string[][] } }).internal.pages).flat(2).join('\n');
    expect(inhalt).toContain('Grundraster'); expect(inhalt).toContain('Felder:'); expect(inhalt).toContain('15');
    expect(inhalt).toContain('10'); expect(inhalt).toContain('Gestell');
  });
  it('sperrt belegte Fotos mit unbestätigten Maßen auch beim direkten Generatoraufruf', async () => {
    const projekt = projektMitFlaechen();
    projekt.flaechen[0]!.massStatus = 'offen';
    const rastereSvg = vi.fn();
    await expect(baueBelegungsPdf(projekt, null, () => null, { ...optionen, rastereSvg })).rejects.toThrow(
      'Maße vor dem Belegen prüfen und ausdrücklich übernehmen',
    );
    expect(rastereSvg).not.toHaveBeenCalled();
  });

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
    expect(inhalt).toContain('SüdEnergie');
    expect(inhalt).toContain('suedenergie-pv.de');
    expect(inhalt).not.toContain('LCV');
    expect(inhalt).not.toContain('Kunde:');
    expect(inhalt).not.toContain('Adresse:');
    expect(inhalt).not.toContain('Erfasser:');
    expect(inhalt).toContain('Datum: 27.08.2026');
    expect(inhalt).toContain('A - Dachfläche 1');
    expect(inhalt).not.toContain('A · Dachfläche 1');
  });

  it('erzeugt viele Flächen über mehrere Seiten mit nachvollziehbarer Fortsetzung', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projektMitFlaechen(60), null, () => svg, optionen);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const inhalt = ((doc as unknown as { internal: { pages: string[][] } }).internal.pages)
      .flat(2)
      .join('\n');
    expect(inhalt).toContain('Dachflächen / Fortsetzung');
    expect(inhalt).toContain('Belegungsübersicht');
  });

  it.each([
    [1, 9 / 16],
    [2, 9 / 16],
    [3, 3 / 4],
    [4, 9 / 16],
    [5, 3 / 2],
    [6, 9 / 16],
  ])('ordnet %i Fotos ohne Beschnitt auf eigenen Bildseiten an', async (anzahl, verhaeltnis) => {
    const projekt = projektMitFlaechen();
    projekt.fotos = Array.from({ length: anzahl }, (_, i) => ({
      ...projekt.fotos[0]!, id: `foto-${i + 1}`, name: `Drohnenfoto ${i + 1}`,
    }));
    projekt.flaechen[0]!.fotoZuordnungen = projekt.fotos.map((foto) => ({
      ...projekt.flaechen[0]!.fotoZuordnungen![0]!, fotoId: foto.id,
    }));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, {
      ...optionen,
      rastereSvg: async () => ({ dataUrl: 'data:image/jpeg;base64,eA==', seitenverhaeltnis: verhaeltnis }),
    });
    const seiten = (doc as unknown as { internal: { pages: string[][] } }).internal.pages
      .slice(1).map((seite) => seite.join('\n'));
    expect(seiten).toHaveLength(anzahl + (anzahl > 1 ? 1 : 0));
    expect(seiten[0]).toContain(anzahl > 1 ? 'Perspektive' : 'Belegungsübersicht');
    expect(seiten[0]).toMatch(/\/I\d+ Do/);
    expect(seiten.join('\n')).toContain('PDF Test');
    expect(seiten.join('\n')).toContain('Musterweg 1');
    expect(seiten.join('\n')).not.toContain('1 Dachflächen');

    // Mehrere Ansichten erhalten eigene, passend ausgerichtete Bildseiten;
    // die Anlagendaten stehen auf einer separaten A4-Hochformatseite.
    for (const [index, seite] of seiten.slice(0, anzahl).entries()) {
      doc.setPage(index + 1);
      const seitenH = doc.internal.pageSize.getHeight();
      const seitenB = doc.internal.pageSize.getWidth();
      // Die tatsächlichen PDF-Bildmatrizen prüfen (Punkte, Ursprung unten links).
      const bilder = [...seite.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s+\/I\d+ Do/g)]
        .map((treffer) => {
          const [b, h, x, unten] = treffer.slice(1).map((wert) => Number(wert) * 25.4 / 72);
          return { b: b!, h: h!, x: x!, y: seitenH - unten! - h! };
        });
      expect(bilder).toHaveLength(1);
      expect(seite).toContain(anzahl > 1 ? 'Perspektive' : 'Belegungsübersicht');
      if (anzahl > 1) expect(seite).toContain(`${index + 1} von ${anzahl}`);
      for (const [bildIndex, bild] of bilder.entries()) {
        if (anzahl === 1) expect(seite).toContain(`Drohnenfoto ${index + 1}`);
        expect(bild.h / bild.b).toBeCloseTo(verhaeltnis, 5);
        // Das erste Hochformatbild teilt sich die Seite mit einer Datenspalte.
        // jsPDF rundet das A4-MediaBox-Maß bei der Umrechnung aus Punkten.
        const mitte = anzahl === 1 && verhaeltnis > 1.1 ? 68
          : anzahl > 1 && verhaeltnis <= 0.73 ? (76 + seitenB - 16) / 2 : seitenB / 2;
        expect(bild.x + bild.b / 2).toBeCloseTo(mitte, 2);
        expect(bild.y).toBeGreaterThanOrEqual(anzahl > 1 && verhaeltnis <= 0.73 ? 29.99 : 33.9);
        expect(bild.y + bild.h).toBeLessThanOrEqual(seitenH - (anzahl > 1 ? 19.99 : 25));
        if (anzahl > 1 && verhaeltnis <= 9 / 16) {
          expect(seitenB).toBeGreaterThan(seitenH);
          expect(bild.b).toBeGreaterThan(200);
        }
        if (verhaeltnis <= 9 / 16) expect(bild.b).toBeGreaterThanOrEqual(160);
        if (verhaeltnis === 3 / 4) expect(bild.b).toBeGreaterThanOrEqual(115);
        if (bildIndex > 0) expect(bild.y).toBeGreaterThan(bilder[bildIndex - 1]!.y + bilder[bildIndex - 1]!.h);
      }
    }
    if (anzahl > 1) {
      const datenSeite = seiten.at(-1)!;
      expect(datenSeite).toContain('Anlagendaten');
      expect(datenSeite).toContain('Ansichten im Überblick');
      expect(datenSeite).toContain('Ansicht 1 / Seite 1');
      doc.setPage(doc.getNumberOfPages());
      expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(doc.internal.pageSize.getWidth());
    }
  });

  it.each([1, 2])('erhält bei %i Fotos alle Angaben mit mindestens 12 pt und ohne wiederholten Fußblock', async (anzahlFotos) => {
    const projekt = projektMitFlaechen();
    if (anzahlFotos > 1) {
      projekt.fotos.push({ ...projekt.fotos[0]!, id: 'foto-2', name: 'Andere Perspektive' });
      projekt.flaechen[0]!.fotoZuordnungen!.push({ ...projekt.flaechen[0]!.fotoZuordnungen![0]!, fotoId: 'foto-2' });
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const seiten = (doc as unknown as { internal: { pages: string[][] } }).internal.pages.slice(1).map(page => page.join('\n'));
    for (const [index, seite] of seiten.slice(0, anzahlFotos).entries()) {
      for (const angabe of ['Belegungsplan', 'PDF Test', 'Musterweg 1', 'Datum: 27.08.2026',
        '27.08.2026', 'Module', 'kWp', anzahlFotos > 1 ? 'Dachfläche A' : 'Dachflächen A',
        ...(anzahlFotos > 1 ? ['Perspektive', `${index + 1} von 2`, index === 0 ? 'Foto: Dachfoto' : 'Foto: Andere Perspektive'] : ['Dachfoto'])]) {
        expect(seite).toContain(angabe);
      }
      if (anzahlFotos > 1) {
        expect(seite).not.toContain('Vorplanung, keine Fachplanung');
        expect(seite).not.toContain('Beratung:');
      }
    }
    for (const seite of seiten) {
      const groessen = [...seite.matchAll(/\/F\d+\s+([\d.]+)\s+Tf/g)].map(match => Number(match[1]));
      expect(groessen.length).toBeGreaterThan(0);
      expect(Math.min(...groessen)).toBeGreaterThanOrEqual(12);
    }
    expect(seiten.join('\n').match(/Vorplanung, keine Fachplanung/g)).toHaveLength(1);
    expect(seiten.at(-1)).toContain('Beratung: Test Vertrieb');
    expect(seiten.at(-1)).toContain('suedenergie-pv.de');
  });

  it('richtet gemischte Dachfotos einzeln aus und erhält einen Anhang in Hochformat', async () => {
    const projekt = projektMitFlaechen();
    projekt.fotos.push({ ...projekt.fotos[0]!, id: 'foto-2', name: 'Hochformat' });
    projekt.flaechen[0]!.fotoZuordnungen!.push({ ...projekt.flaechen[0]!.fotoZuordnungen![0]!, fotoId: 'foto-2' });
    const querSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const hochSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, id => id === 'foto-1' ? querSvg : hochSvg, {
      ...optionen,
      rastereSvg: async svg => ({ dataUrl: 'data:image/jpeg;base64,eA==', seitenverhaeltnis: svg === querSvg ? 9 / 16 : 1.5 }),
    });
    expect(doc.getNumberOfPages()).toBe(3);
    doc.setPage(1);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    doc.setPage(2);
    expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(doc.internal.pageSize.getWidth());
    doc.setPage(3);
    expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(doc.internal.pageSize.getWidth());
  });

  it('bettet die Original-Markenschrift für durchsuchbare PDF-Texte ein', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projektMitFlaechen(), null, () => svg, { ...optionen, registriereSchrift: undefined });
    expect(doc.getFontList()['Inter']).toEqual(['normal', 'bold']);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(20_000);
  });

  it.each([1, 2])('erhält lange Projekt-, Flächen- und Bildnamen bei %i Fotos vollständig innerhalb der Druckränder', async (fotoAnzahl) => {
    const projekt = projektMitFlaechen(3);
    projekt.kunde = 'Sehr langer Kundenname '.repeat(140) + 'KUNDENENDE';
    projekt.adresse = 'Eine lange Adresse '.repeat(60) + 'ADRESSENENDE';
    projekt.erfasser = 'Ausführlicher Beratername '.repeat(50) + 'BERATERENDE';
    projekt.flaechen[0]!.name = 'Dachfläche mit langem Namen '.repeat(140) + 'FLAECHENENDE';
    projekt.fotos[0]!.name = 'Lange Bildbeschreibung '.repeat(90) + 'BILDENDE';
    if (fotoAnzahl > 1) {
      projekt.fotos.push({ ...projekt.fotos[0]!, id: 'foto-2' });
      projekt.flaechen[0]!.fotoZuordnungen!.push({ ...projekt.flaechen[0]!.fotoZuordnungen![0]!, fotoId: 'foto-2' });
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const seiten = (doc as unknown as { internal: { pages: string[][] } }).internal.pages.slice(1);
    const inhalt = seiten.flat(2).join('\n');
    for (const ende of ['KUNDENENDE', 'ADRESSENENDE', 'BERATERENDE', 'FLAECHENENDE', 'BILDENDE']) expect(inhalt).toContain(ende);
    for (const [index, seite] of seiten.entries()) {
      doc.setPage(index + 1);
      const seitenH = doc.internal.pageSize.getHeight();
      for (const treffer of seite.join('\n').matchAll(/([\d.]+) ([\d.]+) Td/g)) {
        const y = seitenH - Number(treffer[2]) * 25.4 / 72;
        expect(y).toBeGreaterThanOrEqual(12);
        expect(y).toBeLessThanOrEqual(seitenH - 6.99);
      }
    }
  });

  it.each([1, 35, 42])('hält Überschrift und Einzelbild bei %i Flächen zusammen', async (anzahl) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projektMitFlaechen(anzahl), null, () => svg, optionen);
    const seiten = (doc as unknown as { internal: { pages: string[][] } }).internal.pages
      .slice(1).map((seite) => seite.join('\n'));
    if (anzahl === 1) expect(seiten).toHaveLength(1);
    expect(seiten[0]).toMatch(/\/I\d+ Do/);
    expect(seiten.filter((seite) => /\/I\d+ Do/.test(seite))).toHaveLength(1);
    for (const seite of seiten) {
      expect(seite.includes('Belegungsübersicht')).toBe(/\/I\d+ Do/.test(seite));
    }
  });
});

describe('Vorbereiteter PDF-Download', () => {
  it('übergibt auf iOS eine fertige PDF-Datei erst beim Antippen an den nativen Dialog', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\nTest');
    const doc = { output: vi.fn((format) => format === 'arraybuffer' ? bytes.buffer : 'data:application/pdf;base64,JVBERi0=') } as unknown as import('jspdf').jsPDF;
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);
    vi.stubGlobal('navigator', { share, canShare });
    const download = pdfDownloadFuerBrowser(doc, 'plan.pdf', 'iPhone');
    expect(share).not.toHaveBeenCalled();
    expect(download.teilen).toBeTypeOf('function');
    await download.teilen!();
    const datei = share.mock.calls[0]![0].files[0] as File;
    expect(datei.name).toBe('plan.pdf');
    expect(datei.type).toBe('application/pdf');
    expect(datei.size).toBe(bytes.length);
    expect(canShare).toHaveBeenCalledWith({ files: [datei] });
  });

  it.each([false, 'throw'])('behält den Dateilink bei nicht verfügbarem Dateiteilen (%s)', (faehigkeit) => {
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: () => { if (faehigkeit === 'throw') throw new Error('gesperrt'); return false; },
    });
    const doc = { output: vi.fn(() => new ArrayBuffer(3)) } as unknown as import('jspdf').jsPDF;
    expect(pdfDownloadFuerBrowser(doc, 'plan.pdf', 'iPhone').teilen).toBeUndefined();
  });
  it('erkennt Safari, Chrome, Google-App, Firefox und Edge auf iOS', () => {
    expect(istIosWebviewBrowser('Mozilla/5.0 CriOS/140.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 GSA/384.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 FxiOS/142.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 EdgiOS/140.0 Mobile/15E148')).toBe(true);
    expect(istIosWebviewBrowser('Mozilla/5.0 (iPad) Version/18.0 Mobile/15E148 Safari/604.1')).toBe(true);
    expect(
      istIosWebviewBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15',
        'MacIntel',
        5,
      ),
    ).toBe(true);
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

  it('erstellt auch für Safari auf iOS ohne Blob-URL einen selbstenthaltenen Dateilink', () => {
    const dataUrl = 'data:application/pdf;filename=plan.pdf;base64,JVBERi0=';
    const doc = { output: vi.fn(() => dataUrl) } as unknown as import('jspdf').jsPDF;
    const createObjectURL = vi.fn(() => {
      throw new Error('Blob-URL darf auf iOS nicht verwendet werden');
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });

    const download = pdfDownloadFuerBrowser(
      doc,
      'plan.pdf',
      'Mozilla/5.0 (iPad) Version/18.0 Mobile/15E148 Safari/604.1',
    );

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(download).toMatchObject({ href: dataUrl, dateiname: 'plan.pdf' });
  });
});
