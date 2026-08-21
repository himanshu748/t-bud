import type { DemoPhase } from "./demoReducer";

const steps = [
  ["discovering", "Agent Card"],
  ["searching", "search_treks"],
  ["budget_conflict", "quote_bundle"],
  ["quote_ready", "human gate H1"],
  ["itinerary_approved", "request_hold"],
  ["held", "human gate H2"],
  ["payment_approved", "create_checkout"],
  ["paid", "verified"]
] as const;

function phaseRank(phase: DemoPhase): number {
  const map: Record<DemoPhase, number> = {
    idle: -1,
    discovering: 0,
    searching: 1,
    budget_conflict: 2,
    quote_ready: 3,
    itinerary_approved: 4,
    capacity_conflict: 4,
    held: 5,
    payment_approved: 6,
    checkout: 6,
    paid: 7,
    failed: 0
  };
  return map[phase];
}

export function ProtocolRail({ phase }: { phase: DemoPhase }) {
  const active = phaseRank(phase);
  return (
    <aside className="demo-rail" aria-label="A2A protocol trace">
      <div className="demo-rail__head">
        <span className="instrument-label">A2A / trace</span>
        <strong>message.send</strong>
      </div>
      <ol>
        {steps.map(([stepPhase, label], index) => {
          const status = index < active ? "done" : index === active ? "active" : "waiting";
          return (
            <li className={`demo-rail__step demo-rail__step--${status}`} key={stepPhase}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
