import type { WorkersAiBinding } from "./ai/recommendation";
import type { DepartureHold } from "./holds/DepartureHold";

export interface Env {
  ASSETS?: Fetcher;
  DB: D1Database;
  AI?: WorkersAiBinding;
  AI_MODEL?: string;
  DEPARTURE_HOLD: DurableObjectNamespace<DepartureHold>;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  QUOTE_RATE_LIMITER?: RateLimit;
  HOLD_RATE_LIMITER?: RateLimit;
  CHECKOUT_RATE_LIMITER?: RateLimit;
}
