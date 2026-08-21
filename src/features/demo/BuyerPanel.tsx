import { formatInr } from "../../lib/format";
import type { DemoState } from "./demoReducer";

export function BuyerPanel({ state }: { state: DemoState }) {
  return (
    <section className="demo-panel demo-panel--buyer" aria-labelledby="buyer-panel-title">
      <div className="demo-panel__heading">
        <span className="instrument-label">01 / Buyer agent</span>
        <h2 id="buyer-panel-title">TrailMate</h2>
      </div>

      <div className="traveller-grid" aria-label="Four travellers">
        {[
          ["HJ", "Planner"],
          ["AK", "Occasional"],
          ["RS", "Occasional"],
          ["NM", "Occasional"]
        ].map(([initials, label], index) => (
          <div className="traveller" key={initials}>
            <span>{initials}</span>
            <small>{index === 0 ? label : `Friend ${index}`}</small>
          </div>
        ))}
      </div>

      <div className="buyer-intent">
        <span className="instrument-label">Structured intent</span>
        <h3>Manali trek for four friends</h3>
        <dl className="constraint-list">
          <div><dt>Duration</dt><dd>2 days / 1 night</dd></div>
          <div><dt>Experience</dt><dd>Occasional hikers</dd></div>
          <div><dt>Need</dt><dd>Pickup + upgraded meals</dd></div>
          <div><dt>Hard ceiling</dt><dd>{formatInr(state.quote.budget)}</dd></div>
        </dl>
      </div>

      <div className="buyer-boundary">
        <span>Agent may</span>
        <strong>Discover · compare · prepare</strong>
        <span>Agent may not</span>
        <strong>Hold · pay · change approval</strong>
      </div>
    </section>
  );
}
