import { jsonResponse } from './response';
import type { Env } from './types';

type LarkResponse = {
  code: number;
  msg?: string;
};

export async function handleReport(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ code: 400, msg: 'invalid json' }, 400);
  }

  const text = typeof body === 'object' && body !== null && 'text' in body ? (body as { text?: unknown }).text : undefined;
  if (typeof text !== 'string' || text.trim() === '') {
    return jsonResponse({ code: 400, msg: 'text required' }, 400);
  }

  if (!env.LARK_WEBHOOK) {
    await env.KV.put(`REPORT:${Date.now()}`, JSON.stringify({ text, at: new Date().toISOString() }), {
      expirationTtl: 30 * 24 * 60 * 60,
    });
    return jsonResponse({ code: 0, msg: 'stored' });
  }

  const resp = await fetch(env.LARK_WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'interactive',
      card: {
        elements: [{ tag: 'markdown', content: text }],
        header: {
          template: 'blue',
          title: { content: '用户反馈', tag: 'plain_text' },
        },
      },
    }),
  });

  if (!resp.ok) {
    return jsonResponse({ code: 500, msg: 'ReportToLark error' }, 500);
  }
  const larkResp = (await resp.json()) as LarkResponse;
  if (larkResp.code !== 0) {
    return jsonResponse({ code: 500, msg: larkResp.msg ?? 'ReportToLark error' }, 500);
  }
  return jsonResponse({ code: 0 });
}
