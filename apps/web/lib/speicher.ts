import {
  migriereProjekt,
  migriereWorkflowSchritt,
  neueProjektId,
  type Projekt,
  type ProjektDb,
  type ProjektEintrag,
} from './model';

const ALT_EINZEL_KEY = 'pv-belegung-wizard-v1';
const ALT_PROJEKTE_KEY = 'pv-belegung-projekte-v1';
const PROJEKTE_KEY = 'pv-belegung-projekte-v2';
const SPEICHER_VERSION = 2 as const;
const WORKFLOW_VERSION = 2 as const;
const FOTO_DB = 'pv-belegung-fotos-v1';
const FOTO_STORE = 'fotos';

export const SPEICHER_SCHLUESSEL = {
  altEinzel: ALT_EINZEL_KEY,
  altProjekte: ALT_PROJEKTE_KEY,
  aktuell: PROJEKTE_KEY,
} as const;

interface PersistierteDb extends ProjektDb {
  speicherVersion: typeof SPEICHER_VERSION;
}

interface FotoDatensatz {
  key: string;
  projektId: string;
  fotoId: string;
  dataUrl: string;
}

export type SpeicherErgebnis =
  | { status: 'erfolg'; db: ProjektDb; migriert?: boolean }
  | { status: 'kapazitaet'; grund: string; rohdaten: string }
  | { status: 'reparatur'; grund: string; rohdaten: string };

export type ImportErgebnis =
  | { status: 'erfolg'; db: ProjektDb; importiert: number }
  | Exclude<SpeicherErgebnis, { status: 'erfolg' }>;

const leereDb = (): ProjektDb => ({
  aktivId: null,
  projekte: [],
  workflowVersion: WORKFLOW_VERSION,
});

const fotoKey = (projektId: string, fotoId: string) => `${projektId}::${fotoId}`;

function fehlertext(fehler: unknown): string {
  return fehler instanceof Error ? fehler.message : String(fehler);
}

function istKapazitaetsfehler(fehler: unknown): boolean {
  const name = fehler instanceof DOMException ? fehler.name : '';
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function rohdatenVon(wert: unknown): string {
  try {
    return typeof wert === 'string' ? wert : JSON.stringify(wert, null, 2);
  } catch {
    return 'Rohdaten konnten nicht serialisiert werden.';
  }
}

function anfrage<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Anfrage fehlgeschlagen.'));
  });
}

function transaktionFertig(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen.'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen.'));
  });
}

async function oeffneFotoDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('Der Browser stellt keinen IndexedDB-Fotospeicher bereit.');
  }
  const request = window.indexedDB.open(FOTO_DB, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(FOTO_STORE)) {
      request.result.createObjectStore(FOTO_STORE, { keyPath: 'key' });
    }
  };
  return anfrage(request);
}

function alleFotos(db: ProjektDb): FotoDatensatz[] {
  return db.projekte.flatMap((eintrag) =>
    eintrag.projekt.fotos.map((foto) => ({
      key: fotoKey(eintrag.id, foto.id),
      projektId: eintrag.id,
      fotoId: foto.id,
      dataUrl: foto.dataUrl,
    })),
  );
}

async function schreibeUndPruefeFotos(db: ProjektDb): Promise<void> {
  const fotos = alleFotos(db);
  if (fotos.length === 0) return;
  if (fotos.some((foto) => !foto.dataUrl.startsWith('data:image/'))) {
    throw new Error('Mindestens ein Foto ist leer oder beschädigt.');
  }

  const datenbank = await oeffneFotoDb();
  try {
    const schreiben = datenbank.transaction(FOTO_STORE, 'readwrite');
    const schreibenFertig = transaktionFertig(schreiben);
    const store = schreiben.objectStore(FOTO_STORE);
    for (const foto of fotos) store.put(foto);
    await schreibenFertig;

    const pruefen = datenbank.transaction(FOTO_STORE, 'readonly');
    const pruefenFertig = transaktionFertig(pruefen);
    const pruefStore = pruefen.objectStore(FOTO_STORE);
    const gelesen = await Promise.all(
      fotos.map((foto) => anfrage(pruefStore.get(foto.key)) as Promise<FotoDatensatz | undefined>),
    );
    await pruefenFertig;
    gelesen.forEach((foto, index) => {
      if (!foto || foto.dataUrl !== fotos[index]!.dataUrl) {
        throw new Error(`Foto „${fotos[index]!.fotoId}“ konnte nicht vollständig zurückgelesen werden.`);
      }
    });
  } finally {
    datenbank.close();
  }
}

async function ladeFoto(projektId: string, fotoId: string): Promise<string> {
  const datenbank = await oeffneFotoDb();
  try {
    const tx = datenbank.transaction(FOTO_STORE, 'readonly');
    const fertig = transaktionFertig(tx);
    const datensatz = await anfrage(tx.objectStore(FOTO_STORE).get(fotoKey(projektId, fotoId))) as
      | FotoDatensatz
      | undefined;
    await fertig;
    if (!datensatz?.dataUrl?.startsWith('data:image/')) {
      throw new Error(`Gespeichertes Foto „${fotoId}“ fehlt oder ist beschädigt.`);
    }
    return datensatz.dataUrl;
  } finally {
    datenbank.close();
  }
}

function ohneFotoBloecke(db: ProjektDb): PersistierteDb {
  return {
    ...db,
    speicherVersion: SPEICHER_VERSION,
    workflowVersion: WORKFLOW_VERSION,
    projekte: db.projekte.map((eintrag) => ({
      ...eintrag,
      projekt: {
        ...eintrag.projekt,
        fotos: eintrag.projekt.fotos.map((foto) => ({ ...foto, dataUrl: '' })),
      },
    })),
  };
}

function pruefeProjektRohdaten(projekt: Projekt, kontext: string): void {
  if (!projekt || !Array.isArray(projekt.flaechen)) {
    throw new Error(`${kontext}: Dachflächen fehlen.`);
  }
  if (projekt.fotos !== undefined && !Array.isArray(projekt.fotos)) {
    throw new Error(`${kontext}: Fotoliste ist beschädigt.`);
  }
  const fotoIds = new Set<string>();
  for (const foto of projekt.fotos ?? []) {
    if (
      !foto ||
      typeof foto.id !== 'string' ||
      !foto.id ||
      typeof foto.dataUrl !== 'string' ||
      !foto.dataUrl.startsWith('data:image/') ||
      !Number.isFinite(foto.breitePx) ||
      !Number.isFinite(foto.hoehePx)
    ) {
      throw new Error(`${kontext}: Mindestens ein Foto ist unvollständig.`);
    }
    if (fotoIds.has(foto.id)) throw new Error(`${kontext}: Doppelte Foto-ID „${foto.id}“.`);
    fotoIds.add(foto.id);
  }
}

function normalisiereDb(roh: unknown, bereitsNeuerWorkflow: boolean, leereErlaubt = false): ProjektDb {
  if (!roh || typeof roh !== 'object' || !Array.isArray((roh as Partial<ProjektDb>).projekte)) {
    throw new Error('Die Projektliste fehlt oder ist beschädigt.');
  }
  const eingang = roh as Partial<ProjektDb>;
  if (!leereErlaubt && eingang.projekte!.length === 0) {
    throw new Error('Der gespeicherte Projektstand enthält kein Projekt.');
  }

  const ids = new Set<string>();
  const projekte = eingang.projekte!.map((wert, index) => {
    const eintrag = wert as Partial<ProjektEintrag>;
    if (
      typeof eintrag.id !== 'string' ||
      !eintrag.id ||
      !eintrag.projekt ||
      typeof eintrag.erstelltAm !== 'number' ||
      !Number.isFinite(eintrag.erstelltAm) ||
      typeof eintrag.geaendertAm !== 'number' ||
      !Number.isFinite(eintrag.geaendertAm)
    ) {
      throw new Error(`Projekt ${index + 1} ist strukturell beschädigt.`);
    }
    if (ids.has(eintrag.id)) throw new Error(`Doppelte Projekt-ID „${eintrag.id}“.`);
    ids.add(eintrag.id);
    pruefeProjektRohdaten(eintrag.projekt, `Projekt ${index + 1}`);
    return {
      id: eintrag.id,
      projekt: migriereProjekt(eintrag.projekt),
      schritt: bereitsNeuerWorkflow
        ? Math.max(0, Math.min(2, Number(eintrag.schritt) || 0))
        : migriereWorkflowSchritt(Number(eintrag.schritt) || 0),
      erstelltAm: eintrag.erstelltAm,
      geaendertAm: eintrag.geaendertAm,
    } satisfies ProjektEintrag;
  });

  if (projekte.length > 0 && (typeof eingang.aktivId !== 'string' || !ids.has(eingang.aktivId))) {
    throw new Error('Das aktive Projekt verweist auf keinen gültigen Eintrag.');
  }
  return {
    aktivId: projekte.length > 0 ? eingang.aktivId! : null,
    projekte,
    workflowVersion: WORKFLOW_VERSION,
  };
}

async function hydriereV2(roh: string): Promise<ProjektDb> {
  const parsed = JSON.parse(roh) as Partial<PersistierteDb>;
  if (parsed.speicherVersion !== SPEICHER_VERSION || !Array.isArray(parsed.projekte)) {
    throw new Error('Unbekannte oder beschädigte Speicherversion.');
  }
  const hydriert: PersistierteDb = {
    ...parsed,
    aktivId: parsed.aktivId ?? null,
    projekte: await Promise.all(parsed.projekte.map(async (eintrag, index) => {
      if (!eintrag?.projekt || !Array.isArray(eintrag.projekt.fotos)) {
        throw new Error(`Projekt ${index + 1}: Fotometadaten fehlen.`);
      }
      return {
        ...eintrag,
        projekt: {
          ...eintrag.projekt,
          fotos: await Promise.all(eintrag.projekt.fotos.map(async (foto) => {
            if (!foto || typeof foto.id !== 'string' || !foto.id) {
              throw new Error(`Projekt ${index + 1}: Foto-ID fehlt.`);
            }
            return { ...foto, dataUrl: await ladeFoto(eintrag.id, foto.id) };
          })),
        },
      };
    })),
    workflowVersion: WORKFLOW_VERSION,
    speicherVersion: SPEICHER_VERSION,
  };
  return normalisiereDb(hydriert, true);
}

export async function speichereProjekte(db: ProjektDb): Promise<SpeicherErgebnis> {
  if (typeof window === 'undefined') return { status: 'erfolg', db };
  const rohdaten = rohdatenVon(db);
  try {
    const geprueft = normalisiereDb(db, true, true);
    await schreibeUndPruefeFotos(geprueft);
    window.localStorage.setItem(PROJEKTE_KEY, JSON.stringify(ohneFotoBloecke(geprueft)));
    return { status: 'erfolg', db: geprueft };
  } catch (fehler) {
    if (istKapazitaetsfehler(fehler)) {
      return {
        status: 'kapazitaet',
        grund: 'Der Browser-Fotospeicher ist voll. Der letzte vollständige Stand bleibt erhalten.',
        rohdaten,
      };
    }
    return { status: 'reparatur', grund: fehlertext(fehler), rohdaten };
  }
}

function reparatur(
  grund: string,
  rohdaten: string,
): Extract<SpeicherErgebnis, { status: 'reparatur' }> {
  return { status: 'reparatur', grund, rohdaten };
}

async function migriereAlteProjektDb(roh: string): Promise<SpeicherErgebnis> {
  try {
    const parsed = JSON.parse(roh) as Partial<ProjektDb>;
    const db = normalisiereDb(parsed, parsed.workflowVersion === WORKFLOW_VERSION);
    const gespeichert = await speichereProjekte(db);
    if (gespeichert.status !== 'erfolg') return { ...gespeichert, rohdaten: roh };
    window.localStorage.removeItem(ALT_PROJEKTE_KEY);
    return { ...gespeichert, migriert: true };
  } catch (fehler) {
    return reparatur(fehlertext(fehler), roh);
  }
}

async function migriereAltenEinzelstand(roh: string): Promise<SpeicherErgebnis> {
  try {
    const stand = JSON.parse(roh) as { projekt?: Projekt; schritt?: number };
    if (!stand.projekt) throw new Error('Im alten Einzelstand fehlt das Projekt.');
    pruefeProjektRohdaten(stand.projekt, 'Alter Einzelstand');
    const jetzt = Date.now();
    const eintrag: ProjektEintrag = {
      id: neueProjektId(),
      projekt: migriereProjekt(stand.projekt),
      schritt: migriereWorkflowSchritt(Number(stand.schritt) || 0),
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    };
    const db: ProjektDb = {
      aktivId: eintrag.id,
      projekte: [eintrag],
      workflowVersion: WORKFLOW_VERSION,
    };
    const gespeichert = await speichereProjekte(db);
    if (gespeichert.status !== 'erfolg') return { ...gespeichert, rohdaten: roh };
    window.localStorage.removeItem(ALT_EINZEL_KEY);
    return { ...gespeichert, migriert: true };
  } catch (fehler) {
    return reparatur(fehlertext(fehler), roh);
  }
}

export async function ladeProjekte(): Promise<SpeicherErgebnis> {
  if (typeof window === 'undefined') return { status: 'erfolg', db: leereDb() };
  const aktuell = window.localStorage.getItem(PROJEKTE_KEY);
  if (aktuell !== null) {
    try {
      return { status: 'erfolg', db: await hydriereV2(aktuell) };
    } catch (fehler) {
      return reparatur(fehlertext(fehler), aktuell);
    }
  }

  const altProjekte = window.localStorage.getItem(ALT_PROJEKTE_KEY);
  if (altProjekte !== null) return migriereAlteProjektDb(altProjekte);
  const altEinzel = window.localStorage.getItem(ALT_EINZEL_KEY);
  if (altEinzel !== null) return migriereAltenEinzelstand(altEinzel);
  return { status: 'erfolg', db: leereDb() };
}

export function komplettExportJson(db: ProjektDb): string {
  return JSON.stringify(
    {
      format: 'pvbelegung',
      version: 1,
      exportiertAm: new Date().toISOString(),
      db,
    },
    null,
    2,
  );
}

export function komplettExportDateiname(): string {
  return `pv-belegung-komplett-${new Date().toISOString().slice(0, 10)}.pvbelegung.json`;
}

export async function importiereKomplettExport(
  text: string,
  bestehend: ProjektDb,
): Promise<ImportErgebnis> {
  try {
    const datei = JSON.parse(text) as { format?: string; version?: number; db?: unknown };
    if (datei.format !== 'pvbelegung' || datei.version !== 1 || !datei.db) {
      throw new Error('Die Datei ist kein unterstützter .pvbelegung.json-Komplettexport.');
    }
    const importDb = normalisiereDb(datei.db, true);
    const reserviert = new Set(bestehend.projekte.map((eintrag) => eintrag.id));
    const importiert = importDb.projekte.map((eintrag) => {
      let id = eintrag.id;
      while (reserviert.has(id)) id = neueProjektId();
      reserviert.add(id);
      return id === eintrag.id ? eintrag : { ...eintrag, id };
    });
    const kombiniert: ProjektDb = {
      aktivId: bestehend.aktivId ?? importiert[0]?.id ?? null,
      projekte: [...bestehend.projekte, ...importiert],
      workflowVersion: WORKFLOW_VERSION,
    };
    const gespeichert = await speichereProjekte(kombiniert);
    if (gespeichert.status !== 'erfolg') return gespeichert;
    return { status: 'erfolg', db: gespeichert.db, importiert: importiert.length };
  } catch (fehler) {
    return reparatur(fehlertext(fehler), text);
  }
}

/** Wird erst nach Ablauf der Lösch-Rückgängigfrist aufgerufen. */
export async function loescheProjektFotos(projektId: string): Promise<void> {
  const datenbank = await oeffneFotoDb();
  try {
    const lesen = datenbank.transaction(FOTO_STORE, 'readonly');
    const lesenFertig = transaktionFertig(lesen);
    const keys = await anfrage(lesen.objectStore(FOTO_STORE).getAllKeys());
    await lesenFertig;
    const loeschen = datenbank.transaction(FOTO_STORE, 'readwrite');
    const loeschenFertig = transaktionFertig(loeschen);
    const store = loeschen.objectStore(FOTO_STORE);
    keys
      .filter((key) => typeof key === 'string' && key.startsWith(`${projektId}::`))
      .forEach((key) => store.delete(key));
    await loeschenFertig;
  } finally {
    datenbank.close();
  }
}
