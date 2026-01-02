-- Migration: Add product reviews and rating system
-- Description: Create tables for product reviews, ratings, and moderation

-- Create product reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    helpful_count INTEGER DEFAULT 0,
    reported_count INTEGER DEFAULT 0,
    moderated_by INTEGER REFERENCES users(id),
    moderated_at TIMESTAMP,
    moderation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one review per user per product
    UNIQUE(product_id, user_id)
);

-- Create review helpfulness tracking table
CREATE TABLE IF NOT EXISTS review_helpfulness (
    id SERIAL PRIMARY KEY,
    review_id INTEGER NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one vote per user per review
    UNIQUE(review_id, user_id)
);

-- Create review reports table for moderation
CREATE TABLE IF NOT EXISTS review_reports (
    id SERIAL PRIMARY KEY,
    review_id INTEGER NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'fake', 'offensive', 'other')),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one report per user per review per reason
    UNIQUE(review_id, reporter_user_id, reason)
);

-- Create review media table for images/videos
CREATE TABLE IF NOT EXISTS review_media (
    id SERIAL PRIMARY KEY,
    review_id INTEGER NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url VARCHAR(500) NOT NULL,
    media_thumbnail_url VARCHAR(500),
    alt_text VARCHAR(200),
    file_size INTEGER,
    mime_type VARCHAR(100),
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON product_reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_product_reviews_featured ON product_reviews(is_featured);

CREATE INDEX IF NOT EXISTS idx_review_helpfulness_review_id ON review_helpfulness(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpfulness_user_id ON review_helpfulness(user_id);

CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);
CREATE INDEX IF NOT EXISTS idx_review_reports_created_at ON review_reports(created_at);

CREATE INDEX IF NOT EXISTS idx_review_media_review_id ON review_media(review_id);
CREATE INDEX IF NOT EXISTS idx_review_media_approved ON review_media(is_approved);

-- Add review statistics to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rating_distribution JSONB DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}';

-- Create function to update product review statistics
CREATE OR REPLACE FUNCTION update_product_review_stats(product_id_param INTEGER)
RETURNS VOID AS $$
DECLARE
    review_stats RECORD;
    rating_dist JSONB;
BEGIN
    -- Calculate review statistics
    SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5
    INTO review_stats
    FROM product_reviews 
    WHERE product_id = product_id_param AND is_approved = true;
    
    -- Build rating distribution JSON
    rating_dist := json_build_object(
        '1', COALESCE(review_stats.rating_1, 0),
        '2', COALESCE(review_stats.rating_2, 0),
        '3', COALESCE(review_stats.rating_3, 0),
        '4', COALESCE(review_stats.rating_4, 0),
        '5', COALESCE(review_stats.rating_5, 0)
    );
    
    -- Update product statistics
    UPDATE products 
    SET 
        review_count = COALESCE(review_stats.total_reviews, 0),
        average_rating = ROUND(COALESCE(review_stats.avg_rating, 0), 2),
        rating_distribution = rating_dist,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update review statistics
CREATE OR REPLACE FUNCTION trigger_update_product_review_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT and UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_product_review_stats(NEW.product_id);
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        PERFORM update_product_review_stats(OLD.product_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update product review statistics
DROP TRIGGER IF EXISTS trigger_product_reviews_stats ON product_reviews;
CREATE TRIGGER trigger_product_reviews_stats
    AFTER INSERT OR UPDATE OR DELETE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_product_review_stats();

-- Create function to update review helpfulness count
CREATE OR REPLACE FUNCTION update_review_helpfulness_count(review_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE product_reviews 
    SET helpful_count = (
        SELECT COUNT(*) 
        FROM review_helpfulness 
        WHERE review_id = review_id_param AND is_helpful = true
    )
    WHERE id = review_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for review helpfulness
CREATE OR REPLACE FUNCTION trigger_update_review_helpfulness()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT and UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_review_helpfulness_count(NEW.review_id);
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        PERFORM update_review_helpfulness_count(OLD.review_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for review helpfulness
DROP TRIGGER IF EXISTS trigger_review_helpfulness_count ON review_helpfulness;
CREATE TRIGGER trigger_review_helpfulness_count
    AFTER INSERT OR UPDATE OR DELETE ON review_helpfulness
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_review_helpfulness();

-- Apply updated_at trigger to reviews table
DROP TRIGGER IF EXISTS update_product_reviews_updated_at ON product_reviews;
CREATE TRIGGER update_product_reviews_updated_at
    BEFORE UPDATE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for review analytics
CREATE OR REPLACE VIEW review_analytics AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.review_count,
    p.average_rating,
    p.rating_distribution,
    COUNT(CASE WHEN pr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as reviews_last_30_days,
    COUNT(CASE WHEN pr.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as reviews_last_7_days,
    COUNT(CASE WHEN pr.is_verified_purchase = true THEN 1 END) as verified_reviews,
    AVG(CASE WHEN pr.is_verified_purchase = true THEN pr.rating END) as verified_avg_rating,
    COUNT(CASE WHEN pr.is_featured = true THEN 1 END) as featured_reviews
FROM products p
LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = true
GROUP BY p.id, p.name, p.review_count, p.average_rating, p.rating_distribution;

-- Insert sample data for testing (optional)
-- This would be removed in production
INSERT INTO product_reviews (product_id, user_id, rating, title, review_text, is_verified_purchase) 
SELECT 
    1, -- Assuming product ID 1 exists
    1, -- Assuming user ID 1 exists  
    5,
    'Great product!',
    'This product exceeded my expectations. Highly recommended!',
    true
WHERE EXISTS (SELECT 1 FROM products WHERE id = 1) 
  AND EXISTS (SELECT 1 FROM users WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = 1 AND user_id = 1);