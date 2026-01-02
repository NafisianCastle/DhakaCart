const jwt = require('jsonwebtoken');
const logger = require('../logger');

class JWTManager {
    constructor() {
        this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';
        this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    }

    generateAccessToken(payload) {
        try {
            return jwt.sign(payload, this.accessTokenSecret, {
                expiresIn: this.accessTokenExpiry,
                issuer: 'dhakacart-api',
                audience: 'dhakacart-client'
            });
        } catch (error) {
            logger.error('Error generating access token', { error: error.message });
            throw new Error('Token generation failed');
        }
    }

    generateRefreshToken(payload) {
        try {
            return jwt.sign(payload, this.refreshTokenSecret, {
                expiresIn: this.refreshTokenExpiry,
                issuer: 'dhakacart-api',
                audience: 'dhakacart-client'
            });
        } catch (error) {
            logger.error('Error generating refresh token', { error: error.message });
            throw new Error('Token generation failed');
        }
    }

    verifyAccessToken(token) {
        try {
            return jwt.verify(token, this.accessTokenSecret, {
                issuer: 'dhakacart-api',
                audience: 'dhakacart-client'
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Access token expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid access token');
            }
            throw new Error('Token verification failed');
        }
    }

    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, this.refreshTokenSecret, {
                issuer: 'dhakacart-api',
                audience: 'dhakacart-client'
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Refresh token expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid refresh token');
            }
            throw new Error('Token verification failed');
        }
    }

    generateTokenPair(payload) {
        const accessToken = this.generateAccessToken(payload);
        const refreshToken = this.generateRefreshToken({ userId: payload.userId });

        return {
            accessToken,
            refreshToken,
            expiresIn: this.accessTokenExpiry
        };
    }
}

module.exports = new JWTManager();