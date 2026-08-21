import type {
  D1BookingRepository,
  OrderRecord
} from "../data/repository";
import type { CheckoutService } from "../domain/tools";
import type { Quote } from "../domain/types";
import type { Env } from "../env";
import {
  HttpRazorpayGateway,
  SimulatedRazorpayGateway,
  type RazorpayGateway
} from "./client";

export interface CheckoutOrder {
  orderId: string;
  amount: number;
  currency: "INR";
  simulated: boolean;
}

export function gatewayForEnv(env: Env): RazorpayGateway {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return new HttpRazorpayGateway({
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET
    });
  }
  return new SimulatedRazorpayGateway();
}

function toCheckout(order: OrderRecord): CheckoutOrder {
  return {
    orderId: order.razorpayOrderId,
    amount: order.amount,
    currency: "INR",
    simulated: order.razorpayOrderId.startsWith("order_sim_")
  };
}

export class RazorpayCheckoutService implements CheckoutService {
  constructor(
    private readonly repository: D1BookingRepository,
    private readonly gateway: RazorpayGateway,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(input: {
    quote: Quote;
    sessionId: string;
  }): Promise<CheckoutOrder> {
    const hold = await this.repository.getActiveHoldByQuote(input.quote.id);
    if (!hold || hold.status !== "held" || Date.parse(hold.expiresAt) <= this.now().getTime()) {
      throw new Error("an active seat hold is required");
    }

    const existing = await this.repository.getOrderByQuote(input.quote.id);
    if (existing) return toCheckout(existing);

    const receipt = `tb_${input.quote.id}`.slice(0, 40);
    const gatewayOrder = await this.gateway.createOrder({
      amount: input.quote.total,
      currency: input.quote.currency,
      receipt,
      notes: {
        quote_id: input.quote.id,
        task_id: input.quote.taskId
      }
    });
    if (
      gatewayOrder.amount !== input.quote.total ||
      gatewayOrder.currency !== input.quote.currency
    ) {
      throw new Error("gateway order did not match the approved quote");
    }
    const createdAt = this.now().toISOString();
    const order: OrderRecord = {
      id: crypto.randomUUID(),
      quoteId: input.quote.id,
      razorpayOrderId: gatewayOrder.id,
      amount: gatewayOrder.amount,
      paymentId: null,
      verificationStatus: "created",
      createdAt,
      updatedAt: createdAt
    };
    await this.repository.saveOrder(order);
    await this.repository.appendAudit({
      id: crypto.randomUUID(),
      taskId: input.quote.taskId,
      actor: "merchant_agent",
      action: "checkout.order_created",
      target: order.id,
      payload: {
        amount: order.amount,
        currency: input.quote.currency,
        simulated: gatewayOrder.id.startsWith("order_sim_")
      },
      result: "accepted",
      createdAt
    });
    return toCheckout(order);
  }
}
