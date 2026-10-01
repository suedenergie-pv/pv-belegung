'use client';

import { useEffect, useState } from 'react';

/** Auch iPads mit angeschlossenem Trackpad behalten ihre Touch-Bedienung. */
export function useTouchBedienung() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.('(any-pointer: coarse)');
    const pruefen = () => setTouch(!!media?.matches || navigator.maxTouchPoints > 0);
    pruefen();
    media?.addEventListener?.('change', pruefen);
    return () => media?.removeEventListener?.('change', pruefen);
  }, []);
  return [touch, () => setTouch(true)] as const;
}
