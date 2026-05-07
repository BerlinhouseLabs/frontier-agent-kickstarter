import * as ed25519 from '@noble/ed25519';

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

export type VerifyWebhookOptions = {
  headers: WebhookHeaders;
  body: JsonValue;
  publicKey?: string;
  now?: number;
  toleranceMs?: number;
};

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export async function verifyWebhookDelivery(options: VerifyWebhookOptions): Promise<void> {
  const timestamp = getHeader(options.headers, 'x-webhook-timestamp');
  const signature = getHeader(options.headers, 'x-webhook-signature');
  const algorithm = getHeader(options.headers, 'x-webhook-signature-algorithm');
  const publicKey = options.publicKey ?? process.env.WEBHOOK_PUBLIC_KEY;

  if (!timestamp) throw new WebhookVerificationError('Missing X-Webhook-Timestamp');
  if (!signature) throw new WebhookVerificationError('Missing X-Webhook-Signature');
  if (!publicKey) throw new WebhookVerificationError('Missing WEBHOOK_PUBLIC_KEY');
  if (algorithm && algorithm.toLowerCase() !== 'ed25519') {
    throw new WebhookVerificationError(`Unsupported signature algorithm: ${algorithm}`);
  }

  assertFreshTimestamp(timestamp, options.now ?? Date.now(), options.toleranceMs ?? DEFAULT_TOLERANCE_MS);

  const message = signatureMessage(timestamp, options.body);
  const isValid = await ed25519.verifyAsync(
    decodeBase64(signature, 'signature'),
    message,
    decodeBase64(publicKey, 'public key'),
  );

  if (!isValid) {
    throw new WebhookVerificationError('Invalid webhook signature');
  }
}

export function signatureMessage(timestamp: string, body: JsonValue): Uint8Array {
  return new TextEncoder().encode(`${timestamp}.${canonicalJson(body)}`);
}

export function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function assertFreshTimestamp(timestamp: string, now: number, toleranceMs: number): void {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    throw new WebhookVerificationError('Invalid X-Webhook-Timestamp');
  }

  const age = now - parsed;
  if (age > toleranceMs) {
    throw new WebhookVerificationError('Webhook timestamp is too old');
  }

  if (age < -toleranceMs) {
    throw new WebhookVerificationError('Webhook timestamp is too far in the future');
  }
}

function getHeader(headers: WebhookHeaders, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = match?.[1];
  return Array.isArray(value) ? value[0] : value;
}

function decodeBase64(value: string, label: string): Uint8Array {
  try {
    return Buffer.from(value, 'base64');
  } catch {
    throw new WebhookVerificationError(`Invalid base64 ${label}`);
  }
}
