# Agent Instructions for Frontier Agent Apps

This document is for LLM agents and operators modifying Hello Agent. Keep the repo small: vanilla TypeScript in `pwa/`, Hono in `server/`, helpers inline under `server/src/lib/`.

## Overview

Hello Agent has two halves:

- PWA half: normal Frontier App Store iframe app. It uses `@frontiertower/frontier-sdk` and the existing postMessage protocol.
- Server half: operator-hosted Hono app. It receives signed Frontier webhooks, calls Frontier APIs with `X-API-Key` and `X-OnBehalfOf`, checks AgentRegistry state, and exposes a JSON status surface.

Do not introduce platform mocks. This starter is allowed to fail until sandbox ships AgentRegistry, gateway on-behalf-of support, and cron deliveries.

## PWA Half

Read the canonical SDK instructions here:

- `/Users/memehalis/work/frontieros/frontier-kickstarter/docs/AGENT_INSTRUCTIONS.md`
- `/Users/memehalis/work/frontieros/frontier-sdk/src/sdk.ts`

The PWA half follows the same shape as `frontier-kickstarter/src/main.ts`:

```ts
import { FrontierSDK } from '@frontiertower/frontier-sdk';
import { isInFrontierApp, renderStandaloneMessage } from '@frontiertower/frontier-sdk/ui-utils';

const sdk = new FrontierSDK();

if (!isInFrontierApp()) {
  renderStandaloneMessage(app, 'Hello Agent');
}
```

The PWA does not talk to AgentRegistry directly. The App Store installer creates the subscription and consent entry. The PWA only:

- fetches `GET /state/:frontierId` from the operator server,
- renders subscription, budget, scopes, and check-in entries,
- posts `POST /action/ping` for a citizen-initiated manual run,
- polls state every 30 seconds while open.

## Server Half

The server entrypoint is `server/src/index.ts`. It exports a Hono app for Vercel and starts a Node server on port `8787` when run locally.

Routes:

- `GET /healthz`
- `POST /webhooks/frontier`
- `GET /state/:userId`
- `POST /action/ping`

## Handler Surface

The demo agent's behavior lives in `server/src/handlers.ts`.

### onSubscribe

Runs when Frontier delivers an agent subscription event.

```ts
await handlers.onSubscribe({
  user: { id: '123', firstName: 'Michalis' },
});
```

Expected operator edits:

- initialize per-user state,
- validate requested scopes and budget,
- enqueue any first-run setup.

### onUnsubscribe

Runs when a citizen unsubscribes.

```ts
await handlers.onUnsubscribe({ user: { id: '123' } });
```

Expected operator edits:

- delete per-user state,
- cancel scheduled external jobs,
- revoke any external service linkage.

### onTick

Runs when sandbox delivers `cron:weekly` for a subscribed citizen.

```ts
const state = await handlers.onTick({ user: { id: '123' } });
```

Hello Agent calls:

```ts
const profile = await client.onBehalfOf(user.id).getUser().getProfile();
```

That call depends on gateway support for `X-OnBehalfOf`. Until the gateway recognizes agent operators, the call will fail against sandbox. Do not replace this with fake profile data.

### onUserAction

Runs when the PWA asks for a manual ping.

```ts
await handlers.onUserAction({
  user: { id: '123' },
  action: 'ping',
});
```

The starter records that the citizen requested a ping and then tries `onTick`. If the Frontier API call fails because sandbox agent auth is not live, the status surface records the platform error.

## FrontierClient API

`server/src/lib/frontier-client.ts` is a thin REST client, not the iframe SDK.

```ts
const client = new FrontierClient({
  apiKey: process.env.FRONTIER_API_KEY!,
  baseUrl: process.env.SANDBOX_API_BASE!,
});

const profile = await client
  .onBehalfOf(frontierId)
  .getUser()
  .getProfile();
```

Every request includes:

- `X-API-Key: <developer api key>`
- `X-OnBehalfOf: <frontier_id>` when acting for a subscribed citizen

The REST endpoints mirror the current PWA backend paths:

- `getUser().getDetails()` -> `/auth/users/me/`
- `getUser().getProfile()` -> `/auth/profiles/me/`
- `getEvents().listEvents()` -> `/events/`

## Webhook Verification

`server/src/lib/verify-webhook.ts` mirrors `/Users/memehalis/work/frontieros/berlinhouse-api/apps/third_party/models/webhook.py`.

Canonical message:

```ts
const message = timestamp + '.' + canonicalJson(body);
```

Where `canonicalJson` sorts object keys recursively and emits no whitespace, matching Python:

```python
json.dumps(body, separators=(",", ":"), sort_keys=True)
```

Verification steps:

1. Read `X-Webhook-Timestamp`.
2. Read `X-Webhook-Signature`.
3. Read `X-Webhook-Signature-Algorithm`.
4. Reject anything except Ed25519.
5. Reject timestamps older than 5 minutes.
6. Verify the base64 signature with the base64 `WEBHOOK_PUBLIC_KEY`.

## AgentRegistry API

`server/src/lib/agent-registry.ts` is intentionally importable but not usable until the contract is deployed in sandbox.

```ts
const registry = new AgentRegistry({
  contractAddress,
  rpcUrl,
  agentEoa,
});

await registry.listSubscribers();
await registry.getSubscription(frontierId);
await registry.canSpend(frontierId, amount);
await registry.spend(frontierId, amount, 'event booking');
```

All methods currently throw:

```ts
throw new Error('AgentRegistry not yet deployed in sandbox');
```

Do not remove that guard until Felix's contract address and ABI are live.

## State Store

`server/src/lib/state.ts` is a single in-memory `Map`.

This is correct for v1 because the starter is a reference, not hosted infrastructure. Production operators should swap the implementation for Vercel KV, Cloudflare KV, or Postgres without changing the handler signatures.

## Status Surface Contract

`server/src/status-surface.ts` is the canonical schema. `pwa/src/main.ts` duplicates the type to avoid introducing a workspace or shared package.

```ts
type AgentStatusSurface = {
  userId: string;
  subscribed: boolean;
  subscribedAt: number | null;
  budget: {
    currency: 'FND';
    maxPerPeriod: string;
    periodDays: number;
    usedThisPeriod: string;
  };
  scopes: string[];
  lastCheckIn: number | null;
  nextCheckIn: number | null;
  entries: StatusEntry[];
};
```

If you change this schema, update both halves in the same commit.

## Safe Extension Points

Good first edits:

- change `SERVER_URL` in `pwa/src/main.ts`,
- add another webhook event case in `server/src/index.ts`,
- add a new handler method in `server/src/handlers.ts`,
- replace `state.ts` with a durable store,
- replace the AgentRegistry ABI once the contract ships.

Avoid:

- publishing an SDK package from this repo,
- adding React or Tailwind,
- adding local mocks for platform pieces,
- adding a spending demo before AgentRegistry and allowance pulls are live.
