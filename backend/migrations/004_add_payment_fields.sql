-- Migration: Add payment integration fields to orders table
-- Created: 2024-12-30

-- Add payment intent ID for Stripe integration
ALTER TABLE orders ADD COLUMN payment_intent_id TEXT;

-- Add index for payment intent ID lookups
CREATE INDEX idx_orders_payment_intent ON orders(payment_intent_id);

-- Add customer ID for Stripe customer management
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

-- Add index for Stripe customer ID
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- Add payment metadata table for storing additional payment information
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    payment_intent_id TEXT NOT NULL,
    stripe_charge_id TEXT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
    payment_method_type TEXT,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for payment transactions
CREATE INDEX idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_intent ON payment_transactions(payment_intent_id);
CREATE INDEX idx_payment_transactions_charge ON payment_transactions(stripe_charge_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add refunds table for tracking refund transactions
CREATE TABLE refund_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    payment_transaction_id INTEGER REFERENCES payment_transactions(id) ON DELETE CASCADE,
    stripe_refund_id TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for refund transactions
CREATE INDEX idx_refund_transactions_order ON refund_transactions(order_id);
CREATE INDEX idx_refund_transactions_payment ON refund_transactions(payment_transaction_id);
CREATE INDEX idx_refund_transactions_refund ON refund_transactions(stripe_refund_id);
CREATE INDEX idx_refund_transactions_status ON refund_transactions(status);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_refund_transactions_updated_at 
    BEFORE UPDATE ON refund_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();