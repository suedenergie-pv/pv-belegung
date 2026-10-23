import { normalisiereFeldDrehung, type StringPlanResult } from '@pv-belegung/engine';
import { logoPng } from './logo';
import { ladeBildMitTimeout, svgMarkupAlsDataUrl } from './svg-raster';
import {
  aktiveModule,
  ausrichtungenVon,
  downloadDateiname,
  flachdachOstRichtung,
  flachdachSuedRichtung,
  fertigeFotoFlaechen,
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
 * SüdEnergie-Kundenblatt mit bildbetonter Titelseite und redaktionellen Flächendetails.
 * Ein unbeschnittenes Foto pro Seite; umfangreiche Flächendetails folgen den Bildern. Die Foto-SVGs werden
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
  const img = await ladeBildMitTimeout(
    svgMarkupAlsDataUrl(markup),
    'SVG-Rasterung fehlgeschlagen',
  );
  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.drawImage(img, 0, 0, breite, hoehe);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), seitenverhaeltnis };
}

export interface PdfGeneratorOptionen {
  /** Trennt PDF-Inhalt und Seitenlogik von der Browser-Rasterung. */
  rastereSvg?: typeof svgZuJpeg;
  /** Der PDF-Inhalt bleibt auch ohne Browser-Logo testbar. */
  ladeLogo?: () => Promise<Awaited<ReturnType<typeof logoPng>> | null>;
  /** Festes Datum für reproduzierbare Exporttests. */
  jetzt?: Date;
  /** Tests können PDF-Geometrie unabhängig von eingebetteten Schriftglyphen prüfen. */
  registriereSchrift?: (doc: import('jspdf').jsPDF) => Promise<string>;
}


function azimutLabel(deg: number): string {
  const namen: [number, string][] = [
    [0, 'Nord'], [45, 'Nord-Ost'], [90, 'Ost'], [135, 'Süd-Ost'],
    [180, 'Süd'], [225, 'Süd-West'], [270, 'West'], [315, 'Nord-West'], [360, 'Nord'],
  ];
  const treffer = namen.find(([d]) => Math.abs(d - deg) <= 22.5);
  return treffer ? `${treffer[1]} (${deg}°)` : `${deg}°`;
}

const HINWEIS = 'Vorplanung, keine Fachplanung. Die finale Auslegung erfolgt durch die Projektleitung (PV*SOL).';

async function registriereInter(doc: import('jspdf').jsPDF): Promise<string> {
  const { INTER_REGULAR, INTER_BOLD } = await import('./pdf-font-data');
  doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR);
  doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
  return 'Inter';
}

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
    throw new Error(`PDF gesperrt: ${freigabe.pdfFehler.map((f) => f.meldung).join(' ')}`);
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
    const bild = await (optionen.rastereSvg ?? svgZuJpeg)(svg, 2200);
    const flaechen = zugeordneteFlaechen
      .map(({ f, i }) => zonenVon(f, i))
      .join(', ');
    fotoBilder.push({ id: foto.id, name: foto.name, flaechen, ...bild });
  }

  const mehrereFotos = fotoBilder.length > 1;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: mehrereFotos && fotoBilder[0]!.seitenverhaeltnis <= 0.73 ? 'landscape' : 'portrait', putOnlyUsedFonts: true });
  doc.setProperties({ title: 'SüdEnergie Belegungsplan', author: 'SüdEnergie', creator: 'SüdEnergie Belegungsplaner', subject: 'Photovoltaik-Vorplanung' });
  const schrift = await (optionen.registriereSchrift ?? registriereInter)(doc);
  const RAND = 16, BREITE = 178, ENDE = mehrereFotos ? 272 : 264;
  // Kunden-PDF: Original-Logo-Orange aus logo.ts, nicht das abweichende Dashboard-Orange.
  const INK = '#17212b', MUTED = '#53616d', AKZENT = '#EF4C29', LINE = '#d9dfe4';
  const datum = (optionen.jetzt ?? new Date()).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const font = (groesse: number, fett = false, farbe = INK) => {
    doc.setFont(schrift, fett ? 'bold' : 'normal');
    doc.setFontSize(groesse);
    doc.setTextColor(farbe);
  };
  const zeilen = (inhalt: string, breite: number, groesse = 10, fett = false): string[] => {
    font(groesse, fett);
    return doc.splitTextToSize(inhalt, breite) as string[];
  };
  const text = (inhalt: string | string[], x: number, y: number, groesse = 10, fett = false, farbe = INK) => {
    font(groesse, fett, farbe);
    doc.text(inhalt, x, y, { lineHeightFactor: 1.3 });
  };
  const linie = (y: number, x = RAND, breite = BREITE) => {
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.25);
    doc.line(x, y, x + breite, y);
  };
  const akzent = (x: number, y: number) => {
    doc.setDrawColor(AKZENT);
    doc.setLineWidth(0.7);
    doc.line(x, y, x + 13, y);
  };
  // Eine offene Dachkante verbindet Projektdaten und Foto. Das Original-Logo bleibt unverändert.
  const dachkante = (x: number, oben: number, unten: number) => {
    doc.setDrawColor(AKZENT);
    doc.setLineWidth(1.1);
    doc.lines([[-5, 6], [0, unten - oben - 6]], x + 5, oben, [1, 1], 'S', false);
  };
  const bildnameBreite = (verhaeltnis: number) => verhaeltnis <= 0.73 ? 129 : BREITE - 76;
  const bildSeitenzahlY = new Map<number, number>();
  const logoKopf = () => {
    const logoH = mehrereFotos ? 6.5 : 7.5;
    if (logo) doc.addImage(logo.dataUrl, 'PNG', RAND, mehrereFotos ? 12.4 : 14, logoH * logo.w / logo.h, logoH);
    else text('SüdEnergie', RAND, 21, 17, true);
    if (!mehrereFotos) {
      font(12, true);
      doc.text('PHOTOVOLTAIK / VORPLANUNG', 194, 17, { align: 'right' });
    }
    font(12, false, MUTED);
    doc.text(`Datum: ${datum}`, 194, mehrereFotos ? 16 : 23, { align: 'right' });
    linie(31);
  };
  const neueSeite = (titel: string) => {
    doc.addPage('a4', 'portrait');
    logoKopf();
    if (mehrereFotos) dachkante(10, 39, 59);
    else akzent(RAND, 40);
    text(titel, RAND, 51, mehrereFotos ? 27 : 23, true);
    return mehrereFotos ? 72 : 65;
  };

  // Hochformat bekommt Bild und Daten nebeneinander, Querformat die volle Bildbreite.
  const hochformat = (fotoBilder[0]?.seitenverhaeltnis ?? 0) > 1.1;
  const kundeZeilen = zeilen(projekt.kunde, 57, 12, true);
  const adresseZeilen = zeilen(projekt.adresse, 57, 12);
  const beraterZeilen = zeilen(projekt.erfasser ? `Beratung: ${projekt.erfasser} / suedenergie-pv.de` : '', BREITE - 27, 12);
  const projektImAnhang = kundeZeilen.length > 2 || adresseZeilen.length > 3 || beraterZeilen.length > 1;
  const anzahl = projekt.flaechen.reduce((sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)), 0);
  const flaechen = projekt.flaechen.map((f, i) => {
    const raster = rasterFuer(f, modul);
    const n = aktiveModule(f, raster);
    const winkel = [...new Set((f.felder ?? []).map(feld => normalisiereFeldDrehung(feld.drehungDeg)))];
    const richtung = f.flachdach
      ? f.flachdach.aufstaenderung === 'ostwest'
        ? `Ost/West: Ost ${flachdachOstRichtung(f)}` : `Süd ${flachdachSuedRichtung(f)}`
      : azimutLabel(f.azimutDeg);
    const gedreht = !!f.flachdach && winkel.some(w => w !== 0);
    const ausrichtung = ausrichtungenVon(f, raster).bezeichnung;
    return {
      titel: flaechenTitel(f, i).replaceAll(' · ', ' - '),
      leistung: `${n} Module / ${fmtDe(n * modul.pmaxW / 1000, 2)} kWp`,
      details: `${gedreht ? 'Grundraster ' : ''}${richtung} / ${f.flachdach ? `${f.flachdach.winkelDeg}° Gestellneigung` : `${f.neigungDeg}° Dachneigung`}
${ausrichtung === 'hoch' ? 'Hochkant' : ausrichtung === 'quer' ? 'Querformat' : 'Hochkant und Querformat'}${gedreht ? ` / Felder: ${winkel.map(w => `${fmtDe(w, 1)}°`).join(', ')}` : ''}`,
    };
  });
  const ausstattung = `${modul.name}
${modul.pmaxW} Wp je Modul${projekt.wrId ? `
Wechselrichter: ${wrById(projekt.wrId).name}` : ''}`;
  const datenX = hochformat ? 132 : 96;
  const datenB = 194 - datenX;
  const ausstattungZeilen = zeilen(ausstattung, datenB, 12);
  const ausstattungImAnhang = mehrereFotos || ausstattungZeilen.length > (hochformat ? 5 : 4);
  const kompaktB = hochformat ? datenB : flaechen.length === 2 ? 84 : BREITE;
  const kompakt = flaechen.map(f => ({
    ...f,
    titelZeilen: zeilen(f.titel, kompaktB, 12, true),
    detailZeilen: zeilen(f.details, kompaktB, 12),
  }));
  const detailsImAnhang = mehrereFotos || flaechen.length > 2 || kompakt.some(f => f.titelZeilen.length > 1 || f.detailZeilen.length > 2);

  // Kein Beschnitt und keine große farbige Trägerfläche. Die Bildunterschrift
  // folgt dem tatsächlichen Bildrand, auch bei schmalen oder hohen Bildern.
  const bildZeichnen = (bild: typeof fotoBilder[number], oben: number, unten: number, x = RAND, breite = BREITE, beschriftung = true) => {
    const platzH = unten - oben - (beschriftung ? 18 : 0);
    const b = Math.min(breite, platzH / bild.seitenverhaeltnis);
    const h = b * bild.seitenverhaeltnis;
    const bildX = x + (breite - b) / 2;
    const bildY = oben + (platzH - h) / 2;
    doc.addImage(bild.dataUrl, 'JPEG', bildX, bildY, b, h);
    const rahmen = { x: bildX, y: bildY, breite: b, hoehe: h };
    if (!beschriftung) return rahmen;
    const captionY = bildY + h + 5;
    text('Belegungsübersicht', bildX, captionY, 12, true);
    const caption = zeilen(`${bild.name || 'Dachfoto'} / Dachflächen ${bild.flaechen}`, b, 12);
    text(caption.length <= 1 ? caption : `Foto ${fotoBilder.indexOf(bild) + 1} / Bildangaben im Anhang`, bildX, captionY + 6, 12, false, MUTED);
    return rahmen;
  };

  if (mehrereFotos) {
    for (const [index, bild] of fotoBilder.entries()) {
      const quer = bild.seitenverhaeltnis <= 0.73;
      if (index > 0) doc.addPage('a4', quer ? 'landscape' : 'portrait');
      const seitenB = doc.internal.pageSize.getWidth();
      const seitenH = doc.internal.pageSize.getHeight();
      const rechts = seitenB - RAND;
      if (logo) doc.addImage(logo.dataUrl, 'PNG', RAND, 12.4, 6.5 * logo.w / logo.h, 6.5);
      else text('SüdEnergie', RAND, 21, 17, true);
      const kundenB = quer ? 136 : BREITE;
      const namePasst = zeilen(projekt.kunde, kundenB, 14, true).length <= 1;
      const adressePasst = zeilen(projekt.adresse, kundenB, 12).length <= 1;
      const name = namePasst ? projekt.kunde : 'Projektangaben im Anhang';
      const adresse = adressePasst ? projekt.adresse : 'Vollständige Adresse im Anhang';
      const flaechenAnzahl = `${projekt.flaechen.length} ${projekt.flaechen.length === 1 ? 'Dachfläche' : 'Dachflächen'}`;
      const kopfX = quer ? 76 : RAND;
      if (name) text(name, kopfX, quer ? 15.8 : 51, 14, true);
      if (adresse) text(adresse, kopfX, quer ? 23.2 : 58, 12, false, MUTED);
      font(12, false, MUTED);
      doc.text(`Datum: ${datum}`, rechts, 16, { align: 'right' });
      let rahmen: ReturnType<typeof bildZeichnen>;
      if (quer) {
        text('Belegungsplan', RAND, 43, 19, true);
        text('Gesamtleistung', RAND, 66, 12, false, MUTED);
        const leistung = fmtDe(kwpGesamt(projekt), 2);
        font(14, true);
        const einheitB = doc.getTextWidth('kWp');
        let groesse = 32;
        font(groesse, true);
        while (doc.getTextWidth(leistung) + einheitB + 2.5 > 49 && groesse > 18) font(--groesse, true);
        const leistungB = doc.getTextWidth(leistung);
        text(leistung, RAND, 83, groesse, true);
        text('kWp', RAND + leistungB + 2.5, 83, 14, true, AKZENT);
        text(`${anzahl} Module`, RAND, 107, 14, true);
        text(flaechenAnzahl, RAND, 116, 12, false, MUTED);
        rahmen = bildZeichnen(bild, 30, seitenH - 32, 76, seitenB - 76 - RAND, false);
        const bildEnde = rahmen.y + rahmen.hoehe;
        text('Perspektive', RAND, bildEnde - 11, 12, false, MUTED);
        text(`${index + 1} von ${fotoBilder.length}`, RAND, bildEnde, 18, true);
        dachkante(69, rahmen.y - 1, bildEnde + 1);
      } else {
        text('Belegungsplan', RAND, 39, 27, true);
        font(12, false, MUTED);
        doc.text('Perspektive', rechts, 32, { align: 'right' });
        font(14, true);
        doc.text(`${index + 1} von ${fotoBilder.length}`, rechts, 40, { align: 'right' });
        text(`${fmtDe(kwpGesamt(projekt), 2)} kWp`, RAND, 72, 22, true);
        text(`${anzahl} Module / ${flaechenAnzahl}`, 96, 71, 12, true);
        dachkante(10, 32, 73);
        rahmen = bildZeichnen(bild, 81, seitenH - 32, RAND, BREITE, false);
      }

      const bildname = `Foto: ${bild.name || 'Dachfoto'}`;
      const bildnameB = bildnameBreite(bild.seitenverhaeltnis);
      const bildnamePasst = zeilen(bildname, bildnameB, 12).length <= 1;
      const captionY = rahmen.y + rahmen.hoehe + 7;
      text(bildnamePasst ? bildname : `Foto ${index + 1}: vollständiger Bildname im Anhang`, quer ? 76 : RAND, captionY, 12);
      const zuordnung = `${bild.flaechen.includes(',') ? 'Dachflächen' : 'Dachfläche'} ${bild.flaechen}`;
      font(12, true);
      doc.text(zeilen(zuordnung, 48, 12, true).length <= 1 ? zuordnung : 'Zuordnung im Anhang', rechts - 21, captionY, { align: 'right' });
      bildSeitenzahlY.set(index + 1, captionY);
    }
  } else {
    logoKopf();
    text('DACHBELEGUNG', RAND, 39, 12, true, MUTED);
    text('Belegungsplan', RAND, 55, 27, true);
    if (projektImAnhang) {
      text('Projektangaben', 137, 44, 12, true);
      text('Vollständig im Anhang', 137, 51, 12, false, MUTED);
    } else {
      if (projekt.kunde) text(kundeZeilen, 137, 44, 12, true);
      if (projekt.adresse) text(adresseZeilen, 137, 44 + kundeZeilen.length * 5.5 + 2, 12, false, MUTED);
    }

    if (fotoBilder[0]) {
      if (hochformat) bildZeichnen(fotoBilder[0], 74, 262, RAND, 104);
      else bildZeichnen(fotoBilder[0], 73, 188);
    } else {
      text('Kein fertig kalibriertes Belegungsfoto vorhanden.', RAND, 120, 12, false, MUTED);
    }

    // Die Leistung trägt die Typografie; Orange wird nur als kurzer Akzent eingesetzt.
    const leistungX = hochformat ? datenX : RAND;
    const leistungY = hochformat ? 97 : 210;
    akzent(leistungX, leistungY - 18);
    const leistung = fmtDe(kwpGesamt(projekt), 2);
    let leistungGroesse = hochformat ? 30 : 36;
    font(leistungGroesse, true);
    while (doc.getTextWidth(leistung) > (hochformat ? datenB : 66) && leistungGroesse > 16) {
      font(--leistungGroesse, true);
    }
    text(leistung, leistungX, leistungY, leistungGroesse, true);
    text('kWp', leistungX, leistungY + 9, 12);
    text('Geplante Modulleistung', leistungX, leistungY + 16, 12, false, MUTED);

    const geraeteY = hochformat ? 139 : 195;
    text('AUSSTATTUNG', datenX, geraeteY, 12, true, MUTED);
    text(ausstattungImAnhang ? zeilen('Vollständige Ausstattung im Anhang.', datenB, 12) : ausstattungZeilen, datenX, geraeteY + 7, 12);
    const zaehlerY = hochformat ? 124 : 232;
    text(zeilen(`${anzahl} Module / ${projekt.flaechen.length} ${projekt.flaechen.length === 1 ? 'Dachfläche' : 'Dachflächen'}`, datenB, 12, true), datenX, zaehlerY, 12, true);
    if (result?.valid) text(zeilen('Stringcheck: Regeln R1-R12 bestanden', datenB, 12), datenX, hochformat ? 183 : 239, 12, false, MUTED);

    if (detailsImAnhang) {
      text(zeilen('Dachflächen im Detail: siehe Anhang.', datenB, 12), datenX, hochformat ? 201 : 253, 12, false, MUTED);
    } else {
      for (const [i, f] of kompakt.entries()) {
        const x = hochformat ? datenX : RAND + (flaechen.length === 2 ? i * 94 : 0);
        const y = hochformat ? 194 + i * 32 : 241;
        linie(y, x, kompaktB);
        text(f.titelZeilen, x, y + 6, 12, true);
        text(f.leistung, x, y + 12, 12, true);
        text(f.detailZeilen, x, y + 18, 12, false, MUTED);
      }
    }
  }
  let y = 0;
  if (detailsImAnhang || ausstattungImAnhang) {
    y = neueSeite(mehrereFotos ? 'Anlagendaten' : 'Dachflächen im Detail');
    if (mehrereFotos) {
      if (!projektImAnhang) {
        if (projekt.kunde) {
          for (const zeile of zeilen(projekt.kunde, BREITE, 14, true)) {
            text(zeile, RAND, y, 14, true);
            y += 7;
          }
        }
        if (projekt.adresse) {
          for (const zeile of zeilen(projekt.adresse, BREITE, 12)) {
            text(zeile, RAND, y, 12, false, MUTED);
            y += 6.5;
          }
        }
        y += 8;
      }
      const leistung = `${fmtDe(kwpGesamt(projekt), 2)} kWp`;
      let groesse = 34;
      font(groesse, true);
      while (doc.getTextWidth(leistung) > 116 && groesse > 18) font(--groesse, true);
      text(leistung, RAND, y + 7, groesse, true);
      text(`${anzahl} Module`, 143, y - 1, 16, true);
      text(`${projekt.flaechen.length} ${projekt.flaechen.length === 1 ? 'Dachfläche' : 'Dachflächen'}`, 143, y + 8, 12, false, MUTED);
      linie(y + 17);
      y += 31;
    }
    if (ausstattungImAnhang) {
      if (mehrereFotos) {
        text('Ausstattung', RAND, y, 14, true);
        y += 9;
      }
      for (const zeile of zeilen(ausstattung, BREITE, 12)) {
        if (y + 6 > ENDE) y = neueSeite('Anlagendetails / Fortsetzung');
        text(zeile, RAND, y, 12);
        y += 6.5;
      }
      y += 10;
    }
    if (mehrereFotos && result?.valid) {
      text('Stringcheck: Regeln R1-R12 bestanden', RAND, y, 12, false, MUTED);
      y += 9;
    }
    if (detailsImAnhang) for (const f of flaechen) {
      const abschnitte: Array<[string, number, boolean]> = [[f.titel, 16, true], [f.leistung, 14, true], [f.details, 12, false]];
      if (y + 32 > ENDE) y = neueSeite('Dachflächen / Fortsetzung');
      if (!mehrereFotos) linie(y - 5);
      for (const [inhalt, groesse, fett] of abschnitte) {
        const titel = inhalt === f.titel;
        const absatz = zeilen(inhalt, mehrereFotos ? BREITE - 8 : BREITE, groesse, fett);
        for (const zeile of absatz) {
          if (y + 6 > ENDE) y = neueSeite('Dachflächen / Fortsetzung');
          if (mehrereFotos && titel) {
            doc.setFillColor('#f4f6f8');
            doc.rect(RAND, y - 6, BREITE, groesse * 0.46 + 2, 'F');
            doc.setFillColor(AKZENT);
            doc.rect(RAND, y - 6, 1.2, groesse * 0.46 + 2, 'F');
          }
          text(zeile, RAND + (mehrereFotos ? 4 : 0), y, groesse, fett);
          y += groesse * 0.46;
        }
        y += 2;
      }
      y += 7;
    }
  }
  const langeBildangaben = fotoBilder.filter(b => {
    if (mehrereFotos) {
      const bildnameZuLang = zeilen(`Foto: ${b.name || 'Dachfoto'}`, bildnameBreite(b.seitenverhaeltnis), 12).length > 1;
      const zuordnung = `${b.flaechen.includes(',') ? 'Dachflächen' : 'Dachfläche'} ${b.flaechen}`;
      return bildnameZuLang || zeilen(zuordnung, 48, 12, true).length > 1;
    }
    const rahmenB = hochformat ? 104 : BREITE;
    const rahmenH = hochformat ? 170 : 97;
    const breite = Math.min(rahmenB, rahmenH / b.seitenverhaeltnis);
    return zeilen(`${b.name || 'Dachfoto'} / Dachflächen ${b.flaechen}`, breite, 12).length > 1;
  });
  if (projektImAnhang || langeBildangaben.length) {
    y = neueSeite('Projektangaben');
    const angaben = [
      ...(projektImAnhang ? [projekt.kunde && `Kunde: ${projekt.kunde}`, projekt.adresse && `Adresse: ${projekt.adresse}`, projekt.erfasser && `Beratung: ${projekt.erfasser}`].filter(Boolean) : []),
      ...langeBildangaben.map(b => `Foto ${fotoBilder.indexOf(b) + 1}: ${b.name}
Dachflächen ${b.flaechen}`),
    ];
    for (const angabe of angaben) {
      for (const zeile of zeilen(angabe as string, BREITE, 12)) {
        if (y + 6 > ENDE) y = neueSeite('Projektangaben / Fortsetzung');
        text(zeile, RAND, y, 12);
        y += 6.5;
      }
      y += 7;
    }
  }

  // Bei kurzen Anlagenblättern erklärt ein Bildindex die Zuordnung der Perspektiven.
  // Die großen Belegungsfotos davor bleiben die eigentlichen Planblätter.
  const indexHoehe = fotoBilder.length > 3 ? 51 : 44;
  if (mehrereFotos && !projektImAnhang && !langeBildangaben.length && y + indexHoehe + 26 <= ENDE) {
    text('Ansichten im Überblick', RAND, y, 14, true);
    const vorschauen = fotoBilder.slice(0, 3);
    const spalteB = (BREITE - 7 * (vorschauen.length - 1)) / vorschauen.length;
    for (const [index, bild] of vorschauen.entries()) {
      const x = RAND + index * (spalteB + 7);
      const b = Math.min(spalteB, 28 / bild.seitenverhaeltnis);
      const h = b * bild.seitenverhaeltnis;
      doc.addImage(bild.dataUrl, 'JPEG', x + (spalteB - b) / 2, y + 7 + (28 - h) / 2, b, h);
      text(`Ansicht ${index + 1} / Seite ${index + 1}`, x, y + 42, 12, false, MUTED);
    }
    if (fotoBilder.length > 3) text(`Weitere Perspektiven: Seiten 4 bis ${fotoBilder.length}.`, RAND, y + 50, 12, false, MUTED);
    y += indexHoehe;
  }
  if (mehrereFotos) {
    const beratung = projekt.erfasser && !projektImAnhang ? `Beratung: ${projekt.erfasser} / suedenergie-pv.de` : 'SüdEnergie / suedenergie-pv.de';
    const kontakt = zeilen(beratung, BREITE, 12);
    const hinweis = zeilen(HINWEIS, BREITE, 12);
    const blockH = 8 + kontakt.length * 6.5 + hinweis.length * 5.6;
    if (y + blockH > ENDE) y = neueSeite('Beratung und Planung');
    else y += 5;
    text(kontakt, RAND, y, 12);
    y += kontakt.length * 6.5 + 3;
    text(hinweis, RAND, y, 12, false, MUTED);
  }

  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    const seitenB = doc.internal.pageSize.getWidth();
    const seitenH = doc.internal.pageSize.getHeight();
    if (mehrereFotos) {
      const seitenzahlY = bildSeitenzahlY.get(i) ?? seitenH - 8;
      font(12, false, MUTED);
      doc.text(`${i} / ${seiten}`, seitenB - RAND, seitenzahlY, { align: 'right' });
      continue;
    }
    linie(seitenH - 27, RAND, seitenB - 2 * RAND);
    text(zeilen(HINWEIS, BREITE, 12), RAND, seitenH - 21, 12, false, MUTED);
    const kontakt = !projektImAnhang && projekt.erfasser ? `Beratung: ${projekt.erfasser} / suedenergie-pv.de` : 'SüdEnergie / suedenergie-pv.de';
    text(kontakt, RAND, seitenH - 7, 12, false, MUTED);
    font(12, true);
    doc.text(`${i} / ${seiten}`, seitenB - RAND, seitenH - 7, { align: 'right' });
  }
  return { doc, dateiname: downloadDateiname(projekt, 'belegungsplan', 'pdf') };
}

export interface VorbereiteterPdfDownload {
  href: string;
  dateiname: string;
  teilen?: () => Promise<void>;
  aufraeumen: () => void;
}

export function istIosWebviewBrowser(
  userAgent = navigator.userAgent,
  platform = navigator.platform,
  maxTouchPoints = navigator.maxTouchPoints,
): boolean {
  return (
    /iPad|iPhone|iPod|CriOS|GSA|FxiOS|EdgiOS|OPiOS/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && platform === 'MacIntel' && maxTouchPoints > 1)
  );
}

export function pdfDownloadFuerBrowser(
  doc: import('jspdf').jsPDF,
  dateiname: string,
  userAgent = navigator.userAgent,
): VorbereiteterPdfDownload {
  const datei = new File([doc.output('arraybuffer')], dateiname, {
    type: 'application/pdf',
  });
  if (istIosWebviewBrowser(userAgent)) {
    // Datei vor dem Tap vorbereiten: share() braucht die unmittelbare
    // Nutzeraktivierung. Ein Download-Link allein ist auf iOS nicht verlässlich.
    let kannTeilen = false;
    try {
      kannTeilen = typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [datei] });
    } catch { /* Eingebettete Browser können die Fähigkeit sperren. */ }
    return {
      href: doc.output('datauristring', { filename: dateiname }),
      dateiname,
      teilen: kannTeilen ? () => navigator.share({ files: [datei] }) : undefined,
      aufraeumen: () => undefined,
    };
  }

  const href = URL.createObjectURL(datei);
  return {
    href,
    dateiname,
    aufraeumen: () => URL.revokeObjectURL(href),
  };
}

export async function bereiteBelegungsPdfDownload(
  projekt: Projekt,
  result: StringPlanResult | null,
  svgVonFoto: (fotoId: string) => SVGSVGElement | null,
): Promise<VorbereiteterPdfDownload> {
  const { doc, dateiname } = await baueBelegungsPdf(projekt, result, svgVonFoto);
  return pdfDownloadFuerBrowser(doc, dateiname);
}
