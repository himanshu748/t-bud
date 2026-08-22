import { expect, test } from "@playwright/test";

test("a live over-budget quote stops before approval", async ({ page }) => {
  await page.goto("/book");
  const budget = page.getByRole("spinbutton", { name: "Budget ceiling" });
  await budget.fill("19000");
  await page.getByRole("button", { name: "Check live inventory" }).click();

  await expect(page.getByRole("heading", { name: "Budget conflict" })).toBeVisible();
  await expect(page.getByText("₹600 over the hard ceiling")).toBeVisible();
  await expect(page.getByRole("button", { name: /approve exact itinerary/i })).toHaveCount(0);

  await budget.fill("20000");
  await page.getByRole("button", { name: "Check live inventory" }).click();
  await expect(page.getByRole("button", { name: "Approve exact itinerary" })).toBeVisible();
});
