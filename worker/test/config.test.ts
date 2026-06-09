import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { makeConfig, makeEnv } from './helpers';

describe('config loading', () => {
  it('loads config from environment JSON', async () => {
    const config = makeConfig();
    const env = makeEnv(config);

    await expect(loadConfig(env)).resolves.toMatchObject({
      campus: [{ name: '西土城' }],
      class_table: { start_week: '2024-03-04' },
    });
  });

  it('prefers KV config over environment JSON', async () => {
    const env = makeEnv(makeConfig());
    const kvConfig = makeConfig();
    kvConfig.campus[0].name = '沙河';
    await env.KV.put('CONFIG_JSON', JSON.stringify(kvConfig));

    const loaded = await loadConfig(env);
    expect(loaded.campus[0].name).toBe('沙河');
  });

  it('merges campus tables and notification from separate sources', async () => {
    const config = makeConfig();
    config.class_table.class_table_map = {};
    const env = makeEnv(config);
    await env.KV.put('CAMPUS_TABLES_JSON', JSON.stringify(makeConfig().class_table.class_table_map));
    await env.KV.put(
      'NOTIFICATION_JSON',
      JSON.stringify({
        title: 'kv notice',
        content: 'kv content',
        duration: 1,
        type: 'warning',
        showNotification: true,
        start: '2024-01-01 00:00:00',
        end: '2024-12-31 23:59:59',
      }),
    );

    const loaded = await loadConfig(env);
    expect(loaded.class_table.class_table_map.西土城.class).toHaveLength(1);
    expect(loaded.notification.title).toBe('kv notice');
  });
});
