import type { Env, JWClassInfo } from './types';
import { shanghaiNow, shanghaiWeekday } from './time';

const ORIGIN = 'https://jwgl.bupt.edu.cn';
const LOGIN_PAGE_URL = `${ORIGIN}/jsxsd/`;
const LOGIN_URL = `${ORIGIN}/jsxsd/xk/LoginToXk`;
const CLASSROOM_TABLE_URL = `${ORIGIN}/jsxsd/kbcx/kbxx_classroom_ifr`;
const DEFAULT_CLASS_TIME_MODE = '9475847A3F3033D1E05377B5030AA94D';

const CAMPUS_ID_MAP: Record<number, { qzId: string; namePrefix: string }> = {
  1: { qzId: '01', namePrefix: '校本部' },
  2: { qzId: '04', namePrefix: '沙河校区' },
};

class CookieJar {
  private values = new Map<string, string>();

  store(headers: Headers): void {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const cookies = typeof getSetCookie === 'function' ? getSetCookie.call(headers) : [headers.get('set-cookie')].filter(Boolean) as string[];
    for (const cookie of cookies) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      if (separator === -1) {
        continue;
      }
      this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header(): string {
    return Array.from(this.values, ([key, value]) => `${key}=${value}`).join('; ');
  }
}

function requireSecret(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`missing secret ${name}`);
  }
  return value;
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function request(fetcher: typeof fetch, jar: CookieJar, input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (jar.header()) {
    headers.set('cookie', jar.header());
  }
  headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36');
  const resp = await fetchWithTimeout(fetcher, input, { redirect: 'manual', ...init, headers });
  jar.store(resp.headers);
  return resp;
}

function encodeInp(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function login(env: Env): Promise<CookieJar> {
  const fetcher = env.EC_FETCH ?? fetch;
  const username = requireSecret(env.JW_USERNAME, 'JW_USERNAME');
  const password = requireSecret(env.JW_PASSWORD, 'JW_PASSWORD');
  const jar = new CookieJar();

  const pageResp = await request(fetcher, jar, LOGIN_PAGE_URL);
  if (!pageResp.ok) {
    throw new Error(`QZ login page failed with status ${pageResp.status}`);
  }

  const body = new URLSearchParams({
    userAccount: username,
    userPassword: '',
    encoded: `${encodeInp(username)}%%%${encodeInp(password)}`,
  });
  const resp = await request(fetcher, jar, LOGIN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: LOGIN_PAGE_URL,
    },
    body,
  });
  const text = await resp.text();
  const location = resp.headers.get('location') ?? '';
  if (resp.status !== 302 || !location.includes('/jsxsd/framework/')) {
    const message = /用户登录|请输入账号|登录/.test(text) ? 'login rejected' : text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(`QZ login failed: ${message || `status ${resp.status}`}`);
  }

  return jar;
}

function htmlText(value: string): string {
  return value
    .replace(/<br\s*\/?>(?=.)/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripBuildingSuffix(value: string): string {
  return value.replace(/楼$/u, '');
}

function normalizeClassroom(raw: string, fallbackBuilding: string): string | null {
  let value = htmlText(raw);
  if (!value || value === '教室\\节次') {
    return null;
  }
  value = value.replace(/[（(]\s*(\d+)\s*[)）]/u, '($1)');
  const sizeMatch = value.match(/[（(]\d+[)）]/u)?.[0] ?? '';
  const withoutSize = value.replace(/[（(]\s*\d+\s*[)）]/u, '').trim();
  if (withoutSize.includes('-')) {
    return `${withoutSize}${sizeMatch}`;
  }
  return `${stripBuildingSuffix(fallbackBuilding)}-${withoutSize}${sizeMatch}`;
}

function parseRows(html: string): string[][] {
  return Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (row) =>
    Array.from(row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi), (cell) => cell[1]),
  );
}

function parseBuildingName(cells: string[], previous: string): string {
  for (const cell of cells.slice(0, 2)) {
    const text = htmlText(cell);
    if (text && text !== '教室\\节次' && !/^\d{2}$/u.test(text)) {
      if (!/[（(]\d+[)）]/u.test(text) && !text.includes('-')) {
        return text;
      }
    }
  }
  return previous;
}

function parseClassroomTable(html: string, now = shanghaiNow()): JWClassInfo[] {
  const dayIndex = (shanghaiWeekday(now) + 6) % 7;
  const startCell = 1 + dayIndex * 14;
  const byNode = Array.from({ length: 14 }, () => [] as string[]);
  let buildingName = '';

  for (const cells of parseRows(html)) {
    if (cells.length < startCell + 14) {
      continue;
    }
    const firstText = htmlText(cells[0]);
    if (!firstText || firstText === '教室\\节次') {
      continue;
    }
    buildingName = parseBuildingName(cells, buildingName);
    const classroom = normalizeClassroom(cells[0], buildingName);
    if (!classroom) {
      continue;
    }
    for (let node = 0; node < 14; node += 1) {
      const cellText = htmlText(cells[startCell + node]);
      if (!cellText) {
        byNode[node].push(classroom);
      }
    }
  }

  return byNode
    .filter((classrooms) => classrooms.length > 0)
    .map((classrooms, index) => ({
      CLASSROOMS: classrooms.join(','),
      NODETIME: '',
      NODENAME: String(index + 1),
    }));
}

async function queryClassroomTable(env: Env, jar: CookieJar, campusId: number): Promise<string> {
  const campus = CAMPUS_ID_MAP[campusId];
  if (!campus) {
    throw new Error(`unsupported campus id ${campusId}`);
  }
  const fetcher = env.EC_FETCH ?? fetch;
  const resp = await request(fetcher, jar, CLASSROOM_TABLE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${ORIGIN}/jsxsd/kbcx/kbxx_classroom`,
    },
    body: new URLSearchParams({
      xqid: campus.qzId,
      kbjcmsid: DEFAULT_CLASS_TIME_MODE,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`${campus.namePrefix} classroom query failed with status ${resp.status}`);
  }
  if (/用户登录|请输入账号/u.test(text)) {
    throw new Error(`${campus.namePrefix} classroom query returned login page`);
  }
  return text;
}

export async function queryOne(env: Env, campusId: number): Promise<JWClassInfo[]> {
  const jar = await login(env);
  const html = await queryClassroomTable(env, jar, campusId);
  const data = parseClassroomTable(html);
  if (data.length === 0) {
    throw new Error(`QZ classroom query returned no occupied classrooms for campus ${campusId}`);
  }
  return data;
}

export const __test__ = { parseClassroomTable };
