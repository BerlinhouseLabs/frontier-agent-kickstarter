# Hello Agent Deployment

This guide covers deploying both halves of Hello Agent.

## Prerequisites

- Request a test agent operator account from the tech team.
- Install the Vercel CLI: `npm i -g vercel`.
- Set server environment variables from `server/.env.example`.
- Deploy over HTTPS. Frontier OS will not iframe or deliver production webhooks to plain HTTP URLs.

## Allowed Origins

The PWA must be frameable by:

- `http://localhost:5173`
- `https://sandbox.os.frontiertower.io`
- `https://os.frontiertower.io`

The PWA CSP must also allow `connect-src` to your operator server URL.

## Recommended: Vercel For Both Halves

### 1. Deploy the PWA

```bash
cd pwa
npm install
npm run build
vercel --prod
```

Set a custom domain if needed, for example:

```text
hello-agent.appstore.frontiertower.io
```

### 2. Deploy the Server

```bash
cd server
npm install
npm run build
vercel --prod
```

Set these environment variables in Vercel:

```text
FRONTIER_API_KEY
AGENT_EOA_PRIVATE_KEY
WEBHOOK_PUBLIC_KEY
AGENT_REGISTRY_ADDRESS
SANDBOX_API_BASE
SANDBOX_RPC_URL
```

Verify:

```bash
curl https://hello-agent-server.vercel.app/healthz
```

Expected:

```json
{"status":"ok"}
```

### 3. Register With The Tech Team

Run from the repo root:

```bash
./deploy.sh
```

The script prints a JSON payload to paste to the tech team.

## Server Alternatives

### Cloudflare Workers

Hono supports Cloudflare Workers. Keep `server/src/index.ts` as the app source and adapt the export to the Cloudflare runtime when you move off Vercel.

Checklist:

- bind secrets with `wrangler secret put`,
- keep `/webhooks/frontier` public,
- verify the raw JSON body before dispatch,
- configure CORS for the PWA origins.

### Render

Use the Node entrypoint:

```bash
cd server
npm install
npm run build
npm start
```

Set `PORT` in Render if needed. The server defaults to `8787` locally.

### Plain Node

```bash
cd server
npm install
npm run build
PORT=8787 npm start
```

Terminate TLS at a reverse proxy and forward to the Node process.

## PWA Alternatives

### Netlify

```bash
cd pwa
npm install
npm run build
netlify deploy --prod --dir dist
```

Configure equivalent CORS and CSP headers to `pwa/vercel.json`.

### Nginx

```bash
cd pwa
npm install
npm run build
```

Serve `pwa/dist` and set:

```nginx
add_header Access-Control-Allow-Origin "https://os.frontiertower.io" always;
add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type" always;
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://hello-agent-server.vercel.app; frame-ancestors https://os.frontiertower.io https://sandbox.os.frontiertower.io http://localhost:5173;" always;
```

## Updating URLs

After deployment:

1. Update `SERVER_URL` in `pwa/src/main.ts`.
2. Update `pwa/vercel.json` `connect-src`.
3. Update `manifest.json` `agent.serverUrl`.
4. Rebuild and redeploy the PWA.

## Current Sandbox Dependencies

The full autonomous flow depends on platform work outside this repo:

- AgentRegistry deployed in sandbox.
- API gateway recognizing `X-OnBehalfOf`.
- Sandbox emitting `cron:*` webhook deliveries per subscriber.

Until those are live, `GET /healthz`, `GET /state/:userId`, and `POST /action/ping` can be smoke-tested locally, while real cron/profile checks will report the platform dependency.
