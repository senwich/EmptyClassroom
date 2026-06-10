import { describe, expect, it } from 'vitest';
import { LAST_REFRESH_ERROR_KEY, TODAY_CACHE_KEY, TODAY_STALE_CACHE_KEY } from '../src/cache';
import { queryAll } from '../src/classTable';
import { makeConfig, makeEnv } from './helpers';

function qzTableHtml(classroom = '教一-101(80)'): string {
  const cells = Array.from({ length: 98 }, (_, index) => `<td>${index === 0 ? 'busy' : ''}</td>`).join('');
  return `<table><tr><th></th></tr><tr><td>教室\\节次</td></tr><tr><td>${classroom}</td>${cells}</tr></table>`;
}

function mockQzFetch(queryUrls?: string[]): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.endsWith('/jsxsd/')) {
      return new Response('login page');
    }
    if (url.includes('/jsxsd/xk/LoginToXk')) {
      return new Response('', { status: 302, headers: { location: 'https://jwgl.bupt.edu.cn/jsxsd/framework/xsMain_bjyddx.jsp' } });
    }
    if (url.includes('/jsxsd/kbcx/kbxx_classroom_ifr')) {
      queryUrls?.push(url);
      return new Response(qzTableHtml(), { headers: { 'content-type': 'text/html' } });
    }
    return new Response('', { status: 404 });
  };
}

function mockQzFetchWithClassroom(classroom: string): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.endsWith('/jsxsd/')) {
      return new Response('login page');
    }
    if (url.includes('/jsxsd/xk/LoginToXk')) {
      return new Response('', { status: 302, headers: { location: 'https://jwgl.bupt.edu.cn/jsxsd/framework/xsMain_bjyddx.jsp' } });
    }
    if (url.includes('/jsxsd/kbcx/kbxx_classroom_ifr')) {
      return new Response(qzTableHtml(classroom), { headers: { 'content-type': 'text/html' } });
    }
    return new Response('', { status: 404 });
  };
}

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
    env.EC_FETCH = mockQzFetch();

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
    await expect(env.KV.get(LAST_REFRESH_ERROR_KEY)).resolves.toContain('QZ login failed');
  });

  it('uses default realtime campuses when config has no campus list', async () => {
    const config = makeConfig();
    config.campus = [];
    config.class_table.class_table_map = {};
    const env = makeEnv(config);
    const queryUrls: string[] = [];
    env.EC_FETCH = mockQzFetch(queryUrls);

    const data = await queryAll(env, new Date('2024-03-18T01:00:00+08:00'));

    expect(Object.keys(data.campus_info_map ?? {})).toEqual(['西土城', '沙河']);
    expect(queryUrls).toEqual([
      'https://jwgl.bupt.edu.cn/jsxsd/kbcx/kbxx_classroom_ifr',
      'https://jwgl.bupt.edu.cn/jsxsd/kbcx/kbxx_classroom_ifr',
    ]);
    await expect(env.KV.get(TODAY_CACHE_KEY)).resolves.toBeTruthy();
  });

  it('uses configured proxy for realtime data', async () => {
    const config = makeConfig();
    config.campus[0].has_realtime = true;
    const env = makeEnv(config);
    env.JW_PROXY_URL = 'https://proxy.example.test';
    env.JW_PROXY_TOKEN = 'secret';
    env.EC_FETCH = async (input, init) => {
      expect(String(input)).toBe('https://proxy.example.test/api/query?campusId=1');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret');
      return Response.json({
        data: [{ CLASSROOMS: '教一-101(80)', NODETIME: '', NODENAME: '2' }],
      });
    };

    const data = await queryAll(env, new Date('2024-03-18T01:00:00+08:00'));

    expect(data.is_fallback).toEqual({});
    expect(data.campus_info_map?.西土城.building_info_map['0'].class_matrix[1][0]).toBe(0);
  });

  it('applies original Go classroom name rules to QZ data', async () => {
    const config = makeConfig();
    config.campus[0].has_realtime = true;
    const env = makeEnv(config);
    env.EC_FETCH = mockQzFetchWithClassroom('2-138');

    const data = await queryAll(env, new Date('2024-03-18T01:00:00+08:00'));

    expect(data.campus_info_map?.西土城.building_info_map['1'].name).toBe('教2');
    expect(data.campus_info_map?.西土城.building_info_map['1'].classroom_id_map['138']).toBe(0);
  });

  it('rejects when neither config nor realtime data can provide classrooms', async () => {
    const config = makeConfig();
    config.campus = [];
    config.class_table.class_table_map = {};
    const env = makeEnv(config);
    env.EC_FETCH = async () => Response.json({ code: '0', Msg: 'failed' });

    await expect(queryAll(env, new Date('2024-03-18T01:00:00+08:00'))).rejects.toThrow('西土城: QZ login failed');
    await expect(env.KV.get(TODAY_CACHE_KEY)).resolves.toBeNull();
    await expect(env.KV.get(LAST_REFRESH_ERROR_KEY)).resolves.toContain('沙河: QZ login failed');
  }, 15000);

  it('hides notification and class table outside active windows', async () => {
    const env = makeEnv();

    const data = await queryAll(env, new Date('2024-08-01T01:00:00+08:00'));

    expect(data.notification).toBeNull();
    expect(data.class_table).toBeNull();
  });
});
