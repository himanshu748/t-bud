import { Hono } from "hono";
import type { Env } from "./env";
import { demoRoutes } from "./http/demo";
import {
  sameOriginMutations,
  secureHeaders,
  sessionMiddleware,
  type SecurityVariables
} from "./http/security";

const app = new Hono<{ Bindings: Env; Variables: SecurityVariables }>();

app.use("*", secureHeaders());
app.use("/api/*", sessionMiddleware());
app.use("/api/*", sameOriginMutations());

app.get("/api/health", (context) =>
  context.json({ ok: true, service: "t-bud" as const })
);
app.route("/api/demo", demoRoutes);

app.all("*", (context) => {
  if (context.env.ASSETS) {
    return context.env.ASSETS.fetch(context.req.raw);
  }

  return context.html("<!doctype html><title>T-Bud</title><main>T-Bud</main>");
});

export default app;
