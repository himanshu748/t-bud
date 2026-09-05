import { describe, expect, it, vi } from "vitest";
import { HttpRazorpayGateway } from "../../worker/razorpay/client";

it("creates a Razorpay order with integer paise and non-sensitive notes", async () => {
  const fetcher = vi.fn(async () =>
    new Response(
      JSON.stringify({
        id: "order_123",
        amount: 1_960_000,
        currency: "INR",
        receipt: "tb_quote_demo_v2",
        status: "created"
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );
  const gateway = new HttpRazorpayGateway({
    keyId: "rzp_test_public",
    keySecret: "private_secret",
    fetcher
  });

  await expect(
    gateway.createOrder({
      amount: 1_960_000,
      currency: "INR",
      receipt: "tb_quote_demo_v2",
      notes: { quote_id: "quote_demo_v2", task_id: "task_demo" }
    })
  ).resolves.toMatchObject({ id: "order_123", amount: 1_960_000 });
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.razorpay.com/v1/orders",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        authorization: `Basic ${btoa("rzp_test_public:private_secret")}`
      }),
      body: JSON.stringify({
        amount: 1_960_000,
        currency: "INR",
        receipt: "tb_quote_demo_v2",
        notes: { quote_id: "quote_demo_v2", task_id: "task_demo" }
      })
    })
  );
});

const capturedPayment = { id: "pay_valid", order_id: "order_valid", amount: 1960000, currency: "INR", status: "captured" };
const captureInput = { paymentId: "pay_valid", orderId: "order_valid", amount: 1960000 };
it("verifies captured payment amount and order before fulfillment", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(capturedPayment)));
  await expect(new HttpRazorpayGateway({keyId:"rzp_test_test",keySecret:"test",fetcher}).ensureCaptured(captureInput)).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([{amount:1},{order_id:"order_wrong"},{currency:"USD"},{status:"failed"}])("refuses a mismatched or failed payment %j", async (change) => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({...capturedPayment,...change})));
  await expect(new HttpRazorpayGateway({keyId:"rzp_test_test",keySecret:"test",fetcher}).ensureCaptured(captureInput)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("captures authorized payments using the stored order amount and rechecks status", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({...capturedPayment,status:"authorized"})))
    .mockResolvedValueOnce(new Response("{}"))
    .mockResolvedValueOnce(new Response(JSON.stringify(capturedPayment)));
  await new HttpRazorpayGateway({keyId:"rzp_test_test",keySecret:"test",fetcher}).ensureCaptured(captureInput);
  expect(fetcher.mock.calls[1]).toEqual(["https://api.razorpay.com/v1/payments/pay_valid/capture",expect.objectContaining({method:"POST",body:JSON.stringify({amount:1960000,currency:"INR"})})]);
});
