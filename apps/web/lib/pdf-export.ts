import type { StringPlanResult } from '@pv-belegung/engine';
import { logoPng } from './logo';
import {
  aktiveModule,
  ausrichtungenVon,
  downloadDateiname,
  flachdachOstRichtung,
  flachdachSuedRichtung,
  fertigeFotoFlaechen,
  flaecheM2,
  flaechenTitel,
  fmtDe,
  kwpGesamt,
  modulById,
  projektFreigabe,
  rasterFuer,
  wrById,
  zonenVon,
  type Projekt,
} from './model';

/**
 * PDF-Export des Belegungsplans (Hauptexport fürs Vertriebsgespräch, 06.07.2026):
 * Seite 1 = Zusammenfassung + Fotoübersicht aller Flächen. Die Foto-SVGs werden
 * per Canvas gerastert; kein Server, alles bleibt im Browser. Eine synthetische
 * Dach-Draufsicht wird nicht exportiert.
 * Der Stringplan ist bewusst NUR Zusatzinfo: gültig → eine Zeile, sonst weggelassen.
 */

/** Serialisiert ein gerendertes SVG und rastert es über ein Canvas zu JPEG. */
async function svgZuJpeg(
  svg: SVGSVGElement,
  zielBreitePx: number,
): Promise<{ dataUrl: string; seitenverhaeltnis: number }> {
  const vb = svg.viewBox.baseVal;
  const seitenverhaeltnis = vb && vb.width > 0 ? vb.height / vb.width : 0.6;
  const breite = Math.round(zielBreitePx);
  const hoehe = Math.round(zielBreitePx * seitenverhaeltnis);

  const klon = svg.cloneNode(true) as SVGSVGElement;
  klon.setAttribute('width', String(breite));
  klon.setAttribute('height', String(hoehe));
  klon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = new XMLSerializer().serializeToString(klon);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('SVG-Rasterung fehlgeschlagen'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = breite;
    canvas.height = hoehe;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, breite, hoehe);
    ctx.drawImage(img, 0, 0, breite, hoehe);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), seitenverhaeltnis };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface PdfGeneratorOptionen {
  /** Trennt PDF-Inhalt und Seitenlogik von der Browser-Rasterung. */
  rastereSvg?: typeof svgZuJpeg;
  /** Der PDF-Inhalt bleibt auch ohne Browser-Logo testbar. */
  ladeLogo?: () => Promise<Awaited<ReturnType<typeof logoPng>> | null>;
  /** Festes Datum für reproduzierbare Exporttests. */
  jetzt?: Date;
}

function azimutLabel(deg: number): string {
  const namen: [number, string][] = [
    [0, 'Nord'], [45, 'Nord-Ost'], [90, 'Ost'], [135, 'Süd-Ost'],
    [180, 'Süd'], [225, 'Süd-West'], [270, 'West'], [315, 'Nord-West'], [360, 'Nord'],
  ];
  const treffer = namen.find(([d]) => Math.abs(d - deg) <= 22.5);
  return treffer ? `${treffer[1]} (${deg}°)` : `${deg}°`;
}

const HINWEIS =
  'Vorplanung Vertrieb — keine Fachplanung. Finale Auslegung durch die Projektleitung (PV*SOL).';

/**
 * Baut das PDF aus fertig kalibrierten Projektfotos — der Generator kennt kein React.
 */
export async function baueBelegungsPdf(
  projekt: Projekt,
  result: StringPlanResult | null,
  svgVonFoto: (fotoId: string) => SVGSVGElement | null,
  optionen: PdfGeneratorOptionen = {},
): Promise<{ doc: import('jspdf').jsPDF; dateiname: string }> {
  const freigabe = projektFreigabe(projekt);
  if (!freigabe.pdf) {
    throw new Error(`PDF gesperrt: ${freigabe.fehler.map((f) => f.meldung).join(' ')}`);
  }
  if (kwpGesamt(projekt) <= 0) throw new Error('PDF gesperrt: Die Belegung hat 0 kWp.');
  const { jsPDF } = await import('jspdf');
  const modul = modulById(projekt.modulId);

  // Logo vorab rastern (fällt bei Fehler auf den Text-Schriftzug zurück)
  const logo = await (optionen.ladeLogo ?? logoPng)().catch(() => null);

  // Projektfotos mit allen jeweils zugeordneten Flächen, falls vorhanden.
  const fotoBilder: Array<{
    id: string;
    name: string;
    flaechen: string;
    dataUrl: string;
    seitenverhaeltnis: number;
  }> = [];
  for (const foto of projekt.fotos) {
    const zugeordneteFlaechen = fertigeFotoFlaechen(projekt, foto.id);
    if (zugeordneteFlaechen.length === 0) continue;
    const svg = svgVonFoto(foto.id);
    if (!svg) throw new Error(`Exportbild für „${foto.name || foto.id}“ fehlt.`);
    const bild = await (optionen.rastereSvg ?? svgZuJpeg)(svg, 1600);
    const flaechen = zugeordneteFlaechen
      .map(({ f, i }) => zonenVon(f, i))
      .join(', ');
    fotoBilder.push({ id: foto.id, name: foto.name, flaechen, ...bild });
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const SEITE_B = 210;
  const SEITE_H = 297;
  const RAND = 16;
  const NUTZ_B = SEITE_B - 2 * RAND;
  const INHALT_ENDE = SEITE_H - 16;

  /** Gemeinsamer Seitenumbruch für Tabellenzeilen und Fotokarten. */
  const seitenwechselWennNoetig = (hoehe: number, nachUmbruch?: () => void) => {
    if (y + hoehe <= INHALT_ENDE) return;
    doc.addPage();
    y = 18;
    nachUmbruch?.();
  };

  const fuss = () => {
    const seiten = doc.getNumberOfPages();
    for (let i = 1; i <= seiten; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140);
      doc.text(HINWEIS, RAND, SEITE_H - 8);
      doc.text(`Seite ${i}/${seiten}`, SEITE_B - RAND, SEITE_H - 8, { align: 'right' });
    }
  };

  // ---- Seite 1: Kopf + Zusammenfassung ----
  let y = RAND + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text('Belegungsplan', RAND, y);
  if (logo) {
    // Logo oben rechts, an der Titelzeile ausgerichtet (Icon = Schrifthöhe, s. logo.ts)
    const logoH = 9;
    const logoW = logoH * (logo.w / logo.h);
    doc.addImage(logo.dataUrl, 'PNG', SEITE_B - RAND - logoW, y - 6.6, logoW, logoH);
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('SüdEnergie PV', SEITE_B - RAND, y, { align: 'right' });
  }
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80);
  const datum = (optionen.jetzt ?? new Date()).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const kopfzeilen = [
    projekt.kunde && `Kunde: ${projekt.kunde}`,
    projekt.adresse && `Adresse: ${projekt.adresse}`,
    projekt.erfasser && `Erfasser: ${projekt.erfasser}`,
    `Datum: ${datum}`,
  ].filter(Boolean) as string[];
  for (const zeile of kopfzeilen) {
    doc.text(zeile, RAND, y);
    y += 5;
  }
  y += 2;

  // kWp-Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(20);
  doc.text(`${fmtDe(kwpGesamt(projekt), 2)} kWp`, RAND, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80);
  const gesamtModule = projekt.flaechen.reduce(
    (sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)),
    0,
  );
  doc.text(`${gesamtModule} × ${modul.name} (${modul.pmaxW} Wp)`, RAND + 62, y + 3);
  if (projekt.wrId) {
    doc.text(`WR: ${wrById(projekt.wrId).name}`, RAND + 62, y + 8);
  }
  y += 14;
  if (result?.valid) {
    doc.setFontSize(9);
    doc.setTextColor(30, 120, 60);
    doc.text('Stringplan geprüft (Regeln R1–R12): bestanden', RAND, y);
    y += 6;
  }

  // Flächen-Tabelle
  const SPALTEN = [RAND, RAND + 52, RAND + 92, RAND + 124, RAND + 152] as const;
  const tabellenKopf = () => {
    doc.setDrawColor(210);
    doc.setLineWidth(0.25);
    doc.line(RAND, y, SEITE_B - RAND, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text('Fläche', SPALTEN[0], y);
    doc.text('Ausrichtung', SPALTEN[1], y);
    doc.text('Neigung', SPALTEN[2], y);
    doc.text('Module', SPALTEN[3], y);
    doc.text('Leistung', SPALTEN[4], y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);
  };
  tabellenKopf();
  for (const [i, f] of projekt.flaechen.entries()) {
    seitenwechselWennNoetig(7, () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20);
      doc.text('Flächenübersicht (Fortsetzung)', RAND, y);
      y += 6;
      tabellenKopf();
    });
    const raster = rasterFuer(f, modul);
    const n = aktiveModule(f, raster);
    const ausrichtungen = ausrichtungenVon(f, raster);
    doc.text(flaechenTitel(f, i), SPALTEN[0], y);
    const richtungKurz = f.flachdach
      ? f.flachdach.aufstaenderung === 'ostwest'
        ? `O/W: O ${flachdachOstRichtung(f)}`
        : `Süd ${flachdachSuedRichtung(f)}`
      : azimutLabel(f.azimutDeg);
    doc.text(richtungKurz, SPALTEN[1], y);
    doc.text(`${f.neigungDeg}°`, SPALTEN[2], y);
    doc.text(`${n} (${ausrichtungen.bezeichnung})`, SPALTEN[3], y);
    doc.text(`${fmtDe((n * modul.pmaxW) / 1000, 2)} kWp`, SPALTEN[4], y);
    y += 5;
  }
  y += 3;
  doc.line(RAND, y, SEITE_B - RAND, y);
  y += 7;

  // Belegungsübersicht ausschließlich aus Drohnenfotos mit ihren zugeordneten Flächen.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text('Belegungsübersicht', RAND, y);
  y += 5;

  if (fotoBilder.length > 0) {
    const spalten = fotoBilder.length === 1 ? 1 : 2;
    const zelleB = (NUTZ_B - (spalten - 1) * 6) / spalten;
    const bildBereichH = fotoBilder.length === 1 ? Math.min(142, SEITE_H - y - 34) : 70;
    const kopfH = 12;
    const kartenH = kopfH + bildBereichH + 4;
    let spalte = 0;
    for (const bild of fotoBilder) {
      if (spalte === 0) seitenwechselWennNoetig(kartenH, () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(20);
        doc.text('Belegungsübersicht (Fortsetzung)', RAND, y);
        y += 6;
      });

      const x = RAND + spalte * (zelleB + 6);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(214, 220, 228);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, zelleB, kartenH, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(35, 45, 60);
      doc.text(bild.name || 'Belegungsfoto', x + 3, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(105, 115, 130);
      doc.text(
        bild.flaechen ? `Dachflächen ${bild.flaechen}` : 'Noch keine Fläche markiert',
        x + 3,
        y + 8.5,
      );

      const maxBildB = zelleB - 6;
      let bildB = maxBildB;
      let bildH = bildB * bild.seitenverhaeltnis;
      if (bildH > bildBereichH) {
        bildH = bildBereichH;
        bildB = bildH / bild.seitenverhaeltnis;
      }
      const bildX = x + (zelleB - bildB) / 2;
      const bildY = y + kopfH + (bildBereichH - bildH) / 2;
      doc.addImage(bild.dataUrl, 'JPEG', bildX, bildY, bildB, bildH);

      spalte += 1;
      if (spalte >= spalten) {
        spalte = 0;
        y += kartenH + 6;
      }
    }
    if (spalte !== 0) y += kartenH + 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('Kein fertig kalibriertes Belegungsfoto vorhanden.', RAND, y + 4);
  }

  fuss();
  return { doc, dateiname: downloadDateiname(projekt, 'belegungsplan', 'pdf') };
}

export async function erzeugeBelegungsPdf(
  projekt: Projekt,
  result: StringPlanResult | null,
  svgVonFoto: (fotoId: string) => SVGSVGElement | null,
): Promise<void> {
  const { doc, dateiname } = await baueBelegungsPdf(projekt, result, svgVonFoto);
  doc.save(dateiname);
}
