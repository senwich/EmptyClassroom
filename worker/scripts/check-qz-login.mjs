import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ORIGIN = 'https://jwgl.bupt.edu.cn';

function loadDevVars() {
  const file = resolve(process.cwd(), '.dev.vars');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

class CookieJar {
  values = new Map();

  store(headers) {
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    for (const cookie of cookies) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      if (separator === -1) continue;
      this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header() {
    return Array.from(this.values, ([key, value]) => `${key}=${value}`).join('; ');
  }
}

function encodeInp(input) {
  return Buffer.from(input, 'utf8').toString('base64');
}

function scramble(code, seed, order) {
  let encoded = '';
  let rest = seed;
  for (let i = 0; i < code.length; i += 1) {
    if (i < 20) {
      const take = Number.parseInt(order.slice(i, i + 1), 10);
      encoded += code.slice(i, i + 1) + rest.slice(0, take);
      rest = rest.slice(take);
    } else {
      encoded += code.slice(i);
      break;
    }
  }
  return encoded;
}

async function request(jar, url, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (jar.header()) headers.set('cookie', jar.header());
  headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36');
  const resp = await fetch(url, { redirect: 'manual', ...init, headers });
  jar.store(resp.headers);
  const text = await resp.text();
  return { resp, text };
}

async function loginJsxsd(username, password) {
  const jar = new CookieJar();
  await request(jar, `${ORIGIN}/jsxsd/`);

  const encoded = `${encodeInp(username)}%%%${encodeInp(password)}`;
  const form = new URLSearchParams({ userAccount: username, userPassword: '', encoded });
  const { resp, text } = await request(jar, `${ORIGIN}/jsxsd/xk/LoginToXk`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${ORIGIN}/jsxsd/`,
    },
    body: form,
  });
  return { jar, status: resp.status, location: resp.headers.get('location'), text };
}

async function loginRoot(username, password) {
  const jar = new CookieJar();
  await request(jar, `${ORIGIN}/`);
  const seedResp = await request(jar, `${ORIGIN}/Logon.do?method=logon&flag=sess`, {
    method: 'POST',
    headers: { referer: `${ORIGIN}/` },
  });
  const [seed, order] = seedResp.text.split('#');
  if (!seed || !order) {
    throw new Error(`root seed failed: ${seedResp.text.slice(0, 120)}`);
  }
  const encoded = scramble(`${username}%%%${password}`, seed, order);
  const form = new URLSearchParams({ userAccount: '', userPassword: '', encoded });
  const { resp, text } = await request(jar, `${ORIGIN}/Logon.do?method=logon`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${ORIGIN}/`,
    },
    body: form,
  });
  return { jar, status: resp.status, location: resp.headers.get('location'), text };
}

async function probeLoggedIn(label, session) {
  const probes = [
    '/jsxsd/framework/xsMain.jsp',
    '/jsxsd/xskb/xskb_list.do',
    '/jsxsd/kbcx/kbxx_classroom_ifr',
    '/jsxsd/kbcx/kbxx_classroom',
    '/jsxsd/xxwcqk/xxwcqk_idxOnzh.do',
  ];
  console.log(`${label}: login status=${session.status} location=${session.location ?? ''} textHasLogin=${/用户登录|请输入账号|登录/.test(session.text)}`);
  for (const path of probes) {
    const { resp, text } = await request(session.jar, `${ORIGIN}${path}`, { headers: { referer: ORIGIN } });
    console.log(`${label}: probe ${path} status=${resp.status} hasLogin=${/用户登录|请输入账号|登录/.test(text)} title=${(text.match(/<title>(.*?)<\/title>/i)?.[1] ?? '').trim()}`);
    if (label === 'jsxsd-base64' && path.includes('kbxx_classroom')) {
      const compact = text.replace(/\s+/g, ' ');
      for (const needle of ['<form', 'action=', 'kbxx_classroom', '教室', '校区', 'xqid', 'xqbh', 'submit']) {
        const index = compact.indexOf(needle);
        if (index !== -1) {
          console.log(`${label}: snippet ${needle}: ${compact.slice(Math.max(0, index - 180), index + 420)}`);
        }
      }
    }
  }

  if (label === 'jsxsd-base64') {
    for (const [xqid, name] of [
      ['01', '校本部'],
      ['04', '沙河校区'],
    ]) {
      const buildings = await request(session.jar, `${ORIGIN}/jsxsd/kbcx/getJxlByAjax`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          referer: `${ORIGIN}/jsxsd/kbcx/kbxx_classroom`,
        },
        body: new URLSearchParams({ xqid }),
      });
      console.log(`${label}: buildings ${name} status=${buildings.resp.status} body=${buildings.text.slice(0, 500)}`);

      const table = await request(session.jar, `${ORIGIN}/jsxsd/kbcx/kbxx_classroom_ifr`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          referer: `${ORIGIN}/jsxsd/kbcx/kbxx_classroom`,
        },
        body: new URLSearchParams({ xqid, kbjcmsid: '9475847A3F3033D1E05377B5030AA94D' }),
      });
      const trCount = (table.text.match(/<tr\b/gi) ?? []).length;
      const occupiedCount = (table.text.match(/课程名称|任课教师|上课班级|font/gi) ?? []).length;
      console.log(`${label}: table ${name} status=${table.resp.status} tr=${trCount} occupiedHints=${occupiedCount} hasLogin=${/用户登录|请输入账号|登录/.test(table.text)}`);
      const compact = table.text.replace(/\s+/g, ' ');
      const rows = Array.from(compact.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gi), (match) => match[0]);
      console.log(`${label}: table ${name} first rows=${rows.slice(0, 5).join(' ').slice(0, 2400)}`);
    }
  }
}

loadDevVars();
const username = process.env.JW_USERNAME;
const password = process.env.JW_PASSWORD;
if (!username || !password) {
  console.error('Missing JW_USERNAME or JW_PASSWORD');
  process.exitCode = 1;
} else {
  try {
    console.log(`Checking QZ web login for username length ${username.length}...`);
    await probeLoggedIn('jsxsd-base64', await loginJsxsd(username, password));
    await probeLoggedIn('root-scramble', await loginRoot(username, password));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
