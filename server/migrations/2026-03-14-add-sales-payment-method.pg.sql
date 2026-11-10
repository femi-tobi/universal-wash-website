-- Postgres migration: add payment_method to sales (idempotent)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
