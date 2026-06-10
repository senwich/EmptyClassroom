import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { queryOne } from '../src/jw.ts';

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

loadDevVars();

const username = process.env.JW_USERNAME;
const password = process.env.JW_PASSWORD;

if (!username || !password) {
  console.error('Missing JW_USERNAME or JW_PASSWORD. Set env vars or create worker/.dev.vars.');
  process.exit(1);
}

try {
  console.log(`Checking QZ classroom source for username length ${username.length}, password length ${password.length}...`);
  console.log(`Username numeric: ${/^\d+$/.test(username)}`);
  console.log(`Username has surrounding whitespace: ${username !== username.trim()}`);
  console.log(`Password has surrounding whitespace: ${password !== password.trim()}`);
  console.log(`Password has non-ASCII chars: ${/[^\x20-\x7e]/.test(password)}`);

  for (const [id, name] of [
    [1, '西土城'],
    [2, '沙河'],
  ]) {
    const data = await queryOne({ JW_USERNAME: username, JW_PASSWORD: password }, id);
    const classroomCount = new Set(data.flatMap((item) => item.CLASSROOMS.split(',').filter(Boolean))).size;
    console.log(`${name} ok: ${data.length} class nodes, ${classroomCount} available classrooms`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
