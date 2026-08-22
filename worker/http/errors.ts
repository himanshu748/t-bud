import type { Context } from "hono";

export function jsonError(
  context: Context,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503,
  code: string,
  message: string
) {
  return context.json({ error: { code, message } }, status);
}
