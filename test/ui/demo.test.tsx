import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DemoPage } from "../../src/features/demo/DemoPage";
import type { DemoApi } from "../../src/lib/api";

function api(overrides: Partial<DemoApi> = {}): DemoApi {
  return {
    approveItinerary: vi.fn().mockResolvedValue({
      approvedAt: "2026-08-21T10:00:00.000Z"
    }),
    requestHold: vi.fn().mockResolvedValue({
      holdId: "hold_demo",
      expiresAt: "2026-08-21T10:10:00.000Z"
    }),
    approvePayment: vi.fn().mockResolvedValue({
      approvedAt: "2026-08-21T10:01:00.000Z"
    }),
    createCheckout: vi.fn().mockResolvedValue({
      orderId: "order_sim_demo",
      keyId: "rzp_test_simulated",
      amount: 1_960_000,
      currency: "INR",
      simulated: true
    }),
    verifyPayment: vi.fn().mockResolvedValue({ verified: true }),
    simulatePayment: vi.fn().mockResolvedValue({ verified: true }),
    ...overrides
  };
}

describe("DemoPage", () => {
  it("does not expose hold controls before itinerary approval", () => {
    render(
      <MemoryRouter>
        <DemoPage initialPhase="quote_ready" api={api()} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /hold 4 seats/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve itinerary/i })).toBeEnabled();
  });

  it("advances only after the approval API succeeds", async () => {
    const user = userEvent.setup();
    const client = api();
    render(
      <MemoryRouter>
        <DemoPage initialPhase="quote_ready" api={client} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /approve itinerary/i }));

    await waitFor(() => expect(client.approveItinerary).toHaveBeenCalledWith("quote_demo_v2"));
    expect(await screen.findByRole("button", { name: /hold 4 seats/i })).toBeEnabled();
    expect(screen.getByText("Human approved itinerary")).toBeVisible();
  });

  it("keeps the human gate open when approval fails", async () => {
    const user = userEvent.setup();
    const client = api({
      approveItinerary: vi.fn().mockRejectedValue(new Error("Approval could not be verified"))
    });
    render(
      <MemoryRouter>
        <DemoPage initialPhase="quote_ready" api={client} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /approve itinerary/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Approval could not be verified");
    expect(screen.getByRole("button", { name: /approve itinerary/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /hold 4 seats/i })).not.toBeInTheDocument();
  });

  it("shows the four-friend budget correction before itinerary approval", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DemoPage initialPhase="budget_conflict" api={api()} />
      </MemoryRouter>
    );

    expect(screen.getByText("₹20,800")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /review ₹19,600 bundle/i }));
    expect(screen.getByRole("button", { name: /approve itinerary/i })).toBeEnabled();
  });

  it("keeps checkout behind a separate payment approval", async () => {
    const user = userEvent.setup();
    const client = api();
    render(
      <MemoryRouter>
        <DemoPage initialPhase="held" api={client} />
      </MemoryRouter>
    );

    expect(
      screen.queryByRole("button", { name: /open razorpay test checkout/i })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /approve payment of ₹19,600/i })
    );
    await user.click(
      await screen.findByRole("button", { name: /open razorpay test checkout/i })
    );

    expect(await screen.findByText("Simulated payment gateway")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /complete simulated payment/i })
    );
    await waitFor(() => {
      expect(client.simulatePayment).toHaveBeenCalledWith("order_sim_demo");
    });
    expect(await screen.findByText("Booking verified")).toBeVisible();
  });
});
