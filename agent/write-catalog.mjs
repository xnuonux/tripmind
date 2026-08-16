import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../js/api.js';
import { STATE_FIELDS, DEFAULTS } from '../js/state.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const catalog = buildCatalog();
fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2));
fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify({
  protocol: catalog.protocol,
  version: catalog.version,
  fields: STATE_FIELDS,
  defaults: DEFAULTS,
}, null, 2));
console.log('wrote agent/catalog.json (' + catalog.presets.length + ' presets) and agent/schema.json');
