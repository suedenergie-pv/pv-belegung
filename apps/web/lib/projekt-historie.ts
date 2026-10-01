import type { Projekt } from './model';

/** Compare only changed branches; photo strings and unchanged objects retain their references. */
function gleich(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const links = Object.keys(a);
  const rechts = Object.keys(b);
  return links.length === rechts.length && links.every((key) =>
    Object.prototype.hasOwnProperty.call(b, key) &&
    gleich((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

interface Verlauf {
  vorher: Projekt[];
  nachher: Projekt[];
  gesten: Set<string>;
  entwurf?: { vorher: Projekt; nachher: Projekt };
}

/** Session-only history. Callers update Projekt immutably; no photo blobs are cloned. */
export class ProjektHistorien {
  private projekte = new Map<string, Verlauf>();
  constructor(private readonly maximum = 20) {}

  private verlauf(id: string): Verlauf {
    let wert = this.projekte.get(id);
    if (!wert) {
      wert = { vorher: [], nachher: [], gesten: new Set() };
      this.projekte.set(id, wert);
    }
    return wert;
  }

  begin(id: string, geste: string) { this.verlauf(id).gesten.add(geste); }

  record(id: string, vorher: Projekt, nachher: Projekt) {
    if (gleich(vorher, nachher)) return;
    const v = this.verlauf(id);
    if (v.gesten.size) {
      v.entwurf = { vorher: v.entwurf?.vorher ?? vorher, nachher };
    } else {
      v.vorher = [...v.vorher.slice(-(this.maximum - 1)), vorher];
      v.nachher = [];
    }
  }

  end(id: string, geste?: string) {
    const v = this.verlauf(id);
    if (geste) v.gesten.delete(geste);
    else v.gesten.clear();
    if (v.gesten.size || !v.entwurf) return;
    const { vorher, nachher } = v.entwurf;
    v.entwurf = undefined;
    if (!gleich(vorher, nachher)) {
      v.vorher = [...v.vorher.slice(-(this.maximum - 1)), vorher];
      v.nachher = [];
    }
  }

  status(id: string) {
    const v = this.verlauf(id);
    const offen = !!v.entwurf && !gleich(v.entwurf.vorher, v.entwurf.nachher);
    return {
      undoCount: Math.min(this.maximum, v.vorher.length + (offen ? 1 : 0)),
      redoCount: offen ? 0 : v.nachher.length,
    };
  }

  undo(id: string, aktuell: Projekt): Projekt | undefined {
    this.end(id);
    const v = this.verlauf(id);
    const vorher = v.vorher.pop();
    if (vorher) v.nachher.push(aktuell);
    return vorher;
  }

  redo(id: string, aktuell: Projekt): Projekt | undefined {
    this.end(id);
    const v = this.verlauf(id);
    const nachher = v.nachher.pop();
    if (nachher) v.vorher.push(aktuell);
    return nachher;
  }

  forget(id: string) { this.projekte.delete(id); }
}
