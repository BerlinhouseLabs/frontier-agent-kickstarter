# Multi-Tenancy And On-Behalf-Of Calls

Normal Frontier apps run in an iframe as the current user. Agent apps also have an operator server that acts when the user is not present.

This creates a multi-tenant server-to-server auth problem: one operator agent acts for many subscribed citizens, but only within each citizen's granted scopes and budget.

## Header Semantics

Hello Agent uses:

```text
X-API-Key: <developer_api_key>
X-OnBehalfOf: <frontier_id>
```

`X-API-Key` authenticates the developer/operator. `X-OnBehalfOf` selects the subscribed citizen for this request.

The gateway must verify:

1. The developer API key belongs to the registered agent operator.
2. The agent EOA is registered in AgentRegistry.
3. The `X-OnBehalfOf` citizen has subscribed to that agent.
4. The requested API action is covered by the citizen's scopes.
5. Any spending action is within the current budget window.

Until that gateway behavior ships, on-behalf-of Frontier API calls from `server/src/lib/frontier-client.ts` may fail.

## EIP-712 Agent Sign-In

The expected sign-in shape is:

1. Operator asks the API for an agent sign-in challenge.
2. API returns an EIP-712 typed data challenge.
3. Operator signs the challenge with `AGENT_EOA_PRIVATE_KEY`.
4. API verifies the signature against AgentRegistry.
5. API issues or refreshes the operator token.

The helper is in `server/src/lib/eoa.ts`:

```ts
const eoa = agentEoaFromEnv();
const address = eoa.getAddress();
const signature = await eoa.signEip712Challenge(challenge);
```

The exact challenge endpoint is platform work and is not simulated in this starter.

## Per-User Scope Checks

Agent subscriptions combine permissions and budget into one object:

```json
{
  "frontierId": "123",
  "agent": "0xagent",
  "scopes": ["user:read"],
  "budget": {
    "currency": "FND",
    "maxPerPeriod": "0.00",
    "periodDays": 30
  }
}
```

For `GET /auth/profiles/me/` on behalf of user `123`, the gateway should require a user-read scope. For a future booking or spending call, it should require the relevant domain scope and budget availability.

## Batch Calls

Batch/list semantics are intentionally not expanded in this starter. A multi-tenant agent should not see arbitrary users just because it has one operator token.

Safe default:

- single-user calls require `X-OnBehalfOf`,
- list calls return only resources visible to that subscribed user,
- operator-wide subscriber lists come from AgentRegistry, not from user APIs.

## PWA Relationship

The PWA still uses the normal iframe SDK and postMessage protocol. It does not send `X-OnBehalfOf` itself and it does not read AgentRegistry directly.

The PWA can:

- display the subscription status,
- display the budget meter,
- call the operator server for manual actions,
- deep-link or close using the standard SDK if the app adds that behavior later.

Subscription creation and cancellation belong to the Frontier OS App Store installer flow.
