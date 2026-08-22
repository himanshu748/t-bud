import { formatInr } from "../../lib/format";

export type BookingPhase =
  | "idle"
  | "quoting"
  | "budget_conflict"
  | "quote_ready"
  | "itinerary_approved"
  | "held"
  | "failed";

export type DemoPhase = BookingPhase;

export type PendingHumanAction =
  | "approve_itinerary"
  | "request_hold"
  | null;

export interface BookingIntent {
  location: "Manali";
  partySize: number;
  budgetRupees: number;
  durationDays: 2;
  durationNights: 1;
  experience: "occasional";
  pickup: boolean;
  meals: boolean;
}

export interface BookingQuote {
  id: string;
  version: number;
  total: number;
  budget: number;
  expiresAt: string;
  departureId: string;
  items: Array<{
    id: string;
    kind: "trek" | "addon";
    name: string;
    quantity: number;
    unitAmount: number;
    amount: number;
  }>;
}

export interface BookingReceipt {
  quote: {
    id: string;
    taskId: string;
    version: number;
    total: number;
    budget: number;
    expiresAt: string;
    departureId: string;
    partySize: number;
    items: BookingQuote["items"];
  };
  task: {
    state: string;
    updatedAt: string;
  };
  departure: {
    id: string;
    startAt: string;
    capacity: number;
    available: number;
  };
  approvals: {
    itinerary: { approvedAt: string; receiptId: string } | null;
    hold: { approvedAt: string; receiptId: string } | null;
  };
  hold: {
    id: string;
    status: string;
    expiresAt: string;
    partySize: number;
  } | null;
  audit: Array<{
    id: string;
    actor: "buyer_agent" | "merchant_agent" | "human" | "system";
    action: string;
    target: string;
    result: string;
    createdAt: string;
  }>;
  verifiedAt: string;
}

export interface LedgerEntry {
  id: string;
  actor: "buyer_agent" | "merchant_agent" | "policy" | "human" | "system";
  label: string;
  detail: string;
  tone: "neutral" | "protocol" | "human" | "success" | "error";
}

export interface DemoState {
  phase: BookingPhase;
  pendingHumanAction: PendingHumanAction;
  intent: BookingIntent;
  quote: BookingQuote | null;
  hold: { id: string; expiresAt: string } | null;
  error: string | null;
  receipt: BookingReceipt | null;
  receiptError: string | null;
  ledger: LedgerEntry[];
}

export type DemoAction =
  | { type: "INTENT_UPDATED"; intent: BookingIntent }
  | { type: "QUOTE_REQUESTED" }
  | {
      type: "QUOTE_RECEIVED";
      quote: BookingQuote;
      policyStatus: "eligible" | "budget_conflict";
      intentSource: "workers_ai" | "rules_fallback";
      recommendationSource: "workers_ai" | "rules_fallback";
    }
  | { type: "ITINERARY_APPROVED"; approvedAt: string }
  | { type: "HOLD_CONFIRMED"; holdId: string; expiresAt: string }
  | { type: "RECEIPT_RECEIVED"; receipt: BookingReceipt }
  | { type: "RECEIPT_FAILED"; message: string }
  | { type: "BOOKING_RESTORED"; state: DemoState }
  | { type: "REQUEST_FAILED"; message: string; recoverTo?: "idle" }
  | { type: "RESET" };

export const defaultBookingIntent: BookingIntent = {
  location: "Manali",
  partySize: 4,
  budgetRupees: 20_000,
  durationDays: 2,
  durationNights: 1,
  experience: "occasional",
  pickup: true,
  meals: true
};

export function bookingIntentText(intent: BookingIntent): string {
  const addOns = [
    intent.pickup ? "pickup" : null,
    intent.meals ? "upgraded meals" : null
  ].filter(Boolean);
  const extras = addOns.length
    ? ` with ${addOns.join(" and ")}`
    : " with no add-ons";
  return `${intent.durationDays}-day ${intent.location} trek for ${intent.partySize} people under ₹${intent.budgetRupees.toLocaleString("en-IN")}${extras} for occasional hikers`;
}

function seedQuote(intent: BookingIntent): BookingQuote {
  return {
    id: "quote_live_v1",
    version: 1,
    total: 1_960_000,
    budget: intent.budgetRupees * 100,
    expiresAt: "2026-09-12T12:15:00.000Z",
    departureId: "dep_hampta_2026_09_12",
    items: [
      {
        id: "trek_hampta",
        kind: "trek",
        name: "Hampta Pass Intro Trek",
        quantity: intent.partySize,
        unitAmount: 400_000,
        amount: 400_000 * intent.partySize
      },
      ...(intent.pickup
        ? [{
            id: "pickup_manali",
            kind: "addon" as const,
            name: "Manali pickup",
            quantity: 1,
            unitAmount: 200_000,
            amount: 200_000
          }]
        : []),
      ...(intent.meals
        ? [{
            id: "meals_budget",
            kind: "addon" as const,
            name: "Upgraded trail meals",
            quantity: intent.partySize,
            unitAmount: 40_000,
            amount: 40_000 * intent.partySize
          }]
        : [])
    ]
  };
}

function requestEntry(intent: BookingIntent): LedgerEntry {
  return {
    id: "request",
    actor: "buyer_agent",
    label: "Booking request submitted",
    detail: `${intent.partySize} travellers · ${intent.location} · ${intent.durationDays} days / ${intent.durationNights} night · ${formatInr(intent.budgetRupees * 100)} ceiling`,
    tone: "protocol"
  };
}

function quoteEntry(quote: BookingQuote, eligible: boolean): LedgerEntry {
  return {
    id: "quote",
    actor: eligible ? "merchant_agent" : "policy",
    label: eligible ? "Live catalog quote created" : "Budget policy stopped the quote",
    detail: eligible
      ? `${formatInr(quote.total)} · departure ${quote.departureId} · expires ${new Date(quote.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
      : `${formatInr(quote.total)} total · ${formatInr(quote.total - quote.budget)} above the hard ceiling`,
    tone: eligible ? "success" : "error"
  };
}

function pendingAction(phase: BookingPhase): PendingHumanAction {
  if (phase === "quote_ready") return "approve_itinerary";
  if (phase === "itinerary_approved") return "request_hold";
  return null;
}

function seededLedger(
  phase: BookingPhase,
  intent: BookingIntent,
  quote: BookingQuote | null
): LedgerEntry[] {
  if (phase === "idle") return [];
  const entries: LedgerEntry[] = [requestEntry(intent)];
  if (phase === "quoting" || !quote) return entries;
  entries.push(quoteEntry(quote, phase !== "budget_conflict"));
  if (["itinerary_approved", "held"].includes(phase)) {
    entries.push({
      id: "itinerary-approval",
      actor: "human",
      label: "Human approved itinerary",
      detail: `Quote v${quote.version} · exact total and expiry verified`,
      tone: "success"
    });
  }
  if (phase === "held") {
    entries.push({
      id: "hold",
      actor: "human",
      label: "Seat hold requested",
      detail: `${intent.partySize} seats held · payment collection remains disabled`,
      tone: "human"
    });
  }
  return entries;
}

export function createInitialDemoState(phase: BookingPhase = "idle"): DemoState {
  const intent = phase === "budget_conflict"
    ? { ...defaultBookingIntent, budgetRupees: 19_000 }
    : defaultBookingIntent;
  const quote = ["idle", "quoting", "failed"].includes(phase)
    ? null
    : seedQuote(intent);
  return {
    phase,
    pendingHumanAction: pendingAction(phase),
    intent,
    quote,
    hold: phase === "held"
      ? { id: "hold_live", expiresAt: "2026-09-12T12:10:00.000Z" }
      : null,
    error: null,
    receipt: null,
    receiptError: null,
    ledger: seededLedger(phase, intent, quote)
  };
}

function append(
  state: DemoState,
  next: Omit<DemoState, "ledger">,
  item: LedgerEntry
): DemoState {
  return { ...next, ledger: [...state.ledger, item] };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "INTENT_UPDATED":
      return {
        ...state,
        phase: "idle",
        pendingHumanAction: null,
        intent: action.intent,
        quote: null,
        hold: null,
        error: null,
        receipt: null,
        receiptError: null,
        ledger: []
      };
    case "QUOTE_REQUESTED":
      return {
        ...state,
        phase: "quoting",
        pendingHumanAction: null,
        quote: null,
        hold: null,
        error: null,
        receipt: null,
        receiptError: null,
        ledger: [requestEntry(state.intent)]
      };
    case "QUOTE_RECEIVED": {
      const eligible = action.policyStatus === "eligible";
      const quoteLedgerEntry = quoteEntry(action.quote, eligible);
      return append(
        state,
        {
          ...state,
          phase: eligible ? "quote_ready" : "budget_conflict",
          pendingHumanAction: eligible ? "approve_itinerary" : null,
          quote: action.quote,
          hold: null,
          error: null,
          receipt: null,
          receiptError: null
        },
        {
          ...quoteLedgerEntry,
          detail: `${quoteLedgerEntry.detail} · intent ${action.intentSource} · add-ons ${action.recommendationSource}`
        }
      );
    }
    case "ITINERARY_APPROVED":
      if (!state.quote) return state;
      return append(
        state,
        {
          ...state,
          phase: "itinerary_approved",
          pendingHumanAction: "request_hold",
          error: null
        },
        {
          id: "itinerary-approval",
          actor: "human",
          label: "Human approved itinerary",
          detail: `Quote v${state.quote.version} approved at ${action.approvedAt}`,
          tone: "success"
        }
      );
    case "HOLD_CONFIRMED":
      return append(
        state,
        {
          ...state,
          phase: "held",
          pendingHumanAction: null,
          hold: { id: action.holdId, expiresAt: action.expiresAt },
          error: null
        },
        {
          id: "hold",
          actor: "human",
          label: "Seat hold created",
          detail: `${state.intent.partySize} seats held until ${new Date(action.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · payment disabled`,
          tone: "human"
        }
      );
    case "RECEIPT_RECEIVED":
      return {
        ...state,
        receipt: action.receipt,
        receiptError: null
      };
    case "RECEIPT_FAILED":
      return {
        ...state,
        receiptError: action.message
      };
    case "BOOKING_RESTORED":
      return action.state;
    case "REQUEST_FAILED":
      return append(
        state,
        {
          ...state,
          phase: action.recoverTo ?? state.phase,
          pendingHumanAction: action.recoverTo
            ? null
            : state.pendingHumanAction,
          error: action.message
        },
        {
          id: "error",
          actor: "system",
          label: "Action stopped safely",
          detail: action.message,
          tone: "error"
        }
      );
    case "RESET": {
      const initial = createInitialDemoState();
      return {
        ...initial,
        ledger: [
          ...state.ledger,
          {
            id: "reset",
            actor: "human",
            label: "Booking request cleared",
            detail: "No payment was started. Any existing hold will expire automatically.",
            tone: "human"
          }
        ]
      };
    }
  }
}
