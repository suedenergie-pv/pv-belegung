# Graph Report - .  (2026-07-10)

## Corpus Check
- Corpus is ~42,263 words - fits in a single context window. You may not need a graph.

## Summary
- 332 nodes · 899 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Wechselrichter- & Modul-Katalog|Wechselrichter- & Modul-Katalog]]
- [[_COMMUNITY_String-Regeln R1-R12|String-Regeln R1-R12]]
- [[_COMMUNITY_Foto-Markierung|Foto-Markierung]]
- [[_COMMUNITY_Wizard & Datenmodell|Wizard & Datenmodell]]
- [[_COMMUNITY_Gesamtansicht & Export|Gesamtansicht & Export]]
- [[_COMMUNITY_Dach-Modul-Rendering|Dach-/Modul-Rendering]]
- [[_COMMUNITY_Web-App-Dependencies|Web-App-Dependencies]]
- [[_COMMUNITY_Belegungs-Engine|Belegungs-Engine]]
- [[_COMMUNITY_TypeScript-Config I|TypeScript-Config I]]
- [[_COMMUNITY_Wizard-Schritte (UI)|Wizard-Schritte (UI)]]
- [[_COMMUNITY_Engine-Package-Config|Engine-Package-Config]]
- [[_COMMUNITY_TypeScript-Config II|TypeScript-Config II]]
- [[_COMMUNITY_Root-PackageScripts|Root-Package/Scripts]]
- [[_COMMUNITY_App-Layout|App-Layout]]
- [[_COMMUNITY_LogoPDF-Assets|Logo/PDF-Assets]]
- [[_COMMUNITY_Next-Config|Next-Config]]
- [[_COMMUNITY_Tailwind-Config|Tailwind-Config]]

## God Nodes (most connected - your core abstractions)
1. `checkStringPlan()` - 20 edges
2. `modulById()` - 17 edges
3. `fmt()` - 17 edges
4. `compilerOptions` - 16 edges
5. `fmtDe()` - 14 edges
6. `buildPlanCalc()` - 13 edges
7. `erzeugeBelegungsPdf()` - 12 edges
8. `ModuleType` - 12 edges
9. `rasterFuer()` - 11 edges
10. `PunktM` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ZeichnenProps` --references--> `PunktM`  [EXTRACTED]
  apps/web/components/DachSvg.tsx → packages/engine/src/geometrie.ts
- `Zeichnung` --references--> `PunktM`  [EXTRACTED]
  apps/web/components/SchrittBelegung.tsx → packages/engine/src/geometrie.ts
- `SchrittStrings()` --calls--> `maxModulesPerString()`  [EXTRACTED]
  apps/web/components/SchrittStrings.tsx → packages/engine/src/stringlimits.ts
- `SchrittStrings()` --calls--> `minModulesPerString()`  [EXTRACTED]
  apps/web/components/SchrittStrings.tsx → packages/engine/src/stringlimits.ts
- `Flaeche` --references--> `RechteckM`  [EXTRACTED]
  apps/web/lib/model.ts → packages/engine/src/geometrie.ts

## Import Cycles
- None detected.

## Communities (20 total, 3 thin omitted)

### Community 0 - "Wechselrichter- & Modul-Katalog"
Cohesion: 0.10
Nodes (35): INVERTERS, AIKO_A480_MAH54MW, AIKO_A485_MCE54DB, JOLYWOOD_JW_HD96N_R2_460, MODULES, buildCases(), CaseRow, GROUP_OF_MODULE (+27 more)

### Community 1 - "String-Regeln R1-R12"
Cohesion: 0.17
Nodes (30): checkR12(), checkR6(), checkR7(), ok(), checkR11(), checkR10(), checkR8(), checkR9() (+22 more)

### Community 2 - "Foto-Markierung"
Cohesion: 0.15
Nodes (26): dateiZuFoto(), deckbreiteDefaultCm(), FotoHintergrund(), Modus, modusKnopfKlasse(), dateiZuBild(), FotoBild, adjugat() (+18 more)

### Community 3 - "Wizard & Datenmodell"
Cohesion: 0.13
Nodes (27): Home(), SCHRITTE, SchrittFlaechen(), SchrittProjekt(), AZIMUT_PRESETS, belegungInput(), besterVersatzFuer(), DachfarbeId (+19 more)

### Community 4 - "Gesamtansicht & Export"
Cohesion: 0.24
Nodes (20): gesamtFlaechenInhalt(), GesamtSvg(), SchrittBelegung(), SchrittExport(), SchrittGesamt(), SchrittStrings(), aktiveModule(), baueEngineInput() (+12 more)

### Community 5 - "Dach-/Modul-Rendering"
Cohesion: 0.13
Nodes (19): DachSvg(), ModulAsset(), moduleAufHomographie(), ZeichnenProps, Zeichnung, Ecken, projPfad(), Dachfarbe (+11 more)

### Community 6 - "Web-App-Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, jspdf, next, @pv-belegung/engine, react, react-dom, devDependencies, autoprefixer (+13 more)

### Community 7 - "Belegungs-Engine"
Cohesion: 0.18
Nodes (17): BelegungInput, BelegungRaster, berechneRaster(), gitterAchse(), ModulPosition, orientierung(), punktInPolygon(), punktSegmentAbstand() (+9 more)

### Community 8 - "TypeScript-Config I"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "Wizard-Schritte (UI)"
Cohesion: 0.32
Nodes (8): Feld(), Karte(), KartenTitel(), ToggleButton(), ZonenBadge(), DACHFARBEN, Projekt, zonenLabel()

### Community 10 - "Engine-Package-Config"
Cohesion: 0.13
Nodes (14): devDependencies, tsx, @types/node, typescript, vitest, main, name, private (+6 more)

### Community 11 - "TypeScript-Config II"
Cohesion: 0.15
Nodes (12): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+4 more)

### Community 12 - "Root-Package/Scripts"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, kalibrierung, test, typecheck (+1 more)

### Community 14 - "Logo/PDF-Assets"
Cohesion: 0.67
Nodes (3): ICON_PFADE, logoPng(), logoSvg()

## Knowledge Gaps
- **88 isolated node(s):** `inter`, `metadata`, `SCHRITTE`, `Modus`, `FotoBild` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkStringPlan()` connect `String-Regeln R1-R12` to `Wechselrichter- & Modul-Katalog`, `Wizard & Datenmodell`, `Gesamtansicht & Export`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `ModuleType` connect `Belegungs-Engine` to `Wechselrichter- & Modul-Katalog`, `Wizard & Datenmodell`, `Dach-/Modul-Rendering`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `buildPlanCalc()` connect `String-Regeln R1-R12` to `Wechselrichter- & Modul-Katalog`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `inter`, `metadata`, `SCHRITTE` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Wechselrichter- & Modul-Katalog` be split into smaller, more focused modules?**
  _Cohesion score 0.09696969696969697 - nodes in this community are weakly interconnected._
- **Should `Foto-Markierung` be split into smaller, more focused modules?**
  _Cohesion score 0.1471264367816092 - nodes in this community are weakly interconnected._
- **Should `Wizard & Datenmodell` be split into smaller, more focused modules?**
  _Cohesion score 0.12561576354679804 - nodes in this community are weakly interconnected._