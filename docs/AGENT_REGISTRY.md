# AgentRegistry

AgentRegistry is the on-chain contract that lets a citizen subscribe to an agent with explicit scopes and a stablecoin budget.

The design context lives in:

- `/Users/memehalis/work/frontieros/issues/2026-05-06-agent-registry-pwa-notes.md`

## What The Contract Does

Each Frontier ID maps to a smart account. Smart accounts can hold Frontier Dollar stablecoin. ERC-20 allowances do not have a native "per month" budget, so Frontier uses AgentRegistry as the policy layer.

Flow:

1. The citizen grants allowance to AgentRegistry.
2. The citizen subscribes to one agent with scopes and a budget.
3. The agent signs in with its registered EOA.
4. The API gateway checks AgentRegistry before honoring on-behalf-of requests.
5. Spending calls go through AgentRegistry, which enforces the time-windowed cap.

## Scope And Budget Model

Example subscription:

```json
{
  "subscriber": "123",
  "agent": "0xagent",
  "scopes": ["user:read"],
  "budget": {
    "currency": "FND",
    "maxPerPeriod": "0.00",
    "periodDays": 30
  }
}
```

Hello Agent uses a zero budget because it is read-only.

## Operator Registration

An operator registers:

- app metadata,
- webhook target,
- Ed25519 webhook public key,
- agent EOA public address,
- requested scopes,
- default budget proposal.

The EOA private key stays on the operator server in `AGENT_EOA_PRIVATE_KEY`.

## Citizen Subscription

The App Store installer should show:

- requested SDK permissions,
- agent scopes,
- proposed budget,
- schedule such as `cron:weekly`,
- the operator server URL.

When the citizen approves, AgentRegistry stores the subscription and the webhook system can deliver agent events scoped to that citizen.

## Spending Flow

This starter does not spend. The future spending path is:

1. Agent decides to spend `amount`.
2. Agent calls `registry.canSpend(frontierId, amount)`.
3. Agent calls `registry.spend(frontierId, amount, purpose)`.
4. AgentRegistry enforces the cap and pulls funds from the citizen smart account.
5. The API records the purpose and transaction hash.

Do not add a spending demo until the contract and gateway allowance pulls are live.

## Current Code

`server/src/lib/agent-registry.ts` exposes:

```ts
await registry.listSubscribers();
await registry.getSubscription(user);
await registry.canSpend(user, amount);
await registry.spend(user, amount, purpose);
```

The ABI is inline and provisional. Every method calls `assertDeployed()` and throws:

```text
AgentRegistry not yet deployed in sandbox
```

That is deliberate. Replace the placeholder only when sandbox has a contract address and final ABI.
