import { expect, test } from "@playwright/test";

test("quote, hold and payment each require a separate human action", async ({ page }) => {
  await page.goto("/book");
  await page.getByRole("button", { name: "Check live inventory" }).click();

  await expect(page.getByRole("heading", { name: "Quote ready for approval" })).toBeVisible();
  await expect(page.getByText("D1 receipt verified")).toBeVisible();
  await expect(page.getByText("12 / 12 seats free")).toBeVisible();
  await expect(page.getByText("Live catalog quote created")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve exact itinerary" })).toBeVisible();
  await expect(page.getByRole("button", { name: /hold 4 seats/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Approve exact itinerary" }).click();
  await expect(page.getByText("Itinerary approval recorded")).toBeVisible();
  await expect(page.getByRole("button", { name: /authorize payment/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Hold 4 seats for 10 minutes" }).click();
  await expect(
    page.getByRole("heading", { name: "Seats held, awaiting payment approval" })
  ).toBeVisible();
  await expect(page.getByText("8 / 12 seats free")).toBeVisible();
  await expect(page.getByText("Atomic seat hold committed")).toBeVisible();
  await expect(page.getByText("Not created")).toBeVisible();

  await page.getByRole("button", { name: "Authorize payment with Razorpay" }).click();
  await expect(page.getByText("Payment approval recorded")).toBeVisible();
  await expect(page.getByText("Razorpay order created")).toBeVisible();

  await page.getByRole("button", { name: "Complete simulated payment" }).click();
  await expect(page.getByRole("heading", { name: "Payment verified" })).toBeVisible();
  await expect(page.getByText("Razorpay signature verified")).toBeVisible();
  await expect(page.getByRole("button", { name: /authorize payment/i })).toHaveCount(0);
});
