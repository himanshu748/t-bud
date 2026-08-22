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
    description: "Itinerary approval and seat-hold approval remain separate."
  },
  {
    id: "HOLD",
    title: "Temporary reservation",
    description: "Durable capacity is held for ten minutes. Payment stays off."
  }
];

const architecture = [
  ["EDGE / ROUTER", "Workers", "Serves the interface and every booking protocol from one origin."],
  ["AI / ADVISORY", "Workers AI", "Structures intent and explains eligible add-ons without setting prices."],
  ["SQL / EVIDENCE", "D1", "Stores inventory, tasks, versioned quotes, approvals and the audit trail."],
  ["STATE / CAPACITY", "Durable Objects", "Serializes last-seat holds so two agents cannot claim the same capacity."]
];

const proofPoints = [
  ["LIVE CATALOG", "D1 merchant inventory"],
  ["CAPACITY", "Durable Object holds"],
  ["OPEN SURFACES", "A2A + WebMCP"],
  ["PAYMENT", "Intentionally off"]
] as const;

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
            <a href="#protocol">How it works</a>
            <a href="#decision-path">Quote logic</a>
            <a href="#architecture">Cloudflare stack</a>
          </nav>
          <div className="site-header__status">
            <Status tone="human">Human control: on</Status>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero__masthead">
            <div className="landing-hero__copy">
              <p className="landing-hero__eyebrow">T-Bud / live Manali booking pilot</p>
              <h1>
                Your agent can plan the trek.
                <span> Only you can hold the seats.</span>
              </h1>
            </div>
            <div className="landing-hero__summary">
              <p>
                T-Bud turns one group brief into a live merchant quote across A2A and
                WebMCP. It pauses before the itinerary and again before the ten-minute
                seat hold. Payment collection stays off.
              </p>
              <div className="landing-hero__actions">
                <a className="button button--primary" href="/book">
                  Start a live quote <ArrowIcon />
                </a>
                <a className="button button--text" href="/.well-known/agent-card.json">
                  Inspect Agent Card
                </a>
              </div>
            </div>
          </div>

          <dl className="landing-hero__proof" aria-label="Live pilot infrastructure">
            {proofPoints.map(([term, detail]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>

          <HandshakeHero />
        </section>

        <section className="evidence-section" id="protocol">
          <div className="section-inner">
            <div className="section-lead">
              <div>
                <p className="section-kicker">01 / Authorization trail</p>
                <h2 className="section-heading">The agent moves. The authority does not.</h2>
              </div>
              <p className="section-intro">
                Discovery, quoting and policy checks move through one bounded engine.
                The two consequential actions remain closed until a person approves.
              </p>
            </div>
            <ProtocolLine steps={protocolSteps} />
          </div>
        </section>

        <section className="evidence-section evidence-section--value" id="decision-path">
          <div className="section-inner">
            <div className="section-lead section-lead--value">
              <div>
                <p className="section-kicker">02 / Quote logic</p>
                <h2 className="section-heading">A better bundle, inside the same hard limit.</h2>
              </div>
              <aside className="budget-guard" aria-label="Budget policy outcome">
                <span>Budget ceiling</span>
                <strong>₹20,000</strong>
                <p>₹400 remains after pickup and upgraded meals.</p>
              </aside>
            </div>
            <ValueSequence />
          </div>
        </section>

        <section className="evidence-section evidence-section--recovery">
          <div className="section-inner">
            <div className="section-lead">
              <div>
                <p className="section-kicker">03 / Safe failure</p>
                <h2 className="section-heading">Every failure returns control to the group.</h2>
              </div>
              <p className="section-intro">
                T-Bud stops when price or capacity changes. A fresh quote and fresh
                approval are required before the group can continue.
              </p>
            </div>
            <div className="recovery-route">
              <article className="recovery-row">
                <span className="recovery-row__index">R-01</span>
                <h3>Budget conflict</h3>
                <p>The policy returns the exact overage and stops the flow. The group can change its budget or add-ons, then request a fresh quote.</p>
              </article>
              <article className="recovery-row">
                <span className="recovery-row__index">R-02</span>
                <h3>Last seats gone</h3>
                <p>The hold fails atomically. No booking is created, and the group must prepare and approve a fresh quote.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="architecture-band" id="architecture">
          <div className="section-inner">
            <div className="section-lead">
              <div>
                <p className="section-kicker">04 / Cloudflare stack</p>
                <h2 className="section-heading">Open at the edge. Strict at the state.</h2>
              </div>
              <p className="section-intro">
                AI structures intent. Deterministic services own price, capacity and
                approval. Each responsibility stays inspectable from the same origin.
              </p>
            </div>
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

        <section className="closing-section">
          <div className="section-inner closing-action">
            <div>
              <p className="section-kicker">Live booking / no payment</p>
              <h2 className="section-heading">Give T-Bud the brief. Keep the last word.</h2>
              <div className="closing-action__actions">
                <a className="button button--primary" href="/book">
                  Start a live quote <ArrowIcon />
                </a>
                <a className="button button--text" href="/.well-known/agent-card.json">
                  Inspect Agent Card
                </a>
              </div>
            </div>
            <p className="closing-action__note">
              Set group size and budget. Query live merchant inventory. Approve the
              exact itinerary. Place a temporary hold. No payment order is created.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
