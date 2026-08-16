# agent/

Static brains and the local mailbox.

| file | |
|---|---|
| `catalog.json` | 61 presets, 14 engines, 30 palettes, every command. No tab required. |
| `schema.json` | state fields, types, ranges, defaults. |
| `bridge.mjs` | static file server + `/v1` HTTP API. The tab is the GPU. |
| `mcp.mjs` | MCP stdio wrapper around the bridge. |
| `write-catalog.mjs` | regenerate catalog/schema after you edit presets. |

```bash
npm start                 # bridge on :8765
curl -s :8765/v1/cmd -H "content-type: application/json" -d '{"cmd":"describe"}'
node agent/mcp.mjs        # MCP — bridge must already be up
```
