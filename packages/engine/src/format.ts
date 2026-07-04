/**
 * Zahlformat für Regel-Meldungen: de-DE (SPEC §7 Beispiel „Winter-Voc 1.052 V").
 */
export function fmt(value: number, maxFractionDigits = 1): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: maxFractionDigits });
}
