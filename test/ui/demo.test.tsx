import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DemoPage } from "../../src/features/demo/DemoPage";
import {
  createInitialDemoState,
  type BookingQuote
} from "../../src/features/demo/demoReducer";
import type { BookingApi } from "../../src/lib/api";

const quote: BookingQuote = {
  id: "quote_live_v1",
  version: 1,
  total: 1_960_000,
  budget: 2_000_000,
  expiresAt: "2026-08-21T10:15:00.000Z",
  departureId: "dep_hampta_2026_09_12",
  items: [
    {
      id: "trek_hampta",
      kind: "trek",
      name: "Hampta Pass Intro Trek",
      quantity: 4,
      unitAmount: 400_000,
      amount: 1_600_000
    },
    {
      id: "pickup_manali",
      kind: "addon",
      name: "Manali pickup",
      quantity: 1,
      unitAmount: 200_000,
      amount: 200_000
    },
    {
      id: "meals_budget",
      kind: "addon",
      name: "Upgraded trail meals",
      quantity: 4,
      unitAmount: 40_000,
      amount: 160_000
    }
  ]
};

const receipt = {
  quote: {
    id: quote.id,
    taskId: "task_server_default",
    version: quote.version,
    total: quote.total,
    budget: quote.budget,
    expiresAt: quote.expiresAt,
    departureId: quote.departureId,
    partySize: 4,
    items: quote.items
  },
  task: { state: "quote_ready", updatedAt: "2026-08-21T10:00:00.000Z" },
  departure: {
    id: quote.departureId,
    startAt: "2026-09-12T06:30:00.000Z",
    capacity: 4,
    available: 4
  },
  approvals: { itinerary: null, hold: null, payment: null },
  order: null,
  hold: null,
  audit: [
    {
      id: "audit_quote_default",
      actor: "merchant_agent" as const,
      action: "quote.created",
      target: quote.id,
      result: "recorded",
      createdAt: "2026-08-21T10:00:01.000Z"
    }
  ],
  verifiedAt: "2026-08-21T10:00:02.000Z"
};

function api(overrides: Partial<BookingApi> = {}): BookingApi {
  return {
    createQuote: vi.fn().mockResolvedValue({
      quote,
      policy: { status: "eligible" },
      intentSource: "rules_fallback",
      recommendationSource: "rules_fallback"
    }),
    approveItinerary: vi.fn().mockResolvedValue({
      approvedAt: "2026-08-21T10:00:00.000Z"
    }),
    approveHold: vi.fn().mockResolvedValue({
      approvedAt: "2026-08-21T10:01:00.000Z"
    }),
    requestHold: vi.fn().mockResolvedValue({
      holdId: "hold_live",
      expiresAt: "2026-08-21T10:10:00.000Z"
    }),
    approvePayment: vi.fn().mockResolvedValue({
      approvedAt: "2026-08-21T10:02:00.000Z"
    }),
    createCheckout: vi.fn().mockResolvedValue({
      orderId: "order_sim_test",
      keyId: "rzp_test_simulated",
      amount: quote.total,
      currency: "INR",
      simulated: true
    }),
    verifyPayment: vi.fn().mockResolvedValue({ verified: true }),
    getReceipt: vi.fn().mockResolvedValue(receipt),
    ...overrides
  };
}

describe("live booking page", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("does not expose hold controls before itinerary approval", () => {
    render(
      <MemoryRouter>
        <DemoPage initialPhase="quote_ready" api={api()} />
      </MemoryRouter>
    );

    expect(
      screen.queryByRole("button", { name: /hold 4 seats/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /approve exact itinerary/i })
    ).toBeEnabled();
  });

  it("creates a quote through the booking API from editable inputs", async () => {
    const user = userEvent.setup();
    const client = api();
    render(
      <MemoryRouter>
        <DemoPage api={client} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: /group size/i }), {
      target: { value: "3" }
    });
    await user.click(screen.getByRole("button", { name: /check live inventory/i }));

    await waitFor(() => expect(client.createQuote).toHaveBeenCalledOnce());
    expect(client.createQuote).toHaveBeenCalledWith(
      expect.stringContaining("for 3 people")
    );
    expect(await screen.findByText("Live catalog quote created")).toBeVisible();
  });

  it("replaces browser-authored proof with the live D1 booking receipt", async () => {
    const user = userEvent.setup();
    const getReceipt = vi.fn().mockResolvedValue({
      quote: {
        id: quote.id,
        taskId: "task_server_72c1",
        version: 1,
        total: 1_960_000,
        budget: 2_000_000,
        expiresAt: "2026-08-21T10:15:00.000Z",
        departureId: quote.departureId,
        partySize: 4,
        items: quote.items
      },
      task: {
        state: "quote_ready",
        updatedAt: "2026-08-21T10:00:00.000Z"
      },
      departure: {
        id: "dep_hampta_2026_09_12",
        startAt: "2026-09-12T06:30:00.000Z",
        capacity: 4,
        available: 4
      },
      approvals: { itinerary: null, hold: null },
      hold: null,
      audit: [
        {
          id: "audit_request_1",
          actor: "buyer_agent",
          action: "request.received",
          target: "task_server_72c1",
          result: "accepted",
          createdAt: "2026-08-21T10:00:00.000Z"
        },
        {
          id: "audit_quote_1",
          actor: "merchant_agent",
          action: "quote.created",
          target: quote.id,
          result: "recorded",
          createdAt: "2026-08-21T10:00:01.000Z"
        }
      ],
      verifiedAt: "2026-08-21T10:00:02.000Z"
    });
    const client = Object.assign(api(), { getReceipt });
    render(
      <MemoryRouter>
        <DemoPage api={client} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /check live inventory/i }));

    await waitFor(() => expect(getReceipt).toHaveBeenCalledWith(quote.id));
    expect(await screen.findByText("D1 receipt verified")).toBeVisible();
    expect(screen.getByText("12 Sep 2026")).toBeVisible();
    expect(screen.getByText("4 / 4 seats free")).toBeVisible();
    expect(screen.getByText("task_server_72c1")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh D1 receipt" }));
    await waitFor(() => expect(getReceipt).toHaveBeenCalledTimes(2));
  });

  it("restores an active booking and refreshes its D1 receipt after reload", async () => {
    const saved = createInitialDemoState("held");
    window.sessionStorage.setItem("tbud.active-booking", JSON.stringify(saved));
    const client = api();

    render(
      <MemoryRouter>
        <DemoPage api={client} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Seats held, awaiting payment approval" })
    ).toBeVisible();
    await waitFor(() => expect(client.getReceipt).toHaveBeenCalledWith(quote.id));
  });

  it("restores a server booking from a receipt deep link", async () => {
    window.history.replaceState(null, "", `/book?quoteId=${quote.id}`);
    const client = api();

    render(
      <MemoryRouter>
        <DemoPage api={client} />
      </MemoryRouter>
    );

    await waitFor(() => expect(client.getReceipt).toHaveBeenCalledWith(quote.id));
    expect(
      await screen.findByRole("heading", { name: "Quote ready for approval" })
    ).toBeVisible();
    expect(screen.getByText("D1 receipt verified")).toBeVisible();
  });

  it("advances only after the approval API succeeds", async () => {
    const user = userEvent.setup();
    const client = api();
    render(
      <MemoryRouter>
        <DemoPage initialPhase="quote_ready" api={client} />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: /approve exact itinerary/i })
    );

    await waitFor(() =>
      expect(client.approveItinerary).toHaveBeenCalledWith("quote_live_v1")
    );
    expect(
      await screen.findByRole("button", { name: /hold 4 seats for 10 minutes/i })
    ).toBeEnabled();
  });

  it("keeps the human gate open when approval fails", async () => {
    const user = userEvent.setup();
    const client = api({
      approveItinerary: vi
        .fn()
        .mockRejectedValue(new Error("Approval could not be verified"))
    });
    render(
      <MemoryRouter>
        <DemoPage initialPhase="quote_ready" api={client} />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: /approve exact itinerary/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approval could not be verified"
    );
    expect(
      screen.getByRole("button", { name: /approve exact itinerary/i })
    ).toBeEnabled();
  });

  it("holds seats without creating a Razorpay order until a human authorizes it", async () => {
    const user = userEvent.setup();
    const client = api();
    render(
      <MemoryRouter>
        <DemoPage initialPhase="itinerary_approved" api={client} />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: /hold 4 seats for 10 minutes/i })
    );

    await waitFor(() =>
      expect(client.approveHold).toHaveBeenCalledWith("quote_live_v1")
    );
    await waitFor(() =>
      expect(client.requestHold).toHaveBeenCalledWith("quote_live_v1")
    );
    expect(
      await screen.findByRole("heading", { name: "Seats held, awaiting payment approval" })
    ).toBeVisible();
    expect(client.approvePayment).not.toHaveBeenCalled();
    expect(client.createCheckout).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /authorize payment with razorpay/i })
    );

    await waitFor(() =>
      expect(client.approvePayment).toHaveBeenCalledWith("quote_live_v1")
    );
    await waitFor(() =>
      expect(client.createCheckout).toHaveBeenCalledWith("quote_live_v1")
    );

    await user.click(
      await screen.findByRole("button", { name: /complete simulated payment/i })
    );

    await waitFor(() =>
      expect(client.verifyPayment).toHaveBeenCalledWith({
        orderId: "order_sim_test",
        paymentId: "pay_simulated"
      })
    );
    expect(
      await screen.findByRole("heading", { name: "Payment verified" })
    ).toBeVisible();
  });
});
