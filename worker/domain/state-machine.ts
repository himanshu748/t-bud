export type BookingState =
  | "received"
  | "searching"
  | "quote_ready"
  | "budget_conflict"
  | "itinerary_approved"
  | "hold_pending"
  | "held"
  | "capacity_conflict"
  | "hold_expired"
  | "payment_approved"
  | "order_created"
  | "payment_failed"
  | "paid"
  | "cancelled"
  | "expired";

export type BookingEventType =
  | "SEARCH_STARTED"
  | "QUOTE_CREATED"
  | "ITINERARY_APPROVED"
  | "HOLD_REQUESTED"
  | "HOLD_CONFIRMED"
  | "CAPACITY_CONFLICT"
  | "QUOTE_CHANGED"
  | "PAYMENT_APPROVED"
  | "ORDER_CREATED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_FAILED"
  | "HOLD_EXPIRED"
  | "QUOTE_EXPIRED"
  | "CANCELLED";

export interface BookingEvent {
  type: BookingEventType;
}

const transitions: Partial<
  Record<BookingState, Partial<Record<BookingEventType, BookingState>>>
> = {
  received: { SEARCH_STARTED: "searching", CANCELLED: "cancelled" },
  searching: { QUOTE_CREATED: "quote_ready", CANCELLED: "cancelled" },
  quote_ready: {
    ITINERARY_APPROVED: "itinerary_approved",
    QUOTE_EXPIRED: "expired",
    CANCELLED: "cancelled"
  },
  budget_conflict: { QUOTE_CREATED: "quote_ready", CANCELLED: "cancelled" },
  itinerary_approved: {
    HOLD_REQUESTED: "hold_pending",
    QUOTE_CHANGED: "quote_ready",
    CANCELLED: "cancelled"
  },
  hold_pending: {
    HOLD_CONFIRMED: "held",
    CAPACITY_CONFLICT: "capacity_conflict",
    CANCELLED: "cancelled"
  },
  held: {
    PAYMENT_APPROVED: "payment_approved",
    HOLD_EXPIRED: "hold_expired",
    CANCELLED: "cancelled"
  },
  capacity_conflict: { QUOTE_CREATED: "quote_ready", CANCELLED: "cancelled" },
  hold_expired: { QUOTE_CREATED: "quote_ready", CANCELLED: "cancelled" },
  payment_approved: {
    ORDER_CREATED: "order_created",
    HOLD_EXPIRED: "hold_expired",
    CANCELLED: "cancelled"
  },
  order_created: {
    PAYMENT_VERIFIED: "paid",
    PAYMENT_FAILED: "payment_failed",
    CANCELLED: "cancelled"
  },
  payment_failed: {
    PAYMENT_APPROVED: "payment_approved",
    HOLD_EXPIRED: "hold_expired",
    CANCELLED: "cancelled"
  }
};

export function transition(
  state: BookingState,
  event: BookingEvent
): BookingState {
  if (state === "quote_ready" && event.type === "HOLD_REQUESTED") {
    throw new Error("itinerary approval required");
  }

  const next = transitions[state]?.[event.type];
  if (!next) {
    throw new Error(`Invalid booking transition: ${state} -> ${event.type}`);
  }

  return next;
}
