import { useEffect, useReducer, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { Status } from "../../components/Status";
import { demoApi, type DemoApi } from "../../lib/api";
import { ApprovalDock } from "./ApprovalDock";
import { BuyerPanel } from "./BuyerPanel";
import { DecisionLedger } from "./DecisionLedger";
import { demoReducer, createInitialDemoState, type DemoPhase } from "./demoReducer";
import { MerchantPanel } from "./MerchantPanel";
import { ProtocolRail } from "./ProtocolRail";

export interface DemoPageProps {
  initialPhase?: DemoPhase;
  api?: DemoApi;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "T-Bud could not complete that action";
}

export function DemoPage({ initialPhase = "idle", api = demoApi }: DemoPageProps) {
  const [state, dispatch] = useReducer(demoReducer, initialPhase, createInitialDemoState);
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function startScenario() {
    dispatch({ type: "SCENARIO_STARTED" });
    timers.current.push(
      window.setTimeout(() => dispatch({ type: "SEARCH_STARTED" }), 520),
      window.setTimeout(
        () => dispatch({ type: "PREMIUM_QUOTE_RECEIVED", total: 2_080_000 }),
        1_180
      )
    );
  }

  async function runVerified(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      dispatch({ type: "REQUEST_FAILED", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function approveItinerary() {
    void runVerified(async () => {
      const result = await api.approveItinerary(state.quote.id);
      dispatch({ type: "ITINERARY_APPROVED", approvedAt: result.approvedAt });
    });
  }

  function requestHold() {
    void runVerified(async () => {
      const result = await api.requestHold(state.quote.id);
      dispatch({ type: "HOLD_CONFIRMED", holdId: result.holdId, expiresAt: result.expiresAt });
    });
  }

  function approvePayment() {
    if (!state.hold) return;
    void runVerified(async () => {
      const result = await api.approvePayment(state.hold!.id);
      dispatch({ type: "PAYMENT_APPROVED", approvedAt: result.approvedAt });
    });
  }

  function reset() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    dispatch({ type: "RESET" });
  }

  return (
    <div className="demo-shell">
      <header className="demo-header">
        <BrandMark />
        <div className="demo-header__context">
          <span className="demo-header__label">Agent Handshake / Manali pilot</span>
          <Status tone="human">Human control: on</Status>
        </div>
        <nav aria-label="Demo navigation">
          <Link to="/">Landing</Link>
          <Link to="/merchant">Merchant view</Link>
        </nav>
      </header>

      <main className="demo-main">
        <div className="demo-intro">
          <div>
            <span className="instrument-label">Live bounded-commerce scenario</span>
            <h1>Four friends. One hard budget. Two human gates.</h1>
          </div>
          <p>Watch buyer and merchant agents prepare a Manali trek. They can recommend and recover, but they cannot hold seats or open payment without you.</p>
        </div>

        <div className="demo-workspace">
          <ApprovalDock
            state={state}
            busy={busy}
            onStart={startScenario}
            onReviewRevision={() => dispatch({ type: "REVISION_ACCEPTED" })}
            onApproveItinerary={approveItinerary}
            onRequestHold={requestHold}
            onApprovePayment={approvePayment}
            onOpenCheckout={() => dispatch({ type: "CHECKOUT_OPENED" })}
            onReset={reset}
          />
          <BuyerPanel state={state} />
          <ProtocolRail phase={state.phase} />
          <MerchantPanel state={state} />
        </div>

        <DecisionLedger state={state} />
      </main>
    </div>
  );
}
