import { Status } from "../../components/Status";
import { formatInr } from "../../lib/format";
import type { DemoState } from "./demoReducer";

const phaseLabel: Record<DemoState["phase"], string> = {
  idle: "Waiting for your request",
  quoting: "Reading catalog and capacity",
  budget_conflict: "Budget conflict",
  quote_ready: "Quote ready for approval",
  itinerary_approved: "Itinerary approved",
  held: "Seats held, awaiting payment approval",
  payment_approved: "Razorpay order ready",
  paid: "Payment verified",
  failed: "Action stopped"
};

export function MerchantPanel({ state }: { state: DemoState }) {
  const quote = state.quote;
  const conflict = state.phase === "budget_conflict";
  const held = state.phase === "held";
  const paid = state.phase === "paid";
  const ordered = state.phase === "payment_approved";

  return (
    <section
      className="demo-panel demo-panel--merchant"
      aria-labelledby="merchant-panel-title"
    >
      <div className="demo-panel__heading">
        <span className="instrument-label">02 / Merchant Worker</span>
        <h2 id="merchant-panel-title">T-Bud</h2>
      </div>

      <div className="quote-head">
        <div>
          <span className="instrument-label">
            {quote ? `Quote v${quote.version}` : "Live quote"}
          </span>
          <h3>{phaseLabel[state.phase]}</h3>
        </div>
        <Status tone={conflict ? "human" : paid || held ? "success" : "protocol"}>
          {conflict ? "Review needed" : state.phase.replaceAll("_", " ")}
        </Status>
      </div>

      {!quote ? (
        <div className="quote-awaiting">
          <span>{state.phase === "quoting" ? "QUERY IN FLIGHT" : "NO QUOTE YET"}</span>
          <strong>
            {state.phase === "quoting"
              ? "The Worker is checking authoritative merchant data."
              : "Set a group size, budget and add-ons to begin."}
          </strong>
          <p>
            The result is created by the live quote endpoint, not a scripted browser
            sequence.
          </p>
        </div>
      ) : (
        <>
          {state.receipt ? (
            <div className="live-verification">
              <span><i aria-hidden="true" /> LIVE FROM WORKER</span>
              <strong>
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  timeZone: "Asia/Kolkata"
                }).format(new Date(state.receipt.departure.startAt))}
              </strong>
              <strong>{state.receipt.departure.available} seats available now</strong>
              <code>{state.receipt.task.state}</code>
            </div>
          ) : null}
          <div className="quote-items">
            {quote.items.map((item) => (
              <div className="quote-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.quantity} × {formatInr(item.unitAmount)} · merchant catalog
                  </span>
                </div>
                <span>{formatInr(item.amount)}</span>
              </div>
            ))}
          </div>

          <div className={`quote-total${conflict ? " quote-total--conflict" : ""}`}>
            <div>
              <span>Total</span>
              <small>Budget {formatInr(quote.budget)}</small>
            </div>
            <strong>{formatInr(quote.total)}</strong>
          </div>
        </>
      )}

      {!quote ? null : conflict ? (
        <div className="policy-note policy-note--error">
          <span>POLICY / BUDGET</span>
          <strong>{formatInr(quote.total - quote.budget)} over the hard ceiling</strong>
          <p>Raise the budget or remove an add-on, then check inventory again.</p>
        </div>
      ) : paid ? (
        <div className="policy-note policy-note--paid">
          <span>RAZORPAY / VERIFIED</span>
          <strong>{formatInr(quote.total)} captured{state.payment?.simulated ? " in the simulated gateway" : " in test mode"}</strong>
          <p>
            Payment {state.payment?.paymentId} was verified against order{" "}
            {state.payment?.orderId} with an HMAC signature check on the Worker before
            the booking was marked paid.
          </p>
        </div>
      ) : ordered ? (
        <div className="policy-note policy-note--hold">
          <span>RAZORPAY / ORDER CREATED</span>
          <strong>Order {(state.checkout?.orderId ?? state.receipt?.order?.razorpayOrderId)} is open for {formatInr(quote.total)}</strong>
          <p>
            The order was created only after you authorized payment. Complete or close
            Checkout: the seat hold stays yours until it expires.
          </p>
        </div>
      ) : held ? (
        <div className="policy-note policy-note--hold">
          <span>HOLD / ACTIVE</span>
          <strong>{state.intent.partySize} seats reserved temporarily</strong>
          <p>
            Hold {state.hold?.id.slice(0, 12)} expires at {state.hold
              ? new Date(state.hold.expiresAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "the quoted time"}. No Razorpay order exists until you authorize one.
          </p>
        </div>
      ) : (
        <div className="policy-note">
          <span>POLICY / ELIGIBLE</span>
          <strong>{formatInr(quote.budget - quote.total)} remains inside budget</strong>
          <p>
            Catalog price and departure eligibility were checked. Final capacity is
            checked atomically only after both human gates are completed.
          </p>
        </div>
      )}
    </section>
  );
}
