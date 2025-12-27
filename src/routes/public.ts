import { Router, Request, Response, NextFunction } from 'express';
import { entityService, verificationService } from '../services';
import { publicRateLimiter } from '../middleware';
import { RoleType, SourceType, VerificationStatusType } from '@prisma/client';

const router = Router();

// Apply rate limiting to all public routes
router.use(publicRateLimiter);

/**
 * @route   GET /api/public/entities
 * @desc    Public read-only access to entities
 * @access  Public (rate-limited)
 */
router.get('/entities', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await entityService.list({
            search: req.query.search as string,
            country: req.query.country as string,
            role: req.query.role as RoleType,
            isActive: 'true', // Only active entities in public API
            limit: req.query.limit as string,
            offset: req.query.offset as string,
        });

        // Return simplified public view
        const publicEntities = result.entities.map((entity) => ({
            id: entity.id,
            name: entity.normalizedName,
            country: entity.normalizedCountry,
            city: entity.normalizedCity,
            roles: entity.roles.map((r) => ({
                type: r.roleType,
                marketContext: r.marketContext,
            })),
        }));

        res.json({
            success: true,
            data: publicEntities,
            pagination: {
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                hasMore: result.offset + result.limit < result.total,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/public/entities/:id
 * @desc    Public entity detail
 * @access  Public (rate-limited)
 */
router.get('/entities/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entity = await entityService.getById(req.params.id);
        const latestVerification = await verificationService.getLatestVerificationStatus(entity.id);

        // Return public view with limited information
        res.json({
            success: true,
            data: {
                id: entity.id,
                name: entity.normalizedName,
                address: entity.normalizedAddress,
                city: entity.normalizedCity,
                country: entity.normalizedCountry,
                website: entity.normalizedWebsite,
                email: entity.normalizedEmail,
                phone: entity.normalizedPhone,
                roles: entity.roles.map((r) => ({
                    type: r.roleType,
                    marketContext: r.marketContext,
                    productScope: r.productScope,
                })),
                verificationStatus: latestVerification?.status || 'UNVERIFIED',
                lastUpdated: entity.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/public/schema
 * @desc    Data schema documentation
 * @access  Public (rate-limited)
 */
router.get('/schema', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            version: '1.0.0',
            description: 'OpenGPSR API Schema - Public Reference Data for GPSR Entities',
            disclaimer: 'This data is informational only. It does not constitute legal advice or guarantee compliance with GPSR regulations.',
            entities: {
                description: 'Business entities relevant to GPSR (producers, importers, responsible persons)',
                fields: {
                    id: 'Unique identifier (UUID)',
                    name: 'Normalized entity name',
                    address: 'Business address',
                    city: 'City',
                    country: 'ISO 3166-1 alpha-2 country code',
                    website: 'Entity website URL',
                    email: 'Contact email',
                    phone: 'Contact phone',
                    roles: 'Array of GPSR roles',
                    verificationStatus: 'Current verification status (informational only)',
                },
            },
            roleTypes: Object.values(RoleType),
            sourceTypes: Object.values(SourceType),
            verificationStatuses: Object.values(VerificationStatusType),
            rateLimit: {
                windowMs: 900000,
                maxRequests: 100,
                description: 'Public API is rate-limited to prevent abuse',
            },
        },
    });
});

/**
 * @route   GET /api/public/stats
 * @desc    Public statistics about the database
 * @access  Public (rate-limited)
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [
            totalEntities,
            activeEntities,
            totalSources,
            entitiesByCountry,
        ] = await Promise.all([
            entityService.list({ limit: '1' }).then((r) => r.total),
            entityService.list({ isActive: 'true', limit: '1' }).then((r) => r.total),
            require('../config/database').default.source.count(),
            require('../config/database').default.entity.groupBy({
                by: ['normalizedCountry'],
                _count: true,
                where: { isActive: true },
                orderBy: { _count: { normalizedCountry: 'desc' } },
                take: 10,
            }),
        ]);

        res.json({
            success: true,
            data: {
                totalEntities,
                activeEntities,
                totalSources,
                topCountries: entitiesByCountry.map((c: any) => ({
                    country: c.normalizedCountry,
                    count: c._count,
                })),
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
