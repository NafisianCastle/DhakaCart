const passwordManager = require('../auth/password');
const jwtManager = require('../auth/jwt');
const logger = require('../logger');

class UserService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
    }

    async createUser(userData) {
        const { email, password, firstName, lastName, phone } = userData;

        try {
            // Check if user already exists
            const existingUser = await this.findUserByEmail(email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Hash password
            const passwordHash = await passwordManager.hashPassword(password);

            // Generate email verification token
            const verificationToken = passwordManager.generateVerificationToken();

            // Create user in database
            const result = await this.db.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, phone, email_verified)
                VALUES ($1, $2, $3, $4, $5, false)
                RETURNING id, email, first_name, last_name, phone, is_active, email_verified, created_at
            `, [email, passwordHash, firstName, lastName, phone]);

            const user = result.rows[0];

            // Store verification token in Redis (expires in 24 hours)
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(
                    `email_verification:${verificationToken}`,
                    { userId: user.id, email: user.email },
                    24 * 60 * 60 // 24 hours
                );
            }

            logger.info('User created successfully', {
                userId: user.id,
                email: user.email
            });

            return {
                user: this.sanitizeUser(user),
                verificationToken
            };
        } catch (error) {
            logger.error('Error creating user', { error: error.message, email });
            throw error;
        }
    }

    async authenticateUser(email, password) {
        try {
            const user = await this.findUserByEmail(email);
            if (!user) {
                throw new Error('Invalid email or password');
            }

            if (!user.is_active) {
                throw new Error('Account is deactivated');
            }

            const isPasswordValid = await passwordManager.verifyPassword(password, user.password_hash);
            if (!isPasswordValid) {
                throw new Error('Invalid email or password');
            }

            // Generate JWT tokens
            const tokenPayload = {
                userId: user.id,
                email: user.email,
                role: user.role || 'customer',
                emailVerified: user.email_verified
            };

            const tokens = jwtManager.generateTokenPair(tokenPayload);

            // Store refresh token in Redis (optional, for token blacklisting)
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(
                    `refresh_token:${user.id}`,
                    tokens.refreshToken,
                    7 * 24 * 60 * 60 // 7 days
                );
            }

            logger.info('User authenticated successfully', {
                userId: user.id,
                email: user.email
            });

            return {
                user: this.sanitizeUser(user),
                tokens
            };
        } catch (error) {
            logger.error('Authentication failed', { error: error.message, email });
            throw error;
        }
    }

    async findUserByEmail(email) {
        try {
            const result = await this.db.query(
                'SELECT * FROM users WHERE email = $1',
                [email.toLowerCase()]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding user by email', { error: error.message, email });
            throw error;
        }
    }

    async findUserById(userId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM users WHERE id = $1 AND is_active = true',
                [userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding user by ID', { error: error.message, userId });
            throw error;
        }
    }

    async updateUser(userId, updateData) {
        const { firstName, lastName, phone } = updateData;

        try {
            const result = await this.db.query(`
                UPDATE users 
                SET first_name = COALESCE($2, first_name),
                    last_name = COALESCE($3, last_name),
                    phone = COALESCE($4, phone),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND is_active = true
                RETURNING id, email, first_name, last_name, phone, is_active, email_verified, created_at, updated_at
            `, [userId, firstName, lastName, phone]);

            if (result.rows.length === 0) {
                throw new Error('User not found or inactive');
            }

            const user = result.rows[0];

            logger.info('User updated successfully', {
                userId: user.id,
                email: user.email
            });

            return this.sanitizeUser(user);
        } catch (error) {
            logger.error('Error updating user', { error: error.message, userId });
            throw error;
        }
    }

    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await this.findUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const isCurrentPasswordValid = await passwordManager.verifyPassword(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            const newPasswordHash = await passwordManager.hashPassword(newPassword);

            await this.db.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newPasswordHash, userId]
            );

            // Invalidate all refresh tokens for this user
            if (this.redis && this.redis.isConnected) {
                await this.redis.deleteCachedData(`refresh_token:${userId}`);
            }

            logger.info('Password changed successfully', { userId });

            return true;
        } catch (error) {
            logger.error('Error changing password', { error: error.message, userId });
            throw error;
        }
    }

    async requestPasswordReset(email) {
        try {
            const user = await this.findUserByEmail(email);
            if (!user) {
                // Don't reveal if email exists or not for security
                logger.info('Password reset requested for non-existent email', { email });
                return { success: true };
            }

            const resetToken = passwordManager.generateResetToken();

            // Store reset token in Redis (expires in 1 hour)
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(
                    `password_reset:${resetToken}`,
                    { userId: user.id, email: user.email },
                    60 * 60 // 1 hour
                );
            }

            logger.info('Password reset token generated', {
                userId: user.id,
                email: user.email
            });

            return {
                success: true,
                resetToken // In production, this would be sent via email
            };
        } catch (error) {
            logger.error('Error requesting password reset', { error: error.message, email });
            throw error;
        }
    }

    async resetPassword(token, newPassword) {
        try {
            let resetData = null;

            // Get reset data from Redis
            if (this.redis && this.redis.isConnected) {
                resetData = await this.redis.getCachedData(`password_reset:${token}`);
            }

            if (!resetData) {
                throw new Error('Invalid or expired reset token');
            }

            const newPasswordHash = await passwordManager.hashPassword(newPassword);

            await this.db.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newPasswordHash, resetData.userId]
            );

            // Remove reset token
            if (this.redis && this.redis.isConnected) {
                await this.redis.deleteCachedData(`password_reset:${token}`);
                // Invalidate all refresh tokens for this user
                await this.redis.deleteCachedData(`refresh_token:${resetData.userId}`);
            }

            logger.info('Password reset successfully', {
                userId: resetData.userId,
                email: resetData.email
            });

            return true;
        } catch (error) {
            logger.error('Error resetting password', { error: error.message });
            throw error;
        }
    }

    async verifyEmail(token) {
        try {
            let verificationData = null;

            // Get verification data from Redis
            if (this.redis && this.redis.isConnected) {
                verificationData = await this.redis.getCachedData(`email_verification:${token}`);
            }

            if (!verificationData) {
                throw new Error('Invalid or expired verification token');
            }

            await this.db.query(
                'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [verificationData.userId]
            );

            // Remove verification token
            if (this.redis && this.redis.isConnected) {
                await this.redis.deleteCachedData(`email_verification:${token}`);
            }

            logger.info('Email verified successfully', {
                userId: verificationData.userId,
                email: verificationData.email
            });

            return true;
        } catch (error) {
            logger.error('Error verifying email', { error: error.message });
            throw error;
        }
    }

    async refreshToken(refreshToken) {
        try {
            const decoded = jwtManager.verifyRefreshToken(refreshToken);
            const user = await this.findUserById(decoded.userId);

            if (!user) {
                throw new Error('User not found');
            }

            // Check if refresh token is still valid in Redis
            if (this.redis && this.redis.isConnected) {
                const storedToken = await this.redis.getCachedData(`refresh_token:${user.id}`);
                if (storedToken !== refreshToken) {
                    throw new Error('Invalid refresh token');
                }
            }

            // Generate new token pair
            const tokenPayload = {
                userId: user.id,
                email: user.email,
                role: user.role || 'customer',
                emailVerified: user.email_verified
            };

            const tokens = jwtManager.generateTokenPair(tokenPayload);

            // Update stored refresh token
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(
                    `refresh_token:${user.id}`,
                    tokens.refreshToken,
                    7 * 24 * 60 * 60 // 7 days
                );
            }

            logger.info('Token refreshed successfully', { userId: user.id });

            return tokens;
        } catch (error) {
            logger.error('Error refreshing token', { error: error.message });
            throw error;
        }
    }

    async logout(userId) {
        try {
            // Remove refresh token from Redis
            if (this.redis && this.redis.isConnected) {
                await this.redis.deleteCachedData(`refresh_token:${userId}`);
            }

            logger.info('User logged out successfully', { userId });
            return true;
        } catch (error) {
            logger.error('Error during logout', { error: error.message, userId });
            throw error;
        }
    }

    sanitizeUser(user) {
        const { password_hash, ...sanitizedUser } = user;
        return sanitizedUser;
    }
}

module.exports = UserService;