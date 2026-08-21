import { Hono } from "hono";
import { a2aRoutes, agentCardResponse } from "./a2a/routes";
import type { Env } from "./env";
import { demoRoutes } from "./http/demo";
import { toolRoutes } from "./http/tools";
import { paymentRoutes } from "./razorpay/routes";
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
  context.json({ ok: true, service: "t-bud" as const })
);
app.route("/api/demo", demoRoutes);
app.route("/api/tools", toolRoutes);
app.route("/api/payments", paymentRoutes);
app.get("/.well-known/agent-card.json", agentCardResponse);
app.route("/a2a/v1", a2aRoutes);

app.all("*", (context) => {
  if (context.env.ASSETS) {
    return context.env.ASSETS.fetch(context.req.raw);
  }

  return context.html("<!doctype html><title>T-Bud</title><main>T-Bud</main>");
});

export default app;
