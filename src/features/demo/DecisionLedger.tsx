import type { DemoState, LedgerEntry } from "./demoReducer";

const actorLabel: Record<LedgerEntry["actor"], string> = {
  buyer_agent: "Buyer agent",
  merchant_agent: "Merchant agent",
  policy: "Policy",
  human: "Human",
  system: "System"
};

export function DecisionLedger({ state }: { state: DemoState }) {
  return (
    <section className="decision-ledger" aria-labelledby="decision-ledger-title">
      <div className="decision-ledger__heading">
        <div>
          <span className="instrument-label">Evidence / append only</span>
          <h2 id="decision-ledger-title">Decision ledger</h2>
        </div>
        <span>{state.ledger.length} events</span>
      </div>
      <ol>
        {state.ledger.map((item, index) => (
          <li className={`ledger-event ledger-event--${item.tone}`} key={`${item.id}-${index}`}>
            <span className="ledger-event__index">{String(index + 1).padStart(2, "0")}</span>
            <span className="ledger-event__actor">{actorLabel[item.actor]}</span>
            <div><strong>{item.label}</strong><p>{item.detail}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
