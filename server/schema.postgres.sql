-- PostgreSQL Schema for Laundry Management System
-- Auto-run on first startup when connected to a PostgreSQL database

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(10) NOT NULL CHECK(role IN ('admin', 'staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Services Table
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    address VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    staff_id INT NOT NULL REFERENCES users(id),
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(10) DEFAULT 'unpaid' CHECK(payment_status IN ('paid', 'unpaid')),
    payment_date TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- 5. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    service_id INT NOT NULL REFERENCES services(id),
    item_type VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- Seed default admin user (password: admin123)
INSERT INTO users (username, password, full_name, role)
VALUES ('admin', '$2b$10$i4Th.GpM1Wy.Al91suKjf.6Z0p6gEIt5o0ksQ251yoZawuIMi22oy', 'System Admin', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Seed sample services
INSERT INTO services (name, description, base_price) VALUES
('Wash',       'Regular washing service',     5.00),
('Iron',       'Ironing service',             3.00),
('Dry Clean',  'Professional dry cleaning',  15.00),
('Wash & Iron','Combined wash and iron',      7.00)
ON CONFLICT DO NOTHING;
