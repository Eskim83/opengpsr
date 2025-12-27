import rateLimit from 'express-rate-limit';
import { config } from '../config';

/**
 * Rate limiter for public API endpoints
 * Protects against abuse while allowing reasonable access
 */
export const publicRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        success: false,
        error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * More permissive rate limiter for authenticated/internal APIs
 */
export const apiRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests * 5, // 5x the public limit
    message: {
        success: false,
        error: {
            message: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
