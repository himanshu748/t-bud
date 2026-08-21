import { expect, test } from "@playwright/test";

test("budget overflow and last-seat sellout both stop at review", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Send booking intent" }).click();

  await expect(page.getByText("Premium bundle exceeds budget")).toBeVisible();
  await expect(page.getByText("₹800 above the hard ceiling")).toBeVisible();
  await page.getByRole("button", { name: "Review ₹19,600 bundle" }).click();
  await page.getByRole("button", { name: "Approve itinerary" }).click();
  await page.getByRole("button", { name: "Simulate last-seat sellout" }).click();

  const merchantPanel = page.getByRole("region", { name: "T-Bud", exact: true });
  await expect(merchantPanel.getByText("Last seats sold out")).toBeVisible();
  await expect(merchantPanel.getByText(/original approval is invalid/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Hold 4 seats" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
});
