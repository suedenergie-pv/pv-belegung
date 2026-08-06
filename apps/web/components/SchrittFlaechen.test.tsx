// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neuesProjekt } from '../lib/model';
import { SchrittFlaechen } from './SchrittFlaechen';

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Kompakte Flächengrunddaten', () => {
  it('zeigt alle häufigen Angaben zusammen und Sondermaße nur bei Bedarf', () => {
    const projekt = neuesProjekt();
    const onChange = vi.fn();
    const { getByLabelText, queryByText, rerender } = render(
      <SchrittFlaechen
        projekt={projekt}
        onChange={onChange}
        nurFlaecheId="p1"
        eingebettet
        onFertig={vi.fn()}
      />,
    );

    expect(getByLabelText('Art der Fläche')).toBeTruthy();
    expect(getByLabelText('Dachform')).toBeTruthy();
    expect(getByLabelText('Ausrichtung')).toBeTruthy();
    expect(getByLabelText(/^Azimut/)).toBeTruthy();
    expect(getByLabelText(/^Neigung/)).toBeTruthy();
    expect(queryByText('Firstbreite oben')).toBeNull();

    fireEvent.change(getByLabelText('Dachform'), { target: { value: 'trapez' } });
    const geaendert = onChange.mock.calls.at(-1)?.[0];
    rerender(
      <SchrittFlaechen
        projekt={geaendert}
        onChange={onChange}
        nurFlaecheId="p1"
        eingebettet
        onFertig={vi.fn()}
      />,
    );
    expect(getByLabelText(/^Firstbreite oben/)).toBeTruthy();
  });
});
