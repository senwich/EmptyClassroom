import type { Config, Env } from '../src/types';

export class MemoryKV {
  private values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(): Promise<KVNamespaceListResult<unknown, string>> {
    return {
      keys: Array.from(this.values.keys()).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    };
  }

  getWithMetadata(): Promise<never> {
    throw new Error('not implemented');
  }
}

export function makeConfig(): Config {
  return {
    class_table: {
      start_week: '2024-03-04',
      end_week: '2024-07-01',
      unable_reason: '',
      is_available: true,
      class_table_map: {
        西土城: {
          class: [
            {
              campus: '西土城',
              seat: '80',
              name: '教一-101',
              classes: Array.from({ length: 14 }, (_, node) =>
                Array.from({ length: 7 }, (_, day) => (node === 0 && day === 1 ? [2] : [])),
              ),
            },
          ],
          typeMap: {
            '教一-101': '普通教室',
          },
        },
      },
    },
    campus: [
      {
        name: '西土城',
        id: 1,
        has_realtime: false,
        replace_regex: [],
      },
    ],
    notification: {
      title: 'notice',
      content: 'content',
      duration: 3,
      type: 'info',
      showNotification: true,
      start: '2024-03-01 00:00:00',
      end: '2024-03-31 23:59:59',
    },
  };
}

export function makeEnv(config = makeConfig()): Env {
  return {
    KV: new MemoryKV() as unknown as KVNamespace,
    JW_USERNAME: 'user',
    JW_PASSWORD: 'pwd',
    EC_CONFIG_JSON: JSON.stringify(config),
  };
}
