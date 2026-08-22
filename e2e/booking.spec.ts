import { expect, test } from "@playwright/test";

test("live quote and seat hold require separate human actions", async ({ page }) => {
  await page.goto("/book");
  await page.getByRole("button", { name: "Check live inventory" }).click();

  await expect(page.getByRole("heading", { name: "Quote ready for approval" })).toBeVisible();
  await expect(page.getByText("D1 receipt verified")).toBeVisible();
  await expect(page.getByText("4 / 4 seats free")).toBeVisible();
  await expect(page.getByText("Live catalog quote created")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve exact itinerary" })).toBeVisible();
  await expect(page.getByRole("button", { name: /hold 4 seats/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve exact itinerary" }).click();
  await expect(page.getByText("Itinerary approval recorded")).toBeVisible();
  await expect(page.getByText("Awaiting human")).toHaveCount(1);
  await page.getByRole("button", { name: "Hold 4 seats for 10 minutes" }).click();
  await expect(page.getByRole("heading", { name: "Seats held, payment disabled" })).toBeVisible();
  await expect(page.getByText("0 / 4 seats free")).toBeVisible();
  await expect(page.getByText("Atomic seat hold committed")).toBeVisible();
  await expect(page.getByText("Awaiting human")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /pay|checkout/i })).toHaveCount(0);
});
