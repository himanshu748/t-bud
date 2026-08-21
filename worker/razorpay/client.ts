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
