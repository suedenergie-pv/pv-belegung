import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const stage = resolve(dirname(fileURLToPath(import.meta.url)), '../.release/pages');
const manifestFile = join(stage, 'manifest.json');
if (!existsSync(manifestFile)) throw new Error('Zuerst npm run build:pages ausführen.');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const root = resolve(stage, manifest.output);
const prefix = '/pv-belegung';
if (manifest.basePath !== prefix || relative(stage, root) !== `apps${sep}web${sep}out`) throw new Error('Ungültiger Exportpfad.');
const port = Number(process.env.PAGES_PREVIEW_PORT ?? '3188');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Ungültiger Vorschau-Port.');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
export function createPagesServer() {
  return createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405).end(); return; }
  let path;
  try { path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (path === prefix) { response.writeHead(308, { Location: `${prefix}/` }).end(); return; }
  if (!path.startsWith(`${prefix}/`) || path.includes('\0')) { response.writeHead(404).end('Not found'); return; }
  let file = resolve(root, `.${path.slice(prefix.length)}`);
  const rel = relative(root, file);
  if (rel.startsWith('..') || rel.startsWith(sep)) { response.writeHead(404).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  // Kein SPA-Fallback: falsche Assetpfade müssen auch im Smoke wirklich scheitern.
  if (!existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; }
  response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
  });
}
export async function startPagesServer() {
  const server = createPagesServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  console.log(`Statisches Pages-Artefakt: http://127.0.0.1:${port}${prefix}/`);
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startPagesServer();
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
}
