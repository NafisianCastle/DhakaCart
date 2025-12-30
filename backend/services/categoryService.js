const logger = require('../logger');

class CategoryService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
        this.cachePrefix = 'category:';
        this.cacheTTL = 600; // 10 minutes
    }

    async createCategory(categoryData) {
        const { name, description } = categoryData;

        try {
            // Generate slug from name
            const slug = this.generateSlug(name);

            // Check if slug already exists
            const existingCategory = await this.findCategoryBySlug(slug);
            if (existingCategory) {
                throw new Error('Category with similar name already exists');
            }

            const result = await this.db.query(`
                INSERT INTO categories (name, description, slug)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [name, description, slug]);

            const category = result.rows[0];

            // Clear categories cache
            await this.clearCategoriesCache();

            logger.info('Category created successfully', {
                categoryId: category.id,
                name: category.name,
                slug: category.slug
            });

            return category;
        } catch (error) {
            logger.error('Error creating category', { error: error.message, categoryData });
            throw error;
        }
    }

    async getCategories(filters = {}) {
        const { isActive = true } = filters;

        try {
            const cacheKey = `categories:list:${isActive}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedCategories = await this.redis.getCachedData(cacheKey);
                if (cachedCategories) {
                    logger.debug('Categories served from cache', { isActive });
                    return cachedCategories;
                }
            }

            const result = await this.db.query(`
                SELECT c.*, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.is_active = $1
                GROUP BY c.id
                ORDER BY c.name ASC
            `, [isActive]);

            const categories = result.rows;

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, categories, this.cacheTTL);
            }

            logger.info('Categories fetched successfully', {
                count: categories.length,
                isActive
            });

            return categories;
        } catch (error) {
            logger.error('Error fetching categories', { error: error.message, filters });
            throw error;
        }
    }

    async getCategoryById(categoryId) {
        try {
            const cacheKey = `${this.cachePrefix}${categoryId}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedCategory = await this.redis.getCachedData(cacheKey);
                if (cachedCategory) {
                    logger.debug('Category served from cache', { categoryId });
                    return cachedCategory;
                }
            }

            const result = await this.db.query(`
                SELECT c.*, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.id = $1 AND c.is_active = true
                GROUP BY c.id
            `, [categoryId]);

            const category = result.rows[0] || null;

            if (category && this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, category, this.cacheTTL);
            }

            return category;
        } catch (error) {
            logger.error('Error fetching category by ID', { error: error.message, categoryId });
            throw error;
        }
    }

    async getCategoryBySlug(slug) {
        try {
            const cacheKey = `${this.cachePrefix}slug:${slug}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedCategory = await this.redis.getCachedData(cacheKey);
                if (cachedCategory) {
                    logger.debug('Category served from cache by slug', { slug });
                    return cachedCategory;
                }
            }

            const result = await this.db.query(`
                SELECT c.*, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.slug = $1 AND c.is_active = true
                GROUP BY c.id
            `, [slug]);

            const category = result.rows[0] || null;

            if (category && this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, category, this.cacheTTL);
            }

            return category;
        } catch (error) {
            logger.error('Error fetching category by slug', { error: error.message, slug });
            throw error;
        }
    }

    async updateCategory(categoryId, updateData) {
        const { name, description, isActive } = updateData;

        try {
            // Check if category exists
            const existingCategory = await this.getCategoryById(categoryId);
            if (!existingCategory) {
                throw new Error('Category not found');
            }

            // Generate new slug if name is being updated
            let slug = existingCategory.slug;
            if (name && name !== existingCategory.name) {
                slug = this.generateSlug(name);

                // Check if new slug already exists
                const existingBySlug = await this.findCategoryBySlug(slug);
                if (existingBySlug && existingBySlug.id !== categoryId) {
                    throw new Error('Category with similar name already exists');
                }
            }

            const result = await this.db.query(`
                UPDATE categories 
                SET name = COALESCE($2, name),
                    description = COALESCE($3, description),
                    slug = COALESCE($4, slug),
                    is_active = COALESCE($5, is_active),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND is_active = true
                RETURNING *
            `, [categoryId, name, description, slug, isActive]);

            if (result.rows.length === 0) {
                throw new Error('Category not found or inactive');
            }

            const category = result.rows[0];

            // Clear cache
            await this.clearCategoryCache(categoryId);
            await this.clearCategoriesCache();

            logger.info('Category updated successfully', {
                categoryId: category.id,
                name: category.name
            });

            return category;
        } catch (error) {
            logger.error('Error updating category', { error: error.message, categoryId, updateData });
            throw error;
        }
    }

    async deleteCategory(categoryId) {
        try {
            // Check if category has products
            const result = await this.db.query(`
                SELECT COUNT(*) as product_count
                FROM products
                WHERE category_id = $1 AND is_active = true
            `, [categoryId]);

            const productCount = parseInt(result.rows[0].product_count);
            if (productCount > 0) {
                throw new Error('Cannot delete category with active products');
            }

            // Soft delete - set is_active to false
            const deleteResult = await this.db.query(`
                UPDATE categories 
                SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND is_active = true
                RETURNING *
            `, [categoryId]);

            if (deleteResult.rows.length === 0) {
                throw new Error('Category not found or already deleted');
            }

            const category = deleteResult.rows[0];

            // Clear cache
            await this.clearCategoryCache(categoryId);
            await this.clearCategoriesCache();

            logger.info('Category deleted successfully', {
                categoryId: category.id,
                name: category.name
            });

            return category;
        } catch (error) {
            logger.error('Error deleting category', { error: error.message, categoryId });
            throw error;
        }
    }

    // Helper methods
    async findCategoryBySlug(slug) {
        try {
            const result = await this.db.query('SELECT * FROM categories WHERE slug = $1', [slug]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding category by slug', { error: error.message, slug });
            throw error;
        }
    }

    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .trim('-'); // Remove leading/trailing hyphens
    }

    async clearCategoryCache(categoryId) {
        if (this.redis && this.redis.isConnected) {
            await this.redis.deleteCachedData(`${this.cachePrefix}${categoryId}`);
        }
    }

    async clearCategoriesCache() {
        if (this.redis && this.redis.isConnected) {
            await this.redis.deleteCachedData('categories:list:true');
            await this.redis.deleteCachedData('categories:list:false');
        }
    }
}

module.exports = CategoryService;