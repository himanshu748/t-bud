import { Status } from "../../components/Status";

export function HandshakeHero() {
  return (
    <div className="handshake" aria-label="Buyer and merchant agent handshake preview">
      <svg
        className="handshake__terrain"
        viewBox="0 0 800 520"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M-30 360 C120 260 230 470 380 340 S650 220 830 330" fill="none" stroke="currentColor" />
        <path d="M-40 390 C120 290 220 500 390 370 S660 250 840 360" fill="none" stroke="currentColor" />
        <path d="M-30 420 C130 320 230 520 400 400 S660 285 840 390" fill="none" stroke="currentColor" />
      </svg>

      <section className="handshake__panel handshake__panel--buyer">
        <div>
          <p className="instrument-label">Buyer agent</p>
          <div className="handshake__agent">TrailMate</div>
        </div>
        <div className="handshake__request">
          <strong>2-day Manali trek · 4 friends · under ₹20,000</strong>
          <span>Occasional hikers · pickup + upgraded meals</span>
        </div>
        <Status tone="protocol">Intent structured</Status>
      </section>

      <div className="handshake__rail" aria-label="A2A protocol exchange">
        <p className="instrument-label">A2A v1 / SendMessage</p>
        <span className="handshake__rail-line" aria-hidden="true" />
        <span className="handshake__rail-node" aria-hidden="true" />
        <span className="handshake__pulse" aria-hidden="true" />
      </div>

      <section className="handshake__panel handshake__panel--merchant">
        <div>
          <p className="instrument-label">Merchant agent</p>
          <div className="handshake__agent">T-Bud</div>
        </div>
        <div className="handshake__evidence">
          <strong>Final bundle ₹19,600</strong>
          <span>Pickup + upgraded meals · 4 seats checked</span>
          <ul className="handshake__checks">
            <li>Budget policy passed</li>
            <li>Price from merchant catalog</li>
            <li>No hold created yet</li>
          </ul>
        </div>
        <Status tone="success">Quote ready</Status>
      </section>

      <div className="handshake__gate">
        <span className="handshake__gate-mark" aria-hidden="true">H1</span>
        <div className="handshake__gate-copy">
          <strong>Awaiting human approval</strong>
          <span>Exact itinerary, total and expiry must be approved</span>
        </div>
        <span className="handshake__gate-state">Agent paused</span>
      </div>
    </div>
  );
}
