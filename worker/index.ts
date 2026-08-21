import { Hono } from "hono";
import type { Env } from "./env";
import { secureHeaders } from "./http/security";

const app = new Hono<{ Bindings: Env }>();

app.use("*", secureHeaders());

app.get("/api/health", (context) =>
  context.json({ ok: true, service: "t-bud" as const })
);

app.all("*", (context) => {
  if (context.env.ASSETS) {
    return context.env.ASSETS.fetch(context.req.raw);
  }

  return context.html("<!doctype html><title>T-Bud</title><main>T-Bud</main>");
});

export default app;
