// @ts-ignore `.open-next/worker.js` is generated during `opennextjs-cloudflare build`.
import { default as handler } from './.open-next/worker.js';
import { recordRefreshError } from './src/cache';
import { queryAll } from './src/classTable';
import type { Env } from './src/types';

export default {
  fetch: handler.fetch,

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      queryAll(env).catch(async (error) => {
        await recordRefreshError(env, error);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
