import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { pathToFileURL } from 'node:url';

const app = new Hono();

app.get('/healthz', (c) => c.json({ status: 'ok' }));

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule && !process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port });
  console.log(`Hello Agent server listening on http://localhost:${port}`);
}

export default app;
