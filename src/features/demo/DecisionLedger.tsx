import type { BookingReceipt, DemoState } from "./demoReducer";

const actorLabel: Record<BookingReceipt["audit"][number]["actor"], string> = {
  buyer_agent: "Buyer agent",
  merchant_agent: "Merchant agent",
  human: "Human",
  system: "System"
};

const actionLabel: Record<string, string> = {
  "request.received": "Request committed to D1",
  "quote.created": "Live catalog quote created",
  "approval.itinerary_recorded": "Itinerary approval recorded",
  "approval.hold_recorded": "Seat-hold approval recorded",
  "hold.created": "Atomic seat hold committed",
  "hold.expired": "Seat hold expired and capacity released",
  "approval.payment_recorded": "Payment approval recorded",
  "checkout.order_created": "Razorpay order created",
  "payment.verified": "Razorpay signature verified"
};

function departureDate(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("day")} ${read("month")} ${read("year")}`;
}

function eventTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

function shortTarget(value: string): string {
  return value.length > 14 ? `${value.slice(0, 12)}…` : value;
}

interface DecisionLedgerProps {
  state: DemoState;
  onRetry(): void;
}

export function DecisionLedger({ state, onRetry }: DecisionLedgerProps) {
  const receipt = state.receipt;

  return (
    <section className="decision-ledger" aria-labelledby="decision-ledger-title">
      <div className="decision-ledger__heading">
        <div>
          <span className="instrument-label">Evidence / server authored</span>
          <h2 id="decision-ledger-title">Booking receipt</h2>
        </div>
        <div className="decision-ledger__status">
          <span>{receipt ? `${receipt.audit.length} D1 events` : "Awaiting D1"}</span>
          {receipt ? (
            <button className="receipt-refresh" type="button" onClick={onRetry}>
              Refresh D1 receipt
            </button>
          ) : null}
        </div>
      </div>

      {receipt ? (
        <>
          <div className="receipt-proof">
            <div className="receipt-proof__status">
              <span className="receipt-proof__signal" aria-hidden="true" />
              <div>
                <strong>D1 receipt verified</strong>
                <span>Read from the booking Worker just now</span>
              </div>
            </div>
            <div className="receipt-fact">
              <span>Server task</span>
              <code>{receipt.quote.taskId}</code>
            </div>
            <div className="receipt-fact">
              <span>Departure</span>
              <strong>{departureDate(receipt.departure.startAt)}</strong>
            </div>
            <div className="receipt-fact">
              <span>Live capacity</span>
              <strong>
                {receipt.departure.available} / {receipt.departure.capacity} seats free
              </strong>
            </div>
          </div>

          <div className="receipt-gates" aria-label="Approval receipts">
            <div>
              <span>H1 / Itinerary</span>
              <code>{receipt.approvals.itinerary?.receiptId ?? "Awaiting human"}</code>
            </div>
            <div>
              <span>H2 / Seat hold</span>
              <code>{receipt.approvals.hold?.receiptId ?? "Awaiting human"}</code>
            </div>
            <div>
              <span>H3 / Payment</span>
              <code>{receipt.approvals.payment?.receiptId ?? "Awaiting human"}</code>
            </div>
            <div>
              <span>Razorpay order</span>
              <code>{receipt.order?.razorpayOrderId ?? "Not created"}</code>
            </div>
            <div>
              <span>Worker state</span>
              <code>{receipt.task.state}</code>
            </div>
            <small>
              Verified <time dateTime={receipt.verifiedAt}>{eventTime(receipt.verifiedAt)}</time>
            </small>
          </div>

          <ol>
            {receipt.audit.map((item, index) => (
              <li className="ledger-event" key={item.id}>
                <span className="ledger-event__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="ledger-event__actor">{actorLabel[item.actor]}</span>
                <div>
                  <strong>{actionLabel[item.action] ?? item.action}</strong>
                  <p>
                    <code>{item.action}</code> · {shortTarget(item.target)} · {item.result} ·{" "}
                    <time dateTime={item.createdAt}>{eventTime(item.createdAt)}</time>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : state.receiptError ? (
        <div className="decision-ledger__empty decision-ledger__empty--error" role="alert">
          <strong>The booking worked, but its D1 receipt could not be read.</strong>
          <p>{state.receiptError}</p>
          <button className="text-action" type="button" onClick={onRetry}>
            Retry receipt verification
          </button>
        </div>
      ) : state.quote ? (
        <div className="receipt-loading" aria-live="polite">
          <span className="receipt-loading__pulse" aria-hidden="true" />
          <div>
            <strong>Reading D1 receipt…</strong>
            <p>Confirming the quote against the server task and live departure object.</p>
          </div>
        </div>
      ) : (
        <div className="decision-ledger__empty">
          <strong>No server receipt yet.</strong>
          <p>Check live inventory to create a task, quote and append-only D1 trace.</p>
        </div>
      )}
    </section>
  );
}
