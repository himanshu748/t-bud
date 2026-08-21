export interface DemoApi {
  approveItinerary(quoteId: string): Promise<{ approvedAt: string }>;
  requestHold(quoteId: string): Promise<{ holdId: string; expiresAt: string }>;
  approvePayment(holdId: string): Promise<{ approvedAt: string }>;
  createCheckout(quoteId: string): Promise<{
    orderId: string;
    keyId: string;
    amount: number;
    currency: "INR";
    simulated: boolean;
  }>;
  verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<{ verified: boolean }>;
  simulatePayment(orderId: string): Promise<{ verified: boolean }>;
}

async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "T-Bud could not complete that action");
  }

  return payload as T;
}

export const demoApi: DemoApi = {
  approveItinerary: (quoteId) =>
    requestJson("/api/demo/approve-itinerary", { quoteId }),
  requestHold: (quoteId) => requestJson("/api/demo/holds", { quoteId }),
  approvePayment: (holdId) =>
    requestJson("/api/demo/approve-payment", { holdId }),
  createCheckout: (quoteId) =>
    requestJson("/api/payments/order", { quoteId }),
  verifyPayment: (input) =>
    requestJson("/api/payments/verify", {
      razorpay_order_id: input.orderId,
      razorpay_payment_id: input.paymentId,
      razorpay_signature: input.signature
    }),
  simulatePayment: (orderId) =>
    requestJson("/api/payments/simulate", { orderId })
};
