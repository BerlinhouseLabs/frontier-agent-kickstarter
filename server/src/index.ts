import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { pathToFileURL } from 'node:url';

import { handlers, userFromFrontierId } from './handlers.js';
import { state } from './lib/state.js';
import { verifyWebhookDelivery, type JsonValue } from './lib/verify-webhook.js';
import { formatForPwa, getState } from './status-surface.js';

const app = new Hono();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5176',
  'http://127.0.0.1:5176',
  'https://sandbox.os.frontiertower.io',
  'https://os.frontiertower.io',
  'https://hello-agent-pwa.vercel.app',
];

app.use(
  '/state/*',
  cors({
    origin: allowedOrigins,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'OPTIONS'],
  }),
);

app.use(
  '/action/*',
  cors({
    origin: allowedOrigins,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'OPTIONS'],
  }),
);

app.get('/healthz', (c) => c.json({ status: 'ok' }));

app.post('/webhooks/frontier', async (c) => {
  const body = (await c.req.json()) as JsonValue;

  try {
    await verifyWebhookDelivery({ headers: c.req.raw.headers, body });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid webhook delivery' }, 400);
  }

  const event = c.req.header('X-Webhook-Event') ?? extractEvent(body);
  const user = extractUser(body);
  if (!event) return c.json({ error: 'Missing X-Webhook-Event' }, 400);
  if (!user) return c.json({ error: 'Missing user in webhook payload' }, 400);

  if (event === 'agent:subscribed' || event === 'agent_subscription:created') {
    const next = await handlers.onSubscribe({ user });
    return c.json({ received: true, event, state: formatForPwa(user.id, next) });
  }

  if (event === 'agent:unsubscribed' || event === 'agent_subscription:deleted') {
    await handlers.onUnsubscribe({ user });
    return c.json({ received: true, event });
  }

  if (event === 'cron:weekly' || event === 'user:profileUpdated') {
    const next = await handlers.onTick({ user });
    return c.json({ received: true, event, state: formatForPwa(user.id, next) });
  }

  const next = await state.append(user.id, {
    kind: 'system',
    text: `Received unhandled Frontier event ${event}`,
    ts: Date.now(),
  });
  return c.json({ received: true, event, state: formatForPwa(user.id, next) });
});

app.get('/state/:userId', async (c) => {
  const userId = c.req.param('userId');
  const current = await getState(userId);
  return c.json(formatForPwa(userId, current));
});

app.post('/action/ping', async (c) => {
  const body = (await c.req.json()) as { frontierId?: string };
  const frontierId = body.frontierId?.trim();

  if (!frontierId) {
    return c.json({ error: 'frontierId is required' }, 400);
  }

  // Production auth should verify the same EIP-712 / OAuth flow described in
  // docs/MULTI_TENANCY.md. The starter keeps the route visible while sandbox
  // gateway support is still being wired.
  const updated = await handlers.onUserAction({
    user: userFromFrontierId(frontierId),
    action: 'ping',
  });

  return c.json(formatForPwa(frontierId, updated));
});

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule && !process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port });
  console.log(`Hello Agent server listening on http://localhost:${port}`);
}

export default app;

function extractEvent(body: JsonValue): string | null {
  if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.event === 'string') {
    return body.event;
  }
  return null;
}

function extractUser(body: JsonValue): { id: string; firstName?: string; lastName?: string } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const data = body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const user = data.user;
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    const id = readString(user, 'id') ?? readString(user, 'frontierId') ?? readString(user, 'frontier_id');
    if (id) {
      return {
        id,
        firstName: readString(user, 'firstName') ?? readString(user, 'first_name'),
        lastName: readString(user, 'lastName') ?? readString(user, 'last_name'),
      };
    }
  }

  const id = readString(data, 'frontierId') ?? readString(data, 'frontier_id') ?? readString(data, 'userId');
  return id ? { id } : null;
}

function readString(value: { [key: string]: JsonValue }, key: string): string | undefined {
  const next = value[key];
  if (typeof next === 'number') return String(next);
  return typeof next === 'string' ? next : undefined;
}
