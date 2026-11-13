// Minimaler statischer Server für die Entwicklung (ES-Module brauchen http).
// Wird in Schritt 6 durch backend/server.js ersetzt.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const relative = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, relative.endsWith('/') ? `${relative}index.html` : relative);
  if (!file.startsWith(root)) {
    res.writeHead(403).end('Verboten');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Nicht gefunden');
  }
}).listen(port, () => console.log(`LifeOS läuft auf http://localhost:${port}`));
