import { describe, expect, it } from 'vitest';
import { TODAY_CACHE_KEY } from '../src/cache';
import { getCachedClassInfo } from '../src/cache';
import { handleReport } from '../src/report';
import { makeEnv } from './helpers';

describe('api handlers', () => {
  it('reads cached data through cache backend', async () => {
    const env = makeEnv();
    const cached = {
      update_at: '2024-03-18T01:00:00.000Z',
      is_fallback: {},
      class_table: null,
      notification: null,
    };
    await env.KV.put(TODAY_CACHE_KEY, JSON.stringify(cached));

    await expect(getCachedClassInfo(env)).resolves.toEqual(cached);
  });

  it('stores report in KV when webhook is not configured', async () => {
    const env = makeEnv();
    const resp = await handleReport(
      new Request('https://example.com/api/report', {
        method: 'POST',
        body: JSON.stringify({ text: 'hello' }),
      }),
      env,
    );

    expect(resp.status).toBe(200);
    const list = await env.KV.list();
    expect(list.keys.some((key) => key.name.startsWith('REPORT:'))).toBe(true);
  });

  it('rejects invalid report body', async () => {
    const env = makeEnv();
    const resp = await handleReport(
      new Request('https://example.com/api/report', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      env,
    );

    expect(resp.status).toBe(400);
  });
});
