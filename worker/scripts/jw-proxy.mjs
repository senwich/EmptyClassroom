import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { queryClassroomTableHtml } from '../src/jw.ts';

const CACHE_TTL_MS = 5 * 60 * 1000;

function loadDevVars() {
  const file = resolve(process.cwd(), '.dev.vars');
  if (!existsSync(file)) {
    return;
  }
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function getBearerToken(req) {
  const header = req.headers.authorization ?? '';
  const prefix = 'Bearer ';
  return header.startsWith(prefix) ? header.slice(prefix.length) : '';
}

loadDevVars();

const port = Number.parseInt(process.env.JW_PROXY_PORT ?? '8788', 10);
const token = process.env.JW_PROXY_TOKEN;
const username = process.env.JW_USERNAME;
const password = process.env.JW_PASSWORD;
const cache = new Map();

if (!token) {
  console.error('Missing JW_PROXY_TOKEN in environment or .dev.vars');
  process.exit(1);
}
if (!username || !password) {
  console.error('Missing JW_USERNAME or JW_PASSWORD in environment or .dev.vars');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true });
      return;
    }
    if (req.method !== 'GET' || url.pathname !== '/api/query') {
      json(res, 404, { error: 'not found' });
      return;
    }
    if (getBearerToken(req) !== token) {
      json(res, 401, { error: 'unauthorized' });
      return;
    }

    const campusId = Number.parseInt(url.searchParams.get('campusId') ?? '', 10);
    if (![1, 2].includes(campusId)) {
      json(res, 400, { error: 'invalid campusId' });
      return;
    }

    const cached = cache.get(campusId);
    if (cached && cached.expiresAt > Date.now()) {
      json(res, 200, { html: cached.html, cached: true, update_at: cached.updateAt });
      return;
    }

    const html = await queryClassroomTableHtml({ JW_USERNAME: username, JW_PASSWORD: password }, campusId);
    const updateAt = new Date().toISOString();
    cache.set(campusId, { html, updateAt, expiresAt: Date.now() + CACHE_TTL_MS });
    json(res, 200, { html, cached: false, update_at: updateAt });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`JW proxy listening on http://127.0.0.1:${port}`);
});
