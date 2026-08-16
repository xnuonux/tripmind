#!/usr/bin/env node
// TRIPMIND local control plane.
// Serves the chamber AND a /v1 HTTP API that agents curl.
// The open browser tab is the GPU. This process is the mailbox.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const PORT = +(process.env.TRIPMIND_PORT || process.argv[2] || 8765);
const HOST = process.env.TRIPMIND_HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

const inbox = [];          // commands waiting for the page
const pageWait = [];       // long-poll resolvers for GET /v1/pending
const results = new Map(); // id -> {ok, data, error}
const resultWait = new Map();
let lastHeartbeat = null;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

function json(res, code, obj) {
  cors(res);
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function wakePage() {
  const waiters = pageWait.splice(0);
  waiters.forEach((fn) => fn());
}

function queueCommand(cmd, args) {
  const id = randomUUID();
  inbox.push({ id, cmd, args: args || {}, t: Date.now() });
  wakePage();
  return id;
}

function takePending() {
  return inbox.splice(0);
}

function putResult(id, payload) {
  results.set(id, { ...payload, t: Date.now() });
  const wait = resultWait.get(id);
  if (wait) {
    resultWait.delete(id);
    wait.forEach((fn) => fn(results.get(id)));
  }
}

function waitResult(id, ms = 25000) {
  if (results.has(id)) return Promise.resolve(results.get(id));
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const arr = resultWait.get(id) || [];
      resultWait.set(id, arr.filter((fn) => fn !== done));
      resolve({ ok: false, error: 'timeout waiting for the chamber tab' });
    }, ms);
    const done = (v) => { clearTimeout(timer); resolve(v); };
    const arr = resultWait.get(id) || [];
    arr.push(done);
    resultWait.set(id, arr);
  });
}

function waitPage(ms = 20000) {
  if (inbox.length) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const i = pageWait.indexOf(done);
      if (i >= 0) pageWait.splice(i, 1);
      resolve();
    }, ms);
    const done = () => { clearTimeout(timer); resolve(); };
    pageWait.push(done);
  });
}

function safeJoin(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const full = path.normalize(path.join(ROOT, clean || 'index.html'));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

async function handleApi(req, res, url) {
  const u = new URL(url, `http://${HOST}:${PORT}`);
  const p = u.pathname;

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (p === '/v1/help' || p === '/v1') {
    return json(res, 200, {
      protocol: 'tripmind/v1',
      hint: 'open the chamber in a browser first. then POST /v1/cmd',
      endpoints: {
        'GET  /v1/help': 'this',
        'GET  /v1/state': 'last heartbeat describe()',
        'POST /v1/cmd': '{cmd, args} → waits for the tab → result',
        'POST /v1/cmd?wait=0': 'queue only, returns {id}',
        'GET  /v1/result/:id': 'poll a queued command',
        'GET  /v1/pending': 'page mailbox (do not call)',
        'POST /v1/result': 'page mailbox (do not call)',
        'POST /v1/heartbeat': 'page mailbox (do not call)',
        'GET  /v1/alive': 'is a tab heartbeating?',
      },
    });
  }

  if (p === '/v1/alive') {
    const age = lastHeartbeat ? Date.now() - lastHeartbeat.t : null;
    return json(res, 200, { alive: age != null && age < 6000, age });
  }

  if (p === '/v1/state' && req.method === 'GET') {
    if (!lastHeartbeat) return json(res, 503, { ok: false, error: 'no chamber tab connected. open http://' + HOST + ':' + PORT });
    return json(res, 200, lastHeartbeat.describe || lastHeartbeat);
  }

  if (p === '/v1/heartbeat' && req.method === 'POST') {
    lastHeartbeat = await readBody(req);
    lastHeartbeat.t = Date.now();
    return json(res, 200, { ok: true });
  }

  if (p === '/v1/pending' && req.method === 'GET') {
    const wait = u.searchParams.get('wait');
    if (wait && !inbox.length) await waitPage(Math.min(25, +wait || 20) * 1000);
    return json(res, 200, takePending());
  }

  if (p === '/v1/result' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.id) return json(res, 400, { error: 'id required' });
    putResult(body.id, body);
    return json(res, 200, { ok: true });
  }

  if (p.startsWith('/v1/result/') && req.method === 'GET') {
    const id = p.slice('/v1/result/'.length);
    const wait = u.searchParams.get('wait') !== '0';
    const r = wait ? await waitResult(id) : results.get(id);
    if (!r) return json(res, 404, { error: 'unknown id' });
    return json(res, 200, r);
  }

  if ((p === '/v1/cmd' || p === '/v1/exec') && req.method === 'POST') {
    const body = await readBody(req);
    const cmd = body.cmd || body.command;
    if (!cmd) return json(res, 400, { error: 'cmd required' });
    const id = queueCommand(cmd, body.args || body.params || {});
    if (u.searchParams.get('wait') === '0') return json(res, 202, { id, status: 'queued' });
    const r = await waitResult(id, 30000);
    return json(res, r.ok === false && r.error?.includes('timeout') ? 504 : 200, { id, ...r });
  }

  return json(res, 404, { error: 'unknown api path', path: p });
}

function serveStatic(req, res, urlPath) {
  let file = safeJoin(urlPath);
  if (!file) { res.writeHead(403); res.end('forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) {
    if (urlPath === '/' || urlPath === '') file = path.join(ROOT, 'index.html');
    else { cors(res); res.writeHead(404); res.end('not found'); return; }
  }
  const ext = path.extname(file);
  cors(res);
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '/';
    if (url.startsWith('/v1')) return void await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      cors(res);
      res.writeHead(405);
      res.end();
      return;
    }
    serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  TRIPMIND bridge');
  console.log('  chamber   http://' + HOST + ':' + PORT + '/');
  console.log('  agents    POST http://' + HOST + ':' + PORT + '/v1/cmd');
  console.log('            GET  http://' + HOST + ':' + PORT + '/v1/help');
  console.log('');
  console.log('  open the chamber in a browser, then:');
  console.log('  curl -s ' + HOST + ':' + PORT + '/v1/cmd -H "content-type: application/json" -d "{\\"cmd\\":\\"preset\\",\\"args\\":{\\"id\\":\\"godhead\\"}}"');
  console.log('');
});
