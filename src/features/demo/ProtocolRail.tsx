import type { DemoPhase } from "./demoReducer";

const steps = [
  ["request", "booking intent"],
  ["quote", "quote_bundle"],
  ["policy", "budget policy"],
  ["approval", "human gate H1"],
  ["hold", "human gate H2"],
  ["reserved", "hold active"],
  ["payment", "human gate H3"],
  ["verified", "razorpay verified"]
] as const;

function phaseRank(phase: DemoPhase): number {
  const map: Record<DemoPhase, number> = {
    idle: -1,
    quoting: 0,
    budget_conflict: 2,
    quote_ready: 3,
    itinerary_approved: 4,
    held: 5,
    payment_approved: 6,
    paid: 7,
    failed: 0
  };
  return map[phase];
}

export function ProtocolRail({ phase }: { phase: DemoPhase }) {
  const active = phaseRank(phase);
  return (
    <aside className="demo-rail" aria-label="Booking control trace">
      <div className="demo-rail__head">
        <span className="instrument-label">Server / control trace</span>
        <strong>quote_bundle</strong>
      </div>
      <ol>
        {steps.map(([stepId, label], index) => {
          const status = index < active ? "done" : index === active ? "active" : "waiting";
          return (
            <li className={`demo-rail__step demo-rail__step--${status}`} key={stepId}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
