// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTouchBedienung } from './touch-bedienung';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('behandelt einen Touchscreen mit primärer Maus oder Trackpad zunächst als direkte Eingabe', () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal('navigator', { maxTouchPoints: 5 });
  function Test() { const [touch] = useTouchBedienung(); return <span>{touch ? 'Touch' : 'Maus'}</span>; }
  expect(render(<Test />).getByText('Maus')).toBeTruthy();
});

it('startet beim primären Touchzeiger mit Fadenkreuz und erlaubt beide Eingaben im Wechsel', () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', vi.fn((query) => ({ matches: query === '(pointer: coarse)', addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  function Test() {
    const [touch, finger, maus] = useTouchBedienung();
    return <><span>{touch ? 'Touch' : 'Maus'}</span><button onClick={finger}>Finger</button><button onClick={maus}>Direkt</button></>;
  }
  const ui = render(<Test />);
  expect(ui.getByText('Touch')).toBeTruthy();
  fireEvent.click(ui.getByText('Direkt'));
  expect(ui.getByText('Maus')).toBeTruthy();
  fireEvent.click(ui.getByText('Finger'));
  expect(ui.getByText('Touch')).toBeTruthy();
});
