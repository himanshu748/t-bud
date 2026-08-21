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
