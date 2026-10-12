// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HoldButton } from './ui';

afterEach(() => vi.useRealTimers());

describe('Tablet-Halteknopf', () => {
  it('löst sofort und wiederholt aus, stoppt aber zuverlässig beim Loslassen', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const { getByRole } = render(<HoldButton onTrigger={fn} title="rechts" intervallMs={100}>→</HoldButton>);
    const button = getByRole('button', { name: 'rechts' });
    fireEvent(button, new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(350));
    expect(fn).toHaveBeenCalledTimes(4);
    fireEvent.pointerUp(button);
    act(() => vi.advanceTimersByTime(500));
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('bleibt deaktiviert vollständig still', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const { getByRole } = render(<HoldButton onTrigger={fn} title="links" disabled>←</HoldButton>);
    fireEvent.pointerDown(getByRole('button', { name: 'links' }));
    act(() => vi.advanceTimersByTime(500));
    expect(fn).not.toHaveBeenCalled();
  });
});

it('löst bei rechter oder mittlerer Maustaste keine Halteaktion aus', () => {
  vi.useFakeTimers();
  const fn = vi.fn();
  const { getByRole } = render(<HoldButton onTrigger={fn} title="Testpfeil">→</HoldButton>);
  for (const button of [1,2]) {
    fireEvent(getByRole('button', { name:'Testpfeil' }), new MouseEvent('pointerdown', { bubbles:true, button }));
    act(() => vi.advanceTimersByTime(500));
  }
  expect(fn).not.toHaveBeenCalled();
});
