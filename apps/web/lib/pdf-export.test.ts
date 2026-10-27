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
  ladeLogo: async () => null,
  rastereSvg: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,eA==',
    seitenverhaeltnis: 0.8,
  })),
  jetzt: new Date('2026-08-27T12:00:00Z'),
};

afterEach(() => vi.unstubAllGlobals());

describe('PDF-Generator', () => {
  it.each([
    ['hoch', 'Hochkant'], ['quer', 'Querformat'],
  ] as const)('schreibt das Modulformat %s verständlich als %s aus', async (ausrichtung, label) => {
    const projekt = projektMitFlaechen();
    const f = projekt.flaechen[0]!;
    f.ausrichtung = ausrichtung;
    f.felder = [vollFeldFuer(f, modulById(projekt.modulId))];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const inhalt = (doc as unknown as { internal: { pages: string[][] } }).internal.pages.flat(2).join('\n');
    expect(inhalt).toContain(label);
    expect(inhalt).not.toContain(`\\(${ausrichtung}\\)`);
  });

  it('hält ausgeschriebene Mischformate innerhalb der Modulspalte und vergrößert die Tabellenzeile', async () => {
    const projekt = projektMitFlaechen(3);
    for (const f of projekt.flaechen) {
      f.felder = [
        { xM: 0.1, yM: 0.1, breiteM: 3, hoeheM: 5, quer: false },
        { xM: 4.5, yM: 0.1, breiteM: 4, hoeheM: 4, quer: true },
      ];
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const inhalt = (doc as unknown as { internal: { pages: string[][] } }).internal.pages.flat(2).join('\n');
    const zellen = [...inhalt.matchAll(/BT([\s\S]*?)ET/g)].map(t => t[1]!).filter(t => t.includes('Hochkant'));
    expect(zellen).toHaveLength(3);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const zeilen = zellen.map(zelle => {
      const position = zelle.match(/([\d.]+) ([\d.]+) Td/)!;
      const texte = [...zelle.matchAll(/\((.*)\) Tj/g)].map(t => t[1]!.replace(/\\([()\\])/g, '$1'));
      expect(texte.join(' ')).toMatch(/^\d+ \(Hochkant und Querformat\)$/);
      expect(texte.length).toBeGreaterThan(1);
      expect(Number(position[1]) * 25.4 / 72).toBeCloseTo(136, 5);
      for (const text of texte) expect(doc.getTextWidth(text)).toBeLessThanOrEqual(26);
      return { y: 297 - Number(position[2]) * 25.4 / 72, anzahl: texte.length };
    });
    for (let i = 1; i < zeilen.length; i++) {
      expect(zeilen[i]!.y - zeilen[i - 1]!.y).toBeGreaterThanOrEqual(zeilen[i - 1]!.anzahl * 3.5 - 0.01);
    }
  });

  it('zeigt beim Schrägdach nur die Himmelsrichtung, erhält aber die Dachneigung', async () => {
    const projekt = projektMitFlaechen();
    Object.assign(projekt.flaechen[0]!, { azimutDeg: 225, neigungDeg: 35 });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const inhalt = (doc as unknown as { internal: { pages: string[][] } }).internal.pages.flat(2).join('\n');
    expect(inhalt).toContain('(Süd-West)');
    expect(inhalt).toContain('(35°)');
    expect(inhalt).not.toContain('225°');
  });

  it.each(['sued', 'ostwest'] as const)('kennzeichnet nach Foto-Süden ausgerichtete %s-Felder ohne falsche Zusatzdrehung', async aufstaenderung => {
    const projekt = projektMitFlaechen();
    const f = projekt.flaechen[0]!;
    Object.assign(f, { art: 'flachdach', breiteM: 30, hoeheM: 30, neigungDeg: 0,
      flachdach: { aufstaenderung, winkelDeg: 25, pitchM: 4, richtungSued: 'unten', suedWinkelDeg: 237.5 },
    });
    f.felder = [vollFeldFuer(f, modulById(projekt.modulId))];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const inhalt = (doc as unknown as { internal: { pages: string[][] } }).internal.pages.flat(2).join('\n');
    expect(inhalt).toContain(aufstaenderung === 'sued' ? '(Süd)' : '(Ost / West)');
    expect(inhalt).toContain('25°');
    expect(inhalt).not.toContain('Felder:');
    expect(inhalt).not.toContain('Grundraster');
    expect(inhalt).not.toContain('unten');
    expect(inhalt).not.toContain('rechts');
  });

  it('beschreibt eigenständig gedrehte Montagefelder relativ zum festgelegten Süden', async () => {
    const projekt = projektMitFlaechen();
    Object.assign(projekt.flaechen[0]!, { art: 'flachdach', breiteM: 30, hoeheM: 30, neigungDeg: 0,
      flachdach: { aufstaenderung: 'sued', winkelDeg: 25, pitchM: 4, richtungSued: 'unten', suedWinkelDeg: 237.5 },
      felder: [{ xM: 10, yM: 10, breiteM: 8, hoeheM: 8, quer: true, drehungDeg: 72.5 }],
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projekt, null, () => svg, optionen);
    const inhalt = (doc as unknown as { internal: { pages: string[][] } }).internal.pages.flat(2).join('\n');
    expect(inhalt).toContain('(Grundraster Süd)');
    expect(inhalt).toContain('(Felder: 15°)');
    expect(inhalt).not.toContain('72,5°');
    expect(inhalt).not.toContain('237,5°');
  });

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
    expect(inhalt).not.toContain('Kunde:');
    expect(inhalt).not.toContain('Adresse:');
    expect(inhalt).not.toContain('Erfasser:');
    expect(inhalt).toContain('Datum: 27.08.2026');
    expect(inhalt).toContain('A - Dachfläche 1');
    expect(inhalt).not.toContain('A · Dachfläche 1');
  });

  it('erzeugt viele Flächen über mehrere Seiten und wiederholt den Tabellenkopf', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const { doc } = await baueBelegungsPdf(projektMitFlaechen(60), null, () => svg, optionen);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const inhalt = ((doc as unknown as { internal: { pages: string[][] } }).internal.pages)
      .flat(2)
      .join('\n');
    expect(inhalt).toContain('Flächenübersicht \\(Fortsetzung\\)');
    expect(inhalt).toContain('Belegungsübersicht');
  });

  it.each([
    [1, 9 / 16],
    [2, 9 / 16],
    [3, 3 / 4],
    [4, 9 / 16],
    [5, 3 / 2],
    [6, 9 / 16],
  ])('ordnet %i Fotos ohne Beschnitt mit höchstens zwei Bildern pro Seite an', async (anzahl, verhaeltnis) => {
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
    expect(seiten).toHaveLength(Math.ceil(anzahl / 2));
    expect(seiten[0]).toContain('Belegungsübersicht');
    expect(seiten[0]).toMatch(/\/I\d+ Do/);

    for (const [index, seite] of seiten.entries()) {
      // Die tatsächlichen PDF-Bildmatrizen prüfen (Punkte, Ursprung unten links).
      const bilder = [...seite.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s+\/I\d+ Do/g)]
        .map((treffer) => {
          const [b, h, x, unten] = treffer.slice(1).map((wert) => Number(wert) * 25.4 / 72);
          return { b: b!, h: h!, x: x!, y: 297 - unten! - h! };
        });
      expect(bilder).toHaveLength(Math.min(2, anzahl - index * 2));
      expect(seite).toContain('Belegungsübersicht');
      for (const [bildIndex, bild] of bilder.entries()) {
        expect(seite).toContain(`Drohnenfoto ${index * 2 + bildIndex + 1}`);
        expect(bild.h / bild.b).toBeCloseTo(verhaeltnis, 5);
        expect(bild.x + bild.b / 2).toBeCloseTo(105, 5);
        expect(bild.y).toBeGreaterThanOrEqual(33.9);
        expect(bild.y + bild.h).toBeLessThanOrEqual(277.1);
        if (verhaeltnis <= 9 / 16) expect(bild.b).toBeGreaterThanOrEqual(160);
        if (verhaeltnis === 3 / 4) expect(bild.b).toBeGreaterThanOrEqual(120);
        if (bildIndex > 0) expect(bild.y).toBeGreaterThan(bilder[bildIndex - 1]!.y + bilder[bildIndex - 1]!.h);
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
