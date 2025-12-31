const logger = require('../logger');

class PromotionalService {
    constructor(dbPool) {
        this.dbPool = dbPool;
    }

    // Coupon Management
    async createCoupon(couponData) {
        try {
            const {
                code,
                name,
                description,
                type,
                value,
                minimumOrderAmount = 0,
                maximumDiscountAmount,
                usageLimit,
                userUsageLimit = 1,
                startsAt,
                expiresAt
            } = couponData;

            const query = `
                INSERT INTO coupons (
                    code, name, description, type, value, minimum_order_amount,
                    maximum_discount_amount, usage_limit, user_usage_limit,
                    starts_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                code.toUpperCase(),
                name,
                description,
                type,
                value,
                minimumOrderAmount,
                maximumDiscountAmount,
                usageLimit,
                userUsageLimit,
                startsAt,
                expiresAt
            ];

            const result = await this.dbPool.query(query, values);

            logger.info('Coupon created successfully', {
                couponId: result.rows[0].id,
                code: result.rows[0].code
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating coupon', { error: error.message });
            throw error;
        }
    }

    async validateCoupon(code, userId, orderAmount) {
        try {
            const couponQuery = `
                SELECT * FROM coupons 
                WHERE UPPER(code) = UPPER($1) 
                AND is_active = true
                AND (starts_at IS NULL OR starts_at <= NOW())
                AND (expires_at IS NULL OR expires_at > NOW())
                AND (usage_limit IS NULL OR usage_count < usage_limit)
            `;

            const couponResult = await this.dbPool.query(couponQuery, [code]);

            if (couponResult.rows.length === 0) {
                return { valid: false, error: 'Invalid or expired coupon code' };
            }

            const coupon = couponResult.rows[0];

            // Check minimum order amount
            if (orderAmount < coupon.minimum_order_amount) {
                return {
                    valid: false,
                    error: `Minimum order amount of $${coupon.minimum_order_amount} required`
                };
            }

            // Check user usage limit
            if (userId) {
                const usageQuery = `
                    SELECT COUNT(*) as usage_count 
                    FROM coupon_usage 
                    WHERE coupon_id = $1 AND user_id = $2
                `;
                const usageResult = await this.dbPool.query(usageQuery, [coupon.id, userId]);
                const userUsageCount = parseInt(usageResult.rows[0].usage_count);

                if (userUsageCount >= coupon.user_usage_limit) {
                    return { valid: false, error: 'Coupon usage limit exceeded for this user' };
                }
            }

            // Calculate discount
            const discount = this.calculateCouponDiscount(coupon, orderAmount);

            return {
                valid: true,
                coupon,
                discount
            };
        } catch (error) {
            logger.error('Error validating coupon', { error: error.message, code });
            throw error;
        }
    }

    calculateCouponDiscount(coupon, orderAmount) {
        let discount = 0;

        switch (coupon.type) {
            case 'percentage':
                discount = (orderAmount * coupon.value) / 100;
                break;
            case 'fixed_amount':
                discount = coupon.value;
                break;
            case 'free_shipping':
                // This would be handled in shipping calculation
                discount = 0;
                break;
        }

        // Apply maximum discount limit if set
        if (coupon.maximum_discount_amount && discount > coupon.maximum_discount_amount) {
            discount = coupon.maximum_discount_amount;
        }

        // Ensure discount doesn't exceed order amount
        if (discount > orderAmount) {
            discount = orderAmount;
        }

        return Math.round(discount * 100) / 100; // Round to 2 decimal places
    }

    async applyCoupon(couponId, userId, orderId, discountAmount) {
        try {
            const query = `
                INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;

            const result = await this.dbPool.query(query, [couponId, userId, orderId, discountAmount]);

            logger.info('Coupon applied successfully', {
                couponId,
                userId,
                orderId,
                discountAmount
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error applying coupon', { error: error.message });
            throw error;
        }
    }

    // Promotional Banners
    async createPromotionalBanner(bannerData) {
        try {
            const {
                title,
                subtitle,
                description,
                imageUrl,
                linkUrl,
                buttonText,
                position = 'hero',
                priority = 0,
                startsAt,
                expiresAt
            } = bannerData;

            const query = `
                INSERT INTO promotional_banners (
                    title, subtitle, description, image_url, link_url,
                    button_text, position, priority, starts_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const values = [
                title,
                subtitle,
                description,
                imageUrl,
                linkUrl,
                buttonText,
                position,
                priority,
                startsAt,
                expiresAt
            ];

            const result = await this.dbPool.query(query, values);

            logger.info('Promotional banner created successfully', {
                bannerId: result.rows[0].id,
                title: result.rows[0].title
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating promotional banner', { error: error.message });
            throw error;
        }
    }

    async getActivePromotionalBanners(position = null) {
        try {
            let query = `
                SELECT * FROM promotional_banners 
                WHERE is_active = true
                AND (starts_at IS NULL OR starts_at <= NOW())
                AND (expires_at IS NULL OR expires_at > NOW())
            `;
            const values = [];

            if (position) {
                query += ' AND position = $1';
                values.push(position);
            }

            query += ' ORDER BY priority DESC, created_at DESC';

            const result = await this.dbPool.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching promotional banners', { error: error.message });
            throw error;
        }
    }

    // Featured Products
    async addFeaturedProduct(productId, section, priority = 0, startsAt = null, expiresAt = null) {
        try {
            const query = `
                INSERT INTO featured_products (product_id, section, priority, starts_at, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (product_id, section) 
                DO UPDATE SET 
                    priority = EXCLUDED.priority,
                    starts_at = EXCLUDED.starts_at,
                    expires_at = EXCLUDED.expires_at,
                    is_active = true,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const result = await this.dbPool.query(query, [productId, section, priority, startsAt, expiresAt]);

            logger.info('Featured product added successfully', {
                productId,
                section,
                priority
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error adding featured product', { error: error.message });
            throw error;
        }
    }

    async getFeaturedProducts(section) {
        try {
            const query = `
                SELECT fp.*, p.name, p.description, p.price, p.image_url, p.slug
                FROM featured_products fp
                JOIN products p ON fp.product_id = p.id
                WHERE fp.section = $1 
                AND fp.is_active = true
                AND p.is_active = true
                AND (fp.starts_at IS NULL OR fp.starts_at <= NOW())
                AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
                ORDER BY fp.priority DESC, fp.created_at DESC
            `;

            const result = await this.dbPool.query(query, [section]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching featured products', { error: error.message, section });
            throw error;
        }
    }

    // Flash Sales
    async createFlashSale(flashSaleData) {
        try {
            const { name, description, discountPercentage, startsAt, expiresAt } = flashSaleData;

            const query = `
                INSERT INTO flash_sales (name, description, discount_percentage, starts_at, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;

            const result = await this.dbPool.query(query, [
                name,
                description,
                discountPercentage,
                startsAt,
                expiresAt
            ]);

            logger.info('Flash sale created successfully', {
                flashSaleId: result.rows[0].id,
                name: result.rows[0].name
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating flash sale', { error: error.message });
            throw error;
        }
    }

    async addProductToFlashSale(flashSaleId, productId, originalPrice, stockLimit = null) {
        try {
            // Get flash sale details to calculate sale price
            const flashSaleQuery = 'SELECT discount_percentage FROM flash_sales WHERE id = $1';
            const flashSaleResult = await this.dbPool.query(flashSaleQuery, [flashSaleId]);

            if (flashSaleResult.rows.length === 0) {
                throw new Error('Flash sale not found');
            }

            const discountPercentage = flashSaleResult.rows[0].discount_percentage;
            const salePrice = originalPrice * (1 - discountPercentage / 100);

            const query = `
                INSERT INTO flash_sale_products (
                    flash_sale_id, product_id, original_price, sale_price, stock_limit
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (flash_sale_id, product_id)
                DO UPDATE SET 
                    original_price = EXCLUDED.original_price,
                    sale_price = EXCLUDED.sale_price,
                    stock_limit = EXCLUDED.stock_limit
                RETURNING *
            `;

            const result = await this.dbPool.query(query, [
                flashSaleId,
                productId,
                originalPrice,
                salePrice,
                stockLimit
            ]);

            logger.info('Product added to flash sale successfully', {
                flashSaleId,
                productId,
                salePrice
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error adding product to flash sale', { error: error.message });
            throw error;
        }
    }

    async getActiveFlashSales() {
        try {
            const query = `
                SELECT fs.*, 
                       COUNT(fsp.id) as product_count,
                       CASE 
                           WHEN fs.starts_at > NOW() THEN 'upcoming'
                           WHEN fs.expires_at < NOW() THEN 'expired'
                           ELSE 'active'
                       END as status
                FROM flash_sales fs
                LEFT JOIN flash_sale_products fsp ON fs.id = fsp.flash_sale_id
                WHERE fs.is_active = true
                GROUP BY fs.id
                ORDER BY fs.starts_at ASC
            `;

            const result = await this.dbPool.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching flash sales', { error: error.message });
            throw error;
        }
    }

    async getFlashSaleProducts(flashSaleId) {
        try {
            const query = `
                SELECT fsp.*, p.name, p.description, p.image_url, p.slug,
                       fs.name as flash_sale_name, fs.starts_at, fs.expires_at
                FROM flash_sale_products fsp
                JOIN products p ON fsp.product_id = p.id
                JOIN flash_sales fs ON fsp.flash_sale_id = fs.id
                WHERE fsp.flash_sale_id = $1
                AND p.is_active = true
                AND fs.is_active = true
                AND fs.starts_at <= NOW()
                AND fs.expires_at > NOW()
                ORDER BY fsp.created_at ASC
            `;

            const result = await this.dbPool.query(query, [flashSaleId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching flash sale products', { error: error.message });
            throw error;
        }
    }

    // Loyalty Program
    async getUserLoyaltyPoints(userId, loyaltyProgramId = null) {
        try {
            let query = `
                SELECT ulp.*, lp.name as program_name, lp.points_per_dollar
                FROM user_loyalty_points ulp
                JOIN loyalty_programs lp ON ulp.loyalty_program_id = lp.id
                WHERE ulp.user_id = $1
            `;
            const values = [userId];

            if (loyaltyProgramId) {
                query += ' AND ulp.loyalty_program_id = $2';
                values.push(loyaltyProgramId);
            }

            const result = await this.dbPool.query(query, values);
            return loyaltyProgramId ? result.rows[0] : result.rows;
        } catch (error) {
            logger.error('Error fetching user loyalty points', { error: error.message });
            throw error;
        }
    }

    async awardLoyaltyPoints(userId, orderId, orderAmount, loyaltyProgramId = null) {
        try {
            // Get default loyalty program if not specified
            if (!loyaltyProgramId) {
                const programQuery = 'SELECT id FROM loyalty_programs WHERE is_active = true LIMIT 1';
                const programResult = await this.dbPool.query(programQuery);
                if (programResult.rows.length === 0) {
                    logger.warn('No active loyalty program found');
                    return null;
                }
                loyaltyProgramId = programResult.rows[0].id;
            }

            // Get points per dollar rate
            const programQuery = 'SELECT points_per_dollar FROM loyalty_programs WHERE id = $1';
            const programResult = await this.dbPool.query(programQuery, [loyaltyProgramId]);

            if (programResult.rows.length === 0) {
                throw new Error('Loyalty program not found');
            }

            const pointsPerDollar = programResult.rows[0].points_per_dollar;
            const pointsEarned = Math.floor(orderAmount * pointsPerDollar);

            if (pointsEarned <= 0) {
                return null;
            }

            // Update or create user loyalty points record
            const upsertQuery = `
                INSERT INTO user_loyalty_points (user_id, loyalty_program_id, total_points, available_points)
                VALUES ($1, $2, $3, $3)
                ON CONFLICT (user_id, loyalty_program_id)
                DO UPDATE SET 
                    total_points = user_loyalty_points.total_points + $3,
                    available_points = user_loyalty_points.available_points + $3,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const upsertResult = await this.dbPool.query(upsertQuery, [userId, loyaltyProgramId, pointsEarned]);

            // Record the transaction
            const transactionQuery = `
                INSERT INTO loyalty_point_transactions (
                    user_id, loyalty_program_id, order_id, transaction_type, points, description
                ) VALUES ($1, $2, $3, 'earned', $4, $5)
                RETURNING *
            `;

            await this.dbPool.query(transactionQuery, [
                userId,
                loyaltyProgramId,
                orderId,
                pointsEarned,
                `Points earned from order #${orderId}`
            ]);

            logger.info('Loyalty points awarded successfully', {
                userId,
                orderId,
                pointsEarned,
                orderAmount
            });

            return {
                pointsEarned,
                totalPoints: upsertResult.rows[0].total_points,
                availablePoints: upsertResult.rows[0].available_points
            };
        } catch (error) {
            logger.error('Error awarding loyalty points', { error: error.message });
            throw error;
        }
    }

    async redeemLoyaltyPoints(userId, pointsToRedeem, loyaltyProgramId = null) {
        try {
            // Get default loyalty program if not specified
            if (!loyaltyProgramId) {
                const programQuery = 'SELECT id FROM loyalty_programs WHERE is_active = true LIMIT 1';
                const programResult = await this.dbPool.query(programQuery);
                if (programResult.rows.length === 0) {
                    throw new Error('No active loyalty program found');
                }
                loyaltyProgramId = programResult.rows[0].id;
            }

            // Check available points
            const pointsQuery = `
                SELECT available_points FROM user_loyalty_points 
                WHERE user_id = $1 AND loyalty_program_id = $2
            `;
            const pointsResult = await this.dbPool.query(pointsQuery, [userId, loyaltyProgramId]);

            if (pointsResult.rows.length === 0 || pointsResult.rows[0].available_points < pointsToRedeem) {
                throw new Error('Insufficient loyalty points');
            }

            // Calculate discount (1 point = $0.01)
            const discountAmount = pointsToRedeem * 0.01;

            // Update available points
            const updateQuery = `
                UPDATE user_loyalty_points 
                SET available_points = available_points - $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $2 AND loyalty_program_id = $3
                RETURNING *
            `;

            const updateResult = await this.dbPool.query(updateQuery, [pointsToRedeem, userId, loyaltyProgramId]);

            // Record the transaction
            const transactionQuery = `
                INSERT INTO loyalty_point_transactions (
                    user_id, loyalty_program_id, transaction_type, points, description
                ) VALUES ($1, $2, 'redeemed', $3, $4)
                RETURNING *
            `;

            await this.dbPool.query(transactionQuery, [
                userId,
                loyaltyProgramId,
                -pointsToRedeem,
                `Points redeemed for $${discountAmount.toFixed(2)} discount`
            ]);

            logger.info('Loyalty points redeemed successfully', {
                userId,
                pointsRedeemed: pointsToRedeem,
                discountAmount
            });

            return {
                pointsRedeemed: pointsToRedeem,
                discountAmount,
                remainingPoints: updateResult.rows[0].available_points
            };
        } catch (error) {
            logger.error('Error redeeming loyalty points', { error: error.message });
            throw error;
        }
    }

    // Admin functions
    async getAllCoupons(page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            const query = `
                SELECT c.*, COUNT(cu.id) as usage_count_actual
                FROM coupons c
                LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
                GROUP BY c.id
                ORDER BY c.created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await this.dbPool.query(query, [limit, offset]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching all coupons', { error: error.message });
            throw error;
        }
    }

    async getCouponUsageStats(couponId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_uses,
                    SUM(discount_amount) as total_discount,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(discount_amount) as avg_discount
                FROM coupon_usage 
                WHERE coupon_id = $1
            `;

            const result = await this.dbPool.query(query, [couponId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching coupon usage stats', { error: error.message });
            throw error;
        }
    }
}

module.exports = PromotionalService;