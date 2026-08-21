function hexToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

async function verifyHmac(
  message: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const bytes = hexToBytes(signature);
  if (!bytes || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(message)
  );
}

export async function verifyPaymentSignature(
  input: { orderId: string; paymentId: string; signature: string },
  secret: string
): Promise<boolean> {
  return verifyHmac(
    `${input.orderId}|${input.paymentId}`,
    input.signature,
    secret
  );
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  return verifyHmac(rawBody, signature, secret);
}
