import HomeClient from './home-client';
import { getCachedClassInfo, recordRefreshError, TODAY_STALE_CACHE_KEY } from '../src/cache';
import { queryAll } from '../src/classTable';
import { getEnv } from '../src/env';
import type { ApiResponse } from '../src/frontendTypes';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialData = await loadInitialData();
  return <HomeClient initialData={initialData} />;
}

async function loadInitialData(): Promise<ApiResponse> {
  const env = await getEnv();
  const cached = await getCachedClassInfo(env);
  if (cached) {
    return { code: 0, data: cached };
  }

  try {
    const classInfo = await queryAll(env);
    return { code: 0, data: classInfo };
  } catch (error) {
    await recordRefreshError(env, error);
    const stale = await getCachedClassInfo(env, TODAY_STALE_CACHE_KEY);
    if (stale) {
      return { code: 0, data: stale, stale: true };
    }
    return { code: 500, msg: 'query failed' };
  }
}
