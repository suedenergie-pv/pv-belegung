/**
 * Kalibrierungs-Testrunner (CLAUDE.md Bau-Reihenfolge 3, SPEC §14).
 *
 * Gibt die Fallstruktur aus kalibrierung.md (Fälle 1–9 je Gruppe) für jedes
 * Katalogmodul × jeden Katalog-WR aus, Engine-Spalte automatisch befüllt.
 * Genrih muss nur noch die PV*SOL-Werte daneben legen.
 *
 * Aufruf: npm run kalibrierung   (Root oder packages/engine)
 * Schreibt kalibrierung-engine-output.md ins Repo-Root und druckt nach stdout.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INVERTERS } from '../catalog/inverters';
import { MODULES } from '../catalog/modules';
import { DEFAULT_DESIGN_PARAMS } from '../constants/auslegung';
import { checkStringPlan } from '../engine';
import { fmt } from '../format';
import { maxModulesPerString, minModulesPerString } from '../stringlimits';
import { vocColdV, vmpHotV } from '../temperature';
import type {
  InverterType,
  ModuleType,
  PlaneOrientation,
  PlannedString,
  StringPlanInput,
  StringPlanResult,
} from '../types';

/** Gruppenbuchstaben lt. kalibrierung.md (A/B/D; C = reale Projekte, macht der PL). */
const GROUP_OF_MODULE: Record<string, string> = {
  'aiko-a485-mce54db': 'A',
  'jw-hd96n-r2-460': 'B',
  'aiko-a480-mah54mw': 'D',
};

const PLANE_SUED: PlaneOrientation = { id: 'p-sued', azimuthDeg: 180, pitchDeg: 35 };
const PLANE_OST: PlaneOrientation = { id: 'p-ost', azimuthDeg: 90, pitchDeg: 35 };
const PLANE_WEST: PlaneOrientation = { id: 'p-west', azimuthDeg: 270, pitchDeg: 35 };
const PLANES = [PLANE_SUED, PLANE_OST, PLANE_WEST];

function mkString(id: string, moduleTypeId: string, n: number, planeId = 'p-sued'): PlannedString {
  return { id, modules: Array.from({ length: n }, () => ({ moduleTypeId, planeId })) };
}

function mkInput(inverter: InverterType, mppts: StringPlanInput['mppts']): StringPlanInput {
  return { inverter, moduleTypes: MODULES, planes: PLANES, mppts };
}

function verdict(result: StringPlanResult): string {
  const failed = Object.entries(result.regeln)
    .filter(([, s]) => s === 'fail')
    .map(([id]) => id);
  const warned = Object.entries(result.regeln)
    .filter(([, s]) => s === 'warn')
    .map(([id]) => id);
  const warnSuffix = warned.length > 0 ? ` ⚠ WARN(${warned.join(',')})` : '';
  return failed.length === 0 ? `PASS${warnSuffix}` : `FAIL(${failed.join(',')})${warnSuffix}`;
}

interface CaseRow {
  nr: string;
  besetzung: string;
  strings: string;
  pruefziel: string;
  erwartung: string;
  engine: string;
}

function buildCases(letter: string, moduleType: ModuleType, wr: InverterType): CaseRow[] {
  const nMin = minModulesPerString(moduleType, wr);
  const nMax = maxModulesPerString(moduleType, wr);
  const nMitte = Math.round((nMin + nMax) / 2);
  const id = moduleType.id;

  const run = (mppts: StringPlanInput['mppts']): string =>
    verdict(checkStringPlan(mkInput(wr, mppts)));

  // Für Parallel-Fälle den MPPT mit den meisten Strings wählen; hat der WR
  // nirgends ≥ 2 Strings, ist Parallelschaltung nur per Y-Stecker möglich (Fußnote ²).
  const bestMpptIdx = wr.stringsPerMppt.indexOf(Math.max(...wr.stringsPerMppt)) + 1;
  const parallelFussnote = Math.max(...wr.stringsPerMppt) < 2 ? '²' : '';

  const rows: CaseRow[] = [];

  rows.push({
    nr: `${letter}1`,
    besetzung: `${nMin} (n_min)`,
    strings: '1',
    pruefziel: 'MPPT-Untergrenze heiß',
    erwartung: 'PASS',
    engine: run([{ mpptIndex: 1, strings: [mkString('S1', id, nMin)] }]),
  });

  rows.push({
    nr: `${letter}2`,
    besetzung: `${nMin - 1} (n_min − 1)`,
    strings: '1',
    pruefziel: 'Unterschreitung',
    erwartung: 'FAIL(R3 o. R5)',
    engine:
      nMin - 1 >= 1
        ? run([{ mpptIndex: 1, strings: [mkString('S1', id, nMin - 1)] }])
        : '— (n_min − 1 < 1)',
  });

  rows.push({
    nr: `${letter}3`,
    besetzung: `${nMitte} (n_mitte)`,
    strings: '1',
    pruefziel: 'Normalfall',
    erwartung: 'PASS',
    engine: run([{ mpptIndex: 1, strings: [mkString('S1', id, nMitte)] }]),
  });

  rows.push({
    nr: `${letter}4`,
    besetzung: `${nMax} (n_max)`,
    strings: '1',
    pruefziel: 'Winter-Voc-Grenze',
    erwartung: 'PASS',
    engine: run([{ mpptIndex: 1, strings: [mkString('S1', id, nMax)] }]),
  });

  rows.push({
    nr: `${letter}5`,
    besetzung: `${nMax + 1} (n_max + 1)`,
    strings: '1',
    pruefziel: 'Überschreitung',
    erwartung: 'FAIL(R1)',
    engine: run([{ mpptIndex: 1, strings: [mkString('S1', id, nMax + 1)] }]),
  });

  rows.push({
    nr: `${letter}6`,
    besetzung: `${nMitte}`,
    strings: `2 parallel (MPPT ${bestMpptIdx})${parallelFussnote}`,
    pruefziel: 'Stromsumme',
    erwartung: 'PASS/FAIL(R6/R7) je WR',
    engine: run([
      { mpptIndex: bestMpptIdx, strings: [mkString('S1', id, nMitte), mkString('S2', id, nMitte)] },
    ]),
  });

  rows.push({
    nr: `${letter}7`,
    besetzung: `${nMitte} + ${nMitte - 1}`,
    strings: `2 parallel, ungleich (MPPT ${bestMpptIdx})${parallelFussnote}`,
    pruefziel: 'Stringlängen-Gleichheit',
    erwartung: 'FAIL(R8)',
    engine: run([
      {
        mpptIndex: bestMpptIdx,
        strings: [mkString('S1', id, nMitte), mkString('S2', id, nMitte - 1)],
      },
    ]),
  });

  const halbOst = Math.floor(nMitte / 2);
  rows.push({
    nr: `${letter}8`,
    besetzung: `${nMitte} (${halbOst} Ost / ${nMitte - halbOst} West)`,
    strings: '1, 2 Ausrichtungen',
    pruefziel: 'Ausrichtungs-Mix',
    erwartung: 'FAIL(R9)¹',
    engine: run([
      {
        mpptIndex: 1,
        strings: [
          {
            id: 'S1',
            modules: [
              ...Array.from({ length: halbOst }, () => ({ moduleTypeId: id, planeId: 'p-ost' })),
              ...Array.from({ length: nMitte - halbOst }, () => ({
                moduleTypeId: id,
                planeId: 'p-west',
              })),
            ],
          },
        ],
      },
    ]),
  });

  // Maximal mögliche DC-Leistung: alle MPPTs × jeweilige Stringanzahl × n_max
  const vollbelegung = Array.from({ length: wr.mpptCount }, (_, i) => ({
    mpptIndex: i + 1,
    strings: Array.from({ length: wr.stringsPerMppt[i]! }, (_, k) =>
      mkString(`S${i + 1}.${k + 1}`, id, nMax),
    ),
  }));
  const totalStrings = wr.stringsPerMppt.reduce((a, b) => a + b, 0);
  const kwpVoll = (totalStrings * nMax * moduleType.pmaxW) / 1000;
  rows.push({
    nr: `${letter}9`,
    besetzung: `${totalStrings} × ${nMax} = ${fmt(kwpVoll, 2)} kWp`,
    strings: 'alle MPPTs voll',
    pruefziel: 'Überbelegung DC:AC',
    erwartung: 'FAIL(R11)',
    engine: run(vollbelegung),
  });

  return rows;
}

function tableFor(letter: string, moduleType: ModuleType, wr: InverterType): string {
  const params = DEFAULT_DESIGN_PARAMS;
  const nMin = minModulesPerString(moduleType, wr);
  const nMax = maxModulesPerString(moduleType, wr);
  const nMitte = Math.round((nMin + nMax) / 2);
  const lines: string[] = [];
  lines.push(`### Gruppe ${letter} — ${moduleType.name} × ${wr.name}`);
  lines.push('');
  lines.push(
    `Modul: Voc_cold ≈ ${fmt(vocColdV(moduleType, params), 2)} V · Vmp_hot ≈ ` +
      `${fmt(vmpHotV(moduleType, params), 2)} V · Isc ×${fmt(params.iscSafetyFactor, 2)} = ` +
      `${fmt(moduleType.iscA * params.iscSafetyFactor, 2)} A — ` +
      `n_min=${nMin}, n_mitte=${nMitte}, n_max=${nMax}`,
  );
  lines.push('');
  lines.push('| # | Module/String | Strings/MPPT | Prüfziel | Erwartung | Engine | PV*SOL | Match |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const row of buildCases(letter, moduleType, wr)) {
    lines.push(
      `| ${row.nr} | ${row.besetzung} | ${row.strings} | ${row.pruefziel} | ${row.erwartung} | ${row.engine} | | |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  let commit = 'unbekannt';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim();
  } catch {
    // kein Git verfügbar — Feld bleibt 'unbekannt'
  }

  const hasDummies = INVERTERS.some((wr) => wr.isDummy);
  const out: string[] = [];
  out.push('# Engine-Ausgabe Kalibrierungsmatrix');
  out.push('');
  out.push(`Generiert: ${new Date().toISOString()} · Engine-Commit: \`${commit}\``);
  out.push(
    `Auslegung: T_min ${fmt(DEFAULT_DESIGN_PARAMS.tMinC)} °C · T_cell_max +${fmt(DEFAULT_DESIGN_PARAMS.tCellMaxC)} °C · Isc-Faktor ${fmt(DEFAULT_DESIGN_PARAMS.iscSafetyFactor, 2)}`,
  );
  out.push('');
  if (hasDummies) {
    out.push(
      '> ⚠️⚠️ **NUR DUMMY-WR IM KATALOG** (SPEC §6 TODO). Diese Ausgabe demonstriert den',
    );
    out.push(
      '> Runner und ist KEINE Kalibrierungsgrundlage. Sobald echte WR-Daten im Katalog',
    );
    out.push('> sind, neu laufen lassen und erst dann PV*SOL-Werte eintragen (SPEC §14).');
    out.push('');
  }
  out.push(
    '¹ Bei WR mit Schatten-Management ist der Ausrichtungs-Mix zulässig (SPEC §7 R9-Ausnahme) — Engine meldet dann PASS.',
  );
  out.push(
    '² WR hat an keinem MPPT ≥ 2 String-Eingänge — Parallelschaltung nur per Y-Stecker; Fall elektrisch trotzdem gerechnet.',
  );
  out.push('');

  // Optionaler Filter: npm run kalibrierung -- <id-teilstring>, z. B. "sh25t" oder "ecoflow"
  const filter = (process.argv[2] ?? '').toLowerCase();
  const wrList = filter ? INVERTERS.filter((wr) => wr.id.includes(filter)) : INVERTERS;
  if (filter) {
    out.push(`**Filter aktiv:** \`${filter}\` → ${wrList.length} von ${INVERTERS.length} WR.`);
    out.push('');
  }

  for (const wr of wrList) {
    out.push(
      `## WR: ${wr.name} (maxDC ${fmt(wr.maxDcVoltageV)} V · MPPT ${fmt(wr.mpptVoltageRange[0])}–${fmt(wr.mpptVoltageRange[1])} V · Start ${fmt(wr.startupVoltageV)} V · maxIn ${wr.maxInputCurrentPerMpptA.map((a) => fmt(a)).join('/')} A · maxSC ${wr.maxShortCircuitCurrentPerMpptA.map((a) => fmt(a)).join('/')} A · Strings ${wr.stringsPerMppt.join('/')} · DC:AC ≤ ${fmt(wr.maxDcAcRatio, 2)})${wr.isDummy ? ' ⚠️ DUMMY' : ''}`,
    );
    out.push('');
    for (const moduleType of MODULES) {
      const letter = GROUP_OF_MODULE[moduleType.id] ?? '?';
      out.push(tableFor(letter, moduleType, wr));
    }
  }

  out.push('## Gruppe C — Grenzfall-Sammlung');
  out.push('');
  out.push(
    'C1–C3 sind reale Kundenprojekte (kalibrierung.md) — werden vom PL definiert und dann hier ergänzt.',
  );
  out.push('');

  const text = out.join('\n');
  const outPath = resolve(repoRoot, 'kalibrierung-engine-output.md');
  writeFileSync(outPath, text, 'utf8');
  console.log(text);
  console.log(`\n→ geschrieben nach ${outPath}`);
}

main();
