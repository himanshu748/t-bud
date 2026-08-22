import { Hono } from "hono";
import { a2aRoutes, agentCardResponse } from "./a2a/routes";
import type { Env } from "./env";
import { bookingRoutes } from "./http/bookings";
import { jsonError } from "./http/errors";
import { toolRoutes } from "./http/tools";
import { merchantRoutes } from "./http/merchant";
import {
  sameOriginMutations,
  secureHeaders,
  sessionMiddleware,
  type SecurityVariables
} from "./http/security";

export { DepartureHold } from "./holds/DepartureHold";

const app = new Hono<{ Bindings: Env; Variables: SecurityVariables }>();

app.use("*", secureHeaders());
app.use("/api/*", sessionMiddleware());
app.use("/api/*", sameOriginMutations());

app.get("/api/health", (context) =>
  context.json({
    ok: true,
    service: "t-bud" as const,
    mode: "live_pilot" as const,
    paymentsEnabled: false
  })
);
app.route("/api/bookings", bookingRoutes);
app.route("/api/tools", toolRoutes);
app.route("/api/merchant", merchantRoutes);
app.all("/api/payments/*", (context) =>
  jsonError(
    context,
    503,
    "payments_disabled",
    "Payment collection is not enabled for this pilot"
  )
);
app.get("/.well-known/agent-card.json", agentCardResponse);
app.route("/a2a/v1", a2aRoutes);

app.all("*", (context) => {
  if (context.env.ASSETS) {
    return context.env.ASSETS.fetch(context.req.raw);
  }

  return context.html("<!doctype html><title>T-Bud</title><main>T-Bud</main>");
});

export default app;
