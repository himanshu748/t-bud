import { formatInr } from "../../lib/format";
import type { DemoState } from "./demoReducer";

interface ApprovalDockProps {
  state: DemoState;
  busy: boolean;
  onStart(): void;
  onReviewRevision(): void;
  onApproveItinerary(): void;
  onRequestHold(): void;
  onSimulateSellout(): void;
  onApprovePayment(): void;
  onOpenCheckout(): void;
  onReset(): void;
}

function actionFor(props: ApprovalDockProps) {
  const { state } = props;
  if (state.phase === "idle") return ["Send booking intent", props.onStart] as const;
  if (state.phase === "budget_conflict") return ["Review ₹19,600 bundle", props.onReviewRevision] as const;
  if (state.phase === "quote_ready") return ["Approve itinerary", props.onApproveItinerary] as const;
  if (state.phase === "itinerary_approved") {
    return ["Hold 4 seats", props.onRequestHold] as const;
  }
  if (state.phase === "held") return [`Approve payment of ${formatInr(state.quote.total)}`, props.onApprovePayment] as const;
  if (state.phase === "payment_approved") return ["Open Razorpay test checkout", props.onOpenCheckout] as const;
  return null;
}

export function ApprovalDock(props: ApprovalDockProps) {
  const { state, busy } = props;
  const action = actionFor(props);
  const gate = ["held", "payment_approved", "checkout", "paid"].includes(state.phase) ? "H2" : "H1";
  const waiting = ["discovering", "searching"].includes(state.phase);

  return (
    <section className="approval-dock" aria-label="Human approval controls">
      <div className="approval-dock__mark">{gate}</div>
      <div className="approval-dock__copy">
        <span className="instrument-label">Human decision boundary</span>
        <strong>
          {waiting
            ? "Agents are preparing a reviewable result"
            : state.phase === "checkout"
              ? "Complete payment in the gateway below"
            : action
              ? "T-Bud is paused until you act"
              : state.phase === "paid"
                ? "Booking verified"
                : "No consequential action is available"}
        </strong>
        <p>Every approval is bound to this quote, total, expiry and demo session.</p>
      </div>
      {state.error ? <p className="approval-dock__error" role="alert">{state.error}</p> : null}
      <div className="approval-dock__actions">
        {action ? (
          <button className="button button--primary" type="button" onClick={action[1]} disabled={busy || waiting}>
            {busy ? "Verifying…" : action[0]}
          </button>
        ) : null}
        {state.phase === "itinerary_approved" ? (
          <button
            className="text-action"
            type="button"
            onClick={props.onSimulateSellout}
            disabled={busy}
          >
            Simulate last-seat sellout
          </button>
        ) : null}
        {state.phase !== "idle" ? (
          <button className="text-action" type="button" onClick={props.onReset} disabled={busy}>
            Reset demo
          </button>
        ) : null}
      </div>
    </section>
  );
}
