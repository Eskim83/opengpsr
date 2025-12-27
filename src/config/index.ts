export const config = {
    // Server configuration
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },

    // Pagination defaults
    pagination: {
        defaultLimit: 20,
        maxLimit: 100,
    },

    // API versioning
    apiVersion: 'v1',
} as const;

export type Config = typeof config;
