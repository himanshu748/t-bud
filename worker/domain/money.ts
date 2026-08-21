export type Money = number & { readonly __brand: "Money" };

export function money(paise: number): Money {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new TypeError("Money must be non-negative integer paise");
  }

  return paise as Money;
}

export function sumMoney(values: readonly Money[]): Money {
  return money(values.reduce((total, value) => total + value, 0));
}
