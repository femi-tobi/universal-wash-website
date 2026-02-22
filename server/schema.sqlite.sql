-- SQLite Schema for Laundry Management System
-- This is the SQLite equivalent of schema.sql

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Services Table
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    address TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 4. Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('paid', 'unpaid')),
    payment_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- 5. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    item_type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES 
('admin', '$2b$10$i4Th.GpM1Wy.Al91suKjf.6Z0p6gEIt5o0ksQ251yoZawuIMi22oy', 'System Admin', 'admin');

-- Insert sample services
INSERT OR IGNORE INTO services (name, description, base_price) VALUES 
('Wash', 'Regular washing service', 5.00),
('Iron', 'Ironing service', 3.00),
('Dry Clean', 'Professional dry cleaning', 15.00),
('Wash & Iron', 'Combined wash and iron', 7.00);
