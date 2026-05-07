# Agent Webhooks

The canonical Frontier webhook guide is:

- `/Users/memehalis/work/frontieros/frontier-kickstarter/docs/WEBHOOKS.md`

Hello Agent uses the same delivery format and signature verification.

## Receiver

Endpoint:

```text
POST /webhooks/frontier
```

Headers:

- `Content-Type: application/json`
- `X-Webhook-Event`
- `X-Webhook-Id`
- `X-Webhook-Timestamp`
- `X-Webhook-Signature`
- `X-Webhook-Signature-Algorithm: ed25519`

The server verifies every delivery before dispatching to handlers.

## Canonical Signature Message

The TypeScript verifier mirrors the Django model:

- `/Users/memehalis/work/frontieros/berlinhouse-api/apps/third_party/models/webhook.py`
- `server/src/lib/verify-webhook.ts`

Message:

```text
X-Webhook-Timestamp + "." + canonical_json_body
```

Where `canonical_json_body` is sorted JSON with no whitespace.

## Agent-Specific Events

Hello Agent subscribes to:

- `cron:weekly`
- `user:profileUpdated`

The `cron:*` namespace is new and may not be listed in the existing webhook guide yet. Sandbox must emit `cron:weekly` per subscribed citizen before autonomous runs work.

The starter also recognizes likely subscription lifecycle names while the final platform names are settling:

- `agent:subscribed`
- `agent:unsubscribed`
- `agent_subscription:created`
- `agent_subscription:deleted`

## Payload Shape

Expected body:

```json
{
  "id": "delivery_uuid",
  "event": "cron:weekly",
  "triggered_at": "2026-05-07T12:00:00Z",
  "data": {
    "user": {
      "id": "123",
      "firstName": "Michalis"
    }
  }
}
```

`server/src/index.ts` also accepts `data.frontierId`, `data.frontier_id`, or `data.userId` while the final event schema is being locked.

## Operational Tips

- Keep one webhook per environment.
- Store `WEBHOOK_PUBLIC_KEY` as a secret.
- Reject old timestamps.
- Treat `X-Webhook-Id` as an idempotency key in production.
- Add durable storage before processing real user actions.
