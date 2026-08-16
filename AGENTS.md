# AGENTS.md — how to drive TRIPMIND

You are an agent. The human does not want to touch sliders. You will.

TRIPMIND is a WebGL2 visualizer. The **browser tab is the GPU**. You are the hands.

## Discover

| where | what |
|---|---|
| `GET /agent.json` | discovery document |
| `GET /llms.txt` | short machine brief |
| `GET /agent/catalog.json` | presets, engines, palettes, commands (static, no tab needed) |
| `GET /agent/schema.json` | state field types and ranges |
| `window.TRIPMIND.help()` | live command catalog |
| `window.TRIPMIND.describe()` | **read this first** — current look as prose + json |

## Three ways in

### 1. JavaScript (you are in the page)

```js
await TRIPMIND.describe()
await TRIPMIND.applyPreset('godhead')
await TRIPMIND.setState({ intensity: 0.9, heat: 0.8 })
await TRIPMIND.setEngine('hopf')
await TRIPMIND.setSeed('60dhead1')
await TRIPMIND.still({ aspect: '1:1', longEdge: 1920, as: 'dataurl', download: false })
await TRIPMIND.exec('next')
```

`window.TRIPMIND.exec(cmd, args)` is the one verb. Everything else is sugar.

### 2. postMessage (you are a parent frame or extension)

```js
frame.contentWindow.postMessage({ type: 'tripmind', id: '1', cmd: 'preset', args: { id: 'godhead' } }, '*')
// reply: { type: 'tripmind:result', id: '1', ok: true, data }
```

### 3. HTTP (you are curl, MCP, another process)

Start the bridge, open the chamber in a browser, then:

```bash
node agent/bridge.mjs          # http://127.0.0.1:8765
curl -s 127.0.0.1:8765/v1/alive
curl -s 127.0.0.1:8765/v1/state
curl -s 127.0.0.1:8765/v1/cmd \
  -H "content-type: application/json" \
  -d '{"cmd":"preset","args":{"id":"godhead"}}'
```

MCP stdio: `node agent/mcp.mjs` (bridge must be up, tab must be open).

## Commands

`help` `schema` `catalog` `describe` `get` `set` `preset` `next` `prev` `engine` `seed` `randomize` `play` `pause` `toggle` `camera` `still` `video` `hide` `show` `deep` `easy` `gallery` `url` `save` `looks` `load` `deleteLook`

Unknown keys on `set` are ignored. Values are coerced to the schema. You cannot break the chamber by sending garbage.

## How to work

1. `describe` — see what is on screen.
2. Pick a **preset** by family (still → vivid → sacred → quantum → abyss) unless the human named one.
3. Nudge **intensity / tempo / heat / bloom**. Do not dump 20 deep fields unless asked.
4. Change **engine** only when the human wants a different theorem.
5. `hide` before a still if they want a clean frame. HUD is never baked anyway.
6. `still` with `as: "dataurl"` if you need the pixels. `video` only if the tab stays visible.
7. Same seed + same engine + same params = the same world. Do not randomize a keeper unless asked.

## URL

Humans and agents can deep-link:

```
#p=godhead&s=60dhead1&e=iris&i=0.9&t=0.34&h=0.7&b=0.82
#state=<base64url JSON of full state>
```

`TRIPMIND.shareURL({full:true})` emits the packed form.

## Do not

- Do not spawn extra tabs if one chamber is already heartbeating.
- Do not sit in deep mode on behalf of a human who asked for “just make it pretty.” Use presets.
- Do not invent preset ids. Use `catalog`.
- Do not claim a render finished if `still` / `video` returned an error.

If the bridge says no tab is connected: tell the human to open `http://127.0.0.1:8765/` and retry.

If the chamber never leaves the splash (common on Intel laptops): `exec('power', { mode: 'low' })` or open with `?lite=1`. Do not keep retrying full gpu.
