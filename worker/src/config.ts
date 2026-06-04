import type { ClassTable, Config, Env, NotificationConfig } from './types';

const CONFIG_JSON_KEY = 'CONFIG_JSON';
const CAMPUS_TABLES_JSON_KEY = 'CAMPUS_TABLES_JSON';
const NOTIFICATION_JSON_KEY = 'NOTIFICATION_JSON';

async function readJsonSource(env: Env, kvKey: string, envKey: keyof Env): Promise<string | null> {
  const kvValue = await env.EC_CACHE.get(kvKey);
  if (kvValue) {
    return kvValue;
  }
  const envValue = env[envKey];
  return typeof envValue === 'string' && envValue.trim() !== '' ? envValue : null;
}

export async function loadConfig(env: Env): Promise<Config> {
  const configJson = await readJsonSource(env, CONFIG_JSON_KEY, 'EC_CONFIG_JSON');
  if (!configJson) {
    throw new Error('missing CONFIG_JSON in KV or EC_CONFIG_JSON env');
  }

  const config = JSON.parse(configJson) as Config;
  const campusTablesJson = await readJsonSource(env, CAMPUS_TABLES_JSON_KEY, 'EC_CAMPUS_TABLES_JSON');
  if (campusTablesJson) {
    config.class_table.class_table_map = JSON.parse(campusTablesJson) as Record<string, ClassTable>;
  }

  const notificationJson = await readJsonSource(env, NOTIFICATION_JSON_KEY, 'EC_NOTIFICATION_JSON');
  if (notificationJson) {
    config.notification = JSON.parse(notificationJson) as NotificationConfig;
  }

  if (!config.class_table.class_table_map) {
    config.class_table.class_table_map = {};
  }

  return config;
}
