import { z } from "zod";

export interface RazorpayOrderInput {
  amount: number;
  currency: "INR";
  receipt: string;
  notes: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: "INR";
  receipt: string;
  status: "created" | "attempted" | "paid";
}

export interface RazorpayGateway {
  createOrder(input: RazorpayOrderInput): Promise<RazorpayOrder>;
}

const OrderResponse = z.object({
  id: z.string().min(1),
  amount: z.number().int().nonnegative(),
  currency: z.literal("INR"),
  receipt: z.string(),
  status: z.enum(["created", "attempted", "paid"])
});

export class HttpRazorpayGateway implements RazorpayGateway {
  private readonly fetcher: typeof fetch;

  constructor(
    private readonly dependencies: {
      keyId: string;
      keySecret: string;
      fetcher?: typeof fetch;
    }
  ) {
    this.fetcher = dependencies.fetcher ?? fetch.bind(globalThis);
  }

  async ensureCaptured(input: { paymentId: string; orderId: string; amount: number }): Promise<void> {
    const url = `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}`;
    const headers = {
      authorization: `Basic ${btoa(`${this.dependencies.keyId}:${this.dependencies.keySecret}`)}`,
      "content-type": "application/json"
    };
    const schema = z.object({id:z.string(), order_id:z.string(), amount:z.number(), currency:z.literal("INR"), status:z.string()});
    const read = async () => {
      const response = await this.fetcher(url, {headers});
      if (!response.ok) throw new Error("Payment status could not be checked. Retry verification.");
      const payment = schema.parse(await response.json());
      if (payment.id !== input.paymentId || payment.order_id !== input.orderId || payment.amount !== input.amount) {
        throw new Error("Payment does not match the approved order");
      }
      return payment;
    };
    let payment = await read();
    if (payment.status === "authorized") {
      // Amount comes from our approved order, never the browser or gateway body.
      await this.fetcher(`${url}/capture`, {method:"POST", headers, body:JSON.stringify({amount:input.amount,currency:"INR"})});
      // A competing callback or auto-capture may have won. Re-read authoritative state.
      payment = await read();
    }
    if (payment.status !== "captured") throw new Error("Payment is not captured yet. Retry verification; do not pay again.");
  }

  async createOrder(input: RazorpayOrderInput): Promise<RazorpayOrder> {
    const response = await this.fetcher("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(
          `${this.dependencies.keyId}:${this.dependencies.keySecret}`
        )}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error("Razorpay order creation failed");
    const parsed = OrderResponse.safeParse(payload);
    if (!parsed.success) throw new Error("Razorpay returned an invalid order");
    return parsed.data;
  }
}

export class SimulatedRazorpayGateway implements RazorpayGateway {
  async createOrder(input: RazorpayOrderInput): Promise<RazorpayOrder> {
    return {
      id: `order_sim_${input.receipt.replace(/[^a-z0-9]/gi, "").slice(-18)}`,
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      status: "created"
    };
  }
}
