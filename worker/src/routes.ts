import { getCachedClassInfo, recordRefreshError, TODAY_STALE_CACHE_KEY } from './cache';
import { queryAll } from './classTable';
import { handleReport } from './report';
import { jsonResponse, notFound } from './response';
import type { Env } from './types';

export async function handleGetData(env: Env): Promise<Response> {
  const cached = await getCachedClassInfo(env);
  if (cached) {
    return jsonResponse({ code: 0, data: cached });
  }

  try {
    const classInfo = await queryAll(env);
    return jsonResponse({ code: 0, data: classInfo });
  } catch (error) {
    await recordRefreshError(env, error);
    const stale = await getCachedClassInfo(env, TODAY_STALE_CACHE_KEY);
    if (stale) {
      return jsonResponse({ code: 0, data: stale, stale: true });
    }
    return jsonResponse({ code: 500, msg: 'query failed', data: null }, 500);
  }
}

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/get_data') {
    return handleGetData(env);
  }
  if (request.method === 'POST' && url.pathname === '/api/report') {
    return handleReport(request, env);
  }
  if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    return new Response(null, { status: 204 });
  }
  return notFound();
}
