import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { target, basePath, label } from './static-target.mjs';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const stage = resolve(root, `.release/${target}`);
const marker = join(stage, `.pv-${target}-staging`);
const web = join(stage, 'apps/web');

// Löschung ist auf unseren markierten Build-Ordner begrenzt, nie auf App-Quellen.
if (relative(root, stage) !== `.release${sep}${target}`) throw new Error('Unerwartetes Staging-Ziel.');
if (existsSync(stage)) {
  if (lstatSync(stage).isSymbolicLink() || realpathSync(stage) !== stage || !existsSync(marker)) {
    throw new Error('Staging ist kein eigener markierter Build-Ordner; nichts gelöscht.');
  }
  rmSync(stage, { recursive: true });
}
mkdirSync(stage, { recursive: true });
writeFileSync(marker, 'Nur generierte Pages-Build-Dateien.\n');

const hash = (file) => existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null;
const protectedFiles = ['apps/web/app/api/debug-shot/route.ts', 'apps/web/next-env.d.ts', 'apps/web/.next/BUILD_ID'];
const protectedBefore = Object.fromEntries(protectedFiles.map((file) => [file, hash(join(root, file))]));
const sourceFiles = [];
const ignored = /(?:^|[\\/])(?:\.debug-shots|node_modules|\.next|out|test|e2e)(?:[\\/]|$)|(?:\.test|\.spec)\.[cm]?[jt]sx?$|\.tsbuildinfo$/;
function copySource(path) {
  const from = join(root, path), to = join(stage, path);
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, {
    recursive: true,
    filter: (file) => {
      const rel = relative(root, file).split(sep).join('/');
      if (rel === 'apps/web/app/api/debug-shot' || ignored.test(rel)) return false;
      if (lstatSync(file).isSymbolicLink()) throw new Error(`Quellen-Symlink nicht erlaubt: ${rel}`);
      if (lstatSync(file).isFile()) sourceFiles.push({ path: rel, sha256: hash(file) });
      return true;
    },
  });
}

// Keine Dokumente, QA-Bilder, lokalen Konfigurationen oder sonstigen Root-Dateien.
for (const path of [
  'apps/web/app', 'apps/web/components', 'apps/web/lib',
  'apps/web/package.json', 'apps/web/next.config.mjs', 'apps/web/postcss.config.mjs',
  'apps/web/tailwind.config.ts', 'apps/web/tsconfig.json',
  'packages/engine/src', 'packages/engine/package.json', 'packages/engine/tsconfig.json',
]) copySource(path);

// Öffentliche Assets nur, wenn sie explizit versioniert sind. Ein lokales Foto
// in public darf nicht versehentlich im Pages-Artefakt landen.
const publicList = spawnSync('git', ['ls-files', '-z', '--', 'apps/web/public'], { cwd: root, encoding: 'utf8', windowsHide: true });
if (publicList.status !== 0) throw new Error('Versionierte öffentliche Assets konnten nicht ermittelt werden.');
for (const file of publicList.stdout.split('\0').filter(Boolean)) copySource(file);
writeFileSync(join(web, 'next-env.d.ts'), '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
writeFileSync(join(stage, 'package.json'), JSON.stringify({ name: 'pv-belegung-pages-stage', private: true, workspaces: ['apps/*', 'packages/*'] }, null, 2));
// Workspace-Auflösung auf die kopierte Engine lenken; alle übrigen bereits
// installierten Abhängigkeiten werden aus dem übergeordneten Repository gelesen.
const engineLink = join(stage, 'node_modules/@pv-belegung/engine');
mkdirSync(dirname(engineLink), { recursive: true });
symlinkSync(join(stage, 'packages/engine'), engineLink, process.platform === 'win32' ? 'junction' : 'dir');
// npm kann einzelne Versionen im Workspace statt im Root installiert haben
// (hier z. B. @types/react). Diese vorhandenen Abhängigkeiten nur lesend nutzen.
for (const workspace of ['apps/web', 'packages/engine']) {
  const installed = join(root, workspace, 'node_modules');
  if (existsSync(installed)) symlinkSync(installed, join(stage, workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
}
const requireFromStage = createRequire(join(web, 'package.json'));
for (const dependency of ['typescript', '@types/react', '@types/node']) {
  // Vor Next abbrechen statt dessen automatische Installation auszulösen.
  requireFromStage.resolve(`${dependency}/package.json`);
}

console.log(`${label}-Build: ${web} → ${basePath}/`);
const built = spawnSync(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'build'], {
  cwd: web, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, STATIC_EXPORT: '1', PAGES_BASE_PATH: basePath, NEXT_TELEMETRY_DISABLED: '1' },
});
for (const file of protectedFiles) {
  if (hash(join(root, file)) !== protectedBefore[file]) throw new Error(`Geschützte lokale Build-Datei wurde parallel verändert: ${file}`);
}
if (built.error) throw built.error;
if (built.status !== 0) process.exit(built.status ?? 1);
const out = join(web, 'out');
if (!existsSync(join(out, 'index.html')) || !existsSync(join(out, '_next/static'))) throw new Error('Statischer Export fehlt.');
const html = readFileSync(join(out, 'index.html'), 'utf8');
if (!html.includes(`${basePath}/_next/`)) throw new Error('Export enthält nicht den festgelegten Basepath.');
function inventory(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const file = join(dir, item.name);
    if (item.isSymbolicLink()) throw new Error(`Symlink im Export: ${file}`);
    return item.isDirectory() ? inventory(file) : [{ path: relative(out, file).split(sep).join('/'), sha256: hash(file) }];
  });
}
const files = inventory(out);
if (files.some(({ path }) => /(?:^|\/)(?:api|\.debug-shots|e2e|test-results)(?:\/|$)/.test(path))) throw new Error('Lokale Artefakte im Export.');
writeFileSync(join(stage, 'manifest.json'), JSON.stringify({
  createdAt: new Date().toISOString(), target, basePath, output: 'apps/web/out',
  sourceFiles: sourceFiles.sort((a, b) => a.path.localeCompare(b.path)), files,
  localBuildUnchanged: true,
}, null, 2));
console.log(`${label}-Artefakt fertig: ${out} (${files.length} Dateien). Lokale Route und Produktionsbuild unverändert.`);
