import * as ed25519 from '@noble/ed25519';
import { describe, expect, it } from 'vitest';

import { signatureMessage, verifyWebhookDelivery, type JsonValue } from './verify-webhook.js';

const now = Date.parse('2026-05-07T12:00:00.000Z');

async function signedHeaders(body: JsonValue, timestamp = new Date(now).toISOString()) {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  const signature = await ed25519.signAsync(signatureMessage(timestamp, body), privateKey);

  return {
    headers: {
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': Buffer.from(signature).toString('base64'),
      'X-Webhook-Signature-Algorithm': 'ed25519',
    },
    publicKey: Buffer.from(publicKey).toString('base64'),
  };
}

describe('verifyWebhookDelivery', () => {
  it('accepts a valid signature over the canonical JSON body', async () => {
    const body = { data: { b: 2, a: 1 }, event: 'cron:weekly', id: 'delivery-1' };
    const fixture = await signedHeaders(body);

    await expect(
      verifyWebhookDelivery({ headers: fixture.headers, body, publicKey: fixture.publicKey, now }),
    ).resolves.toBeUndefined();
  });

  it('rejects a tampered body', async () => {
    const body = { data: { firstName: 'Michalis' }, event: 'cron:weekly', id: 'delivery-1' };
    const fixture = await signedHeaders(body);
    const tampered = { ...body, data: { firstName: 'Someone else' } };

    await expect(
      verifyWebhookDelivery({ headers: fixture.headers, body: tampered, publicKey: fixture.publicKey, now }),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('rejects an old timestamp', async () => {
    const body = { data: {}, event: 'cron:weekly', id: 'delivery-1' };
    const oldTimestamp = new Date(now - 6 * 60 * 1000).toISOString();
    const fixture = await signedHeaders(body, oldTimestamp);

    await expect(
      verifyWebhookDelivery({ headers: fixture.headers, body, publicKey: fixture.publicKey, now }),
    ).rejects.toThrow('too old');
  });

  it('rejects the wrong public key', async () => {
    const body = { data: {}, event: 'cron:weekly', id: 'delivery-1' };
    const fixture = await signedHeaders(body);
    const wrongPublicKey = await ed25519.getPublicKeyAsync(ed25519.utils.randomPrivateKey());

    await expect(
      verifyWebhookDelivery({
        headers: fixture.headers,
        body,
        publicKey: Buffer.from(wrongPublicKey).toString('base64'),
        now,
      }),
    ).rejects.toThrow('Invalid webhook signature');
  });
});
