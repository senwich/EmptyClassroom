import type { Env, JWClassInfo, LoginResponse, QueryResponse } from './types';

const LOGIN_URL = 'http://jwglweixin.bupt.edu.cn/bjyddx/login';
const QUERY_URL = 'http://jwglweixin.bupt.edu.cn/bjyddx/todayClassrooms?campusId=0';

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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function login(env: Env): Promise<string> {
  const fetcher = env.EC_FETCH ?? fetch;
  const body = new URLSearchParams({
    userNo: requireSecret(env.JW_USERNAME, 'JW_USERNAME'),
    pwd: requireSecret(env.JW_PASSWORD, 'JW_PASSWORD'),
    encode: '1',
    captchaData: '',
    codeVal: '',
  });

  const resp = await fetchWithTimeout(fetcher, LOGIN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    throw new Error(`login failed with status ${resp.status}`);
  }

  const data = (await resp.json()) as LoginResponse;
  if (data.code !== '1' || !data.data?.token) {
    throw new Error(`login failed: ${data.Msg ?? data.code}`);
  }
  return data.data.token;
}

export async function queryOne(env: Env, campusId: number): Promise<JWClassInfo[]> {
  const fetcher = env.EC_FETCH ?? fetch;
  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const token = await login(env);
      const resp = await fetchWithTimeout(fetcher, `${QUERY_URL}${campusId}`, {
        headers: { token },
      });
      if (!resp.ok) {
        throw new Error(`query failed with status ${resp.status}`);
      }

      const data = (await resp.json()) as QueryResponse;
      if (data.code !== '1') {
        throw new Error(`query failed: ${data.Msg ?? data.code}`);
      }
      return data.data ?? [];
    } catch (error) {
      lastError = error;
      if (i < 2) {
        await sleep(1000 * (i + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
