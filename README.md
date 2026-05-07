# Hello Agent Kickstarter

A minimal demo agent app for the Frontier App Store showing how an operator-hosted agent can act for subscribed citizens.

Hello Agent has two halves:

- `pwa/` is the iframe app citizens open from Frontier OS.
- `server/` is the Hono service operators host to receive webhooks, call Frontier APIs on behalf of subscribers, and expose the live status surface.

## Disclaimer

**If you are using this, you are in the ultra-early developer group. There will be dragons, things will break.**

## Getting Started

### Prerequisites

- Request a test agent operator account from the tech team (no automation for this yet).
- This kickstarter is preconfigured for `sandbox.os.frontiertower.io`.
- The sandbox agent platform is still coming online. AgentRegistry, `X-OnBehalfOf`, and `cron:*` webhook deliveries must be live in sandbox before the full autonomous flow works end to end.
- If you want to use normal Frontier webhooks first, read `./docs/WEBHOOKS.md`.

### Agent Context

Find the agent instructions and deployment guide to feed to your agent here:

```bash
./docs/AGENT_INSTRUCTIONS.md
./docs/DEPLOYMENT.md
```

### Development Setup

Run the PWA half in one terminal:

```bash
cd pwa
npm install
npm run dev
```

Run the server half in another terminal:

```bash
cd server
npm install
npm run dev
```

The PWA runs on `http://localhost:5176`. The server runs on `http://localhost:8787`.

### Installing the PWA

> If you are developing we recommend using Chrome and move to test the local apps before release.

The Frontier Wallet is a Progressive Web App (PWA) that can be installed on your device:

**iOS:**
1. Open Safari and navigate to [sandbox.os.frontiertower.io](https://sandbox.os.frontiertower.io)
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

**Android:**
1. Open Chrome and navigate to [sandbox.os.frontiertower.io](https://sandbox.os.frontiertower.io)
2. Tap the three-dot menu in the top right
3. Tap "Add to Home Screen" or "Install App"
4. Tap "Add" or "Install" to confirm

### Testing Hello Agent

1. Click on **Apps** -> **App Store**.
2. Install **Hello Agent**.
3. Approve the agent subscription: scopes `user:getDetails`, `user:getProfile`; budget `$0/month`; schedule `cron:weekly`.
4. Click the app to load the local PWA and view the operator server's live status surface.
5. Tap **Send manual ping** and watch the server logs.
6. When sandbox cron is live, watch the server logs as `cron:weekly` webhook deliveries fire per subscriber.

## Architecture

```text
Citizen PWA iframe
  pwa/src/main.ts
        |
        | GET /state/:frontierId
        | POST /action/ping
        v
Operator server
  Hono routes + agent handlers
        |
        | X-API-Key
        | X-OnBehalfOf: <frontier_id>
        v
Frontier API + signed webhooks
        |
        | scope + budget checks
        v
AgentRegistry
```

## Frontier Agent Primitives

Hello Agent demonstrates:

- `subscribe` and `unsubscribe` webhook handlers.
- Scope and zero-budget consent metadata.
- Ed25519 webhook verification.
- `X-API-Key` plus `X-OnBehalfOf` server-to-server calls.
- A live status surface rendered inside the PWA.
- A manual "approve this now" style action from the citizen to the operator server.
- Inline AgentRegistry bindings that compile today and are ready to wire once Felix's contract is deployed.

## Known Limitations

- AgentRegistry is not deployed in sandbox yet.
- The API gateway does not yet honor `X-OnBehalfOf` for agent operator calls.
- `cron:*` webhook events are not yet emitted by sandbox.
- The state store is in-memory for v1 and resets on server cold starts. Production operators should swap it for Vercel KV, Cloudflare KV, or Postgres.

No local platform substitutes are included. This kickstarter is intentionally broken until those sandbox pieces are live, matching the posture of the original `frontier-kickstarter` v0.

## Out Of Scope

- **MCP server multi-tenancy.** The autonomous half hits the Frontier REST API directly with `X-API-Key` plus `X-OnBehalfOf`. MCP-level multi-tenancy (one MCP token acting for many citizens) is open research and a separate piece of work — see the Frontier team's research list rather than this kickstarter.
- A published `@frontiertower/frontier-agent-sdk` package. Helpers live inline at `server/src/lib/`. Extraction comes later, once the API stabilizes.
- React or Tailwind PWA scaffold. The vanilla-TS shape mirrors `frontier-kickstarter`. A React-stack agent template will live inside `frontier-os-app-builder` (`/fos:new-agent`) when that lands.
- The AgentRegistry contract source and deployment. Felix's separate work.

## Deploying Your Agent

When you're ready to deploy, follow `./docs/DEPLOYMENT.md`.

The short version is:

```bash
cd pwa && vercel --prod
cd ../server && vercel --prod
```

Then send the registration payload from `./deploy.sh` to the tech team.

## Required Registration Information

Provide the following metadata:

```json
{
  "name": "Hello Agent",
  "kind": "agent",
  "url": "https://hello-agent-pwa.vercel.app",
  "agentServerUrl": "https://hello-agent-server.vercel.app",
  "permissions": ["user:getDetails", "user:getProfile"],
  "permissionDisclaimer": "Hello Agent reads your profile to greet you on a weekly cron."
}
```

- Specify the list of permissions your agent needs.
- Use as few permissions as possible.
- Explain why you need each permission in `permissionDisclaimer`.
- Register one webhook per environment and store the returned `WEBHOOK_PUBLIC_KEY`.

## App Metadata

Apps use standard HTML meta tags for metadata (fetched by the host PWA):

```html
<head>
  <title>Hello Agent</title>
  <meta name="description" content="A minimal demo agent for the Frontier App Store" />
  <link rel="icon" href="/favicon.svg" />
</head>
```

The host PWA parses your HTML to display the app in the store.
