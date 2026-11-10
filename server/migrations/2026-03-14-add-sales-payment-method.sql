-- Migration: add payment_method to sales (SQLite)
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;
ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT NULL;
COMMIT;
PRAGMA foreign_keys = ON;
