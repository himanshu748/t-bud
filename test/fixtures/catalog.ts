import { money } from "../../worker/domain/money";
import type {
  Addon,
  BookingRequest,
  Departure,
  Trek
} from "../../worker/domain/types";

export const bookingRequest: BookingRequest = {
  location: "Manali",
  partySize: 4,
  budget: money(2_000_000),
  durationDays: 2,
  durationNights: 1,
  difficulty: "moderate",
  requestedAddonCategories: ["pickup", "meals"]
};

export const trek: Trek = {
  id: "trek_hampta",
  name: "Hampta Pass Intro Trek",
  location: "Manali",
  durationDays: 2,
  durationNights: 1,
  difficulty: "moderate",
  unitAmount: money(400_000),
  active: true
};

export const departure: Departure = {
  id: "dep_hampta_2026_09_12",
  trekId: trek.id,
  startAt: "2026-09-12T06:30:00.000Z",
  capacity: 4,
  available: 4,
  status: "active"
};

export const pickup: Addon = {
  id: "pickup_manali",
  name: "Manali pickup",
  category: "pickup",
  scope: "per_booking",
  unitAmount: money(200_000),
  active: true
};

export const premiumMeals: Addon = {
  id: "meals_premium",
  name: "Premium trail meals",
  category: "meals",
  scope: "per_person",
  unitAmount: money(70_000),
  active: true
};

export const budgetMeals: Addon = {
  id: "meals_budget",
  name: "Upgraded trail meals",
  category: "meals",
  scope: "per_person",
  unitAmount: money(40_000),
  active: true
};
