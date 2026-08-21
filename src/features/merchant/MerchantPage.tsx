import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { Status } from "../../components/Status";

interface MerchantOverview {
  agentCard: {
    protocolVersion: string;
    skills: Array<{ id: string; name: string }>;
  };
  webmcpTools: string[];
  departures: Array<{
    id: string;
    trekName: string;
    startAt: string;
    capacity: number;
    available: number;
    status: string;
  }>;
  tasks: Array<{ id: string; state: string; updatedAt: string }>;
  holds: Array<{
    id: string;
    partySize: number;
    expiresAt: string;
    status: string;
  }>;
  audit: Array<{
    id: string;
    actor: string;
    action: string;
    result: string;
    createdAt: string;
  }>;
}

function shortTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function MerchantPage() {
  const [overview, setOverview] = useState<MerchantOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/merchant/overview", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Merchant telemetry is unavailable");
        return response.json() as Promise<MerchantOverview>;
      })
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Merchant telemetry is unavailable"
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="merchant-shell">
      <header className="demo-header merchant-header">
        <BrandMark />
        <div className="demo-header__context">
          <span className="demo-header__label">Merchant field console</span>
          <Status tone="success">System bounded</Status>
        </div>
        <nav aria-label="Merchant navigation">
          <Link to="/">Landing</Link>
          <Link to="/demo">Live demo</Link>
        </nav>
      </header>

      <main className="merchant-main">
        <section className="merchant-intro">
          <div>
            <span className="instrument-label">Merchant-side evidence</span>
            <h1>The booking agent, with its hands visible.</h1>
          </div>
          <p>
            Inspect public protocol surfaces, departure capacity and every consequential
            action. Discovery can run alone. Holds and money cannot.
          </p>
        </section>

        {error ? <p className="merchant-error" role="alert">{error}</p> : null}
        {!overview && !error ? <p className="merchant-loading">Reading the field ledger…</p> : null}

        {overview ? (
          <div className="merchant-board">
            <section className="merchant-module merchant-module--protocol">
              <div className="merchant-module__heading">
                <span className="module-index">01</span>
                <div>
                  <span className="instrument-label">Agent surface</span>
                  <h2>A2A v{overview.agentCard.protocolVersion}</h2>
                </div>
              </div>
              <div className="merchant-skills">
                {overview.agentCard.skills.map((skill) => (
                  <div key={skill.id}>
                    <code>{skill.id}</code>
                    <span>{skill.name}</span>
                  </div>
                ))}
              </div>
              <div className="merchant-tools" aria-label="WebMCP tools">
                <span className="instrument-label">WebMCP registration set</span>
                {overview.webmcpTools.map((tool) => <code key={tool}>{tool}</code>)}
              </div>
            </section>

            <section className="merchant-module merchant-module--inventory">
              <div className="merchant-module__heading">
                <span className="module-index">02</span>
                <div>
                  <span className="instrument-label">Durable capacity</span>
                  <h2>Departure board</h2>
                </div>
              </div>
              <div className="departure-list">
                {overview.departures.map((departure) => (
                  <article key={departure.id}>
                    <div>
                      <strong>{departure.trekName}</strong>
                      <span>{shortTime(departure.startAt)} · {departure.id}</span>
                    </div>
                    <Status tone={departure.available > 0 ? "success" : "error"}>
                      {departure.available} seats available
                    </Status>
                  </article>
                ))}
              </div>
            </section>

            <section className="merchant-module merchant-module--operations">
              <div className="merchant-module__heading">
                <span className="module-index">03</span>
                <div>
                  <span className="instrument-label">Live operations</span>
                  <h2>Tasks and holds</h2>
                </div>
              </div>
              <div className="operation-columns">
                <div>
                  <h3>Recent tasks</h3>
                  {overview.tasks.length ? overview.tasks.map((task) => (
                    <p key={task.id}><code>{task.id.slice(0, 12)}</code><span>{task.state}</span></p>
                  )) : <p className="empty-reading">No incoming tasks</p>}
                </div>
                <div>
                  <h3>Active holds</h3>
                  {overview.holds.length ? overview.holds.map((hold) => (
                    <p key={hold.id}><code>{hold.id.slice(0, 12)}</code><span>{hold.partySize} seats · {hold.status}</span></p>
                  )) : <p className="empty-reading">No seats held</p>}
                </div>
              </div>
            </section>

            <section className="merchant-module merchant-module--ledger">
              <div className="merchant-module__heading">
                <span className="module-index">04</span>
                <div>
                  <span className="instrument-label">Append-only evidence</span>
                  <h2>Decision ledger</h2>
                </div>
              </div>
              <ol className="merchant-ledger">
                {overview.audit.length ? overview.audit.map((event) => (
                  <li key={event.id}>
                    <span>{event.actor}</span>
                    <strong>{event.action}</strong>
                    <small>{event.result} · {shortTime(event.createdAt)}</small>
                  </li>
                )) : <li className="empty-reading">No actions recorded yet</li>}
              </ol>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
