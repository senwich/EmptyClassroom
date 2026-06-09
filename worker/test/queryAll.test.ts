import { describe, expect, it } from 'vitest';
import { TODAY_CACHE_KEY, TODAY_STALE_CACHE_KEY } from '../src/cache';
import { queryAll } from '../src/classTable';
import { makeConfig, makeEnv } from './helpers';

describe('queryAll', () => {
  it('writes fresh and stale caches on success', async () => {
    const env = makeEnv();

    const data = await queryAll(env, new Date('2024-03-18T01:00:00+08:00'));

    expect(data.class_table).not.toBeNull();
    expect(data.notification?.title).toBe('notice');
    await expect(env.KV.get(TODAY_CACHE_KEY)).resolves.toBeTruthy();
    await expect(env.KV.get(TODAY_STALE_CACHE_KEY)).resolves.toBeTruthy();
  });

  it('uses realtime data when campus has realtime enabled', async () => {
    const config = makeConfig();
    config.campus[0].has_realtime = true;
    const env = makeEnv(config);
    env.EC_FETCH = async (input) => {
      const url = String(input);
      if (url.includes('/login')) {
        return Response.json({ code: '1', data: { token: 'token' } });
      }
      return Response.json({
        code: '1',
        data: [{ CLASSROOMS: '教一-101(80)', NODETIME: '', NODENAME: '2' }],
      });
    };

    const data = await queryAll(env, new Date('2024-03-18T01:00:00+08:00'));

    const building = data.campus_info_map?.西土城.building_info_map['0'];
    expect(data.is_fallback).toEqual({});
    expect(building?.classroom_info_map['0'].can_trust).toBe(true);
    expect(building?.class_matrix[1][0]).toBe(0);
  });

  it('marks fallback when realtime query fails', async () => {
    const config = makeConfig();
    config.campus[0].has_realtime = true;
    const env = makeEnv(config);
    env.EC_FETCH = async () => Response.json({ code: '0', Msg: 'failed' });

    const data = await queryAll(env, new Date('2024-03-18T01:00:00+08:00'));

    expect(data.is_fallback).toEqual({ 西土城: true });
    expect(data.campus_info_map?.西土城.building_info_map['0'].classroom_info_map['0'].can_trust).toBe(false);
  });

  it('hides notification and class table outside active windows', async () => {
    const env = makeEnv();

    const data = await queryAll(env, new Date('2024-08-01T01:00:00+08:00'));

    expect(data.notification).toBeNull();
    expect(data.class_table).toBeNull();
  });
});
