import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const widths = [360, 768, 1024, 1440];

for (const width of widths) {
  test(`landing and demo recompose without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/demo", "/merchant"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth === document.documentElement.clientWidth
        )
      ).toBe(true);
    }
    await page.goto("/demo");
    const box = await page.getByRole("button", { name: "Send booking intent" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
}

test("primary routes have no serious or critical accessibility violations", async ({ page }) => {
  for (const route of ["/", "/demo", "/merchant"]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical"
    );
    expect(blocking, `${route}: ${blocking.map((item) => item.id).join(", ")}`).toEqual([]);
  }
});
