import { getCachedClassInfo, recordRefreshError, TODAY_STALE_CACHE_KEY } from '../../../src/cache';
import { queryAll } from '../../../src/classTable';
import { getEnv } from '../../../src/env';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const env = await getEnv();
  const cached = await getCachedClassInfo(env);
  if (cached) {
    return Response.json({ code: 0, data: cached });
  }

  try {
    const classInfo = await queryAll(env);
    return Response.json({ code: 0, data: classInfo });
  } catch (error) {
    await recordRefreshError(env, error);
    const stale = await getCachedClassInfo(env, TODAY_STALE_CACHE_KEY);
    if (stale) {
      return Response.json({ code: 0, data: stale, stale: true });
    }
    return Response.json({ code: 500, msg: 'query failed', data: null }, { status: 500 });
  }
}
