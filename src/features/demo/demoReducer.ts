export type DemoPhase =
  | "idle"
  | "discovering"
  | "searching"
  | "budget_conflict"
  | "quote_ready"
  | "itinerary_approved"
  | "capacity_conflict"
  | "held"
  | "payment_approved"
  | "checkout"
  | "paid"
  | "failed";

export type PendingHumanAction =
  | "review_cheaper_bundle"
  | "approve_itinerary"
  | "request_hold"
  | "approve_payment"
  | "open_checkout"
  | null;

export interface DemoQuote {
  id: string;
  version: number;
  total: number;
  budget: number;
  expiresAt: string;
  items: Array<{ id: string; name: string; detail: string; amount: number }>;
}

export interface LedgerEntry {
  id: string;
  actor: "buyer_agent" | "merchant_agent" | "policy" | "human" | "system";
  label: string;
  detail: string;
  tone: "neutral" | "protocol" | "human" | "success" | "error";
}

export interface DemoState {
  phase: DemoPhase;
  pendingHumanAction: PendingHumanAction;
  quote: DemoQuote;
  hold: { id: string; expiresAt: string } | null;
  error: string | null;
  ledger: LedgerEntry[];
}

export type DemoAction =
  | { type: "SCENARIO_STARTED" }
  | { type: "SEARCH_STARTED" }
  | { type: "PREMIUM_QUOTE_RECEIVED"; total: number }
  | { type: "REVISION_ACCEPTED" }
  | { type: "ITINERARY_APPROVED"; approvedAt: string }
  | { type: "HOLD_CONFIRMED"; holdId: string; expiresAt: string }
  | { type: "CAPACITY_CONFLICT" }
  | { type: "PAYMENT_APPROVED"; approvedAt: string }
  | { type: "CHECKOUT_OPENED" }
  | { type: "PAYMENT_VERIFIED" }
  | { type: "REQUEST_FAILED"; message: string }
  | { type: "RESET" };

const revisedItems: DemoQuote["items"] = [
  {
    id: "trek_hampta_intro",
    name: "Hampta Pass introduction",
    detail: "2 days / 1 night · 4 hikers",
    amount: 1_600_000
  },
  {
    id: "addon_pickup",
    name: "Manali pickup",
    detail: "Private group transfer",
    amount: 160_000
  },
  {
    id: "addon_meals_budget",
    name: "Trail meal upgrade",
    detail: "Four vegetarian meal plans",
    amount: 200_000
  }
];

const premiumItems: DemoQuote["items"] = revisedItems.map((item) =>
  item.id === "addon_meals_budget"
    ? {
        ...item,
        id: "addon_meals_premium",
        name: "Premium camp meals",
        detail: "Four premium meal plans",
        amount: 320_000
      }
    : item
);

function entry(
  id: string,
  actor: LedgerEntry["actor"],
  label: string,
  detail: string,
  tone: LedgerEntry["tone"] = "neutral"
): LedgerEntry {
  return { id, actor, label, detail, tone };
}

const requestEntry = entry(
  "request",
  "buyer_agent",
  "Booking intent received",
  "Four friends · Manali · 2 days / 1 night · ₹20,000 ceiling",
  "protocol"
);

const discoveryEntry = entry(
  "discovery",
  "merchant_agent",
  "T-Bud Agent Card discovered",
  "book_manali_trek skill · A2A v1.0"
);

const searchEntry = entry(
  "search",
  "merchant_agent",
  "Catalog and capacity checked",
  "Occasional difficulty · pickup and meals requested"
);

const conflictEntry = entry(
  "budget",
  "policy",
  "Premium bundle exceeds budget",
  "₹20,800 total · ₹800 above the hard ceiling",
  "error"
);

const revisionEntry = entry(
  "revision",
  "human",
  "Cheaper bundle selected",
  "Pickup retained · premium meals replaced · ₹19,600 total",
  "human"
);

const approvalEntry = entry(
  "itinerary-approval",
  "human",
  "Human approved itinerary",
  "Quote v2 · exact total and expiry verified",
  "success"
);

function quoteForPhase(phase: DemoPhase): DemoQuote {
  const premium = ["budget_conflict"].includes(phase);
  return {
    id: premium ? "quote_demo_v1" : "quote_demo_v2",
    version: premium ? 1 : 2,
    total: premium ? 2_080_000 : 1_960_000,
    budget: 2_000_000,
    expiresAt: "2026-09-12T12:15:00.000Z",
    items: premium ? premiumItems : revisedItems
  };
}

function seededLedger(phase: DemoPhase): LedgerEntry[] {
  const entries = [requestEntry];
  if (phase === "idle") return entries;
  entries.push(discoveryEntry);
  if (phase === "discovering") return entries;
  entries.push(searchEntry);
  if (phase === "searching") return entries;
  entries.push(conflictEntry);
  if (phase === "budget_conflict") return entries;
  entries.push(revisionEntry);
  if (phase === "quote_ready") return entries;
  entries.push(approvalEntry);
  return entries;
}

function pendingAction(phase: DemoPhase): PendingHumanAction {
  if (phase === "budget_conflict") return "review_cheaper_bundle";
  if (phase === "quote_ready") return "approve_itinerary";
  if (phase === "itinerary_approved" || phase === "capacity_conflict") return "request_hold";
  if (phase === "held") return "approve_payment";
  if (phase === "payment_approved") return "open_checkout";
  return null;
}

export function createInitialDemoState(phase: DemoPhase = "idle"): DemoState {
  return {
    phase,
    pendingHumanAction: pendingAction(phase),
    quote: quoteForPhase(phase),
    hold:
      ["held", "payment_approved", "checkout", "paid"].includes(phase)
        ? { id: "hold_demo", expiresAt: "2026-09-12T12:10:00.000Z" }
        : null,
    error: null,
    ledger: seededLedger(phase)
  };
}

function append(state: DemoState, next: Omit<DemoState, "ledger">, item: LedgerEntry): DemoState {
  return { ...next, ledger: [...state.ledger, item] };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "SCENARIO_STARTED":
      return append(
        state,
        { ...state, phase: "discovering", pendingHumanAction: null, error: null },
        discoveryEntry
      );
    case "SEARCH_STARTED":
      return append(
        state,
        { ...state, phase: "searching", pendingHumanAction: null, error: null },
        searchEntry
      );
    case "PREMIUM_QUOTE_RECEIVED":
      return append(
        state,
        {
          ...state,
          phase: "budget_conflict",
          pendingHumanAction: "review_cheaper_bundle",
          quote: { ...quoteForPhase("budget_conflict"), total: action.total },
          error: null
        },
        conflictEntry
      );
    case "REVISION_ACCEPTED":
      return append(
        state,
        {
          ...state,
          phase: "quote_ready",
          pendingHumanAction: "approve_itinerary",
          quote: quoteForPhase("quote_ready"),
          error: null
        },
        revisionEntry
      );
    case "ITINERARY_APPROVED":
      return append(
        state,
        {
          ...state,
          phase: "itinerary_approved",
          pendingHumanAction: "request_hold",
          error: null
        },
        {
          ...approvalEntry,
          detail: `Quote v2 approved at ${action.approvedAt}`
        }
      );
    case "HOLD_CONFIRMED":
      return append(
        state,
        {
          ...state,
          phase: "held",
          pendingHumanAction: "approve_payment",
          hold: { id: action.holdId, expiresAt: action.expiresAt },
          error: null
        },
        entry(
          "hold",
          "system",
          "Four seats held",
          `Atomic hold ${action.holdId} · payment still locked`,
          "success"
        )
      );
    case "CAPACITY_CONFLICT":
      return append(
        state,
        {
          ...state,
          phase: "capacity_conflict",
          pendingHumanAction: "request_hold",
          hold: null,
          error: null
        },
        entry(
          "capacity",
          "system",
          "Last seats sold out",
          "Original approval invalidated · Sep 20 departure proposed",
          "error"
        )
      );
    case "PAYMENT_APPROVED":
      return append(
        state,
        {
          ...state,
          phase: "payment_approved",
          pendingHumanAction: "open_checkout",
          error: null
        },
        entry(
          "payment-approval",
          "human",
          "Human approved payment",
          `₹19,600 approved at ${action.approvedAt}`,
          "human"
        )
      );
    case "CHECKOUT_OPENED":
      return append(
        state,
        { ...state, phase: "checkout", pendingHumanAction: null, error: null },
        entry("checkout", "system", "Razorpay test checkout opened", "Order creation follows a direct user action", "protocol")
      );
    case "PAYMENT_VERIFIED":
      return append(
        state,
        { ...state, phase: "paid", pendingHumanAction: null, error: null },
        entry("paid", "system", "Payment signature verified", "Booking confirmed and audit trail sealed", "success")
      );
    case "REQUEST_FAILED":
      return append(
        state,
        { ...state, error: action.message },
        entry("error", "system", "Action stopped safely", action.message, "error")
      );
    case "RESET": {
      const initial = createInitialDemoState("idle");
      return append(
        state,
        {
          phase: initial.phase,
          pendingHumanAction: initial.pendingHumanAction,
          quote: initial.quote,
          hold: initial.hold,
          error: initial.error
        },
        entry("reset", "human", "Demo reset", "No hold or payment persisted", "human")
      );
    }
  }
}
