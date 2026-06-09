import type { ClassInfo, Env } from './types';

export const TODAY_CACHE_KEY = 'TODAY_CACHE';
export const TODAY_STALE_CACHE_KEY = 'TODAY_CACHE_STALE';
export const LAST_REFRESH_ERROR_KEY = 'LAST_REFRESH_ERROR';

const FRESH_TTL_SECONDS = 60 * 60;
const STALE_TTL_SECONDS = 24 * 60 * 60;

export async function getCachedClassInfo(env: Env, key = TODAY_CACHE_KEY): Promise<ClassInfo | null> {
  const raw = await env.KV.get(key);
  return raw ? (JSON.parse(raw) as ClassInfo) : null;
}

export async function setCachedClassInfo(env: Env, classInfo: ClassInfo): Promise<void> {
  const raw = JSON.stringify(classInfo);
  await Promise.all([
    env.KV.put(TODAY_CACHE_KEY, raw, { expirationTtl: FRESH_TTL_SECONDS }),
    env.KV.put(TODAY_STALE_CACHE_KEY, raw, { expirationTtl: STALE_TTL_SECONDS }),
  ]);
}

export async function recordRefreshError(env: Env, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await env.KV.put(
    LAST_REFRESH_ERROR_KEY,
    JSON.stringify({ message, at: new Date().toISOString() }),
    { expirationTtl: STALE_TTL_SECONDS },
  );
}
