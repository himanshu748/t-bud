# T-Bud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy T-Bud, a Cloudflare-hosted merchant adapter that exposes a human-gated Manali trekking booking through A2A, WebMCP and Razorpay test mode.

**Architecture:** A React and Vite interface is served from the same Cloudflare Worker that owns A2A, booking-tool and payment routes. Shared domain services keep AI advisory while deterministic policy, D1, Durable Objects and approval digests remain authoritative.

**Tech Stack:** TypeScript, React, Vite, Hono, Zod, Cloudflare Workers, Workers AI, D1, Durable Objects, Razorpay Standard Checkout, Vitest, Cloudflare Vitest Pool Workers, Testing Library and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-21-t-bud-agentic-booking-design.md`

## Global Constraints

- Use the approved T-Bud name and Trail Instrument visual direction.
- Do not use ImageGen or generated raster imagery. Product evidence, terrain marks and protocol paths are code-native.
- Use Razorpay test mode only. Never commit or expose a Razorpay key secret.
- Represent every INR amount as integer paise in application code and persistence.
- AI may interpret intent and recommend add-ons, but may not set prices, reserve capacity, approve a quote or create an order.
- Read-only discovery is autonomous. A hold requires itinerary approval and checkout requires a separate payment approval.
- Any quote, departure, item, price or expiry change invalidates earlier approval.
- Use `document.modelContext` as the primary WebMCP draft surface and feature-detect the older `navigator.modelContext` shape only as a compatibility fallback.
- Support 360, 768, 1024 and 1440 pixel widths without horizontal overflow.
- Respect `prefers-reduced-motion`, keyboard navigation and visible focus.
- Do not invent customers, testimonials, logos, usage metrics or performance claims.
- Set Wrangler `compatibility_date` to `2026-08-21`.
- Verify Cloudflare authentication with `npx wrangler whoami` immediately before the first remote migration or deployment.

## File Structure

```text
package.json                         Scripts and dependency manifest
tsconfig.json                        Shared strict TypeScript configuration
vite.config.ts                       React build and jsdom unit-test configuration
vitest.config.worker.ts              Workers integration test configuration
playwright.config.ts                 Responsive end-to-end test configuration
wrangler.jsonc                       Worker, assets, AI, D1 and Durable Object bindings
migrations/0001_initial.sql          D1 schema and indexes
migrations/0002_seed_demo.sql        Deterministic Manali demonstration data
worker/index.ts                      Worker composition and route mounting
worker/env.ts                        Runtime binding types
worker/http/errors.ts                Typed HTTP errors and JSON responses
worker/http/security.ts              Session, CSP, origin and rate-limit guards
worker/domain/types.ts               Shared booking-domain contracts
worker/domain/money.ts               Integer-paise helpers
worker/domain/policy.ts              Budget and add-on policy
worker/domain/state-machine.ts       Booking state transition guards
worker/domain/approval.ts            Quote canonicalization and approval digests
worker/domain/tools.ts               Shared booking-tool service
worker/data/repository.ts            D1 repository contracts and implementation
worker/data/schema.ts                D1 row-to-domain mapping
worker/audit/service.ts              Append-only audit event writer
worker/ai/recommendation.ts          Workers AI adapter and deterministic fallback
worker/a2a/types.ts                  Narrow A2A v1.0 types used by T-Bud
worker/a2a/agent-card.ts              Public Agent Card construction
worker/a2a/routes.ts                 JSON-RPC message and task routes
worker/holds/DepartureHold.ts        Strongly consistent capacity and hold state
worker/razorpay/client.ts            Order creation client
worker/razorpay/signature.ts         Web Crypto payment verification
worker/razorpay/routes.ts            Payment order, callback and webhook routes
src/main.tsx                         React entry point
src/app/App.tsx                      Route composition
src/app/router.tsx                   Landing, demo and merchant routes
src/styles/tokens.css                Trail Instrument design tokens
src/styles/global.css                Reset, typography, focus and responsive rules
src/components/BrandMark.tsx         Code-native T-Bud mark
src/components/ProtocolLine.tsx      A2A and decision-path visual primitive
src/components/Status.tsx            Semantic connection and approval states
src/features/landing/LandingPage.tsx Product narrative and primary calls to action
src/features/landing/HandshakeHero.tsx Interactive first-viewport proof
src/features/landing/ValueSequence.tsx Transparent ₹16k → ₹20.8k → ₹19.6k story
src/features/demo/DemoPage.tsx        Agent Handshake product surface
src/features/demo/demoReducer.ts      Visible demonstration state and transitions
src/features/demo/BuyerPanel.tsx      Buyer request and constraints
src/features/demo/ProtocolRail.tsx    A2A messages and timing
src/features/demo/MerchantPanel.tsx   Quote and add-on evidence
src/features/demo/ApprovalDock.tsx    Human approval controls
src/features/demo/DecisionLedger.tsx  Auditable event timeline
src/features/merchant/MerchantPage.tsx Agent Card, tools, inventory and holds
src/lib/api.ts                        Typed browser API client
src/lib/format.ts                     INR and time formatting
src/webmcp/register.ts                Progressive WebMCP registration
src/webmcp/types.d.ts                 Draft browser API declarations
test/fixtures/catalog.ts              Shared deterministic Manali fixtures
test/worker/setup.ts                  Cloudflare test helpers
test/worker/security.test.ts          Security headers, session and rate-limit tests
test/ui/setup.ts                      Testing Library DOM assertions
test/domain/*.test.ts                 Money, policy, state and approval tests
test/data/repository.test.ts          D1 repository tests
test/ai/recommendation.test.ts        AI validation and fallback tests
test/a2a/*.test.ts                    Agent Card and task lifecycle tests
test/webmcp/register.test.ts          Registration and parity tests
test/holds/concurrency.test.ts        Last-seat race test
test/razorpay/*.test.ts               Order idempotency and signature tests
test/ui/*.test.tsx                    Landing and demo interaction tests
e2e/booking.spec.ts                   Successful gated booking path
e2e/failures.spec.ts                  Budget and capacity recovery paths
e2e/responsive.spec.ts                Required breakpoint assertions
README.md                             Setup, local use, secrets and demo script
```

---

### Task 1: Full-stack Worker and React foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.worker.ts`
- Create: `wrangler.jsonc`
- Create: `worker/env.ts`
- Create: `worker/index.ts`
- Create: `worker/http/errors.ts`
- Create: `worker/http/security.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `test/worker/setup.ts`
- Create: `test/worker/health.test.ts`
- Create: `test/worker/security.test.ts`
- Create: `test/ui/setup.ts`

**Interfaces:**
- Produces: `Env`, `app.fetch(request, env, ctx)` and `GET /api/health -> { ok: true, service: "t-bud" }`.
- Produces: browser routes `/`, `/demo` and `/merchant`.

- [ ] **Step 1: Create the package and strict TypeScript configuration**

Use these scripts and dependency groups in `package.json`:

```json
{
  "name": "t-bud",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:worker": "wrangler dev",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:worker": "vitest run --config vitest.config.worker.ts",
    "test:e2e": "playwright test",
    "check": "npm run test && npm run test:worker && npm run build",
    "deploy": "wrangler deploy"
  }
}
```

Install runtime dependencies with `npm install react react-dom react-router-dom hono zod` and development dependencies with `npm install -D typescript vite @types/node @types/react @types/react-dom @vitejs/plugin-react vitest @cloudflare/vitest-pool-workers wrangler @cloudflare/workers-types @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @playwright/test @axe-core/playwright`.

Configure `vite.config.ts` with `react()` and a jsdom Vitest environment that loads `test/ui/setup.ts`. Configure the current Cloudflare Workers Vitest plugin in `vitest.config.worker.ts`:

```ts
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: { setupFiles: ["./test/worker/setup.ts"] }
});
```

- [ ] **Step 2: Write the failing Worker health test**

```ts
import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../../worker";

it("reports the T-Bud service as healthy", async () => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request("https://t-bud.test/api/health"), env, ctx);
  await waitOnExecutionContext(ctx);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true, service: "t-bud" });
});
```

In `test/worker/security.test.ts`, assert every HTML response includes the declared CSP, `nosniff`, referrer and permissions headers. Assert that API JSON never includes `Razorpay-Signature`, model prompt text or environment-secret values from the test bindings.

- [ ] **Step 3: Run the Worker test and verify it fails**

Run: `npm run test:worker -- test/worker/health.test.ts test/worker/security.test.ts`  
Expected: FAIL because `worker/index.ts` does not export a handler or security middleware.

- [ ] **Step 4: Implement the minimal Worker and React route shell**

```ts
// worker/index.ts
import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();
app.get("/api/health", (c) => c.json({ ok: true, service: "t-bud" as const }));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

Configure `wrangler.jsonc` with `main: "worker/index.ts"`, `compatibility_date: "2026-08-21"` and static assets from `./dist` using SPA not-found handling.

Add `secureHeaders()` middleware that applies `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` and a Content Security Policy. The CSP must use `default-src 'self'`, permit Razorpay only through `script-src https://checkout.razorpay.com`, `frame-src https://*.razorpay.com`, `connect-src 'self' https://*.razorpay.com`, `img-src 'self' data: https://*.razorpay.com` and deny plugins with `object-src 'none'`.

- [ ] **Step 5: Run foundation checks**

Run: `npm run test:worker -- test/worker/health.test.ts test/worker/security.test.ts && npm run build`  
Expected: health and security-header tests PASS and Vite build completes.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.worker.ts wrangler.jsonc worker src test/worker
git commit -m "chore: scaffold T-Bud on Cloudflare Workers"
```

---

### Task 2: Money, booking contracts and bundle policy

**Files:**
- Create: `worker/domain/types.ts`
- Create: `worker/domain/money.ts`
- Create: `worker/domain/policy.ts`
- Create: `test/fixtures/catalog.ts`
- Create: `test/domain/money.test.ts`
- Create: `test/domain/policy.test.ts`

**Interfaces:**
- Produces: `Money`, `BookingRequest`, `Trek`, `Departure`, `Addon`, `Quote`, `QuoteItem` and `PolicyResult`.
- Produces: `evaluateBundle(request, trek, addons): PolicyResult` and `findSmallestEligibleRevision(request, trek, addons, alternatives): PolicyResult`.

- [ ] **Step 1: Define the failing policy examples**

```ts
const request = { partySize: 4, budget: 2_000_000, durationDays: 2, difficulty: "moderate" };

it("rejects the premium bundle above ₹20,000", () => {
  const result = evaluateBundle(request, trek, [pickup, premiumMeals]);
  expect(result).toMatchObject({ status: "budget_conflict", total: 2_080_000, overBy: 80_000 });
});

it("accepts pickup and budget meals at ₹19,600", () => {
  const result = evaluateBundle(request, trek, [pickup, budgetMeals]);
  expect(result).toMatchObject({ status: "eligible", total: 1_960_000 });
});

it("proposes the smallest eligible change without silently removing an add-on", () => {
  const result = findSmallestEligibleRevision(request, trek, [pickup, premiumMeals], [budgetMeals]);
  expect(result).toMatchObject({ status: "eligible", total: 1_960_000, requiresHumanApproval: true });
  expect(result.items.map((item) => item.id)).toContain("pickup_manali");
});
```

- [ ] **Step 2: Run the domain tests and verify they fail**

Run: `npm test -- test/domain/money.test.ts test/domain/policy.test.ts`  
Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Implement integer-paise helpers and pure policy logic**

```ts
export type Money = number & { readonly __brand: "Money" };
export const money = (paise: number): Money => {
  if (!Number.isSafeInteger(paise) || paise < 0) throw new TypeError("Money must be non-negative integer paise");
  return paise as Money;
};

export function evaluateBundle(
  request: BookingRequest,
  trek: Trek,
  addons: Addon[],
): PolicyResult {
  const items = toQuoteItems(request.partySize, trek, addons);
  const total = money(items.reduce((sum, item) => sum + item.amount, 0));
  return total > request.budget
    ? { status: "budget_conflict", items, total, overBy: money(total - request.budget) }
    : { status: "eligible", items, total };
}
```

The add-on fixture must encode pickup as ₹2,000 per booking, premium meals as ₹700 per person and budget meals as ₹400 per person. `findSmallestEligibleRevision` compares eligible substitutions by the smallest total reduction, preserves all unaffected requested add-ons and returns a proposal only. It never mutates the approved selection.

- [ ] **Step 4: Run domain tests**

Run: `npm test -- test/domain/money.test.ts test/domain/policy.test.ts`  
Expected: all policy and money tests PASS.

- [ ] **Step 5: Commit the domain core**

```bash
git add worker/domain test/fixtures test/domain
git commit -m "feat: add deterministic booking policy"
```

---

### Task 3: Booking state machine, approvals and audit contracts

**Files:**
- Create: `worker/domain/state-machine.ts`
- Create: `worker/domain/approval.ts`
- Create: `worker/audit/service.ts`
- Create: `test/domain/state-machine.test.ts`
- Create: `test/domain/approval.test.ts`

**Interfaces:**
- Produces: `BookingState`, `BookingEvent`, `transition(state, event)`.
- Produces: `quoteDigest(quote, actorSessionId): Promise<string>` and `approvalMatches(approval, quote, actorSessionId): Promise<boolean>`.
- Produces: `AuditSink.append(event): Promise<void>`.

- [ ] **Step 1: Write failing transition and invalidation tests**

```ts
it("requires itinerary approval before a hold", () => {
  expect(() => transition("quote_ready", { type: "HOLD_REQUESTED" })).toThrow("itinerary approval required");
});

it("invalidates approval when the quote version changes", async () => {
  const approval = { quoteId: quote.id, quoteVersion: 1, actorSessionId: "session_a", digest: await quoteDigest(quote, "session_a") };
  await expect(approvalMatches(approval, { ...quote, version: 2 }, "session_a")).resolves.toBe(false);
});

it("invalidates approval when the actor session changes", async () => {
  const approval = { quoteId: quote.id, quoteVersion: 1, actorSessionId: "session_a", digest: await quoteDigest(quote, "session_a") };
  await expect(approvalMatches(approval, quote, "session_b")).resolves.toBe(false);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- test/domain/state-machine.test.ts test/domain/approval.test.ts`  
Expected: FAIL because transition and digest functions are missing.

- [ ] **Step 3: Implement explicit state guards and canonical digests**

```ts
const allowed: Record<BookingState, BookingEvent["type"][]> = {
  received: ["SEARCH_STARTED", "CANCELLED"],
  searching: ["QUOTE_CREATED", "CANCELLED"],
  quote_ready: ["ITINERARY_APPROVED", "QUOTE_EXPIRED", "CANCELLED"],
  itinerary_approved: ["HOLD_REQUESTED", "QUOTE_CHANGED", "CANCELLED"],
  hold_pending: ["HOLD_CONFIRMED", "CAPACITY_CONFLICT", "CANCELLED"],
  held: ["PAYMENT_APPROVED", "HOLD_EXPIRED", "CANCELLED"],
  payment_approved: ["ORDER_CREATED", "HOLD_EXPIRED", "CANCELLED"],
  order_created: ["PAYMENT_VERIFIED", "PAYMENT_FAILED", "CANCELLED"],
  paid: [], cancelled: [], expired: [], hold_expired: ["QUOTE_CREATED", "CANCELLED"], budget_conflict: ["QUOTE_CREATED", "CANCELLED"],
  capacity_conflict: ["QUOTE_CREATED", "CANCELLED"], payment_failed: ["PAYMENT_APPROVED", "CANCELLED"]
};
```

Canonicalize only approved fields in a stable key order, including trek, departure, party size, add-ons, itemized prices, total, currency, version, expiry and actor session ID. Hash with `crypto.subtle.digest("SHA-256", bytes)` and encode as lowercase hex. Reject expired quotes and any session, departure, amount or version mismatch.

- [ ] **Step 4: Run domain tests**

Run: `npm test -- test/domain/state-machine.test.ts test/domain/approval.test.ts`  
Expected: PASS including stale quote, expired quote and changed departure cases.

- [ ] **Step 5: Commit control-plane logic**

```bash
git add worker/domain worker/audit test/domain
git commit -m "feat: enforce human approval gates"
```

---

### Task 4: D1 schema and booking repository

**Files:**
- Create: `migrations/0001_initial.sql`
- Create: `migrations/0002_seed_demo.sql`
- Create: `worker/data/schema.ts`
- Create: `worker/data/repository.ts`
- Create: `test/data/repository.test.ts`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Consumes: domain types and approval digest contracts.
- Produces: `BookingRepository` with `createTask`, `getTask`, `saveQuote`, `getQuote`, `saveApproval`, `saveHold`, `findOrderByQuote`, `saveOrder` and `appendAudit`.

- [ ] **Step 1: Write a failing repository round-trip test**

```ts
it("persists a quote with ordered items and audit evidence", async () => {
  const repository = new D1BookingRepository(env.DB);
  await repository.saveQuote(quote);
  await repository.appendAudit({ id: "evt_1", taskId: quote.taskId, action: "quote.created", payload: { total: quote.total } });
  await expect(repository.getQuote(quote.id)).resolves.toEqual(quote);
  await expect(repository.listAudit(quote.taskId)).resolves.toHaveLength(1);
});
```

- [ ] **Step 2: Create and apply the local schema**

Create normalized tables from the spec with foreign keys, ISO-8601 text timestamps and indexes on `departures(trek_id,start_at)`, `quotes(task_id,version)`, `holds(departure_id,status)` and `audit_events(task_id,created_at)`. Store the hashed actor session identifier on each approval. Add a `payment_events` table with a unique gateway event ID so webhook replay handling is transactional.

Run: `npx wrangler d1 migrations apply t-bud --local`  
Expected: both migrations apply without SQL errors.

- [ ] **Step 3: Run the repository test and verify it fails**

Run: `npm run test:worker -- test/data/repository.test.ts`  
Expected: FAIL because `D1BookingRepository` is missing.

- [ ] **Step 4: Implement prepared-statement repository methods**

```ts
export class D1BookingRepository implements BookingRepository {
  constructor(private readonly db: D1Database) {}

  async getQuote(id: string): Promise<Quote | null> {
    const row = await this.db.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first<QuoteRow>();
    if (!row) return null;
    const items = await this.db.prepare("SELECT * FROM quote_items WHERE quote_id = ? ORDER BY position").bind(id).all<QuoteItemRow>();
    return mapQuote(row, items.results);
  }
}
```

Use `db.batch()` when saving a quote and its items. Never interpolate SQL values.

- [ ] **Step 5: Run migration and repository tests**

Run: `npm run test:worker -- test/data/repository.test.ts`  
Expected: PASS with seeded trek and add-on records available.

- [ ] **Step 6: Commit persistence**

```bash
git add migrations wrangler.jsonc worker/data test/data
git commit -m "feat: persist booking state in D1"
```

---

### Task 5: Trail Instrument landing page

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/components/BrandMark.tsx`
- Create: `src/components/ProtocolLine.tsx`
- Create: `src/components/Status.tsx`
- Create: `src/features/landing/LandingPage.tsx`
- Create: `src/features/landing/HandshakeHero.tsx`
- Create: `src/features/landing/ValueSequence.tsx`
- Create: `test/ui/landing.test.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Produces: `/` landing page with `Run the live demo` and `Inspect the Agent Card` actions.
- Produces: shared visual primitives used by the product screens.

- [ ] **Step 1: Write failing landing-page behavior tests**

```tsx
it("leads with human-controlled agentic booking", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: /make every adventure bookable by an agent/i })).toBeVisible();
  expect(screen.getByRole("link", { name: "Run the live demo" })).toHaveAttribute("href", "/demo");
  expect(screen.getByRole("link", { name: "Inspect the Agent Card" })).toHaveAttribute("href", "/.well-known/agent-card.json");
});

it("shows the transparent value sequence without fake claims", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByText("₹16,000")).toBeVisible();
  expect(screen.getByText("₹20,800")).toBeVisible();
  expect(screen.getByText("₹19,600")).toBeVisible();
});
```

- [ ] **Step 2: Run the UI test and verify failure**

Run: `npm test -- test/ui/landing.test.tsx`  
Expected: FAIL because landing components do not exist.

- [ ] **Step 3: Implement the design tokens and page silhouette**

```css
:root {
  --canvas: #ffffff;
  --surface: #f4f6f8;
  --ink: #171a1d;
  --muted: #5c6670;
  --rule: #b9c0c6;
  --human: #ff5b35;
  --protocol: #365bd8;
  --success: #327a4a;
  --warning: #9a5b00;
  --error: #a33434;
  --focus: #1c55ff;
  --content: 1180px;
}
```

Build a quiet header, asymmetric first viewport, code-native handshake preview, protocol rail, value sequence, failure-recovery sequence, Cloudflare architecture band and closing CTA. Do not add a hero badge, customer strip, testimonial or decorative dashboard grid.

Set the document title to `T-Bud | Human-controlled agentic adventure booking` and write a truthful meta description around A2A, WebMCP, Cloudflare and Razorpay test mode. The first viewport must reveal the beginning of the evidence sequence at 1440×900 and the CTA pair must remain visible without covering the handshake preview at 360×800.

- [ ] **Step 4: Implement purposeful motion and reduced motion**

Animate only the protocol message travelling toward the approval gate using transform and opacity. Under `@media (prefers-reduced-motion: reduce)`, render every message in its final position and disable smooth scrolling.

- [ ] **Step 5: Run landing tests and build**

Run: `npm test -- test/ui/landing.test.tsx && npm run build`  
Expected: tests PASS and build has no TypeScript or CSS errors.

- [ ] **Step 6: Inspect the landing page at 360 and 1440 pixels**

Use the in-app browser. Capture the full page at both widths, compare it with the Trail Instrument thesis and record the three highest-impact repairs before committing. Confirm no horizontal overflow and that the next section is visible below the first viewport.

- [ ] **Step 7: Commit the landing page**

```bash
git add src/styles src/components src/features/landing src/app/router.tsx test/ui/landing.test.tsx
git commit -m "feat: build T-Bud Trail Instrument landing page"
```

---

### Task 6: Agent Handshake demo interface

**Files:**
- Create: `src/features/demo/demoReducer.ts`
- Create: `src/features/demo/DemoPage.tsx`
- Create: `src/features/demo/BuyerPanel.tsx`
- Create: `src/features/demo/ProtocolRail.tsx`
- Create: `src/features/demo/MerchantPanel.tsx`
- Create: `src/features/demo/ApprovalDock.tsx`
- Create: `src/features/demo/DecisionLedger.tsx`
- Create: `src/lib/api.ts`
- Create: `src/lib/format.ts`
- Create: `test/ui/demoReducer.test.ts`
- Create: `test/ui/demo.test.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: booking states, quotes and audit events.
- Produces: `DemoAction`, `demoReducer(state, action)` and the `/demo` interaction surface.

- [ ] **Step 1: Write failing reducer and approval-dock tests**

```ts
it("stops a budget conflict at human review", () => {
  const next = demoReducer(initialDemoState, { type: "PREMIUM_QUOTE_RECEIVED", total: 2_080_000 });
  expect(next.phase).toBe("budget_conflict");
  expect(next.pendingHumanAction).toBe("review_cheaper_bundle");
});
```

```tsx
it("does not expose hold controls before itinerary approval", () => {
  render(<DemoPage initialPhase="quote_ready" />);
  expect(screen.queryByRole("button", { name: /hold 4 seats/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /approve itinerary/i })).toBeEnabled();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- test/ui/demoReducer.test.ts test/ui/demo.test.tsx`  
Expected: FAIL because the demo modules are missing.

- [ ] **Step 3: Implement explicit visual phases**

```ts
export type DemoPhase =
  | "idle" | "discovering" | "searching" | "budget_conflict"
  | "quote_ready" | "itinerary_approved" | "capacity_conflict"
  | "held" | "payment_approved" | "checkout" | "paid" | "failed";
```

Each reducer action must append one decision-ledger entry. Approval buttons call the typed API client and never advance optimistically past a failed server response.

- [ ] **Step 4: Implement the responsive handshake composition**

Desktop uses buyer panel, narrow protocol rail and merchant panel with the approval dock spanning the decision boundary. Mobile renders the same information as an ordered sequence with a sticky approval dock and collapsible ledger.

- [ ] **Step 5: Run demo UI tests**

Run: `npm test -- test/ui/demoReducer.test.ts test/ui/demo.test.tsx`  
Expected: PASS for approval visibility, error state, keyboard activation and ledger ordering.

- [ ] **Step 6: Commit the interactive demo shell**

```bash
git add src/features/demo src/lib src/app/router.tsx test/ui
git commit -m "feat: add human-gated agent handshake demo"
```

---

### Task 7: Shared booking tools and Workers AI recommendations

**Files:**
- Create: `worker/domain/tools.ts`
- Create: `worker/ai/recommendation.ts`
- Create: `test/ai/recommendation.test.ts`
- Create: `test/worker/tools.test.ts`
- Modify: `worker/http/security.ts`
- Modify: `worker/env.ts`
- Modify: `worker/index.ts`
- Modify: `wrangler.jsonc`
- Modify: `test/worker/security.test.ts`

**Interfaces:**
- Consumes: `BookingRepository`, policy functions and audit sink.
- Produces: `BookingTools.searchTreks`, `getAvailability`, `quoteBundle`, `requestHold` and `createCheckout`.
- Produces: `structureIntent(text, model): Promise<StructuredIntentResult>` and `recommendAddons(input, model): Promise<RecommendationResult>`.
- Produces: session-bound same-origin authorization and route-specific rate limits for quote, hold and checkout operations.

- [ ] **Step 1: Write failing AI validation and fallback tests**

```ts
it("uses the deterministic fallback when model output is invalid", async () => {
  const model = { run: vi.fn().mockResolvedValue({ response: "not-json" }) };
  const result = await recommendAddons(recommendationInput, model);
  expect(result.source).toBe("rules_fallback");
  expect(result.addonIds).toEqual(["pickup_manali", "meals_budget"]);
});

it("never accepts model-authored prices", async () => {
  const model = fakeModel({ addonIds: ["pickup_manali"], price: 1 });
  const result = await recommendAddons(recommendationInput, model);
  expect(result).not.toHaveProperty("price");
});

it("structures the Manali request without granting action authority", async () => {
  const result = await structureIntent(
    "2-day Manali trek for four friends under ₹20,000 with pickup and upgraded meals",
    fakeModel(validStructuredIntent)
  );
  expect(result.intent).toMatchObject({ partySize: 4, budget: 2_000_000, durationDays: 2, durationNights: 1 });
  expect(result.intent).not.toHaveProperty("approved");
  expect(result.intent).not.toHaveProperty("price");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- test/ai/recommendation.test.ts test/worker/tools.test.ts`  
Expected: FAIL because recommendation and tool services are missing.

- [ ] **Step 3: Implement a schema-validated model adapter**

```ts
const RecommendationSchema = z.object({
  addonIds: z.array(z.string()).max(3),
  reasons: z.record(z.string(), z.string().max(180))
}).strict();

const BookingIntentSchema = z.object({
  location: z.string().max(80),
  partySize: z.number().int().min(1).max(12),
  budget: z.number().int().nonnegative(),
  durationDays: z.number().int().min(1).max(14),
  durationNights: z.number().int().min(0).max(13),
  difficulty: z.enum(["easy", "moderate", "hard"]),
  requestedAddonCategories: z.array(z.enum(["pickup", "meals"])).max(2)
}).strict();

export interface RecommendationModel {
  run(input: { system: string; user: string }): Promise<unknown>;
}
```

Use the `AI` binding with a configurable `AI_MODEL` var whose default is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Set temperature to `0` and cap the response. Parse and validate intent and recommendation output before matching IDs against D1 eligibility. On timeout, malformed output or unavailable AI, return a visible `rules_fallback` result and append a redacted fallback event without logging prompts or internal errors.

- [ ] **Step 4: Implement session, origin and rate-limit guards**

Issue a random opaque `tb_session` in an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie and persist only its SHA-256 identifier in approvals. For browser mutations, require a same-origin `Origin` header. For all consequential tools, require the approval token to resolve to the same session and task.

Configure three Cloudflare Rate Limiting bindings in `wrangler.jsonc`: `QUOTE_RATE_LIMITER` with namespace `775817871` at 20 calls per 60 seconds, `HOLD_RATE_LIMITER` with namespace `775817872` at 10 calls per 60 seconds and `CHECKOUT_RATE_LIMITER` with namespace `775817873` at 5 calls per 60 seconds. Key each call by hashed session ID plus route. Return HTTP 429 and append a redacted `security.rate_limited` audit event when denied.

- [ ] **Step 5: Implement shared tool handlers**

`quoteBundle` calls intent structuring and recommendation, loads authoritative prices, runs `evaluateBundle`, saves the quote and appends audit evidence. `requestHold` and `createCheckout` delegate to injected services and reject missing, expired or session-mismatched approvals before any external action. Validate every input with Zod, treat merchant text and model text as untrusted display data and redact prompts, secrets, signatures and contact fields from audit payloads. Do not collect or send traveller contact details until Gate 1 approval exists.

- [ ] **Step 6: Run tool, AI and security tests**

Run: `npm test -- test/ai/recommendation.test.ts test/worker/tools.test.ts && npm run test:worker -- test/worker/security.test.ts`  
Expected: PASS for valid output, malformed output, unknown add-on IDs, model failure, approval rejection, session mismatch, cross-origin mutation and each 429 threshold.

- [ ] **Step 7: Commit booking tools**

```bash
git add worker/domain/tools.ts worker/ai worker/http/security.ts worker/env.ts worker/index.ts wrangler.jsonc test/ai test/worker/tools.test.ts test/worker/security.test.ts
git commit -m "feat: add bounded AI booking recommendations"
```

---

### Task 8: A2A v1.0 discovery and task lifecycle

**Files:**
- Create: `worker/a2a/types.ts`
- Create: `worker/a2a/agent-card.ts`
- Create: `worker/a2a/routes.ts`
- Create: `test/a2a/agent-card.test.ts`
- Create: `test/a2a/tasks.test.ts`
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: shared booking tools and repository.
- Produces: `GET /.well-known/agent-card.json` and JSON-RPC endpoint `/a2a/v1`.
- Produces: A2A `message/send`, `tasks/get` and `tasks/cancel` methods.

- [ ] **Step 1: Write a failing Agent Card contract test**

```ts
it("publishes a v1 JSON-RPC booking skill", async () => {
  const response = await SELF.fetch("https://t-bud.test/.well-known/agent-card.json");
  const card = await response.json<AgentCard>();
  expect(card.name).toBe("T-Bud Merchant Booking Agent");
  expect(card.supportedInterfaces).toContainEqual({
    url: "https://t-bud.test/a2a/v1",
    protocolBinding: "JSONRPC",
    protocolVersion: "1.0"
  });
  expect(card.skills.map((skill) => skill.id)).toContain("book_manali_trek");
});
```

- [ ] **Step 2: Write failing task lifecycle tests**

Send `message/send` with structured party size, budget and preferences. Assert the response is a task with a stable `contextId`, a structured quote artifact and a concise human-readable summary, then use `tasks/get` and `tasks/cancel` to verify persisted state. Assert the Agent Card does not advertise streaming, push notifications or operations the Worker does not implement.

- [ ] **Step 3: Run A2A tests and verify failure**

Run: `npm run test:worker -- test/a2a`  
Expected: 404 responses before A2A routes exist.

- [ ] **Step 4: Implement narrow validated A2A handlers**

```ts
const RpcRequest = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.enum(["message/send", "tasks/get", "tasks/cancel"]),
  params: z.record(z.string(), z.unknown())
});
```

Return protocol-shaped errors for invalid params, missing tasks, unsupported methods and invalid state transitions. Map booking states to A2A task states without returning prompts, chain-of-thought or internal model errors. Agent Card URLs derive from the request origin and include cache headers with an ETag. Cancelling an active task releases its Durable Object hold before persisting `cancelled`.

- [ ] **Step 5: Run A2A tests**

Run: `npm run test:worker -- test/a2a`  
Expected: PASS for discovery, send, retrieve, cancel, invalid method and version mismatch.

- [ ] **Step 6: Commit A2A support**

```bash
git add worker/a2a worker/index.ts test/a2a
git commit -m "feat: expose T-Bud through A2A v1"
```

---

### Task 9: Progressive WebMCP bridge and tool parity

**Files:**
- Create: `src/webmcp/types.d.ts`
- Create: `src/webmcp/register.ts`
- Create: `test/webmcp/register.test.ts`
- Create: `test/webmcp/parity.test.ts`
- Modify: `src/main.tsx`
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: browser API client and shared Worker tool routes.
- Produces: `registerTBudTools(): Promise<{ registered: string[]; supported: boolean }>`.
- Produces: `/api/tools/search_treks`, `get_availability`, `quote_bundle`, `request_hold` and `create_checkout`.

- [ ] **Step 1: Write failing supported and unsupported-browser tests**

```ts
it("does nothing when WebMCP is unavailable", async () => {
  const result = await registerTBudTools({ documentObject: {} as Document, navigatorObject: {} as Navigator });
  expect(result).toEqual({ supported: false, registered: [] });
});

it("registers five tools on document.modelContext", async () => {
  const registerTool = vi.fn().mockResolvedValue(undefined);
  const result = await registerTBudTools({ documentObject: { modelContext: { registerTool } } as Document, navigatorObject: navigator });
  expect(result.registered).toEqual(["search_treks", "get_availability", "quote_bundle", "request_hold", "create_checkout"]);
});
```

- [ ] **Step 2: Run WebMCP tests and verify failure**

Run: `npm test -- test/webmcp`  
Expected: FAIL because registration is missing.

- [ ] **Step 3: Implement feature detection and precise tool definitions**

```ts
const context = documentObject.modelContext ?? navigatorObject.modelContext;
if (!context?.registerTool) return { supported: false, registered: [] };
```

Mark only search and availability with `readOnlyHint: true`. Describe `request_hold` as a temporary reservation requiring an approved quote and `create_checkout` as order preparation that still requires the user to open Razorpay Checkout.

- [ ] **Step 4: Implement route parity tests**

For one fixture input, call the A2A task flow and each HTTP tool route. Assert both return the same quote version, item IDs, authoritative amounts and policy status. Do not compare prose explanations byte-for-byte.

- [ ] **Step 5: Run WebMCP and A2A suites**

Run: `npm test -- test/webmcp && npm run test:worker -- test/a2a`  
Expected: PASS with no tool bundle error when the browser API is absent.

- [ ] **Step 6: Commit WebMCP support**

```bash
git add src/webmcp src/main.tsx worker/index.ts test/webmcp
git commit -m "feat: expose booking tools through WebMCP"
```

---

### Task 10: Strongly consistent capacity holds

**Files:**
- Create: `worker/holds/DepartureHold.ts`
- Create: `test/holds/concurrency.test.ts`
- Modify: `worker/domain/tools.ts`
- Modify: `worker/env.ts`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces: `DepartureHold.reserve(request): Promise<HoldResult>`, `release(holdId)` and `getAvailability()`.
- Produces: `findComparableDeparture(failedDeparture, request): Promise<Departure | null>` and a new quote version when recovery succeeds.
- Consumes: validated itinerary approval and departure capacity.

- [ ] **Step 1: Write the failing last-seat race test**

```ts
it("allows only one four-seat hold when four seats remain", async () => {
  const stub = env.DEPARTURE_HOLD.getByName("dep_hampta_2026_09_12");
  await stub.configure({ capacity: 4 });
  const [first, second] = await Promise.all([
    stub.reserve({ holdId: "hold_a", quoteId: "quote_a", seats: 4, expiresAt: future }),
    stub.reserve({ holdId: "hold_b", quoteId: "quote_b", seats: 4, expiresAt: future })
  ]);
  expect([first.status, second.status].sort()).toEqual(["capacity_conflict", "held"]);
});
```

- [ ] **Step 2: Run the hold test and verify failure**

Run: `npm run test:worker -- test/holds/concurrency.test.ts`  
Expected: FAIL because the Durable Object binding and class are absent.

- [ ] **Step 3: Implement transactional Durable Object storage**

```ts
export class DepartureHold extends DurableObject<Env> {
  async reserve(input: HoldRequest): Promise<HoldResult> {
    return this.ctx.storage.transaction(async (txn) => {
      const state = await readCapacity(txn);
      removeExpired(state, Date.now());
      if (availableSeats(state) < input.seats) return { status: "capacity_conflict", available: availableSeats(state) };
      state.holds[input.holdId] = input;
      await txn.put("capacity", state);
      return { status: "held", holdId: input.holdId, expiresAt: input.expiresAt };
    });
  }
}
```

Register the binding and a new-class migration in `wrangler.jsonc`. `requestHold` addresses objects by departure ID and mirrors successful holds to D1 after the Durable Object confirms them.

When the object returns `capacity_conflict`, query active departures for the same trek, party size, duration and difficulty, then choose the closest future departure with enough seats. Create a new quote version with that departure, invalidate the previous approval and return the proposal with `requiresHumanApproval: true`. Never move the booking automatically.

- [ ] **Step 4: Run concurrency and tool tests**

Run: `npm run test:worker -- test/holds/concurrency.test.ts test/worker/tools.test.ts`  
Expected: PASS for race, idempotent same-hold retry, release, expiry, deterministic comparable-departure selection and renewed-approval enforcement.

- [ ] **Step 5: Commit capacity coordination**

```bash
git add worker/holds worker/domain/tools.ts worker/env.ts wrangler.jsonc test/holds
git commit -m "feat: protect trek capacity with Durable Objects"
```

---

### Task 11: Razorpay test order and verified checkout

**Files:**
- Create: `worker/razorpay/client.ts`
- Create: `worker/razorpay/signature.ts`
- Create: `worker/razorpay/routes.ts`
- Create: `test/razorpay/client.test.ts`
- Create: `test/razorpay/signature.test.ts`
- Create: `src/features/demo/RazorpayCheckout.tsx`
- Create: `test/ui/checkout.test.tsx`
- Modify: `worker/domain/tools.ts`
- Modify: `worker/env.ts`
- Modify: `worker/index.ts`
- Modify: `src/features/demo/DemoPage.tsx`

**Interfaces:**
- Produces: `RazorpayGateway.createOrder(input): Promise<RazorpayOrder>`.
- Produces: `verifyPaymentSignature(input, secret): Promise<boolean>`.
- Produces: `verifyWebhookSignature(rawBody, signature, secret): Promise<boolean>`.
- Produces: `POST /api/payments/order`, `/verify` and `/webhook`.

- [ ] **Step 1: Write failing HMAC verification tests**

```ts
it("verifies a valid Razorpay payment signature", async () => {
  const signature = await signForTest("order_123|pay_456", "test_secret");
  await expect(verifyPaymentSignature({ orderId: "order_123", paymentId: "pay_456", signature }, "test_secret")).resolves.toBe(true);
});

it("rejects a forged signature", async () => {
  await expect(verifyPaymentSignature({ orderId: "order_123", paymentId: "pay_456", signature: "00".repeat(32) }, "test_secret")).resolves.toBe(false);
});
```

- [ ] **Step 2: Write failing idempotent-order test**

Call `createCheckout` twice for the same approved quote and assert the gateway receives one `POST /v1/orders` call and both responses contain the same order ID.

Write a webhook test that signs the exact raw request bytes with `RAZORPAY_WEBHOOK_SECRET`, rejects a modified body and proves replaying the same captured-payment event does not mark the booking twice.

- [ ] **Step 3: Run payment tests and verify failure**

Run: `npm test -- test/razorpay test/ui/checkout.test.tsx`  
Expected: FAIL because the gateway and checkout component do not exist.

- [ ] **Step 4: Implement the Razorpay client and Web Crypto verification**

```ts
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["verify"]
);
return crypto.subtle.verify(
  "HMAC",
  key,
  hexToBytes(signature),
  new TextEncoder().encode(`${serverOrderId}|${paymentId}`)
);
```

The order route loads the hold, quote, actor session and payment approval from D1, rechecks expiry, then sends amount, `INR`, receipt and non-sensitive notes. Read the order ID used for verification from D1. The webhook route verifies the `X-Razorpay-Signature` header against the untouched raw body before parsing JSON, stores a processed event identifier and applies each captured-payment transition once. A failed checkout or webhook signature leaves the booking unfulfilled and writes a redacted security event without logging the signature.

- [ ] **Step 5: Implement user-triggered Checkout loading**

Load `https://checkout.razorpay.com/v1/checkout.js` only after the user presses `Open Razorpay test checkout`. Pass the public test key ID and server-created order ID. When credentials are absent, use an injected deterministic gateway and display the exact label `Simulated payment gateway`.

- [ ] **Step 6: Run payment and UI tests**

Run: `npm test -- test/razorpay test/ui/checkout.test.tsx && npm run test:worker -- test/worker/tools.test.ts`  
Expected: PASS for valid callback and webhook signatures, forged or modified signatures, duplicate callback, replayed webhook, idempotent order and user-triggered modal.

- [ ] **Step 7: Commit payments**

```bash
git add worker/razorpay worker/domain/tools.ts worker/env.ts worker/index.ts src/features/demo test/razorpay test/ui/checkout.test.tsx
git commit -m "feat: add verified Razorpay test checkout"
```

---

### Task 12: Merchant console, end-to-end proof and Cloudflare deployment

**Files:**
- Create: `src/features/merchant/MerchantPage.tsx`
- Create: `test/ui/merchant.test.tsx`
- Create: `e2e/booking.spec.ts`
- Create: `e2e/failures.spec.ts`
- Create: `e2e/responsive.spec.ts`
- Create: `playwright.config.ts`
- Create: `README.md`
- Modify: `src/app/router.tsx`
- Modify: `package.json`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Consumes: Agent Card, WebMCP registration status, D1 inventory, holds and audit events.
- Produces: `/merchant`, complete browser flows and a deployed Cloudflare URL.

- [ ] **Step 1: Write the failing merchant-console test**

```tsx
it("shows the merchant's actual agent surfaces and inventory", async () => {
  render(<MerchantPage />);
  expect(await screen.findByText("book_manali_trek")).toBeVisible();
  expect(screen.getByText("search_treks")).toBeVisible();
  expect(screen.getByText("4 seats available")).toBeVisible();
});
```

- [ ] **Step 2: Implement the merchant console**

Render public Agent Card skills, WebMCP registration state, seeded departures, incoming A2A tasks, active holds and decision-ledger events. Use the same Trail Instrument tokens and provide links back to the landing page and live demo.

- [ ] **Step 3: Write the successful booking E2E test**

Configure Playwright to exercise the built Worker rather than Vite alone:

```ts
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run build && npm run dev:worker -- --port 8787",
    url: "http://127.0.0.1:8787/api/health",
    reuseExistingServer: !process.env.CI
  },
  use: {
    baseURL: "http://127.0.0.1:8787",
    trace: "retain-on-failure"
  }
});
```

```ts
test("human approves itinerary and payment separately", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start agent request" }).click();
  await expect(page.getByText("₹20,800")).toBeVisible();
  await page.getByRole("button", { name: "Review cheaper bundle" }).click();
  await page.getByRole("button", { name: "Approve itinerary at ₹19,600" }).click();
  await expect(page.getByText("4 seats held")).toBeVisible();
  await expect(page.getByRole("button", { name: /open .* checkout/i })).not.toBeVisible();
  await page.getByRole("button", { name: "Approve payment" }).click();
  await expect(page.getByRole("button", { name: /open .* checkout/i })).toBeVisible();
});
```

- [ ] **Step 4: Write budget, capacity and payment failure E2E tests**

Use a seeded test switch that triggers one atomic capacity conflict. Assert the revised departure invalidates approval and the hold button stays unavailable until the new itinerary is approved. Inject a forged payment callback, assert the booking stays unfulfilled and verify the interface shows a recoverable payment failure without releasing a still-valid hold.

- [ ] **Step 5: Write responsive and accessibility E2E checks**

For 360, 768, 1024 and 1440 widths, assert `document.documentElement.scrollWidth === document.documentElement.clientWidth`, the main heading is visible and approval controls meet a 44-pixel minimum target. Run `@axe-core/playwright` against `/`, `/demo` and `/merchant`, failing on serious or critical violations. Assert landmarks, labels, logical focus order, keyboard activation and the reduced-motion rendering directly in Playwright.

- [ ] **Step 6: Run the full local shipping gate**

Run: `npm run check && npm run test:e2e`  
Expected: unit, Worker, build and browser suites all PASS.

- [ ] **Step 7: Complete the rendered critique loop**

Use the in-app browser to capture full landing and primary demo screens at 360 and 1440 pixels. Inspect hierarchy, copy, palette, protocol lines, responsive recomposition, focus and both failure branches. Fix the three highest-impact issues, capture again and confirm no material mismatch with the Trail Instrument thesis.

- [ ] **Step 8: Document local and Cloudflare setup**

`README.md` must include:

```bash
npm install
npx wrangler d1 migrations apply t-bud --local
npm run dev:worker
```

It must explain `npx wrangler secret put RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, the `AI` binding, local simulated-payment labeling and the five-minute demo sequence.

- [ ] **Step 9: Verify Cloudflare auth and deploy**

Run: `npx wrangler whoami`  
Expected: authenticated account details.

Run: `npx wrangler d1 list --json`  
Expected: valid JSON. If a database named `t-bud` exists, bind `DB` to its returned ID. If it does not exist, run `npx wrangler d1 create t-bud --location apac --binding DB --update-config` and confirm Wrangler writes the new binding to `wrangler.jsonc`.

Run: `npx wrangler d1 migrations apply t-bud --remote`  
Expected: both migrations applied to the bound remote D1 database.

Run: `npm run deploy`  
Expected: Worker upload succeeds and returns an HTTPS `workers.dev` or configured custom-domain URL.

- [ ] **Step 10: Run deployed smoke tests**

Against the deployed URL, verify `/`, `/demo`, `/merchant`, `/.well-known/agent-card.json`, `/api/health`, A2A `message/send`, WebMCP feature detection and Razorpay test checkout. Confirm the deployed decision ledger records the verified payment.

- [ ] **Step 11: Commit the completed proof of concept**

```bash
git add src/features/merchant src/app/router.tsx test/ui/merchant.test.tsx e2e playwright.config.ts README.md package.json wrangler.jsonc
git commit -m "feat: complete and deploy T-Bud proof of concept"
```
