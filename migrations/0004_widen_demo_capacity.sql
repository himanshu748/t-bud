-- A four-seat departure is emptied by a single four-person demo booking, which
-- leaves the next visitor with a capacity conflict instead of the product.
UPDATE departures
SET capacity = 12, available = 12
WHERE id = 'dep_hampta_2026_09_12';
