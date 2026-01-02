-- Migration: Add promotional and discount system
-- Created: 2024-12-31

-- Coupons table for discount codes
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'free_shipping')),
    value NUMERIC(10,2) NOT NULL CHECK (value >= 0),
    minimum_order_amount NUMERIC(10,2) DEFAULT 0 CHECK (minimum_order_amount >= 0),
    maximum_discount_amount NUMERIC(10,2),
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    user_usage_limit INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_dates CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at)
);

-- Coupon usage tracking
CREATE TABLE coupon_usage (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    discount_amount NUMERIC(10,2) NOT NULL CHECK (discount_amount >= 0),
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, order_id)
);

-- Promotional banners
CREATE TABLE promotional_banners (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    button_text TEXT,
    position TEXT DEFAULT 'hero' CHECK (position IN ('hero', 'sidebar', 'footer', 'popup')),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_banner_dates CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at)
);

-- Featured products for promotions
CREATE TABLE featured_products (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('hero', 'deals', 'trending', 'new_arrivals')),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, section),
    CONSTRAINT valid_featured_dates CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at)
);

-- Flash sales for limited-time offers
CREATE TABLE flash_sales (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    discount_percentage NUMERIC(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_flash_sale_dates CHECK (starts_at < expires_at)
);

-- Flash sale products
CREATE TABLE flash_sale_products (
    id SERIAL PRIMARY KEY,
    flash_sale_id INTEGER REFERENCES flash_sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    original_price NUMERIC(10,2) NOT NULL CHECK (original_price >= 0),
    sale_price NUMERIC(10,2) NOT NULL CHECK (sale_price >= 0),
    stock_limit INTEGER,
    sold_count INTEGER DEFAULT 0 CHECK (sold_count >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(flash_sale_id, product_id),
    CONSTRAINT valid_sale_price CHECK (sale_price < original_price)
);

-- Loyalty program
CREATE TABLE loyalty_programs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    points_per_dollar NUMERIC(5,2) DEFAULT 1.00 CHECK (points_per_dollar >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User loyalty points
CREATE TABLE user_loyalty_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    loyalty_program_id INTEGER REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0 CHECK (total_points >= 0),
    available_points INTEGER DEFAULT 0 CHECK (available_points >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, loyalty_program_id)
);

-- Loyalty point transactions
CREATE TABLE loyalty_point_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    loyalty_program_id INTEGER REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
    points INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reward redemptions
CREATE TABLE reward_redemptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    loyalty_program_id INTEGER REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    points_redeemed INTEGER NOT NULL CHECK (points_redeemed > 0),
    discount_amount NUMERIC(10,2) NOT NULL CHECK (discount_amount >= 0),
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add discount fields to orders table
ALTER TABLE orders ADD COLUMN coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN coupon_discount NUMERIC(10,2) DEFAULT 0 CHECK (coupon_discount >= 0);
ALTER TABLE orders ADD COLUMN loyalty_points_used INTEGER DEFAULT 0 CHECK (loyalty_points_used >= 0);
ALTER TABLE orders ADD COLUMN loyalty_discount NUMERIC(10,2) DEFAULT 0 CHECK (loyalty_discount >= 0);
ALTER TABLE orders ADD COLUMN subtotal NUMERIC(10,2) DEFAULT 0 CHECK (subtotal >= 0);

-- Indexes for performance
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active);
CREATE INDEX idx_coupons_dates ON coupons(starts_at, expires_at);

CREATE INDEX idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX idx_coupon_usage_order ON coupon_usage(order_id);

CREATE INDEX idx_promotional_banners_active ON promotional_banners(is_active);
CREATE INDEX idx_promotional_banners_position ON promotional_banners(position);
CREATE INDEX idx_promotional_banners_priority ON promotional_banners(priority);
CREATE INDEX idx_promotional_banners_dates ON promotional_banners(starts_at, expires_at);

CREATE INDEX idx_featured_products_section ON featured_products(section);
CREATE INDEX idx_featured_products_active ON featured_products(is_active);
CREATE INDEX idx_featured_products_priority ON featured_products(priority);
CREATE INDEX idx_featured_products_dates ON featured_products(starts_at, expires_at);

CREATE INDEX idx_flash_sales_active ON flash_sales(is_active);
CREATE INDEX idx_flash_sales_dates ON flash_sales(starts_at, expires_at);

CREATE INDEX idx_flash_sale_products_sale ON flash_sale_products(flash_sale_id);
CREATE INDEX idx_flash_sale_products_product ON flash_sale_products(product_id);

CREATE INDEX idx_loyalty_programs_active ON loyalty_programs(is_active);

CREATE INDEX idx_user_loyalty_points_user ON user_loyalty_points(user_id);
CREATE INDEX idx_user_loyalty_points_program ON user_loyalty_points(loyalty_program_id);

CREATE INDEX idx_loyalty_point_transactions_user ON loyalty_point_transactions(user_id);
CREATE INDEX idx_loyalty_point_transactions_program ON loyalty_point_transactions(loyalty_program_id);
CREATE INDEX idx_loyalty_point_transactions_type ON loyalty_point_transactions(transaction_type);

CREATE INDEX idx_reward_redemptions_user ON reward_redemptions(user_id);
CREATE INDEX idx_reward_redemptions_order ON reward_redemptions(order_id);

CREATE INDEX idx_orders_coupon ON orders(coupon_id);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promotional_banners_updated_at BEFORE UPDATE ON promotional_banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_featured_products_updated_at BEFORE UPDATE ON featured_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_flash_sales_updated_at BEFORE UPDATE ON flash_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON loyalty_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_loyalty_points_updated_at BEFORE UPDATE ON user_loyalty_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update coupon usage count
CREATE OR REPLACE FUNCTION update_coupon_usage_count()
RETURNS TRIGGER AS $
BEGIN
    UPDATE coupons 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.coupon_id;
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_coupon_usage_count_trigger 
    AFTER INSERT ON coupon_usage 
    FOR EACH ROW EXECUTE FUNCTION update_coupon_usage_count();

-- Function to update flash sale sold count
CREATE OR REPLACE FUNCTION update_flash_sale_sold_count()
RETURNS TRIGGER AS $
BEGIN
    -- This will be called when an order item is created for a flash sale product
    -- We'll implement this logic in the application layer for better control
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Function to calculate loyalty points earned
CREATE OR REPLACE FUNCTION calculate_loyalty_points(order_amount NUMERIC, points_per_dollar NUMERIC)
RETURNS INTEGER AS $
BEGIN
    RETURN FLOOR(order_amount * points_per_dollar);
END;
$ LANGUAGE plpgsql;

-- Insert default loyalty program
INSERT INTO loyalty_programs (name, description, points_per_dollar, is_active)
VALUES (
    'DhakaCart Rewards',
    'Earn points on every purchase and redeem for discounts',
    1.00,
    true
) ON CONFLICT DO NOTHING;