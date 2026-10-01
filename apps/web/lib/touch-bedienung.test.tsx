// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTouchBedienung } from './touch-bedienung';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('erkennt Touch auch bei einem primären Trackpad', () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal('navigator', { maxTouchPoints: 5 });
  function Test() { const [touch] = useTouchBedienung(); return <span>{touch ? 'Touch' : 'Maus'}</span>; }
  expect(render(<Test />).getByText('Touch')).toBeTruthy();
});
