import { BrandMark } from "../../components/BrandMark";
import { ProtocolLine, type ProtocolStep } from "../../components/ProtocolLine";
import { Status } from "../../components/Status";
import { HandshakeHero } from "./HandshakeHero";
import { ValueSequence } from "./ValueSequence";

const protocolSteps: ProtocolStep[] = [
  {
    id: "A2A",
    title: "Agent discovery",
    description: "A public Agent Card declares one real booking skill."
  },
  {
    id: "MCP",
    title: "Tool parity",
    description: "WebMCP calls the same booking handlers as A2A."
  },
  {
    id: "POLICY",
    title: "Bounded decisions",
    description: "AI recommends. Deterministic code owns price and rules."
  },
  {
    id: "HUMAN",
    title: "Two consent gates",
    description: "Itinerary and payment receive separate approval."
  },
  {
    id: "PAY",
    title: "Verified checkout",
    description: "Razorpay test mode opens only after a user action."
  }
];

const architecture = [
  ["EDGE / ROUTER", "Workers", "Serves the interface and every booking protocol from one origin."],
  ["AI / ADVISORY", "Workers AI", "Structures intent and explains eligible add-ons without setting prices."],
  ["SQL / EVIDENCE", "D1", "Stores inventory, tasks, versioned quotes, approvals and the audit trail."],
  ["STATE / CAPACITY", "Durable Objects", "Serializes last-seat holds so two agents cannot claim the same capacity."]
];

function ArrowIcon() {
  return (
    <svg className="button__arrow" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <BrandMark />
          <nav className="site-header__nav" aria-label="Landing page sections">
            <a href="#protocol">Protocol</a>
            <a href="#decision-path">Decision path</a>
            <a href="#architecture">Architecture</a>
          </nav>
          <div className="site-header__status">
            <Status tone="human">Human control: on</Status>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="landing-hero__eyebrow">Merchant agent adapter / Manali pilot</p>
            <h1>
              Make every adventure bookable by an agent, without losing human control<span aria-hidden="true">.</span>
            </h1>
            <p className="landing-hero__support">
              An A2A merchant adapter for Manali trek bookings. Agents can discover,
              compare and prepare checkout. People approve every hold and payment.
            </p>
            <div className="landing-hero__actions">
              <a className="button button--primary" href="/demo">
                Run the live demo <ArrowIcon />
              </a>
              <a className="button" href="/.well-known/agent-card.json">
                Inspect the Agent Card
              </a>
            </div>
            <ul className="landing-hero__proof" aria-label="Integrated protocols and infrastructure">
              <li>A2A v1.0</li>
              <li>WebMCP</li>
              <li>Razorpay test mode</li>
              <li>Cloudflare</li>
            </ul>
          </div>
          <HandshakeHero />
        </section>

        <section className="evidence-section" id="protocol">
          <div className="section-inner">
            <h2 className="section-heading">One bounded engine. Three open surfaces.</h2>
            <p className="section-intro">
              A2A, WebMCP and the human interface share one policy layer. The route is
              open to agents. Consequential actions stay closed until a person approves.
            </p>
            <ProtocolLine steps={protocolSteps} />
          </div>
        </section>

        <section className="evidence-section" id="decision-path">
          <div className="section-inner">
            <h2 className="section-heading">Growth with a visible boundary.</h2>
            <p className="section-intro">
              T-Bud lifts booking value with relevant pickup and meal add-ons while a
              deterministic budget guard protects the travellers' hard limit.
            </p>
            <ValueSequence />
          </div>
        </section>

        <section className="evidence-section">
          <div className="section-inner">
            <h2 className="section-heading">Failure changes the route, never the consent.</h2>
            <div className="recovery-route">
              <article className="recovery-row">
                <span className="recovery-row__index">R-01</span>
                <h3>Budget conflict</h3>
                <p>The policy returns the exact ₹800 overage and proposes the smallest eligible change. The person decides whether to accept it.</p>
              </article>
              <article className="recovery-row">
                <span className="recovery-row__index">R-02</span>
                <h3>Last seats gone</h3>
                <p>The hold fails atomically. T-Bud proposes the nearest comparable departure and invalidates the earlier itinerary approval.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="architecture-band" id="architecture">
          <div className="section-inner">
            <h2 className="section-heading">Cloudflare owns the fast path and the hard state.</h2>
            <p className="section-intro">
              Each service has one concrete responsibility. AI remains advisory. Money,
              capacity and approval stay authoritative.
            </p>
            <div className="architecture-grid">
              {architecture.map(([binding, title, copy]) => (
                <article className="architecture-cell" key={title}>
                  <span className="architecture-cell__binding">{binding}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="evidence-section">
          <div className="section-inner closing-action">
            <div>
              <h2 className="section-heading">Watch the handshake stop for a human.</h2>
              <div className="closing-action__actions">
                <a className="button button--primary" href="/demo">
                  Run the live demo <ArrowIcon />
                </a>
                <a className="button" href="/.well-known/agent-card.json">
                  Inspect the Agent Card
                </a>
              </div>
            </div>
            <p className="closing-action__note">
              Demo scenario: four friends · Manali · 2 days / 1 night · ₹20,000 total budget · pickup and upgraded meals
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
