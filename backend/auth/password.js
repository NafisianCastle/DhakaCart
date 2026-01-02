const bcrypt = require('bcrypt');
const crypto = require('crypto');
const logger = require('../logger');

class PasswordManager {
    constructor() {
        this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    }

    async hashPassword(password) {
        try {
            if (!password || password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            const salt = await bcrypt.genSalt(this.saltRounds);
            const hashedPassword = await bcrypt.hash(password, salt);

            logger.debug('Password hashed successfully');
            return hashedPassword;
        } catch (error) {
            logger.error('Error hashing password', { error: error.message });
            throw new Error('Password hashing failed');
        }
    }

    async verifyPassword(password, hashedPassword) {
        try {
            const isValid = await bcrypt.compare(password, hashedPassword);
            logger.debug('Password verification completed', { isValid });
            return isValid;
        } catch (error) {
            logger.error('Error verifying password', { error: error.message });
            throw new Error('Password verification failed');
        }
    }

    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateVerificationToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    validatePasswordStrength(password) {
        const errors = [];

        if (!password) {
            errors.push('Password is required');
            return { isValid: false, errors };
        }

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (password.length > 128) {
            errors.push('Password must be less than 128 characters');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Check for common weak patterns
        const commonPatterns = [
            /(.)\1{2,}/, // Repeated characters (aaa, 111)
            /123456|654321|qwerty|password|admin/i, // Common sequences
        ];

        for (const pattern of commonPatterns) {
            if (pattern.test(password)) {
                errors.push('Password contains common patterns and is too weak');
                break;
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = new PasswordManager();