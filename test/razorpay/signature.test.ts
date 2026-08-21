import { describe, expect, it } from "vitest";
import {
  verifyPaymentSignature,
  verifyWebhookSignature
} from "../../worker/razorpay/signature";

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

describe("Razorpay signatures", () => {
  it("verifies a payment against the server order ID", async () => {
    const signature = await sign("order_123|pay_456", "test_secret");
    await expect(
      verifyPaymentSignature(
        { orderId: "order_123", paymentId: "pay_456", signature },
        "test_secret"
      )
    ).resolves.toBe(true);
  });

  it("rejects forged and malformed payment signatures", async () => {
    await expect(
      verifyPaymentSignature(
        {
          orderId: "order_123",
          paymentId: "pay_456",
          signature: "00".repeat(32)
        },
        "test_secret"
      )
    ).resolves.toBe(false);
    await expect(
      verifyPaymentSignature(
        { orderId: "order_123", paymentId: "pay_456", signature: "not-hex" },
        "test_secret"
      )
    ).resolves.toBe(false);
  });

  it("verifies the exact raw webhook body", async () => {
    const raw = '{"event":"payment.captured","created_at":1787300000}';
    const signature = await sign(raw, "webhook_secret");
    await expect(
      verifyWebhookSignature(raw, signature, "webhook_secret")
    ).resolves.toBe(true);
    await expect(
      verifyWebhookSignature(`${raw}\n`, signature, "webhook_secret")
    ).resolves.toBe(false);
  });
});
