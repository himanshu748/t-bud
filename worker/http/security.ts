import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";

export interface SecurityVariables {
  sessionId: string;
}

type AppContext = { Bindings: Env; Variables: SecurityVariables };

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function hashSessionId(sessionId: string): Promise<string> {
  return toHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId))
  );
}

function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function sessionMiddleware(): MiddlewareHandler<AppContext> {
  return async (context, next) => {
    let session = getCookie(context, "tb_session");
    if (!session) {
      session = newSessionId();
      setCookie(context, "tb_session", session, {
        httpOnly: true,
        secure: new URL(context.req.url).protocol === "https:",
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });
    }
    context.set("sessionId", await hashSessionId(session));
    await next();
  };
}

export function sameOriginMutations(): MiddlewareHandler<AppContext> {
  return async (context, next) => {
    if (context.req.path === "/api/payments/webhook") {
      await next();
      return;
    }
    if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) {
      await next();
      return;
    }

    const origin = context.req.header("origin");
    const expected = new URL(context.req.url).origin;
    if (!origin || origin !== expected) {
      return context.json(
        {
          error: {
            code: "origin_not_allowed",
            message: "Browser mutations must come from the T-Bud origin"
          }
        },
        403
      );
    }
    await next();
  };
}

export async function enforceRateLimit(
  binding: Pick<RateLimit, "limit"> | undefined,
  sessionHash: string,
  route: string
): Promise<boolean> {
  if (!binding) return true;
  const result = await binding.limit({ key: `${sessionHash}:${route}` });
  return result.success;
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' https://checkout.razorpay.com",
  "style-src 'self'",
  "img-src 'self' data: https://*.razorpay.com",
  "connect-src 'self' https://*.razorpay.com",
  "frame-src https://*.razorpay.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.razorpay.com",
  "frame-ancestors 'none'"
].join("; ");

export function secureHeaders(): MiddlewareHandler<AppContext> {
  return async (context, next) => {
    await next();
    context.header("Content-Security-Policy", contentSecurityPolicy);
    context.header("X-Content-Type-Options", "nosniff");
    context.header("Referrer-Policy", "strict-origin-when-cross-origin");
    context.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
  };
}
