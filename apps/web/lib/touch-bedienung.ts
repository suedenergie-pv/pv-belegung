'use client';

import { useEffect, useState } from 'react';

/** Startmodus nach primärem Zeiger; anschließend entscheidet die Eingabe im Bild. */
export function useTouchBedienung() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.('(pointer: coarse)');
    const pruefen = () => setTouch(!!media?.matches);
    pruefen();
    media?.addEventListener?.('change', pruefen);
    return () => media?.removeEventListener?.('change', pruefen);
  }, []);
  return [touch, () => setTouch(true), () => setTouch(false)] as const;
}
