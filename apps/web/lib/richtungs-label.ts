/** Lesbare Himmelsrichtung für Kundenunterlagen, ohne Änderung der Berechnung. */
export function azimutLabel(deg: number): string {
  const namen: [number, string][] = [
    [0, 'Nord'], [45, 'Nord-Ost'], [90, 'Ost'], [135, 'Süd-Ost'],
    [180, 'Süd'], [225, 'Süd-West'], [270, 'West'], [315, 'Nord-West'], [360, 'Nord'],
  ];
  const treffer = namen.find(([d]) => Math.abs(d - deg) <= 22.5);
  return treffer ? treffer[1] : 'Richtung offen';
}
