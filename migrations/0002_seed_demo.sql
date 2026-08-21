INSERT INTO treks (
  id, name, location, duration_days, duration_nights, difficulty,
  unit_amount, description, active
) VALUES (
  'trek_hampta', 'Hampta Pass Intro Trek', 'Manali', 2, 1, 'moderate',
  400000, 'A two-day guided introduction to Hampta terrain for occasional hikers.', 1
);

INSERT INTO departures (id, trek_id, start_at, capacity, available, status) VALUES
  ('dep_hampta_2026_09_12', 'trek_hampta', '2026-09-12T06:30:00.000Z', 4, 4, 'active'),
  ('dep_hampta_2026_09_19', 'trek_hampta', '2026-09-19T06:30:00.000Z', 8, 8, 'active');

INSERT INTO addons (
  id, name, category, scope, unit_amount, eligibility_json, active
) VALUES
  ('pickup_manali', 'Manali pickup', 'pickup', 'per_booking', 200000, '{"location":"Manali"}', 1),
  ('meals_premium', 'Premium trail meals', 'meals', 'per_person', 70000, '{"durationDays":2}', 1),
  ('meals_budget', 'Upgraded trail meals', 'meals', 'per_person', 40000, '{"durationDays":2}', 1);
