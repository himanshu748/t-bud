import { formatInr } from "../../lib/format";
import type { BookingIntent, DemoState } from "./demoReducer";

interface BuyerPanelProps {
  state: DemoState;
  busy: boolean;
  onIntentChange(intent: BookingIntent): void;
}

export function BuyerPanel({ state, busy, onIntentChange }: BuyerPanelProps) {
  const editable = ["idle", "budget_conflict", "failed"].includes(state.phase);
  const update = (patch: Partial<BookingIntent>) =>
    onIntentChange({ ...state.intent, ...patch });

  return (
    <section
      className="demo-panel demo-panel--buyer"
      aria-labelledby="buyer-panel-title"
    >
      <div className="demo-panel__heading">
        <span className="instrument-label">01 / Traveller request</span>
        <h2 id="buyer-panel-title">Trip brief</h2>
      </div>

      <div className="traveller-grid" aria-label="Current request summary">
        {[
          [`${state.intent.partySize}`, "Seats"],
          ["MNL", "Manali"],
          ["2D", "1 night"],
          ["OC", "Occasional"]
        ].map(([value, label]) => (
          <div className="traveller" key={label}>
            <span>{value}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>

      <form className="booking-intent" aria-label="Trek requirements">
        <fieldset disabled={!editable || busy}>
          <legend className="instrument-label">Editable requirements</legend>
          <div className="booking-intent__fields">
            <label>
              <span>Group size</span>
              <input
                type="number"
                min="1"
                max="12"
                value={state.intent.partySize}
                onChange={(event) =>
                  update({
                    partySize: Math.min(
                      12,
                      Math.max(1, Number(event.currentTarget.value) || 1)
                    )
                  })
                }
              />
            </label>
            <label>
              <span>Budget ceiling</span>
              <span className="booking-intent__money">
                <b aria-hidden="true">₹</b>
                <input
                  type="number"
                  min="4000"
                  max="100000"
                  step="500"
                  value={state.intent.budgetRupees}
                  onChange={(event) =>
                    update({
                      budgetRupees: Math.min(
                        100_000,
                        Math.max(4_000, Number(event.currentTarget.value) || 4_000)
                      )
                    })
                  }
                />
              </span>
            </label>
          </div>
          <div className="booking-intent__addons" aria-label="Requested add-ons">
            <label>
              <input
                type="checkbox"
                checked={state.intent.pickup}
                onChange={(event) => update({ pickup: event.currentTarget.checked })}
              />
              <span>Manali pickup</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.intent.meals}
                onChange={(event) => update({ meals: event.currentTarget.checked })}
              />
              <span>Upgraded meals</span>
            </label>
          </div>
        </fieldset>
      </form>

      <div className="constraint-list" aria-label="Fixed catalog constraints">
        <div><span>Route</span><strong>Manali · Hampta introduction</strong></div>
        <div><span>Duration</span><strong>2 days / 1 night</strong></div>
        <div><span>Experience</span><strong>Occasional hikers</strong></div>
        <div><span>Hard ceiling</span><strong>{formatInr(state.intent.budgetRupees * 100)}</strong></div>
      </div>

      <div className="buyer-boundary">
        <span>Agent may</span>
        <strong>Discover · compare · prepare</strong>
        <span>Human only</span>
        <strong>Approve itinerary · place hold</strong>
        <span>Unavailable</span>
        <strong>Payment collection</strong>
      </div>
    </section>
  );
}
