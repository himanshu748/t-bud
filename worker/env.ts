import type { WorkersAiBinding } from "./ai/recommendation";

export interface Env {
  ASSETS?: Fetcher;
  DB: D1Database;
  AI?: WorkersAiBinding;
  AI_MODEL?: string;
  QUOTE_RATE_LIMITER?: RateLimit;
  HOLD_RATE_LIMITER?: RateLimit;
  CHECKOUT_RATE_LIMITER?: RateLimit;
}
