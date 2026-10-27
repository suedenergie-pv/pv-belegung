// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlachdachFeldEditor } from './FlachdachFeldEditor';
afterEach(cleanup);
describe('Flachdachfeld genau ausrichten', () => {
  it('übernimmt gültige Gradwerte ausdrücklich, bietet links/rechts und Reset an', () => {
    const onWinkel = vi.fn(), onDrehen = vi.fn();
    render(<FlachdachFeldEditor winkel={0} suedWinkel={37.5} anzahl={1} module={16} onWinkel={onWinkel} onDrehen={onDrehen} />);
    fireEvent.change(screen.getByLabelText('Felddrehung in Grad'), { target: { value: '15,5' } });
    expect(onWinkel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Winkel setzen')); expect(onWinkel).toHaveBeenLastCalledWith(15.5);
    fireEvent.click(screen.getByLabelText('Feld 5 Grad nach links drehen')); expect(onDrehen).toHaveBeenLastCalledWith(-5);
    fireEvent.click(screen.getByText('Am Kompass ausrichten')); expect(onWinkel).toHaveBeenLastCalledWith(37.5);
  });
  it.each(['', 'foo', '361', '-361'])('verwirft ungültige Eingabe %s statt still 0° zu setzen', eingabe => {
    const onWinkel = vi.fn();
    render(<FlachdachFeldEditor winkel={15} anzahl={1} module={0} onWinkel={onWinkel} onDrehen={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Felddrehung in Grad'), { target: { value: eingabe } });
    fireEvent.click(screen.getByText('Winkel setzen'));
    expect(onWinkel).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('zeigt unterschiedliche Winkel ohne irreführenden gemeinsamen Wert', () => {
    render(<FlachdachFeldEditor winkel={null} anzahl={2} module={20} onWinkel={vi.fn()} onDrehen={vi.fn()} />);
    expect(screen.getByPlaceholderText('Verschiedene')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('20 Module');
  });
});
