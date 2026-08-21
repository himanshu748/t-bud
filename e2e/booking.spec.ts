import { expect, test } from "@playwright/test";

test("human approves itinerary and payment separately", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Send booking intent" }).click();
  await expect(page.getByText("₹20,800", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review ₹19,600 bundle" }).click();

  await expect(page.getByRole("button", { name: "Approve itinerary" })).toBeVisible();
  await expect(page.getByRole("button", { name: /hold 4 seats/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve itinerary" }).click();
  await page.getByRole("button", { name: "Hold 4 seats" }).click();
  await expect(page.getByRole("heading", { name: "Four seats held" })).toBeVisible();

  await expect(
    page.getByRole("button", { name: /open razorpay test checkout/i })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Approve payment of ₹19,600" }).click();
  await page.getByRole("button", { name: "Open Razorpay test checkout" }).click();
  await expect(page.getByText("Simulated payment gateway")).toBeVisible();
  await page.getByRole("button", { name: "Complete simulated payment" }).click();
  await expect(page.getByText("Booking verified")).toBeVisible();
});
