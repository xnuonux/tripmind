// Talks to the local agent bridge (agent/bridge.mjs) when we are served by it.
// On GitHub Pages this 404s once and goes to sleep. Harmless.

export function startBridgeClient(api) {
  const root = location.origin;
  let dead = false;
  let fail = 0;

  async function heartbeat() {
    if (dead) return;
    try {
      await fetch(root + '/v1/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          t: Date.now(),
          describe: api.describe(),
        }),
      });
      fail = 0;
    } catch {
      if (++fail > 3) dead = true;
    }
  }

  async function pullLoop() {
    while (!dead) {
      try {
        const r = await fetch(root + '/v1/pending?wait=20');
        if (r.status === 404) { dead = true; return; }
        if (!r.ok) { await sleep(800); continue; }
        const cmds = await r.json();
        for (const c of cmds) {
          document.body.classList.add('agent-live');
          const result = await api.exec(c.cmd, c.args || {});
          await fetch(root + '/v1/result', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: c.id, ...result }),
          });
          setTimeout(() => document.body.classList.remove('agent-live'), 800);
        }
        fail = 0;
      } catch {
        if (++fail > 8) { dead = true; return; }
        await sleep(1000);
      }
    }
  }

  heartbeat();
  setInterval(heartbeat, 2000);
  pullLoop();
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
