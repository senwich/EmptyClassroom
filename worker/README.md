# Empty Classroom Worker

Cloudflare Worker rewrite of the Go API. It keeps the existing frontend API shape:

- `GET /api/get_data`
- `POST /api/report`

## Configuration

The Worker cannot read local files at runtime. Provide config through one of these methods:

1. KV keys: `CONFIG_JSON`, `CAMPUS_TABLES_JSON`, `NOTIFICATION_JSON`
2. Environment/secrets: `EC_CONFIG_JSON`, `EC_CAMPUS_TABLES_JSON`, `EC_NOTIFICATION_JSON`

`CAMPUS_TABLES_JSON` should be a JSON object whose keys are campus names and values are the former `<campus>.json` contents.

Required secrets:

```bash
npx wrangler secret put JW_USERNAME
npx wrangler secret put JW_PASSWORD
```

Optional feedback webhook:

```bash
npx wrangler secret put LARK_WEBHOOK
```

## Local Development

```bash
npm install
npm test
npm run typecheck
npx wrangler dev
```

## Deploy

Create a KV namespace, update `wrangler.toml`, then deploy:

```bash
npx wrangler kv:namespace create EC_CACHE
npm run deploy
```

## Verification

Local checks:

```bash
npm run typecheck
npm test
npm audit
npx wrangler deploy --dry-run --outdir dist
```

Online checks after replacing the KV namespace id and setting secrets:

1. Deploy to a test Worker route.
2. Confirm `GET /api/get_data` returns `{ "code": 0, "data": ... }`.
3. Confirm KV contains `TODAY_CACHE` and `TODAY_CACHE_STALE` after the first successful refresh.
4. Confirm the Cron Trigger updates `TODAY_CACHE` every few minutes.
5. Confirm `LAST_REFRESH_ERROR` is absent or only contains transient errors.
6. Confirm Cloudflare Workers can reach `http://jwglweixin.bupt.edu.cn/bjyddx/login` with the configured account.
7. Submit `POST /api/report` and verify it reaches `LARK_WEBHOOK`, or is stored under `REPORT:<timestamp>` when no webhook is configured.
