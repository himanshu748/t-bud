# T-Bud

T-Bud is a human-gated merchant booking agent for a Manali trekking operator. A buyer agent can discover the merchant through A2A v1.0, use the same booking capabilities through WebMCP and prepare a ₹19,600 bundle for four friends. It cannot hold seats or create checkout until the human approves each action separately.

## Demo scenario

- Four occasional hikers
- Manali, 2 days and 1 night
- Hard budget of ₹20,000
- Pickup and upgraded meals requested
- Premium ₹20,800 proposal stopped by deterministic budget policy
- Revised ₹19,600 proposal presented for approval
- Durable Object seat hold after itinerary approval
- Razorpay test checkout after a second payment approval

The landing page and demo use CSS-built interface graphics. No generated imagery is required.

## Architecture

- React and Vite interface served by a Cloudflare Worker
- Hono HTTP routes
- A2A v1.0 JSON-RPC endpoint and public Agent Card
- Progressive WebMCP registration through `document.modelContext`
- Workers AI for bounded intent and add-on recommendations, with deterministic fallback
- D1 for catalog, quotes, approvals, orders and audit records
- Durable Objects for atomic departure capacity
- Razorpay Orders, Standard Checkout signatures and signed webhook handling

AI output is advisory. Prices come from D1 and budget eligibility comes from deterministic integer-paise policy.

## Local setup

```bash
npm install
npm run build
npx wrangler d1 migrations apply t-bud --local
npm run dev:worker
```

Open the URL printed by Wrangler. Local development uses the exact label `Simulated payment gateway` when Razorpay credentials are absent. It does not collect real money.

Run the shipping checks:

```bash
npm run check
npm run test:e2e
```

## Cloudflare and Razorpay configuration

Create or locate the production D1 database, then replace the placeholder `database_id` in `wrangler.production.jsonc`:

```bash
npx wrangler whoami
npx wrangler d1 list --json
npx wrangler d1 create t-bud --location apac
npx wrangler d1 migrations apply t-bud --remote -c wrangler.production.jsonc
```

Set Razorpay test credentials without committing them:

```bash
npx wrangler secret put RAZORPAY_KEY_ID -c wrangler.production.jsonc
npx wrangler secret put RAZORPAY_KEY_SECRET -c wrangler.production.jsonc
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET -c wrangler.production.jsonc
```

`wrangler.production.jsonc` binds Workers AI as `AI`, D1 as `DB` and the `DepartureHold` Durable Object as `DEPARTURE_HOLD`. Deploy with:

```bash
npm run deploy
```

Configure Razorpay to send payment webhooks to `/api/payments/webhook`. T-Bud verifies the `X-Razorpay-Signature` against the untouched raw body and deduplicates `x-razorpay-event-id` values.

## Five-minute judge walkthrough

1. Open `/` and explain the bounded handshake: discover, quote, approve, hold, approve payment.
2. Open `/demo`, send the four-friend request and pause on the ₹20,800 budget conflict.
3. Review the ₹19,600 revision, approve the itinerary and hold four seats.
4. Approve payment separately, open the simulated or Razorpay test checkout and complete verification.
5. Reset, repeat to itinerary approval and choose `Simulate last-seat sellout` to show that approval is invalidated.
6. Open `/merchant` to inspect A2A, WebMCP, capacity and the append-only decision ledger.

## Public surfaces

- `/.well-known/agent-card.json`
- `/a2a/v1`
- `/api/tools/search_treks`
- `/api/tools/get_availability`
- `/api/tools/quote_bundle`
- `/api/tools/request_hold`
- `/api/tools/create_checkout`
- `/api/merchant/overview`

Implementation details follow the [A2A v1.0 specification](https://github.com/a2aproject/A2A/blob/main/docs/specification.md), the [WebMCP proposal](https://github.com/webmachinelearning/webmcp/blob/main/index.bs) and [Razorpay Standard Checkout guidance](https://razorpay.com/docs/developer-tools/integrations/standard-checkout/).
