import { useEffect, useRef, useState } from "react";
import { formatInr } from "../../lib/format";
import type { CheckoutDetails } from "./demoReducer";

interface RazorpayCheckoutProps {
  checkout: CheckoutDetails;
  onVerified(input: { orderId: string; paymentId: string; signature?: string }): void;
}

interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", callback: () => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Checkout could not load")), {
        once: true
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Checkout could not load")), {
      once: true
    });
    document.head.appendChild(script);
  });
}

export function RazorpayCheckout({ checkout, onVerified }: RazorpayCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (checkout.simulated) return;
    let active = true;
    void loadCheckoutScript()
      .then(() => {
        if (!active || !window.Razorpay) return;
        const instance = new window.Razorpay({
          key: checkout.keyId,
          order_id: checkout.orderId,
          amount: checkout.amount,
          currency: checkout.currency,
          name: "T-Bud",
          description: "Manali trek booking",
          handler: (result: RazorpayResult) =>
            onVerifiedRef.current({
              orderId: result.razorpay_order_id,
              paymentId: result.razorpay_payment_id,
              signature: result.razorpay_signature
            }),
          modal: { confirm_close: true }
        });
        instance.on("payment.failed", () => setError("Payment failed safely. Your hold is still active."));
        instance.open();
      })
      .catch(() => {
        if (active) setError("Razorpay Checkout could not load. Try again while the hold is active.");
      });
    return () => {
      active = false;
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
      <strong>Opening secure checkout…</strong>
      {error ? <p role="alert">{error}</p> : <p>Order {checkout.orderId} is ready.</p>}
    </section>
  );
}
