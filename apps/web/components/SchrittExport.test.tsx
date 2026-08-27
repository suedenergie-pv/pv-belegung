// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modulById, neuesProjekt, vollFeldFuer } from '../lib/model';

const { pdfMock } = vi.hoisted(() => ({ pdfMock: vi.fn() }));
vi.mock('../lib/pdf-export', () => ({ erzeugeBelegungsPdf: pdfMock }));

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
  it('erzeugt PDF und kopiert den vollständigen JSON-Payload', async () => {
    const projekt = freigegebenesProjekt();
    const { getByRole, getByText } = render(<SchrittExport projekt={projekt} onChange={vi.fn()} />);

    fireEvent.click(getByRole('button', { name: 'PDF herunterladen' }));
    await waitFor(() => expect(pdfMock).toHaveBeenCalledTimes(1));
    fireEvent.click(getByText('Technische Daten (JSON)', { exact: false }));
    fireEvent.click(getByRole('button', { name: 'JSON kopieren' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const json = vi.mocked(navigator.clipboard.writeText).mock.calls[0]![0];
    expect(JSON.parse(json)).toMatchObject({ projekt: { kunde: 'Audit Kunde' }, geometrie_quelle: 'manual' });
  });

  it('sperrt PDF und JSON bei belegter Fläche ohne kalibriertes Foto', () => {
    const projekt = neuesProjekt();
    projekt.kunde = 'Audit Kunde';
    projekt.adresse = 'Musterweg 1';
    projekt.erfasser = 'Test Vertrieb';
    projekt.flaechen[0]!.felder = [vollFeldFuer(projekt.flaechen[0]!, modulById(projekt.modulId))];
    const { getByRole, getByText } = render(<SchrittExport projekt={projekt} onChange={vi.fn()} />);

    expect((getByRole('button', { name: 'PDF herunterladen' }) as HTMLButtonElement).disabled).toBe(true);
    expect(getByText(/bestätigte und gültige Fotoperspektive fehlt/)).toBeTruthy();
    fireEvent.click(getByText('Technische Daten (JSON)', { exact: false }));
    expect((getByRole('button', { name: 'JSON kopieren' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('zeigt PDF-Fehler an, ohne die Oberfläche hängen zu lassen', async () => {
    pdfMock.mockRejectedValueOnce(new Error('Canvas fehlgeschlagen'));
    const { getByRole, findByText } = render(
      <SchrittExport projekt={freigegebenesProjekt()} onChange={vi.fn()} />,
    );
    fireEvent.click(getByRole('button', { name: 'PDF herunterladen' }));
    expect(await findByText('Canvas fehlgeschlagen')).toBeTruthy();
    expect((getByRole('button', { name: 'PDF herunterladen' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
