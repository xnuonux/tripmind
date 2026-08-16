#!/usr/bin/env node
// MCP stdio server — wraps the local TRIPMIND bridge.
// Point Claude / Cursor / Grok at: node agent/mcp.mjs
// Requires the bridge running and a browser tab on the chamber.

import { stdin, stdout } from 'node:process';

const BASE = process.env.TRIPMIND_URL || 'http://127.0.0.1:8765';

async function rpc(method, params, id) {
  if (method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'tripmind', version: '1.1.0' },
      capabilities: { tools: {} },
    };
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null;
  }
  if (method === 'tools/list') {
    return { tools: TOOLS };
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments || {};
    const text = await callTool(name, args);
    return { content: [{ type: 'text', text }] };
  }
  if (method === 'ping') return {};
  throw new Error('unknown method ' + method);
}

const TOOLS = [
  {
    name: 'tripmind_help',
    description: 'Discover TRIPMIND: protocol, commands, and whether a chamber tab is alive.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tripmind_describe',
    description: 'Read the current look as prose + structured JSON. Call this before changing anything.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tripmind_catalog',
    description: 'List presets, engines, palettes. Optional family filter: still|vivid|sacred|quantum|abyss|keeper.',
    inputSchema: {
      type: 'object',
      properties: { family: { type: 'string' } },
    },
  },
  {
    name: 'tripmind_exec',
    description: 'Run any TRIPMIND command (preset, set, engine, seed, still, next, prev, hide, show, camera, ...). Prefer named tools when they exist.',
    inputSchema: {
      type: 'object',
      properties: {
        cmd: { type: 'string', description: 'command verb, e.g. preset, set, still' },
        args: { type: 'object', description: 'command arguments' },
      },
      required: ['cmd'],
    },
  },
  {
    name: 'tripmind_preset',
    description: 'Load a named composition (godhead, hopf-fibration, pale-ember, ...).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, seed: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'tripmind_set',
    description: 'Patch state fields: intensity, tempo, heat, bloom, engine, kaleid, warpAmt, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        fields: { type: 'object', additionalProperties: true },
      },
      required: ['fields'],
    },
  },
  {
    name: 'tripmind_still',
    description: 'Render a still. download=true saves in the browser. as=dataurl returns a PNG data URL.',
    inputSchema: {
      type: 'object',
      properties: {
        aspect: { type: 'string' },
        longEdge: { type: 'number' },
        as: { type: 'string', enum: ['dataurl', 'blob'] },
      },
    },
  },
];

async function callTool(name, args) {
  try {
    if (name === 'tripmind_help') {
      const [help, alive] = await Promise.all([
        get('/v1/help'),
        get('/v1/alive'),
      ]);
      return JSON.stringify({ alive, help }, null, 2);
    }
    if (name === 'tripmind_describe') {
      const state = await get('/v1/state');
      return JSON.stringify(state, null, 2);
    }
    if (name === 'tripmind_catalog') {
      const r = await post('/v1/cmd', { cmd: 'catalog', args: { family: args.family } });
      return JSON.stringify(r, null, 2);
    }
    if (name === 'tripmind_exec') {
      const r = await post('/v1/cmd', { cmd: args.cmd, args: args.args || {} });
      return JSON.stringify(r, null, 2);
    }
    if (name === 'tripmind_preset') {
      const r = await post('/v1/cmd', { cmd: 'preset', args: { id: args.id, seed: args.seed } });
      return JSON.stringify(r, null, 2);
    }
    if (name === 'tripmind_set') {
      const r = await post('/v1/cmd', { cmd: 'set', args: args.fields || args });
      return JSON.stringify(r, null, 2);
    }
    if (name === 'tripmind_still') {
      const r = await post('/v1/cmd', {
        cmd: 'still',
        args: { aspect: args.aspect || '1:1', longEdge: args.longEdge || 1920, as: args.as || 'dataurl', download: false },
      });
      return JSON.stringify(r, null, 2);
    }
    return JSON.stringify({ error: 'unknown tool ' + name });
  } catch (err) {
    return JSON.stringify({
      error: String(err.message || err),
      hint: 'Start the bridge (`node agent/bridge.mjs`) and open the chamber in a browser.',
    });
  }
}

async function get(p) {
  const r = await fetch(BASE + p);
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return r.json();
}
async function post(p, body) {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || (p + ' ' + r.status));
  return data;
}

// JSON-RPC over stdio (Content-Length framing AND newline-delimited — accept both)
let buf = Buffer.alloc(0);
stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (true) {
    const msg = pull();
    if (!msg) break;
    handle(msg);
  }
});

function pull() {
  const s = buf.toString('utf8');
  if (s.startsWith('Content-Length:')) {
    const idx = s.indexOf('\r\n\r\n');
    if (idx < 0) return null;
    const len = parseInt(s.match(/Content-Length:\s*(\d+)/i)[1], 10);
    const start = idx + 4;
    if (buf.length < start + len) return null;
    const json = buf.slice(start, start + len).toString('utf8');
    buf = buf.slice(start + len);
    return JSON.parse(json);
  }
  const nl = s.indexOf('\n');
  if (nl < 0) return null;
  const line = s.slice(0, nl).trim();
  buf = buf.slice(nl + 1);
  if (!line) return pull();
  return JSON.parse(line);
}

async function handle(msg) {
  if (!msg || msg.id == null && !msg.method) return;
  if (msg.method && msg.method.startsWith('notifications/')) {
    try { await rpc(msg.method, msg.params, msg.id); } catch {}
    return;
  }
  try {
    const result = await rpc(msg.method, msg.params, msg.id);
    if (msg.id != null && result !== undefined) reply({ jsonrpc: '2.0', id: msg.id, result });
  } catch (err) {
    if (msg.id != null) {
      reply({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(err.message || err) } });
    }
  }
}

function reply(obj) {
  const body = JSON.stringify(obj);
  stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}
