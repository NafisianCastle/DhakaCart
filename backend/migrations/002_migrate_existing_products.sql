-- Migration: Migrate existing products data to new schema
-- Created: 2024-12-30

-- Create a default category for existing products
INSERT INTO categories (name, description, slug) 
VALUES ('General', 'General category for existing products', 'general')
ON CONFLICT (name) DO NOTHING;

-- Migrate existing products if the old products table exists
DO $$
DECLARE
    old_products_exists BOOLEAN;
    default_category_id INTEGER;
BEGIN
    -- Check if old products table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products_old'
    ) INTO old_products_exists;
    
    -- Get the default category ID
    SELECT id INTO default_category_id FROM categories WHERE slug = 'general';
    
    -- If old products table exists, migrate the data
    IF old_products_exists THEN
        INSERT INTO products (name, price, category_id, slug, created_at)
        SELECT 
            name,
            price,
            default_category_id,
            LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || id as slug,
            created_at
        FROM products_old
        ON CONFLICT (slug) DO NOTHING;
        
        -- Drop the old table after migration
        DROP TABLE products_old;
    END IF;
END $$;