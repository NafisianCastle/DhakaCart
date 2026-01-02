-- Migration: Add search and recommendation features
-- Created: 2024-12-31

-- Enable pg_trgm extension for similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add full-text search indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_products_fulltext_search 
ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Add trigram indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin(description gin_trgm_ops);

-- Add indexes for recommendation queries
CREATE INDEX IF NOT EXISTS idx_order_items_product_created 
ON order_items(product_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_user_status_created 
ON orders(user_id, status, created_at);

-- Add composite index for popular products query
CREATE INDEX IF NOT EXISTS idx_products_active_category_created 
ON products(is_active, category_id, created_at);

-- Add index for price range queries
CREATE INDEX IF NOT EXISTS idx_products_price_active 
ON products(price, is_active);

-- Create a function to calculate product popularity score
CREATE OR REPLACE FUNCTION calculate_product_popularity(product_id_param INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    order_count INTEGER;
    total_quantity INTEGER;
    view_count INTEGER;
    popularity_score NUMERIC;
BEGIN
    -- Get order statistics for the last 30 days
    SELECT 
        COALESCE(COUNT(*), 0),
        COALESCE(SUM(oi.quantity), 0)
    INTO order_count, total_quantity
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = product_id_param 
    AND o.created_at >= NOW() - INTERVAL '30 days'
    AND o.status NOT IN ('cancelled');
    
    -- Calculate popularity score (weighted combination)
    popularity_score := (order_count * 10) + (total_quantity * 5);
    
    RETURN popularity_score;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get similar products based on category and price
CREATE OR REPLACE FUNCTION get_similar_products(
    target_product_id INTEGER,
    similarity_threshold REAL DEFAULT 0.3,
    price_variance_factor REAL DEFAULT 0.5,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    product_id INTEGER,
    similarity_score REAL,
    price_difference NUMERIC,
    category_match BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH target_product AS (
        SELECT p.id, p.name, p.price, p.category_id
        FROM products p
        WHERE p.id = target_product_id AND p.is_active = true
    )
    SELECT 
        p.id::INTEGER,
        GREATEST(
            similarity(p.name, tp.name),
            CASE WHEN p.category_id = tp.category_id THEN 0.8 ELSE 0.0 END
        )::REAL as similarity_score,
        ABS(p.price - tp.price)::NUMERIC as price_difference,
        (p.category_id = tp.category_id)::BOOLEAN as category_match
    FROM products p, target_product tp
    WHERE p.id != target_product_id
    AND p.is_active = true
    AND (
        similarity(p.name, tp.name) > similarity_threshold
        OR p.category_id = tp.category_id
        OR (p.price BETWEEN tp.price * (1 - price_variance_factor) 
            AND tp.price * (1 + price_variance_factor))
    )
    ORDER BY 
        similarity_score DESC,
        category_match DESC,
        price_difference ASC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create a view for product recommendations with ratings
CREATE OR REPLACE VIEW product_recommendations AS
SELECT 
    p.id,
    p.name,
    p.description,
    p.price,
    p.stock_quantity,
    p.category_id,
    p.image_url,
    p.slug,
    p.sku,
    p.is_active,
    p.created_at,
    p.updated_at,
    c.name as category_name,
    c.slug as category_slug,
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COUNT(r.id) as rating_count,
    calculate_product_popularity(p.id) as popularity_score
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
WHERE p.is_active = true
GROUP BY p.id, c.name, c.slug;

-- Add comment to track migration
COMMENT ON EXTENSION pg_trgm IS 'Added for product similarity search in migration 007';