import { useEffect, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { Status } from "../../components/Status";
import { bookingApi, type BookingApi } from "../../lib/api";
import { ApprovalDock } from "./ApprovalDock";
import { BuyerPanel } from "./BuyerPanel";
import { DecisionLedger } from "./DecisionLedger";
import {
  bookingIntentText,
  createInitialDemoState,
  demoReducer,
  type BookingPhase,
  type BookingReceipt,
  type DemoPhase,
  type DemoState
} from "./demoReducer";
import { MerchantPanel } from "./MerchantPanel";
import { ProtocolRail } from "./ProtocolRail";
import { RazorpayCheckout } from "./RazorpayCheckout";

export interface DemoPageProps {
  initialPhase?: DemoPhase;
  api?: BookingApi;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "T-Bud could not complete that action";
}

const ACTIVE_BOOKING_KEY = "tbud.active-booking";

function restoreDemoState(initialPhase: DemoPhase): DemoState {
  const initial = createInitialDemoState(initialPhase);
  if (initialPhase !== "idle" || typeof window === "undefined") return initial;

  try {
    const raw = window.sessionStorage.getItem(ACTIVE_BOOKING_KEY);
    if (!raw) return initial;
    const saved = JSON.parse(raw) as DemoState;
    if (!saved.quote?.id || !saved.intent || !saved.phase) return initial;
    return { ...saved, error: null, receiptError: null };
  } catch {
    window.sessionStorage.removeItem(ACTIVE_BOOKING_KEY);
    return initial;
  }
}

function stateFromReceipt(receipt: BookingReceipt): DemoState {
  const phase: BookingPhase = receipt.quote.total > receipt.quote.budget
    ? "budget_conflict"
    : receipt.task.state === "payment_review"
      ? "failed"
    : receipt.task.state === "paid"
      ? "paid"
    : receipt.task.state === "hold_expired"
      ? "failed"
    : receipt.order && receipt.approvals.payment
      ? "payment_approved"
    : receipt.task.state === "held" && receipt.hold
      ? "held"
      : receipt.task.state === "itinerary_approved"
        ? "itinerary_approved"
        : "quote_ready";
  const base = createInitialDemoState(phase);
  const intent = {
    ...base.intent,
    partySize: receipt.quote.partySize,
    budgetRupees: Math.round(receipt.quote.budget / 100),
    pickup: receipt.quote.items.some((item) => item.id.includes("pickup")),
    meals: receipt.quote.items.some((item) => item.id.includes("meals"))
  };

  return {
    ...base,
    phase,
    pendingHumanAction: phase === "quote_ready"
      ? "approve_itinerary"
      : phase === "itinerary_approved"
        ? "request_hold"
        : phase === "held"
          ? "approve_payment"
          : null,
    intent,
    quote: {
      id: receipt.quote.id,
      version: receipt.quote.version,
      total: receipt.quote.total,
      budget: receipt.quote.budget,
      expiresAt: receipt.quote.expiresAt,
      departureId: receipt.quote.departureId,
      items: receipt.quote.items
    },
    hold: receipt.hold
      ? { id: receipt.hold.id, expiresAt: receipt.hold.expiresAt }
      : null,
    checkout: null,
    payment: receipt.order?.verificationStatus === "verified" && receipt.order.paymentId
      ? {
          orderId: receipt.order.razorpayOrderId,
          paymentId: receipt.order.paymentId,
          simulated: receipt.order.simulated
        }
      : null,
    receipt,
    receiptError: null,
    error: receipt.task.state === "payment_review"
      ? "Payment received, but the seats are no longer available. Contact the merchant with your order ID for a refund or another departure. Do not pay again."
      : phase === "failed"
      ? "The seat hold expired. Check live inventory to prepare a fresh quote."
      : null
  };
}

export function DemoPage({
  initialPhase = "idle",
  api = bookingApi
}: DemoPageProps) {
  const [state, dispatch] = useReducer(
    demoReducer,
    initialPhase,
    restoreDemoState
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialPhase !== "idle") return;
    if (state.phase === "idle") {
      window.sessionStorage.removeItem(ACTIVE_BOOKING_KEY);
    } else if (state.quote) {
      window.sessionStorage.setItem(ACTIVE_BOOKING_KEY, JSON.stringify(state));
    }
  }, [initialPhase, state]);

  useEffect(() => {
    if (initialPhase !== "idle") return;
    if (state.quote) {
      void reconcileReceipt(state.quote.id);
      return;
    }
    const quoteId = new URLSearchParams(window.location.search).get("quoteId");
    if (!quoteId) return;
    setBusy(true);
    void api.getReceipt(quoteId)
      .then((receipt) => dispatch({
        type: "BOOKING_RESTORED",
        state: stateFromReceipt(receipt)
      }))
      .catch((error: unknown) => dispatch({
        type: "RECEIPT_FAILED",
        message: errorMessage(error)
      }))
      .finally(() => setBusy(false));
  }, []);

  async function refreshReceipt(
    quoteId: string,
    settlesWhen?: (receipt: BookingReceipt) => boolean
  ) {
    try {
      let receipt = await api.getReceipt(quoteId);
      // Remote D1 can answer before the write that triggered this refresh is
      // readable, which would show evidence that contradicts the headline.
      for (let attempt = 0; settlesWhen && !settlesWhen(receipt) && attempt < 4; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
        receipt = await api.getReceipt(quoteId);
      }
      dispatch({ type: "RECEIPT_RECEIVED", receipt });
    } catch (error) {
      dispatch({ type: "RECEIPT_FAILED", message: errorMessage(error) });
    }
  }

  async function reconcileReceipt(quoteId: string) {
    try {
      const receipt = await api.getReceipt(quoteId);
      dispatch({ type: "BOOKING_RESTORED", state: stateFromReceipt(receipt) });
    } catch (error) {
      dispatch({ type: "RECEIPT_FAILED", message: errorMessage(error) });
    }
  }

  async function runVerified(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      dispatch({ type: "REQUEST_FAILED", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function prepareQuote() {
    setBusy(true);
    dispatch({ type: "QUOTE_REQUESTED" });
    void api
      .createQuote(bookingIntentText(state.intent))
      .then(async (result) => {
        dispatch({
          type: "QUOTE_RECEIVED",
          quote: result.quote,
          policyStatus: result.policy.status,
          intentSource: result.intentSource,
          recommendationSource: result.recommendationSource
        });
        await refreshReceipt(result.quote.id);
      })
      .catch((error: unknown) => {
        dispatch({
          type: "REQUEST_FAILED",
          message: errorMessage(error),
          recoverTo: "idle"
        });
      })
      .finally(() => setBusy(false));
  }

  function approveItinerary() {
    if (!state.quote) return;
    void runVerified(async () => {
      const result = await api.approveItinerary(state.quote!.id);
      dispatch({ type: "ITINERARY_APPROVED", approvedAt: result.approvedAt });
      await refreshReceipt(state.quote!.id);
    });
  }

  function requestHold() {
    if (!state.quote) return;
    void runVerified(async () => {
      await api.approveHold(state.quote!.id);
      const result = await api.requestHold(state.quote!.id);
      dispatch({
        type: "HOLD_CONFIRMED",
        holdId: result.holdId,
        expiresAt: result.expiresAt
      });
      await refreshReceipt(state.quote!.id);
    });
  }

  function approvePayment() {
    if (!state.quote) return;
    void runVerified(async () => {
      const approval = await api.approvePayment(state.quote!.id);
      const checkout = await api.createCheckout(state.quote!.id);
      dispatch({
        type: "PAYMENT_APPROVED",
        approvedAt: approval.approvedAt,
        checkout
      });
      await refreshReceipt(state.quote!.id);
    });
  }

  function completePayment(result: {
    orderId: string;
    paymentId: string;
    signature?: string;
  }) {
    if (!state.quote) return;
    void runVerified(async () => {
      const verification = await api.verifyPayment(result);
      if (verification.bookingConfirmed === false) {
        await reconcileReceipt(state.quote!.id);
        return;
      }
      dispatch({
        type: "PAYMENT_VERIFIED",
        orderId: result.orderId,
        paymentId: result.paymentId,
        simulated: !result.signature
      });
      await refreshReceipt(
        state.quote!.id,
        (receipt) => receipt.order?.verificationStatus === "verified"
      );
    });
  }

  return (
    <div className="demo-shell">
      <header className="demo-header">
        <BrandMark />
        <div className="demo-header__context">
          <span className="demo-header__label">Live booking / Manali pilot</span>
          <Status tone="human">Human control: on</Status>
        </div>
        <nav aria-label="Booking navigation">
          <Link to="/">Landing</Link>
          <Link to="/merchant">Merchant view</Link>
        </nav>
      </header>

      <main className="demo-main">
        <div className="demo-intro">
          <div>
            <span className="instrument-label">Live merchant inventory</span>
            <h1>Set the trip. Check the quote. Hold only when you say.</h1>
          </div>
          <p>
            Your request uses the same booking engine exposed to agents through A2A
            and WebMCP. Catalog prices come from the merchant Worker, then capacity is
            checked atomically when you approve a hold. Payment runs on Razorpay
            Checkout, and only after you authorize it as a third, separate action.
          </p>
        </div>

        <div className="demo-workspace">
          <BuyerPanel
            state={state}
            busy={busy}
            onIntentChange={(intent) => dispatch({ type: "INTENT_UPDATED", intent })}
          />
          <ApprovalDock
            state={state}
            busy={busy}
            onPrepareQuote={prepareQuote}
            onApproveItinerary={approveItinerary}
            onRequestHold={requestHold}
            onApprovePayment={approvePayment}
            onReset={() => dispatch({ type: "RESET" })}
          />
          <ProtocolRail phase={state.phase} />
          <MerchantPanel state={state} />
        </div>

        {state.checkout && state.phase === "payment_approved" ? (
          <RazorpayCheckout checkout={state.checkout} onVerified={completePayment} />
        ) : null}

        <DecisionLedger
          state={state}
          onRetry={() => state.quote && void reconcileReceipt(state.quote.id)}
        />
      </main>
    </div>
  );
}
