import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { RazorpayCheckout } from "../../src/features/demo/RazorpayCheckout";

it("labels and completes the local simulated gateway", async () => {
  const user = userEvent.setup();
  const onVerified = vi.fn();
  render(
    <RazorpayCheckout
      checkout={{
        orderId: "order_sim_quote_demo_v2",
        keyId: "rzp_test_simulated",
        amount: 1_960_000,
        currency: "INR",
        simulated: true
      }}
      onVerified={onVerified}
    />
  );

  expect(screen.getByText("Simulated payment gateway")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: /complete simulated payment/i })
  );
  expect(onVerified).toHaveBeenCalledWith({
    orderId: "order_sim_quote_demo_v2",
    paymentId: "pay_simulated"
  });
});

it("offers recovery after dismissal without claiming payment or creating another order", async () => {
  let options: Record<string, unknown> = {};
  const close = vi.fn();
  window.Razorpay = class {
    constructor(input: Record<string, unknown>) { options = input; }
    open() {}
    close = close;
    on() {}
  };
  const onVerified = vi.fn();
  const onResume = vi.fn();
  const view = render(<RazorpayCheckout checkout={{ orderId: "order_existing", keyId: "rzp_test", amount: 400_000, currency: "INR", simulated: false }} onVerified={onVerified} onResume={onResume} />);
  await screen.findByText("Complete your payment in Razorpay");
  const { act } = await import("@testing-library/react");
  act(() => (options.modal as { ondismiss(): void }).ondismiss());
  expect(screen.getByText("Checkout closed. Your order is saved.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Resume payment" }));
  expect(onResume).toHaveBeenCalledOnce();
  expect(onVerified).not.toHaveBeenCalled();
  expect(options.order_id).toBe("order_existing");
  view.unmount();
  expect(close).toHaveBeenCalledOnce();
  delete window.Razorpay;
});
