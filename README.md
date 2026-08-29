# T-Bud

T-Bud is a human-gated merchant booking agent for a Manali trekking operator. A buyer agent can discover the merchant through A2A v1.0, use the same booking capabilities through WebMCP and prepare a quote from the merchant catalog. It cannot hold seats, and it cannot create a Razorpay order, until a person approves each of those actions separately.

Three human gates, in order: approve the exact itinerary, place the ten-minute seat hold, authorize payment. The Razorpay order is created only at the third gate, and the Worker verifies the payment signature before any booking is marked paid.

## Live pilot

- Choose a group size from 1 to 12
- Set the hard budget ceiling
- Include or remove Manali pickup and upgraded meals
- Create a quote through the Worker-backed booking endpoint
- Stop over-budget requests before approval
- Approve the exact quote in the current browser session
- Place a ten-minute Durable Object seat hold through a second human action
- Authorize the Razorpay order through a third human action
- Verify the Razorpay signature server-side before marking the booking paid

The pilot uses the local or deployed T-Bud D1 catalog. It is not connected to an external tour operator inventory system.

## Architecture

- React and Vite interface served by a Cloudflare Worker
- Hono HTTP routes
- A2A v1.0 JSON-RPC endpoint and public Agent Card
- Progressive WebMCP registration through `document.modelContext`
- Workers AI for bounded intent and add-on recommendations, with deterministic fallback
- Razorpay Orders, Checkout and webhooks, with server-side HMAC signature verification
- D1 for catalog, quotes, approvals, holds, orders and audit records
- Durable Objects for atomic departure capacity

Without `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` the Worker falls back to a simulated gateway so the full loop still runs offline. With test keys set, `/api/payments/order` creates a real test-mode Razorpay order and the browser opens Razorpay Checkout.

Set test keys with:

```bash
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
```

`/api/payments/simulate` is refused whenever real keys are configured, so the simulated path can never stand in for a real payment.

AI output is advisory. Prices come from D1 and budget eligibility comes from deterministic integer-paise policy.

## Local setup

```bash
npm install
npm run build
npx wrangler d1 migrations apply t-bud --local
npm run dev:worker
```

Open the URL printed by Wrangler, then use `/book` for the live booking surface.

Run the shipping checks:

```bash
npm run check
npm run test:e2e
```

## Cloudflare configuration

Create or locate the production D1 database, then replace the placeholder `database_id` in `wrangler.production.jsonc`:

```bash
npx wrangler whoami
npx wrangler d1 list --json
npx wrangler d1 create t-bud --location apac
npx wrangler d1 migrations apply t-bud --remote -c wrangler.production.jsonc
```

`wrangler.production.jsonc` binds Workers AI as `AI`, D1 as `DB` and the `DepartureHold` Durable Object as `DEPARTURE_HOLD`. Deploy with:

```bash
npm run deploy
```

## Five-minute judge walkthrough

1. Open `/` and explain the bounded handshake: discover, quote, approve and hold.
2. Open `/book`, adjust group size, budget or add-ons and check live inventory.
3. Lower the budget below the quote to show the deterministic stop.
4. Restore the budget, approve the exact itinerary and place a temporary seat hold.
5. Authorize payment, complete Razorpay Checkout and show the verified signature in the D1 receipt.
6. Open `/merchant` to inspect A2A, WebMCP, capacity and the append-only decision ledger.

## Public surfaces

- `/.well-known/agent-card.json`
- `/a2a/v1`
- `/api/tools/search_treks`
- `/api/tools/get_availability`
- `/api/tools/quote_bundle`
- `/api/tools/request_hold`
- `/api/bookings/approve-itinerary`
- `/api/bookings/approve-payment`
- `/api/payments/order`
- `/api/payments/verify`
- `/api/payments/webhook`
- `/api/merchant/overview`

Implementation details follow the [A2A v1.0 specification](https://github.com/a2aproject/A2A/blob/main/docs/specification.md) and the [WebMCP proposal](https://github.com/webmachinelearning/webmcp/blob/main/index.bs).
