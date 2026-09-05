import { useEffect, useRef, useState } from "react";
import { formatInr } from "../../lib/format";
import type { CheckoutDetails } from "./demoReducer";

interface RazorpayCheckoutProps {
  checkout: CheckoutDetails;
  busy?: boolean;
  onResume?(): void;
  onVerified(input: { orderId: string; paymentId: string; signature?: string }): void;
}

interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: "payment.failed", callback: () => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let checkoutScript: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScript) return checkoutScript;
  checkoutScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Checkout could not load"));
    };
    const timeout = window.setTimeout(fail, 15_000);
    script.addEventListener("load", () => {
      if (!window.Razorpay) { fail(); return; }
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  }).catch((error: unknown) => { checkoutScript = null; throw error; });
  return checkoutScript;
}

export function RazorpayCheckout({ checkout, onVerified, onResume, busy = false }: RazorpayCheckoutProps) {
  const [status, setStatus] = useState<"loading" | "open" | "closed" | "verifying" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (checkout.simulated) return;
    let active = true;
    let instance: RazorpayInstance | undefined;
    setStatus("loading");
    setError(null);
    void loadCheckoutScript()
      .then(() => {
        if (!active || !window.Razorpay) return;
        instance = new window.Razorpay({
          key: checkout.keyId,
          order_id: checkout.orderId,
          amount: checkout.amount,
          currency: checkout.currency,
          name: "T-Bud",
          description: "Manali trek booking",
          handler: (result: RazorpayResult) => {
            if (!active) return;
            setStatus("verifying");
            onVerifiedRef.current({
              orderId: result.razorpay_order_id,
              paymentId: result.razorpay_payment_id,
              signature: result.razorpay_signature
            });
          },
          modal: { confirm_close: true, ondismiss: () => {
            if (active) setStatus((current) => current === "verifying" ? current : "closed");
          } }
        });
        instance.on("payment.failed", () => {
          if (active) setError("The payment attempt failed. You can retry while the seat hold is active.");
        });
        setStatus("open");
        instance.open();
      })
      .catch(() => {
        if (active) {
          setStatus("error");
          setError("Razorpay Checkout could not load. Check your connection and resume payment.");
        }
      });
    return () => {
      active = false;
      instance?.close();
    };
  }, [checkout]);

  if (checkout.simulated) {
    return (
      <section className="checkout-simulator" aria-label="Simulated Razorpay checkout">
        <span className="instrument-label">Simulated payment gateway</span>
        <strong>{formatInr(checkout.amount)} · Razorpay test flow</strong>
        <p>No real payment is collected. Complete the signed local proof to finish the demo.</p>
        <button
          className="button button--primary"
          type="button"
          onClick={() =>
            onVerifiedRef.current({
              orderId: checkout.orderId,
              paymentId: "pay_simulated"
            })
          }
        >
          Complete simulated payment
        </button>
      </section>
    );
  }

  return (
    <section className="checkout-simulator" aria-live="polite">
      <span className="instrument-label">Razorpay test mode</span>
      <strong>{status === "loading" ? "Opening secure checkout…"
        : status === "closed" ? "Checkout closed. Your order is saved."
        : status === "verifying" ? "Checking payment confirmation…"
        : status === "error" ? "Checkout could not open"
        : "Complete your payment in Razorpay"}</strong>
      {error ? <p role="alert">{error}</p> : <p>Order {checkout.orderId}. Confirmation is checked with the server.</p>}
      {(status === "closed" || status === "error") && onResume ? (
        <button className="button button--primary" type="button" onClick={onResume} disabled={busy}>
          {busy ? "Checking your order…" : "Resume payment"}
        </button>
      ) : null}
    </section>
  );
}
