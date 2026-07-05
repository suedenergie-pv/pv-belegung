/* Dev-Route zum Speichern von Browser-Screenshots (Canvas/SVG als Base64).
   Hintergrund: preview_screenshot hängt in diesem Setup regelmäßig (30-s-Timeout);
   Claude rendert stattdessen über diese Route — siehe CLAUDE.md „Screenshots &
   Verifikation". Route bewusst NICHT löschen: das Anlegen/Löschen hinterließ
   Geister-Typen in .next/types und brach den typecheck. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }
  const { b64, name } = (await req.json()) as { b64: string; name?: string };
  const sicher = (name ?? 'shot').replace(/[^a-z0-9_-]/gi, '') || 'shot';
  const dir = join(process.cwd(), '.debug-shots');
  mkdirSync(dir, { recursive: true });
  const datei = join(dir, `${sicher}.png`);
  writeFileSync(datei, Buffer.from(b64, 'base64'));
  return Response.json({ ok: true, datei });
}
