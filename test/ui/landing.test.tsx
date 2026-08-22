import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "../../src/features/landing/LandingPage";

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

it("leads with human-controlled agentic booking", () => {
  renderLanding();

  expect(
    screen.getByRole("heading", {
      name: /your agent can plan the trek/i
    })
  ).toBeVisible();
  for (const link of screen.getAllByRole("link", { name: "Start a live quote" })) {
    expect(link).toHaveAttribute("href", "/book");
  }
  for (const link of screen.getAllByRole("link", {
    name: "Inspect Agent Card"
  })) {
    expect(link).toHaveAttribute("href", "/.well-known/agent-card.json");
  }
});

it("shows the merchant-backed value build-up", () => {
  renderLanding();

  expect(screen.getByText("₹16,000")).toBeVisible();
  expect(screen.getByText("+₹3,600")).toBeVisible();
  expect(screen.getByText("₹19,600")).toBeVisible();
  expect(screen.getByText(/live eligible quote/i)).toBeVisible();
});

it("makes the human stop visible inside the agent handshake", () => {
  renderLanding();

  expect(screen.getByText("Awaiting the group")).toBeVisible();
  expect(screen.getByText("Human control: on")).toBeVisible();
});
