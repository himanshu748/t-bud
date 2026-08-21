import { Status } from "../../components/Status";
import { formatInr } from "../../lib/format";
import type { DemoState } from "./demoReducer";

const phaseLabel: Record<DemoState["phase"], string> = {
  idle: "Waiting for buyer agent",
  discovering: "Publishing booking skill",
  searching: "Checking catalog and capacity",
  budget_conflict: "Budget conflict",
  quote_ready: "Quote ready for approval",
  itinerary_approved: "Itinerary approved",
  capacity_conflict: "Capacity conflict",
  held: "Four seats held",
  payment_approved: "Payment approved",
  checkout: "Razorpay test checkout",
  paid: "Booking confirmed",
  failed: "Action stopped"
};

export function MerchantPanel({ state }: { state: DemoState }) {
  const conflict = state.phase === "budget_conflict";
  const preQuote = ["idle", "discovering", "searching"].includes(state.phase);
  return (
    <section className="demo-panel demo-panel--merchant" aria-labelledby="merchant-panel-title">
      <div className="demo-panel__heading">
        <span className="instrument-label">02 / Merchant agent</span>
        <h2 id="merchant-panel-title">T-Bud</h2>
      </div>

      <div className="quote-head">
        <div>
          <span className="instrument-label">Quote v{state.quote.version}</span>
          <h3>{phaseLabel[state.phase]}</h3>
        </div>
        <Status tone={conflict ? "human" : state.phase === "paid" ? "success" : "protocol"}>
          {conflict ? "Review needed" : state.phase.replaceAll("_", " ")}
        </Status>
      </div>

      {preQuote ? (
        <div className="quote-awaiting">
          <span>NO QUOTE YET</span>
          <strong>The merchant agent has not prepared a bundle.</strong>
          <p>Send the booking intent to discover the skill, query inventory and run the hard budget policy.</p>
        </div>
      ) : (
        <>
          <div className="quote-items">
            {state.quote.items.map((item) => (
              <div className="quote-item" key={item.id}>
                <div><strong>{item.name}</strong><span>{item.detail}</span></div>
                <span>{formatInr(item.amount)}</span>
              </div>
            ))}
          </div>

          <div className={`quote-total${conflict ? " quote-total--conflict" : ""}`}>
            <div><span>Total</span><small>Budget {formatInr(state.quote.budget)}</small></div>
            <strong>{formatInr(state.quote.total)}</strong>
          </div>
        </>
      )}

      {preQuote ? null : conflict ? (
        <div className="policy-note policy-note--error">
          <span>POLICY / BUDGET</span>
          <strong>{formatInr(state.quote.total - state.quote.budget)} over the hard ceiling</strong>
          <p>Keep pickup. Replace premium camp meals with the eligible trail meal upgrade.</p>
        </div>
      ) : (
        <div className="policy-note">
          <span>POLICY / ELIGIBLE</span>
          <strong>{formatInr(state.quote.budget - state.quote.total)} remains inside budget</strong>
          <p>Catalog price and four-seat availability were checked. No hold exists until H1 approval.</p>
        </div>
      )}
    </section>
  );
}
