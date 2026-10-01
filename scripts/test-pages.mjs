import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPagesServer } from './serve-pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Der Server lebt in diesem Prozess. So hängt unter Windows keine npm-/cmd-
// Prozesskette in Playwrights webServer-Bereinigung; CI nutzt denselben Weg.
const server = await startPagesServer();
try {
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, [
      resolve(root, 'node_modules/@playwright/test/cli.js'), 'test',
      '--config', 'playwright.pages.config.ts', ...process.argv.slice(2),
    ], { cwd: root, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => done(code ?? 1));
  });
  process.exitCode = code;
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
