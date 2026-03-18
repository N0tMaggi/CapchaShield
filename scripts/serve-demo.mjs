import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const host = process.env.DEMO_HOST ?? '127.0.0.1';
const port = Number(process.env.DEMO_PORT ?? 4173);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? '/', `http://${host}:${port}`);

    if (requestUrl.pathname === '/') {
      redirect(res, '/demo/');
      return;
    }

    if (requestUrl.pathname === '/demo') {
      redirect(res, '/demo/');
      return;
    }

    if (requestUrl.pathname === '/api/status') {
      handleStatus(requestUrl, res);
      return;
    }

    if (requestUrl.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (requestUrl.pathname === '/api/verify') {
      await handleVerify(requestUrl, req, res);
      return;
    }

    await serveStatic(requestUrl.pathname, res);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`[demo] Serving CaptchaShield demo at http://${host}:${port}/demo/`);
});

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function handleStatus(requestUrl, res) {
  const mode = requestUrl.searchParams.get('mode') ?? 'ok';
  if (mode === 'fail') {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, source: 'demo-status' }));
    return;
  }

  res.writeHead(204);
  res.end();
}

async function handleVerify(requestUrl, req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
    return;
  }

  await consumeRequest(req);

  const mode = requestUrl.searchParams.get('mode') ?? 'ok';
  if (mode === 'fail') {
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'verification-rejected' }));
    return;
  }

  if (mode === 'slow') {
    await delay(1200);
  }

  res.writeHead(204);
  res.end();
}

async function serveStatic(requestPath, res) {
  const safePath = sanitizePath(requestPath);
  const filePath = path.join(rootDir, safePath);
  const data = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'content-type': contentTypes[ext] ?? 'application/octet-stream' });
  res.end(data);
}

function sanitizePath(requestPath) {
  const normalized = path.posix.normalize(requestPath);
  const resolved = normalized.endsWith('/') ? `${normalized}index.html` : normalized;
  const stripped = resolved.replace(/^\/+/, '');

  if (!stripped || stripped.includes('..')) {
    throw new Error('Invalid path.');
  }

  return stripped;
}

function consumeRequest(req) {
  return new Promise((resolve, reject) => {
    req.on('data', () => undefined);
    req.on('end', resolve);
    req.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
