import type { Money } from "./money";

export type Difficulty = "easy" | "moderate" | "hard";
export type AddonCategory = "pickup" | "meals";

export interface BookingRequest {
  location: string;
  partySize: number;
  budget: Money;
  durationDays: number;
  durationNights: number;
  difficulty: Difficulty;
  requestedAddonCategories: AddonCategory[];
}

export interface Trek {
  id: string;
  name: string;
  location: string;
  durationDays: number;
  durationNights: number;
  difficulty: Difficulty;
  unitAmount: Money;
  active: boolean;
}

export interface Departure {
  id: string;
  trekId: string;
  startAt: string;
  capacity: number;
  available: number;
  status: "active" | "sold_out" | "cancelled";
}

export interface Addon {
  id: string;
  name: string;
  category: AddonCategory;
  scope: "per_booking" | "per_person";
  unitAmount: Money;
  active: boolean;
}

export interface QuoteItem {
  id: string;
  kind: "trek" | "addon";
  name: string;
  quantity: number;
  unitAmount: Money;
  amount: Money;
}

export interface EligiblePolicyResult {
  status: "eligible";
  items: QuoteItem[];
  total: Money;
  requiresHumanApproval: true;
}

export interface BudgetConflictPolicyResult {
  status: "budget_conflict";
  items: QuoteItem[];
  total: Money;
  overBy: Money;
  requiresHumanApproval: true;
}

export type PolicyResult =
  | EligiblePolicyResult
  | BudgetConflictPolicyResult;

export interface Quote {
  id: string;
  taskId: string;
  version: number;
  trekId: string;
  departureId: string;
  partySize: number;
  budget: Money;
  currency: "INR";
  items: QuoteItem[];
  total: Money;
  expiresAt: string;
  status: "ready" | "approved" | "expired" | "superseded";
}
