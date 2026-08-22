import type { DemoState } from "./demoReducer";

interface ApprovalDockProps {
  state: DemoState;
  busy: boolean;
  onPrepareQuote(): void;
  onApproveItinerary(): void;
  onRequestHold(): void;
  onReset(): void;
}

function actionFor(props: ApprovalDockProps) {
  const { state } = props;
  if (["idle", "quoting", "budget_conflict", "failed"].includes(state.phase)) {
    return ["Check live inventory", props.onPrepareQuote] as const;
  }
  if (state.phase === "quote_ready") {
    return ["Approve exact itinerary", props.onApproveItinerary] as const;
  }
  if (state.phase === "itinerary_approved") {
    return [`Hold ${state.intent.partySize} seats for 10 minutes`, props.onRequestHold] as const;
  }
  return null;
}

export function ApprovalDock(props: ApprovalDockProps) {
  const { state, busy } = props;
  const action = actionFor(props);
  const gate = state.phase === "itinerary_approved" || state.phase === "held"
    ? "H2"
    : "H1";
  const waiting = state.phase === "quoting";
  const busyLabel = waiting
    ? "Querying merchant Worker…"
    : state.phase === "quote_ready"
      ? "Recording H1 approval…"
      : state.phase === "itinerary_approved"
        ? "Reserving seats atomically…"
        : "Verifying server state…";

  return (
    <section className="approval-dock" aria-label="Human approval controls">
      <div className="approval-dock__mark">{gate}</div>
      <div className="approval-dock__copy">
        <span className="instrument-label">Human decision boundary</span>
        <strong>
          {waiting
            ? "Checking merchant catalog and capacity"
            : state.phase === "held"
              ? "Seats held, payment disabled"
              : state.phase === "budget_conflict"
                ? "Change the request before continuing"
                : action
                  ? "T-Bud is paused until you act"
                  : "No consequential action is available"}
        </strong>
        <p>
          Quotes and holds are bound to this browser session. No payment order can be
          created in the current pilot.
        </p>
      </div>
      {state.error ? (
        <p className="approval-dock__error" role="alert">{state.error}</p>
      ) : null}
      <div className="approval-dock__actions">
        {action ? (
          <button
            className="button button--primary"
            type="button"
            onClick={action[1]}
            disabled={busy || waiting}
            aria-busy={busy}
          >
            {busy ? busyLabel : action[0]}
          </button>
        ) : null}
        {state.phase !== "idle" ? (
          <button
            className="text-action"
            type="button"
            onClick={props.onReset}
            disabled={busy}
          >
            Start another request
          </button>
        ) : null}
      </div>
    </section>
  );
}
