import { money, sumMoney } from "../../worker/domain/money";

it("rejects fractional paise", () => {
  expect(() => money(100.5)).toThrow("Money must be non-negative integer paise");
});

it("rejects negative money", () => {
  expect(() => money(-1)).toThrow("Money must be non-negative integer paise");
});

it("adds integer-paise values without changing units", () => {
  expect(sumMoney([money(1_600_000), money(200_000), money(160_000)])).toBe(
    1_960_000
  );
});
