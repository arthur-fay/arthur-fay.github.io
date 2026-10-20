/**
 * Minimal static file server for browser tests. Serves the repository root the
 * way GitHub Pages does: directory requests resolve to index.html, unknown
 * paths return the custom 404 page, and files get standard MIME types.
 */
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

export async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.resolve(ROOT, `.${pathname}`);
      if (!file.startsWith(ROOT)) throw Object.assign(new Error('forbidden'), { code: 'EACCES' });
      let stat = await fs.stat(file).catch(() => null);
      let target = file;
      if (stat && stat.isDirectory()) {
        // GitHub Pages redirects /dir to /dir/; emulate with a redirect.
        response.writeHead(301, { Location: `${pathname}/` });
        response.end();
        return;
      }
      if (!stat) {
        target = path.join(ROOT, '404.html');
        stat = await fs.stat(target);
        response.writeHead(404, { 'Content-Type': TYPES['.html'] });
        response.end(await fs.readFile(target));
        return;
      }
      const type = TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
      response.end(await fs.readFile(target));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' });
      response.end(String(error && error.message));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
