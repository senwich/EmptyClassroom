import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from './types';

export async function getEnv(): Promise<Env> {
  const context = await getCloudflareContext({ async: true });
  return context.env as unknown as Env;
}
