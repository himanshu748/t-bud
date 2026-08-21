import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { MerchantPage } from "../../src/features/merchant/MerchantPage";

it("shows the merchant's actual agent surfaces and inventory", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          agentCard: {
            protocolVersion: "1.0",
            skills: [{ id: "book_manali_trek", name: "Book Manali trek" }]
          },
          webmcpTools: [
            "search_treks",
            "get_availability",
            "quote_bundle",
            "request_hold",
            "create_checkout"
          ],
          departures: [
            {
              id: "dep_hampta_2026_09_12",
              trekName: "Hampta Pass Intro Trek",
              startAt: "2026-09-12T06:30:00.000Z",
              capacity: 4,
              available: 4,
              status: "active"
            }
          ],
          tasks: [],
          holds: [],
          audit: []
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )
  );

  render(
    <MemoryRouter>
      <MerchantPage />
    </MemoryRouter>
  );

  expect(await screen.findByText("book_manali_trek")).toBeVisible();
  expect(screen.getByText("search_treks")).toBeVisible();
  expect(screen.getByText("4 seats available")).toBeVisible();
  expect(screen.getByText("A2A v1.0")).toBeVisible();
});
