# T-Bud Agentic Booking Adapter Design

Date: 2026-08-21  
Status: Approved in chat, awaiting written-spec review

## Summary

T-Bud is a merchant-side adapter that makes an existing adventure-booking business discoverable and transactable by AI buyer agents. It exposes the same booking capabilities through an A2A v1.0 agent interface and browser-native WebMCP tools, backed by one Cloudflare-hosted policy and booking engine.

The project targets Razorpay AI Buildathon Track 1, AI Growth and Agentic Commerce. Its central proof is that an AI buyer can discover a merchant, request a suitable experience, receive context-aware add-ons, obtain human approval, hold inventory and complete a Razorpay test payment without giving the agent unchecked authority.

## Problem

Adventure merchants publish useful services for humans but not reliable, structured capabilities for AI buyers. An agent may scrape a page, but it cannot safely determine live capacity, build an explainable bundle or complete a booking while respecting merchant rules and traveller consent.

T-Bud turns the merchant's existing booking domain into an agent-ready surface. The merchant gains higher booking value through relevant add-ons while the traveller retains control over itinerary changes, personal-data sharing, inventory holds and payment.

## Goals

- Publish a standards-aligned A2A Agent Card and booking skill.
- Expose matching WebMCP tools on the merchant website.
- Recommend relevant add-ons based on traveller intent.
- Keep price calculation, capacity and approval enforcement deterministic.
- Require human approval for every consequential commitment.
- Create and verify a Razorpay test-mode payment end to end.
- Show a complete audit trail and two graceful failure recoveries.
- Deploy the full-stack application on Cloudflare.

## Non-goals

- Building a multi-merchant marketplace.
- Supporting live Razorpay payments or real customer fulfilment.
- Automating payment without an explicit human action.
- Implementing every A2A operation or every booking vertical.
- Negotiating arbitrary prices.
- Storing government IDs, health details or other sensitive trek documents.
- Claiming real conversion uplift from a synthetic demo.

## Demonstration Scenario

The buyer-agent request is:

> Find a 2-day/1-night Manali trek for four friends who are occasional hikers. Keep the complete booking under ₹20,000 and include Manali pickup and upgraded meals if possible.

Seeded commercial data:

- Base trek for four: ₹16,000
- Group pickup: ₹2,000
- Premium meal upgrade: ₹2,800
- Budget-compliant meal upgrade: ₹1,600
- Approved final bundle: ₹19,600

The first premium bundle totals ₹20,800. T-Bud explains the conflict and proposes the ₹1,600 meal option, reaching ₹19,600 only after human approval. A separate failure branch makes the last four seats unavailable during the hold attempt. T-Bud proposes a comparable departure and requires renewed approval because the departure changed.

## Product Flow

1. The buyer agent discovers T-Bud through its public A2A Agent Card.
2. The buyer sends the trek request as an A2A task.
3. T-Bud searches live merchant inventory and returns matching departures.
4. Workers AI interprets preferences and proposes pickup and meal add-ons with reasons.
5. The policy engine calculates the authoritative total and detects the ₹20,800 budget conflict.
6. T-Bud proposes the ₹19,600 alternative bundle.
7. The travellers approve the exact versioned itinerary.
8. T-Bud requests a temporary capacity hold from the departure's Durable Object.
9. If capacity is gone, T-Bud returns a comparable alternative and invalidates the old approval.
10. Once a hold succeeds, the travellers separately approve creation of the payment order.
11. The Worker creates a Razorpay test order and the browser opens Razorpay Checkout on a user action.
12. The Worker verifies the returned signature against the server-stored order ID before marking the booking paid.
13. Every recommendation, tool call, state transition, policy check and approval appears in the decision ledger.

## Human Control Model

Read-only discovery and comparison can run automatically. Consequential actions use two explicit gates:

### Gate 1: itinerary approval

The traveller approves a cryptographic digest of:

- Trek and departure
- Party size
- Add-ons
- Itemized price
- Total and currency
- Quote version and expiry

This approval authorizes sharing the minimum booking details and requesting one temporary inventory hold. Any change to the approved fields creates a new quote version and invalidates the approval.

### Gate 2: payment approval

After a hold exists, the traveller separately approves Razorpay order creation and opens checkout through a visible button. T-Bud never opens checkout automatically.

## Architecture

```text
Buyer agent
    │ A2A v1.0 task
    ▼
Cloudflare Worker: T-Bud merchant agent
    ├── A2A interface and Agent Card
    ├── Booking tool handlers
    ├── Workers AI recommendation service
    ├── Deterministic policy engine
    ├── D1 persistence and audit ledger
    ├── Departure Hold Durable Objects
    ├── Razorpay test-mode gateway
    └── Static React application
            ▲
            │ same booking tool handlers
Merchant website WebMCP bridge
```

### React application

React and Vite provide the buyer-agent demonstration, merchant console, approval controls and decision ledger. The production bundle is served through Cloudflare Workers Static Assets so the UI and APIs share an origin.

### Cloudflare Worker

The Worker is the only public application backend. It routes A2A, WebMCP-backed HTTP requests, quote operations, holds, approvals, checkout and payment verification. Hono may be used for routing and validation, but domain logic remains framework-independent.

### Workers AI

Workers AI performs two bounded tasks:

- Convert the buyer's natural-language request into structured preferences.
- Rank eligible add-ons and generate concise explanations.

The model cannot set prices, alter capacity, issue approval tokens, create holds or create Razorpay orders. Its output is schema-validated. If inference fails or returns invalid data, a deterministic suitability scorer produces a safe recommendation and the ledger records the fallback.

### D1

D1 stores merchant data, A2A task state, quotes, approvals, payment references and append-only audit events. All queries use prepared statements.

### Durable Objects

One `DepartureHold` Durable Object is addressed per departure. It serializes capacity checks and temporary holds, preventing two agents from acquiring the same last seats. D1 stores a queryable mirror, while the Durable Object remains authoritative for available and held capacity.

### Razorpay gateway

The Worker calls the Razorpay Orders API with test credentials stored as Worker secrets. Order amounts use paise. Receipts use an idempotent T-Bud quote reference and notes contain no sensitive personal data.

The payment callback sends the payment ID, order ID and signature to the Worker. Verification uses HMAC-SHA256 and the order ID loaded from D1, not a client-trusted value. A verified signature updates the booking once. A webhook endpoint can reconcile captured status without relying solely on the browser callback.

## Protocol Surfaces

### A2A

T-Bud publishes `/.well-known/agent-card.json` with an A2A v1.0 JSON-RPC interface and one booking skill. The proof of concept implements the smallest complete task lifecycle needed for the demo: send message, retrieve task state and cancel an active task. The Agent Card declares only implemented capabilities.

The A2A task artifact contains structured quote data and a human-readable summary. Task states map to the booking state machine rather than exposing internal model reasoning.

### WebMCP

The merchant page feature-detects the current draft `document.modelContext` API before loading its WebMCP bundle. A compatibility adapter may also detect the older `navigator.modelContext` shape without making it the primary contract.

Registered WebMCP tools are thin calls to the same Worker handlers used by A2A. The page does not duplicate pricing or capacity logic.

### Shared tools

| Tool | Effect | Approval requirement |
| --- | --- | --- |
| `search_treks` | Read matching experiences | None |
| `get_availability` | Read current departure capacity | None |
| `quote_bundle` | Create a versioned, expiring quote | None |
| `request_hold` | Reserve seats temporarily | Valid itinerary approval |
| `create_checkout` | Create a Razorpay order | Valid hold and payment approval |

Read-only WebMCP tools declare `readOnlyHint`. Consequential tools use precise descriptions and must not imply that quote preparation creates a booking or charge.

## Booking State Machine

```text
received
  → searching
  → quote_ready
  → itinerary_approved
  → hold_pending
  → held
  → payment_approved
  → order_created
  → paid
```

Alternate terminal or recovery states:

- `budget_conflict` returns a cheaper bundle proposal.
- `capacity_conflict` returns a comparable departure proposal.
- `hold_expired` returns to `quote_ready` after availability refresh.
- `payment_failed` keeps the booking unfulfilled and allows an idempotent retry while the hold remains valid.
- `cancelled` releases any active hold.
- `expired` prevents reuse of quote and approval tokens.

## Data Model

### Merchant inventory

- `treks`: product identity, duration, difficulty, location, description and active status
- `departures`: trek, start time, total capacity and public status
- `addons`: scope, eligibility rules, unit price and active status

### Agent and commerce state

- `a2a_tasks`: protocol task ID, context ID, booking state and timestamps
- `quotes`: task ID, version, party size, budget, currency, total, expiry and status
- `quote_items`: base trek or add-on, quantity, unit amount, reason and source
- `approvals`: quote version, gate type, approved digest and timestamp
- `holds`: departure, quote, party size, hold token, expiry and status
- `orders`: quote, Razorpay order ID, amount, payment ID and verification status
- `audit_events`: actor, action, target, redacted payload, result and timestamp

The audit ledger never stores Worker secrets, Razorpay signatures in logs or unrestricted model prompts containing personal data.

## Interface Design

### Design thesis

Product truth: Two independent agents can coordinate a valuable booking without removing human authority.  
Audience: Hackathon judges, AI builders and adventure merchants.  
Desired feeling: Capable, transparent and ready for real commerce.  
Primary action: Review and approve the agent-proposed itinerary.  
Visual concept: A trail instrument where protocol events and human decisions share one route.  
Primary archetype: Technical instrument.  
Secondary influence: Editorial field guide.  
Page silhouette: Buyer and merchant agent split-screen joined by a central A2A exchange, with a persistent approval dock.  
Type strategy: Compact grotesk headings, legible sans-serif body and monospace protocol labels.  
Material and color language: True-white canvas, near-black text, alpine orange for human action, protocol blue for agent exchange and graphite rules.  
Media strategy: Code-native terrain marks and itinerary details, with no generated imagery.  
Signature moment: A live handshake line connects buyer intent to merchant evidence, then stops at the human approval control.  
Cliches to avoid: Chatbot-only layout, floating gradient dashboard cards and a generic travel marketplace grid.

### Primary screen

- Header: T-Bud mark, A2A connection state and `Human control: on`.
- Left panel: Buyer request, party context, budget and preferences.
- Centre rail: A2A messages, task state and protocol timing.
- Right panel: Merchant quote, add-ons, reasoning and price breakdown.
- Approval dock: Budget, capacity, consent and one unambiguous next action.
- Decision ledger: Expandable chronological evidence for every state transition.

### Secondary merchant console

The console shows the public Agent Card, registered WebMCP tools, inventory status, active holds and incoming tasks. It demonstrates that T-Bud is a merchant adapter, not only a traveller-facing prototype.

### Required visible states

1. Discovering merchant agent
2. Searching and comparing treks
3. Premium add-ons exceed budget
4. Cheaper bundle proposed
5. Human itinerary approval
6. Capacity conflict during hold
7. Alternative departure approval
8. Hold confirmed
9. Human payment approval
10. Razorpay test checkout and verified success or visible failure

The responsive application must work from 360px through 1440px. Mobile changes the split-screen into a sequenced handshake: buyer request, A2A exchange, merchant response and sticky approval dock. It does not simply stack every desktop panel at full density.

## Failure Handling

### Budget conflict

The policy engine returns the exact overage and the smallest eligible change that respects the request. It never removes an add-on automatically. The human approves the revised quote.

### Capacity conflict

The hold Durable Object rejects a stale capacity request atomically. T-Bud refreshes availability, proposes one comparable departure and requires a new itinerary approval.

### AI failure

Schema-invalid, timed-out or unavailable inference falls back to deterministic scoring. The UI identifies that recommendations used the rules fallback without exposing internal errors.

### Razorpay failure

Order creation is idempotent. A gateway error does not release a still-valid hold immediately, and retrying cannot create duplicate internal orders. Failed signature verification leaves the booking unfulfilled and records a security event.

### WebMCP unavailable

The normal interface remains functional. The optional WebMCP bundle is not loaded when the API is absent.

## Security and Privacy

- Use Razorpay test keys only for the buildathon demo.
- Store secrets through Wrangler secrets, never source control or client code.
- Validate all tool inputs and normalize currency amounts as integers.
- Bind approvals to quote version, expiry, actor session and payload digest.
- Keep WebMCP authorization identical to the manual web flow.
- Apply server-side authorization to every consequential tool.
- Rate-limit quote, hold and checkout endpoints.
- Treat model output and merchant-authored text as untrusted data.
- Escape all rendered text and use a restrictive Content Security Policy compatible with Razorpay Checkout.
- Share traveller contact details only after itinerary approval and only when needed for the booking.

## Verification Strategy

### Unit tests

- Budget calculations and integer currency handling
- Add-on eligibility and deterministic fallback ranking
- Approval digest creation and invalidation
- Booking state transition guards
- Razorpay HMAC verification through Web Crypto without manual string equality

### Integration tests

- A2A Agent Card and task lifecycle
- Parity between A2A and WebMCP-backed tool results
- D1 persistence and append-only audit events
- Durable Object concurrency for the last four seats
- Idempotent Razorpay order creation

### Browser tests

- Full successful booking path
- Budget-conflict recovery
- Capacity-conflict recovery
- Keyboard access, focus states and reduced motion
- Responsive layouts at 360, 768, 1024 and 1440 pixels
- WebMCP feature detection with supported and unsupported environments

## Buildathon Success Criteria

The proof of concept is complete when:

- Another agent can discover the public Agent Card and create a booking task.
- The merchant page registers matching WebMCP tools when supported.
- The same request produces the same validated quote through both surfaces.
- Workers AI produces explainable add-on recommendations or a visible deterministic fallback.
- No hold or checkout can occur without the appropriate human approval.
- Two concurrent attempts cannot claim the same last seats.
- The Razorpay test order opens only after a user action and verifies server-side.
- The budget and sellout failures recover without silent substitutions.
- The decision ledger proves every money-related action was explainable, bounded and gated.

## Demo Sequence

1. Show the merchant console, Agent Card and WebMCP tools.
2. Submit the four-friend Manali request from the buyer-agent panel.
3. Show A2A discovery and the merchant agent returning a ₹20,800 premium bundle.
4. Show the budget policy reject it and propose the ₹19,600 bundle.
5. Approve the revised itinerary.
6. Trigger the scripted last-seat conflict and show the alternative departure.
7. Approve the changed itinerary and acquire the hold.
8. Approve payment separately and open Razorpay test checkout.
9. Complete a test payment and show server verification.
10. Open the decision ledger and trace the full exchange.

## Sources

- [Razorpay AI Buildathon](https://razorpay.com/buildathon/)
- [Razorpay Standard Checkout integration guide](https://razorpay.com/docs/developer-tools/integrations/standard-checkout/)
- [Razorpay Orders API](https://razorpay.com/docs/api/orders/)
- [A2A protocol specification](https://github.com/a2aproject/A2A/blob/main/docs/specification.md)
- [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP guidance](https://developer.chrome.com/docs/ai/webmcp)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Workers AI documentation](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare D1 documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Durable Objects documentation](https://developers.cloudflare.com/durable-objects/)
