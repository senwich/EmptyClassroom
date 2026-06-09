# Empty Classroom Worker

Cloudflare Worker rewrite of the Go API. It keeps the existing frontend API shape:

- `GET /api/get_data`
- `POST /api/report`

## Cloudflare Binding

This project uses the Cloudflare docs-style KV binding name:

```ts
env.KV
```

The matching `wrangler.jsonc` entry is:

```jsonc
"kv_namespaces": [
  {
    "binding": "KV",
    "id": "68787afc4bc242baa04e4f1fcb2ca0a5"
  }
]
```

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

Do not put these two values in `wrangler.jsonc` or commit them to GitHub.

Optional feedback webhook:

```bash
npx wrangler secret put LARK_WEBHOOK
```

When using Cloudflare's **Create a Worker -> Connect to GitHub** flow, configure these in the Cloudflare dashboard instead of running `wrangler secret put` locally.

Required environment variables/secrets:

| Name | Required | Purpose |
|---|---:|---|
| `JW_USERNAME` | Yes | BUPT JW login username |
| `JW_PASSWORD` | Yes | BUPT JW login password |

Cloudflare Dashboard placeholders to fill before going live:

```text
JW_USERNAME = <fill in Cloudflare dashboard>
JW_PASSWORD = <fill in Cloudflare dashboard>
```

For local development, copy `.dev.vars.example` to `.dev.vars` and fill those two values locally. `.dev.vars` is ignored by Git.

Optional environment variables/secrets:

| Name | Required | Purpose |
|---|---:|---|
| `LARK_WEBHOOK` | No | Feishu/Lark feedback webhook. If missing, reports are stored in KV under `REPORT:<timestamp>` |
| `EC_CONFIG_JSON` | No | Main config JSON fallback if KV key `CONFIG_JSON` is absent |
| `EC_CAMPUS_TABLES_JSON` | No | Campus table JSON fallback if KV key `CAMPUS_TABLES_JSON` is absent |
| `EC_NOTIFICATION_JSON` | No | Notification JSON fallback if KV key `NOTIFICATION_JSON` is absent |

Recommended KV keys:

| KV key | Required | Purpose |
|---|---:|---|
| `CONFIG_JSON` | Yes, unless `EC_CONFIG_JSON` is set | Former `config/config.json` content |
| `CAMPUS_TABLES_JSON` | Yes, unless included in `CONFIG_JSON` or `EC_CAMPUS_TABLES_JSON` is set | JSON object mapping campus name to former `<campus>.json` content |
| `NOTIFICATION_JSON` | No, if notification is already present in `CONFIG_JSON` | Former `notification.json` content |

`wrangler.jsonc` includes a safe non-secret `EC_CONFIG_JSON` fallback so GitHub-connected deploys can build before real config is imported. Replace it by adding real KV keys above when preparing production data.

## Local Development

```bash
npm install
npm test
npm run typecheck
npx wrangler dev
```

## Deploy

Create or reuse a KV namespace, update `wrangler.jsonc`, then deploy:

```bash
npx wrangler kv namespace create KV
npm run deploy
```

For **Create a Worker -> Connect to GitHub**:

| Setting | Value |
|---|---|
| Root directory | `worker` |
| Build command | `npm run typecheck && npm test` |
| Deploy command | `npm run deploy` |
| Wrangler config | `worker/wrangler.jsonc` |

Cloudflare will read `wrangler.jsonc` from the `worker` directory when that is the project root.

Before first production request, add encrypted secrets in the Cloudflare Worker dashboard:

```text
JW_USERNAME
JW_PASSWORD
```

Then add production config to the bound KV namespace with these keys:

```text
CONFIG_JSON
CAMPUS_TABLES_JSON
NOTIFICATION_JSON
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
