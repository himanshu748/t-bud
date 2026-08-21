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
      name: /make every adventure bookable by an agent/i
    })
  ).toBeVisible();
  for (const link of screen.getAllByRole("link", { name: "Run the live demo" })) {
    expect(link).toHaveAttribute("href", "/demo");
  }
  for (const link of screen.getAllByRole("link", {
    name: "Inspect the Agent Card"
  })) {
    expect(link).toHaveAttribute("href", "/.well-known/agent-card.json");
  }
});

it("shows the transparent value correction", () => {
  renderLanding();

  expect(screen.getByText("₹16,000")).toBeVisible();
  expect(screen.getByText("₹20,800")).toBeVisible();
  expect(screen.getByText("₹19,600")).toBeVisible();
  expect(screen.getByText(/premium bundle exceeds budget/i)).toBeVisible();
});

it("makes the human stop visible inside the agent handshake", () => {
  renderLanding();

  expect(screen.getByText("Awaiting human approval")).toBeVisible();
  expect(screen.getByText("Human control: on")).toBeVisible();
});
