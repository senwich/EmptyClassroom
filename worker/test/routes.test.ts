import { describe, expect, it } from 'vitest';
import { TODAY_CACHE_KEY } from '../src/cache';
import { route } from '../src/routes';
import { makeEnv } from './helpers';

describe('routes', () => {
  it('returns cached data from get_data', async () => {
    const env = makeEnv();
    const cached = {
      update_at: '2024-03-18T01:00:00.000Z',
      is_fallback: {},
      class_table: null,
      notification: null,
    };
    await env.EC_CACHE.put(TODAY_CACHE_KEY, JSON.stringify(cached));

    const resp = await route(new Request('https://example.com/api/get_data'), env);
    expect(resp.status).toBe(200);
    await expect(resp.json()).resolves.toEqual({ code: 0, data: cached });
  });

  it('stores report in KV when webhook is not configured', async () => {
    const env = makeEnv();
    const resp = await route(
      new Request('https://example.com/api/report', {
        method: 'POST',
        body: JSON.stringify({ text: 'hello' }),
      }),
      env,
    );

    expect(resp.status).toBe(200);
    const list = await env.EC_CACHE.list();
    expect(list.keys.some((key) => key.name.startsWith('REPORT:'))).toBe(true);
  });

  it('rejects invalid report body', async () => {
    const env = makeEnv();
    const resp = await route(
      new Request('https://example.com/api/report', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      env,
    );

    expect(resp.status).toBe(400);
  });
});
