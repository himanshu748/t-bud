import type { MiddlewareHandler } from "hono";

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

export function secureHeaders(): MiddlewareHandler {
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
