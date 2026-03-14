-- Postgres migration: add address & phone to users, description to sale_items (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS description TEXT;
