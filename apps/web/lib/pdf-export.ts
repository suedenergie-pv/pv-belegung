import type { StringPlanResult } from '@pv-belegung/engine';
import { logoPng } from './logo';
import { aktiveModule, fmtDe, kwpGesamt, modulById, randVon, rasterFuer, wrById, zonenLabel, type Projekt } from './model';

/**
 * PDF-Export des Belegungsplans (Hauptexport fürs Vertriebsgespräch, 06.07.2026):
 * Seite 1 = Zusammenfassung + Gesamtübersicht aller Flächen, danach je Fläche
 * eine Detailseite. Die SVG-Ansichten (DachSvg, Maße aus mm × Maßstab — SPEC §3.5)
 * werden per Canvas gerastert; kein Server, alles bleibt im Browser.
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
 * Baut das PDF. `svgVonFlaeche` liefert das im DOM gerenderte SVG je Fläche
 * (offscreen-Render in SchrittExport) — der Generator kennt kein React.
 */
export async function erzeugeBelegungsPdf(
  projekt: Projekt,
  result: StringPlanResult | null,
  svgVonFlaeche: (flaecheId: string) => SVGSVGElement | null,
  svgGesamt?: () => SVGSVGElement | null,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const modul = modulById(projekt.modulId);

  // Logo vorab rastern (fällt bei Fehler auf den Text-Schriftzug zurück)
  const logo = await logoPng().catch(() => null);

  // Alle Flächen vorab rastern (Detailbreite; die Übersicht nutzt dieselben Bilder)
  const bilder = new Map<string, { dataUrl: string; seitenverhaeltnis: number }>();
  for (const f of projekt.flaechen) {
    const svg = svgVonFlaeche(f.id);
    if (svg) bilder.set(f.id, await svgZuJpeg(svg, 1600));
  }

  // Gesamtansicht (alle Flächen auf einem Drohnenfoto), falls vorhanden.
  const gesamtSvg = svgGesamt?.() ?? null;
  const gesamtBild = gesamtSvg ? await svgZuJpeg(gesamtSvg, 1600) : null;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const SEITE_B = 210;
  const SEITE_H = 297;
  const RAND = 16;
  const NUTZ_B = SEITE_B - 2 * RAND;

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
  const datum = new Date().toLocaleDateString('de-DE', {
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
  doc.setDrawColor(210);
  doc.setLineWidth(0.25);
  doc.line(RAND, y, SEITE_B - RAND, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(110);
  const SPALTEN = [RAND, RAND + 52, RAND + 92, RAND + 124, RAND + 152] as const;
  doc.text('Dachfläche', SPALTEN[0], y);
  doc.text('Ausrichtung', SPALTEN[1], y);
  doc.text('Neigung', SPALTEN[2], y);
  doc.text('Module', SPALTEN[3], y);
  doc.text('Leistung', SPALTEN[4], y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40);
  for (const f of projekt.flaechen) {
    const n = aktiveModule(f, rasterFuer(f, modul));
    doc.text(
      `${zonenLabel(projekt.flaechen.indexOf(f))}  ${f.name} (${fmtDe(f.breiteM, 2)} × ${fmtDe(f.hoeheM, 2)} m)`,
      SPALTEN[0],
      y,
    );
    doc.text(azimutLabel(f.azimutDeg), SPALTEN[1], y);
    doc.text(`${f.neigungDeg}°`, SPALTEN[2], y);
    doc.text(`${n} (${f.ausrichtung})`, SPALTEN[3], y);
    doc.text(`${fmtDe((n * modul.pmaxW) / 1000, 2)} kWp`, SPALTEN[4], y);
    y += 5;
  }
  y += 3;
  doc.line(RAND, y, SEITE_B - RAND, y);
  y += 7;

  // Gesamtansicht: bevorzugt das Drohnenfoto mit allen Flächen (falls markiert);
  // sonst eine Fläche = groß auf Seite 1, mehrere = Übersicht in 2 Spalten.
  const einzelflaeche = projekt.flaechen.length === 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text('Gesamtansicht', RAND, y);
  y += 5;

  if (gesamtBild) {
    // Ein Gesamtfoto vorhanden → groß und zentriert, keine Kachel-Übersicht.
    let bildB = NUTZ_B;
    let bildH = bildB * gesamtBild.seitenverhaeltnis;
    const maxH = SEITE_H - y - 18;
    if (bildH > maxH) {
      bildH = maxH;
      bildB = bildH / gesamtBild.seitenverhaeltnis;
    }
    doc.addImage(gesamtBild.dataUrl, 'JPEG', RAND + (NUTZ_B - bildB) / 2, y, bildB, bildH);
  } else {
  const spalten = einzelflaeche ? 1 : 2;
  const zelleB = (NUTZ_B - (spalten - 1) * 6) / spalten;
  let zeilenHoehe = 0;
  let x = RAND;
  let spalte = 0;
  for (const f of projekt.flaechen) {
    const bild = bilder.get(f.id);
    if (!bild) continue;
    let bildB = zelleB;
    let bildH = bildB * bild.seitenverhaeltnis;
    // Einzelfläche darf die ganze Restseite füllen, sonst kompakte Übersicht.
    const maxH = einzelflaeche ? SEITE_H - y - 18 : 92;
    if (bildH > maxH) {
      bildH = maxH;
      bildB = bildH / bild.seitenverhaeltnis;
    }
    if (y + bildH + 10 > SEITE_H - 16 && !einzelflaeche) break; // Seite voll — Details folgen
    doc.addImage(bild.dataUrl, 'JPEG', x + (einzelflaeche ? (NUTZ_B - bildB) / 2 : 0), y, bildB, bildH);
    if (!einzelflaeche) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(`${zonenLabel(projekt.flaechen.indexOf(f))}  ${f.name}`, x, y + bildH + 4);
    }
    zeilenHoehe = Math.max(zeilenHoehe, bildH + 8);
    spalte += 1;
    if (spalte >= spalten) {
      spalte = 0;
      x = RAND;
      y += zeilenHoehe;
      zeilenHoehe = 0;
    } else {
      x += zelleB + 6;
    }
  }
  }

  // ---- Je Fläche eine Detailseite (nur bei mehreren Flächen) ----
  if (!einzelflaeche)
  for (const f of projekt.flaechen) {
    const bild = bilder.get(f.id);
    if (!bild) continue;
    doc.addPage();
    let dy = RAND + 4;
    const n = aktiveModule(f, rasterFuer(f, modul));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20);
    doc.text(`${zonenLabel(projekt.flaechen.indexOf(f))}  ${f.name}`, RAND, dy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`${fmtDe((n * modul.pmaxW) / 1000, 2)} kWp`, SEITE_B - RAND, dy, { align: 'right' });
    dy += 6;
    doc.setFontSize(9);
    // Nur ASCII/WinAnsi-sichere Trennzeichen — "·" rendert in jsPDF-Helvetica als Kästchen
    doc.text(
      `${azimutLabel(f.azimutDeg)}, Neigung ${f.neigungDeg}°, Traufe ${fmtDe(f.breiteM, 2)} m × ` +
        `Sparren ${fmtDe(f.hoeheM, 2)} m, Randabstand ${fmtDe(randVon(f) * 100, 0)} cm`,
      RAND,
      dy,
    );
    dy += 5;
    doc.text(`${n} × ${modul.name} (${f.ausrichtung === 'quer' ? 'quer' : 'hochkant'} verlegt)`, RAND, dy);
    dy += 6;
    let bildB = NUTZ_B;
    let bildH = bildB * bild.seitenverhaeltnis;
    const maxH = SEITE_H - dy - 20;
    if (bildH > maxH) {
      bildH = maxH;
      bildB = bildH / bild.seitenverhaeltnis;
    }
    doc.addImage(bild.dataUrl, 'JPEG', RAND + (NUTZ_B - bildB) / 2, dy, bildB, bildH);
  }

  fuss();
  const dateiname = `belegungsplan-${(projekt.kunde || 'projekt').toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(dateiname);
}
