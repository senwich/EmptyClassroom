import type { Env, JWClassInfo } from './types';
import { shanghaiNow, shanghaiWeekday } from './time';

const ORIGINS = ['https://jwgl.bupt.edu.cn', 'http://jwgl.bupt.edu.cn'];
const DEFAULT_CLASS_TIME_MODE = '9475847A3F3033D1E05377B5030AA94D';

const CAMPUS_ID_MAP: Record<number, { qzId: string; namePrefix: string }> = {
  1: { qzId: '01', namePrefix: '校本部' },
  2: { qzId: '04', namePrefix: '沙河校区' },
};

const CLASSROOM_NAME_RULES: Record<number, Array<{ pattern: RegExp; replacement: string }>> = {
  1: [
    { pattern: /^主-(.+)$/u, replacement: '主楼-$1' },
    { pattern: /^(\d)-(.+)$/u, replacement: '教$1-$2' },
    { pattern: /动画室/u, replacement: '教2-动画室' },
    { pattern: /^新科研-(.+)$/u, replacement: '新科研楼-$1' },
    { pattern: /^明-(.+)$/u, replacement: '明光楼-$1' },
    { pattern: /^明光楼(\d.+)$/u, replacement: '明光楼-$1' },
    { pattern: /^经管楼(\d.+)$/u, replacement: '经管楼-$1' },
    { pattern: /^(东.)-(\d+)$/u, replacement: '本部图书馆-$1$2' },
    { pattern: /^图书馆一层$/u, replacement: '本部图书馆-一层' },
    { pattern: /^工程管理仿真中心$/u, replacement: '学10-工程管理仿真中心' },
  ],
  2: [
    { pattern: /（.*$/u, replacement: '' },
    { pattern: /^([NS])(\d+)$/u, replacement: '$1-$2' },
    { pattern: /^图-(.+)$/u, replacement: '沙河图书馆-$1' },
    { pattern: /沙河图书馆东配楼/u, replacement: '沙河图书馆-东配楼_' },
    { pattern: /^D-([NS])(.*)$/u, replacement: '教学实验综合楼-D_$1$2' },
    { pattern: /^邮政楼D1-(.*)$/u, replacement: '邮政楼-D1_$1' },
    { pattern: /^D1-(.*)$/u, replacement: '邮政楼-D1_$1' },
    { pattern: /^办-(.*)$/u, replacement: '综合办公楼-$1' },
    { pattern: /^地下一层自动化$/u, replacement: '教学实验综合楼-地下一层自动化' },
    { pattern: /^报告厅$/u, replacement: '教学实验综合楼-报告厅' },
    { pattern: /^学-(.*)$/u, replacement: '学生活动中心-$1' },
    { pattern: /^(..楼)(\d+)$/u, replacement: '$1-$2' },
    { pattern: /^电路中心(\d+)$/u, replacement: '电路中心实验楼-$1' },
  ],
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

async function responseSnippet(resp: Response): Promise<string> {
  try {
    return (await resp.clone().text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  } catch (error) {
    return `failed to read response body: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function statusError(label: string, url: string, resp: Response): Promise<Error> {
  const snippet = await responseSnippet(resp);
  return new Error(`${label} failed: url=${url} status=${resp.status} body=${snippet || '<empty>'}`);
}

async function requestFirstOk(fetcher: typeof fetch, jar: CookieJar, path: string, init: RequestInit = {}): Promise<{ resp: Response; origin: string }> {
  const failures: string[] = [];
  for (const origin of ORIGINS) {
    const url = `${origin}${path}`;
    const resp = await request(fetcher, jar, url, init);
    if (resp.status !== 530) {
      return { resp, origin };
    }
    failures.push(`${url} status=530 body=${(await responseSnippet(resp)) || '<empty>'}`);
  }
  throw new Error(`all QZ origins failed: ${failures.join('; ')}`);
}

function encodeInp(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function login(env: Env): Promise<{ jar: CookieJar; origin: string }> {
  const fetcher = env.EC_FETCH ?? fetch;
  const username = requireSecret(env.JW_USERNAME, 'JW_USERNAME');
  const password = requireSecret(env.JW_PASSWORD, 'JW_PASSWORD');
  const jar = new CookieJar();

  const { resp: pageResp, origin } = await requestFirstOk(fetcher, jar, '/jsxsd/');
  if (!pageResp.ok) {
    throw await statusError('QZ login page', `${origin}/jsxsd/`, pageResp);
  }

  const body = new URLSearchParams({
    userAccount: username,
    userPassword: '',
    encoded: `${encodeInp(username)}%%%${encodeInp(password)}`,
  });
  const resp = await request(fetcher, jar, `${origin}/jsxsd/xk/LoginToXk`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${origin}/jsxsd/`,
    },
    body,
  });
  const text = await resp.text();
  const location = resp.headers.get('location') ?? '';
  if (resp.status !== 302 || !location.includes('/jsxsd/framework/')) {
    const message = /用户登录|请输入账号|登录/.test(text) ? 'login rejected' : text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(`QZ login failed: url=${origin}/jsxsd/xk/LoginToXk status=${resp.status} location=${location || '<none>'} body=${message || '<empty>'}`);
  }

  return { jar, origin };
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

function normalizeClassroom(raw: string, fallbackBuilding: string, campusId: number): string | null {
  let value = htmlText(raw);
  if (!value || value === '教室\\节次') {
    return null;
  }
  value = value.replace(/[（(]\s*(\d+)\s*[)）]/u, '($1)');
  const sizeMatch = value.match(/[（(]\d+[)）]/u)?.[0] ?? '';
  let withoutSize = value.replace(/[（(]\s*\d+\s*[)）]/u, '').trim();
  if (!withoutSize.includes('-') && fallbackBuilding) {
    withoutSize = `${fallbackBuilding}-${withoutSize}`;
  }
  for (const rule of CLASSROOM_NAME_RULES[campusId] ?? []) {
    if (rule.pattern.test(withoutSize)) {
      withoutSize = withoutSize.replace(rule.pattern, rule.replacement);
    }
  }
  return `${withoutSize}${sizeMatch}`;
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

function parseClassroomTable(html: string, now = shanghaiNow(), campusId = 0): JWClassInfo[] {
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
    const classroom = normalizeClassroom(cells[0], buildingName, campusId);
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

async function queryClassroomTable(env: Env, jar: CookieJar, origin: string, campusId: number): Promise<string> {
  const campus = CAMPUS_ID_MAP[campusId];
  if (!campus) {
    throw new Error(`unsupported campus id ${campusId}`);
  }
  const fetcher = env.EC_FETCH ?? fetch;
  const resp = await request(fetcher, jar, `${origin}/jsxsd/kbcx/kbxx_classroom_ifr`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${origin}/jsxsd/kbcx/kbxx_classroom`,
    },
    body: new URLSearchParams({
      xqid: campus.qzId,
      kbjcmsid: DEFAULT_CLASS_TIME_MODE,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`${campus.namePrefix} classroom query failed: url=${origin}/jsxsd/kbcx/kbxx_classroom_ifr status=${resp.status} body=${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || '<empty>'}`);
  }
  if (/用户登录|请输入账号/u.test(text)) {
    throw new Error(`${campus.namePrefix} classroom query returned login page`);
  }
  return text;
}

export async function queryOne(env: Env, campusId: number): Promise<JWClassInfo[]> {
  if (env.JW_PROXY_URL) {
    return queryOneViaProxy(env, campusId);
  }

  const { jar, origin } = await login(env);
  const html = await queryClassroomTable(env, jar, origin, campusId);
  const data = parseClassroomTable(html, shanghaiNow(), campusId);
  if (data.length === 0) {
    throw new Error(`QZ classroom query returned no occupied classrooms for campus ${campusId}`);
  }
  return data;
}

async function queryOneViaProxy(env: Env, campusId: number): Promise<JWClassInfo[]> {
  const token = requireSecret(env.JW_PROXY_TOKEN, 'JW_PROXY_TOKEN');
  const baseUrl = env.JW_PROXY_URL?.replace(/\/+$/u, '');
  const resp = await fetchWithTimeout(env.EC_FETCH ?? fetch, `${baseUrl}/api/query?campusId=${campusId}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`JW proxy query failed: url=${baseUrl}/api/query?campusId=${campusId} status=${resp.status} body=${text.slice(0, 300) || '<empty>'}`);
  }
  const data = JSON.parse(text) as { data?: JWClassInfo[]; error?: string };
  if (!Array.isArray(data.data)) {
    throw new Error(`JW proxy returned invalid data: ${data.error ?? text.slice(0, 300)}`);
  }
  return data.data;
}

export const __test__ = { parseClassroomTable };
