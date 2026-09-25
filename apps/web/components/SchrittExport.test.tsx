// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modulById, neuesProjekt, vollFeldFuer } from '../lib/model';

const { pdfMock, pdfAufraeumenMock } = vi.hoisted(() => ({
  pdfMock: vi.fn(),
  pdfAufraeumenMock: vi.fn(),
}));
vi.mock('../lib/pdf-export', () => ({
  bereiteBelegungsPdfDownload: pdfMock,
}));

import { SchrittExport } from './SchrittExport';

function freigegebenesProjekt() {
  const projekt = neuesProjekt();
  projekt.kunde = 'Audit Kunde';
  projekt.adresse = 'Musterweg 1';
  projekt.erfasser = 'Test Vertrieb';
  projekt.flaechen[0]!.felder = [vollFeldFuer(projekt.flaechen[0]!, modulById(projekt.modulId))];
  projekt.fotos = [
    { id: 'foto-1', name: 'Foto 1', dataUrl: 'data:image/jpeg;base64,x', breitePx: 100, hoehePx: 80 },
  ];
  projekt.flaechen[0]!.fotoZuordnungen = [{
    fotoId: 'foto-1',
    traufePx: null,
    eckenPx: [[0, 80], [100, 80], [100, 0], [0, 0]],
    perspektiveBestaetigt: true,
    markierungFertig: true,
  }];
  return projekt;
}

beforeEach(() => {
  pdfMock.mockReset();
  pdfAufraeumenMock.mockReset();
  pdfMock.mockResolvedValue({
    href: 'blob:pdf-test',
    dateiname: 'belegungsplan.pdf',
    aufraeumen: pdfAufraeumenMock,
  });
  vi.stubGlobal('React', React);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Exportfunktionen', () => {
  it('startet den nativen Speichern-Dialog synchron beim Klick und verhindert Doppelklicks', async () => {
    let fertig!: () => void;
    const teilen = vi.fn(() => new Promise<void>((resolve) => { fertig = resolve; }));
    pdfMock.mockResolvedValue({ href: 'data:application/pdf;base64,x', dateiname: 'plan.pdf', teilen, aufraeumen: pdfAufraeumenMock });
    const { findByText, getByRole } = render(<SchrittExport projekt={freigegebenesProjekt()} onChange={vi.fn()} />);
    await findByText(/In Dateien sichern/);
    const link = getByRole('button', { name: 'PDF herunterladen' });
    expect(fireEvent.click(link)).toBe(false);
    expect(teilen).toHaveBeenCalledTimes(1);
    fireEvent.click(link);
    expect(teilen).toHaveBeenCalledTimes(1);
    await act(async () => fertig());
    fireEvent.click(link);
    expect(teilen).toHaveBeenCalledTimes(2);
    await act(async () => fertig());
  });

  it.each(['AbortError', 'NotAllowedError', 'sync'])('behandelt den Speichern-Dialog bei %s ohne stillen Fehlschlag', async (name) => {
    const teilen = vi.fn(() => {
      if (name === 'sync') throw new Error('gesperrt');
      return Promise.reject(new DOMException('gesperrt', name));
    });
    pdfMock.mockResolvedValue({ href: 'data:application/pdf;base64,x', dateiname: 'plan.pdf', teilen, aufraeumen: pdfAufraeumenMock });
    const { findByText, getByRole, queryByRole } = render(<SchrittExport projekt={freigegebenesProjekt()} onChange={vi.fn()} />);
    await findByText(/In Dateien sichern/);
    await act(async () => { fireEvent.click(getByRole('button', { name: 'PDF herunterladen' })); });
    if (name === 'AbortError') expect(queryByRole('alert')).toBeNull();
    else expect(getByRole('link', { name: 'Direkter PDF-Download' }).getAttribute('download')).toBe('plan.pdf');
    fireEvent.click(getByRole('button', { name: 'PDF herunterladen' }));
    await waitFor(() => expect(teilen).toHaveBeenCalledTimes(2));
  });
  it('erzeugt PDF und kopiert den vollständigen JSON-Payload', async () => {
    const projekt = freigegebenesProjekt();
    const { getByRole, getByText } = render(<SchrittExport projekt={projekt} onChange={vi.fn()} />);

    await waitFor(() => expect(pdfMock).toHaveBeenCalledTimes(1));
    const pdfLink = getByRole('button', { name: 'PDF herunterladen' });
    expect(pdfLink.getAttribute('href')).toBe('blob:pdf-test');
    expect(pdfLink.getAttribute('download')).toBe('belegungsplan.pdf');
    fireEvent.click(getByText('Technische Daten (JSON)', { exact: false }));
    fireEvent.click(getByRole('button', { name: 'JSON kopieren' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const json = vi.mocked(navigator.clipboard.writeText).mock.calls[0]![0];
    expect(JSON.parse(json)).toMatchObject({ projekt: { kunde: 'Audit Kunde' }, geometrie_quelle: 'manual' });
  });

  it('lädt den Belegungsplan auch ohne Kunde, Adresse und Erfasser herunter', async () => {
    const projekt = freigegebenesProjekt();
    projekt.kunde = '';
    projekt.adresse = '';
    projekt.erfasser = '';
    const { getByRole, queryByText } = render(
      <SchrittExport projekt={projekt} onChange={vi.fn()} />,
    );

    expect(queryByText(/PDF noch gesperrt/)).toBeNull();
    await waitFor(() => expect(pdfMock).toHaveBeenCalledTimes(1));
    expect(getByRole('button', { name: 'PDF herunterladen' })).toBeTruthy();
  });

  it('sperrt PDF und JSON bei belegter Fläche ohne kalibriertes Foto', () => {
    const projekt = neuesProjekt();
    projekt.kunde = 'Audit Kunde';
    projekt.adresse = 'Musterweg 1';
    projekt.erfasser = 'Test Vertrieb';
    projekt.flaechen[0]!.felder = [vollFeldFuer(projekt.flaechen[0]!, modulById(projekt.modulId))];
    const { getAllByText, getByRole, getByText } = render(
      <SchrittExport projekt={projekt} onChange={vi.fn()} />,
    );

    expect((getByRole('button', { name: 'PDF herunterladen' }) as HTMLButtonElement).disabled).toBe(true);
    expect(getAllByText(/bestätigte und gültige Fotoperspektive fehlt/)).toHaveLength(2);
    fireEvent.click(getByText('Technische Daten (JSON)', { exact: false }));
    expect((getByRole('button', { name: 'JSON kopieren' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('zeigt PDF-Fehler an, ohne die Oberfläche hängen zu lassen', async () => {
    pdfMock.mockRejectedValueOnce(new Error('Canvas fehlgeschlagen'));
    const { getByRole, findByText } = render(
      <SchrittExport projekt={freigegebenesProjekt()} onChange={vi.fn()} />,
    );
    expect(await findByText('Canvas fehlgeschlagen')).toBeTruthy();
    const erneut = getByRole('button', { name: 'PDF erneut vorbereiten' });
    expect((erneut as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(erneut);
    await waitFor(() => expect(pdfMock).toHaveBeenCalledTimes(2));
  });

  it('beendet auch einen nie auflösenden PDF-Aufruf mit Wiederholungsmöglichkeit', async () => {
    vi.useFakeTimers();
    pdfMock.mockImplementationOnce(() => new Promise(() => undefined));
    const { getByRole, getByText } = render(
      <SchrittExport projekt={freigegebenesProjekt()} onChange={vi.fn()} />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(getByText('PDF-Erzeugung dauert zu lange. Bitte erneut vorbereiten.')).toBeTruthy();
    expect((getByRole('button', { name: 'PDF erneut vorbereiten' }) as HTMLButtonElement).disabled).toBe(false);
    vi.useRealTimers();
  });
});
