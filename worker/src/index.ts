import { recordRefreshError } from './cache';
import { queryAll } from './classTable';
import { route } from './routes';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      queryAll(env).catch(async (error) => {
        await recordRefreshError(env, error);
      }),
    );
  },
};
