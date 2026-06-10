import { readFileSync } from 'node:fs';
import { queryOne } from '../src/jw.ts';

const vars = {};
for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const index = trimmed.indexOf('=');
  let value = trimmed.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  vars[trimmed.slice(0, index).trim()] = value;
}

const data = await queryOne({
  JW_PROXY_URL: 'http://127.0.0.1:8788',
  JW_PROXY_TOKEN: vars.JW_PROXY_TOKEN,
}, 1);
const rooms = [...new Set(data.flatMap((item) => item.CLASSROOMS.split(',')).filter(Boolean))].slice(0, 30);
console.log(JSON.stringify(rooms, null, 2));
