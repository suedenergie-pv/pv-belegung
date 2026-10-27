import { describe, expect, it } from 'vitest';
import { azimutLabel } from './richtungs-label';

describe('Himmelsrichtungen in Kundenunterlagen', () => {
  it.each([
    [0, 'Nord'], [15, 'Nord'], [45, 'Nord-Ost'], [90, 'Ost'],
    [135, 'Süd-Ost'], [180, 'Süd'], [202, 'Süd'], [225, 'Süd-West'],
    [270, 'West'], [315, 'Nord-West'], [350, 'Nord'], [360, 'Nord'],
  ])('beschriftet %s als %s ohne Kompassgradzahl', (wert, name) => {
    expect(azimutLabel(wert as number)).toBe(name);
    expect(azimutLabel(wert as number)).not.toMatch(/[\d°]/);
  });

  it.each([NaN, Infinity, -Infinity])('erfindet bei ungültiger Richtung %s keine Himmelsrichtung', wert => {
    expect(azimutLabel(wert)).toBe('Richtung offen');
  });
});
