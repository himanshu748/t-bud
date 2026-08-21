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
