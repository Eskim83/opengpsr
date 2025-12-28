import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { entityService, verificationService, contactService } from '../services';
import { publicRateLimiter } from '../middleware';
import { RoleType, SourceType, VerificationStatusType, MarketContext } from '@prisma/client';

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
 * 
 * FIX: Removed normalizedEmail (doesn't exist in schema).
 * Contact info now comes from EntityElectronicContact where isPublic=true.
 */
router.get('/entities/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entity = await entityService.getById(req.params.id);
        const latestVerification = await verificationService.getLatestVerificationStatus(entity.id);

        // FIX: Get public contacts from EntityElectronicContact
        const publicContacts = await contactService.getForEntity(entity.id, { publicOnly: true });

        // Extract email contact if available
        const emailContact = publicContacts.find(c => c.contactType === 'EMAIL');
        const formContact = publicContacts.find(c => c.contactType === 'CONTACT_FORM' || c.contactType === 'WEBSITE_SECTION');

        res.json({
            success: true,
            data: {
                id: entity.id,
                name: entity.normalizedName,
                address: entity.normalizedAddress,
                city: entity.normalizedCity,
                country: entity.normalizedCountry,
                website: entity.normalizedWebsite,
                phone: entity.normalizedPhone,
                // FIX: Contact info from ElectronicContact, not Entity
                electronicContacts: publicContacts.map(c => ({
                    type: c.contactType,
                    value: c.value,
                    label: c.label,
                    directCommunicationConfirmed: c.directCommunicationConfirmed,
                })),
                // Legacy field for backward compatibility
                email: emailContact?.value,
                contactFormUrl: formContact?.value,
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
            version: '2.0.0',
            description: 'OpenGPSR API Schema - Public Reference Data for GPSR Entities and Brands',
            disclaimer: 'This data is informational only. It does not constitute legal advice or guarantee compliance with GPSR regulations.',
            entities: {
                description: 'Business entities relevant to GPSR (producers, importers, responsible persons)',
                fields: {
                    id: 'Unique identifier (UUID)',
                    name: 'Normalized entity name',
                    address: 'Business address (postal address per GPSR)',
                    city: 'City',
                    country: 'ISO 3166-1 alpha-2 country code',
                    website: 'Entity website URL',
                    phone: 'Contact phone',
                    electronicContacts: 'Array of electronic contact points (email, forms) per GPSR',
                    roles: 'Array of GPSR roles with market context',
                    verificationStatus: 'Current verification status (informational only)',
                },
            },
            brands: {
                description: 'Trade names and trademarks (operational core for e-commerce)',
                fields: {
                    id: 'Unique identifier (UUID)',
                    tradeName: 'Registered trade name or trademark',
                    tradeMarkNumber: 'Official trademark registration number',
                    linkedEntities: 'Entities responsible for this brand in various markets',
                },
            },
            roleTypes: Object.values(RoleType),
            sourceTypes: Object.values(SourceType),
            verificationStatuses: Object.values(VerificationStatusType),
            marketContexts: Object.values(MarketContext),
            electronicContactTypes: ['EMAIL', 'CONTACT_FORM', 'WEBSITE_SECTION', 'OTHER'],
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
 * 
 * FIX: Uses prisma directly instead of require() and inefficient patterns
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [
            totalEntities,
            activeEntities,
            totalBrands,
            totalSources,
            entitiesByCountry,
        ] = await Promise.all([
            prisma.entity.count(),
            prisma.entity.count({ where: { isActive: true } }),
            prisma.brand.count({ where: { isActive: true } }),
            prisma.source.count(),
            prisma.entity.groupBy({
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
                totalBrands,
                totalSources,
                topCountries: entitiesByCountry.map((c) => ({
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
