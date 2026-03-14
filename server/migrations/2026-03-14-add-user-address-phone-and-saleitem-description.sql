-- Migration: Add address and phone to users, and description to sale_items (SQLite)
-- Run this against your SQLite database file (database.sqlite) to enable persisting staff address/phone and per-item descriptions.

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Add address and phone to users table if they don't exist
ALTER TABLE users ADD COLUMN address TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL;

-- Add description to sale_items
ALTER TABLE sale_items ADD COLUMN description TEXT DEFAULT NULL;

COMMIT;
PRAGMA foreign_keys = ON;

-- Notes:
-- 1) SQLite's ALTER TABLE ... ADD COLUMN is safe for simple additions. This migration will be a no-op
--    if columns already exist but SQLite will error if you run it twice; check first.
-- 2) To check columns:
--    sqlite3 database.sqlite \
--      "PRAGMA table_info('users');";
--    sqlite3 database.sqlite \
--      "PRAGMA table_info('sale_items');";
-- 3) To run this file with the sqlite3 CLI on Windows PowerShell (from repository root):
--    sqlite3.exe database.sqlite < server/migrations/2026-03-14-add-user-address-phone-and-saleitem-description.sql
-- 4) Alternatively, use any SQLite GUI (DB Browser for SQLite) and execute the ALTER statements.

-- After running, restart your server. New sales will persist item descriptions and staff address/phone.
