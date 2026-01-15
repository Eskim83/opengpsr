import prisma from '../config/database';
import { auditService } from './index';
import { RoleType, Prisma } from '@prisma/client';
import { NotFoundError } from '../utils/errors';

/**
 * Service for managing Product Responsibilities (v2.0 P0)
 * 
 * Answers the core GPSR question: "Who is responsible for product X in country Y?"
 * Each responsibility links a product to an entity with a specific role in a specific country.
 * 
 * @example
 * // Get RP for a product in Poland
 * const rp = await responsibilityService.getForProduct(productId, 'PL', 'RESPONSIBLE_PERSON');
 * 
 * @example
 * // Assign a manufacturer for EU
 * await responsibilityService.assign({
 *   productId,
 *   countryCode: 'EU',
 *   entityId: manufacturerId,
 *   role: 'MANUFACTURER',
 *   sourceId,
 * });
 */
class ProductResponsibilityService {
    /**
     * Assign responsibility for a product in a specific country
     * 
     * @param data - Responsibility assignment data
     * @returns Created ProductResponsibility record
     * @throws ValidationError if product or entity not found
     */
    async assign(data: {
        productId: string;
        countryCode: string;
        entityId: string;
        role: RoleType;
        sourceId: string;
        confidence?: number;
        validFrom?: Date;
        validTo?: Date;
    }) {
        // Validate product exists
        const product = await prisma.productReference.findUnique({
            where: { id: data.productId },
        });
        if (!product) {
            throw new NotFoundError('Product not found');
        }

        // Validate entity exists
        const entity = await prisma.entity.findUnique({
            where: { id: data.entityId },
        });
        if (!entity) {
            throw new NotFoundError('Entity not found');
        }

        // Check for existing ACTIVE responsibility (same product/country/role)
        const existing = await prisma.productResponsibility.findFirst({
            where: {
                productId: data.productId,
                countryCode: data.countryCode.toUpperCase(),
                role: data.role,
                status: 'ACTIVE',
            },
        });

        // If exists, mark as HISTORICAL
        if (existing) {
            await prisma.productResponsibility.update({
                where: { id: existing.id },
                data: {
                    status: 'HISTORICAL',
                    validTo: new Date(),
                },
            });
        }

        // Create new responsibility
        const responsibility = await prisma.productResponsibility.create({
            data: {
                productId: data.productId,
                countryCode: data.countryCode.toUpperCase(),
                entityId: data.entityId,
                role: data.role,
                sourceId: data.sourceId,
                confidence: data.confidence ?? 50,
                validFrom: data.validFrom ?? new Date(),
                validTo: data.validTo,
                status: 'ACTIVE',
            },
            include: {
                product: true,
                entity: true,
                source: true,
            },
        });

        // Audit log
        await auditService.log({
            action: 'RESPONSIBILITY_ASSIGNED',
            entityType: 'ProductResponsibility',
            entityId: responsibility.id,
            newData: responsibility as unknown as Prisma.JsonObject,
        });

        return responsibility;
    }

    /**
     * Get current responsibility for a product
     * 
     * @param productId - Product UUID
     * @param countryCode - ISO 3166-1 alpha-2 country code
     * @param role - Optional: filter by specific role
     * @param status - Optional: filter by status (default: ACTIVE)
     * @returns Array of responsibilities
     */
    async getForProduct(
        productId: string,
        countryCode?: string,
        role?: RoleType,
        status: 'ACTIVE' | 'HISTORICAL' | 'DISPUTED' | undefined = 'ACTIVE'
    ) {
        // Build where clause dynamically (types will be available after migration)
        const where: Record<string, unknown> = {
            productId,
        };

        if (status) {
            where.status = status;
        }

        if (countryCode) {
            where.countryCode = countryCode.toUpperCase();
        }

        if (role) {
            where.role = role;
        }

        return prisma.productResponsibility.findMany({
            where,
            include: {
                entity: {
                    select: {
                        id: true,
                        normalizedName: true,
                        normalizedCountry: true,
                        normalizedAddress: true,
                        normalizedCity: true,
                    },
                },
                source: {
                    select: {
                        id: true,
                        sourceType: true,
                        sourceName: true,
                    },
                },
            },
            orderBy: [
                { role: 'asc' },
                { confidence: 'desc' },
            ],
        });
    }

    /**
     * Get resolved view: "Best known truth" for a product's responsibilities
     * 
     * Supports both CURRENT and HISTORICAL resolution modes:
     * - CURRENT: Returns currently active responsibilities (default)
     * - HISTORICAL: Returns responsibilities valid at a specific point in time
     * 
     * @param productId - Product UUID
     * @param countryCode - ISO 3166-1 alpha-2 country code
     * @param validOnDate - Optional: Date to resolve responsibilities at (for retrospective queries)
     * @returns Resolved responsibility info with confidence, freshness, and temporal context
     */
    async getResolved(productId: string, countryCode: string, validOnDate?: Date) {
        const resolvedAt = new Date();
        const resolutionMode = validOnDate ? 'HISTORICAL' : 'CURRENT';
        const targetDate = validOnDate || resolvedAt;

        // For HISTORICAL mode, query responsibilities valid at that date
        const responsibilities = await this.getForProduct(
            productId,
            countryCode,
            undefined, // role
            resolutionMode === 'HISTORICAL' ? undefined : 'ACTIVE'
        );

        // Filter for historical context
        const validResponsibilities = resolutionMode === 'HISTORICAL'
            ? responsibilities.filter((r: { validFrom: Date; validTo: Date | null }) => {
                const validFrom = r.validFrom;
                const validTo = r.validTo;
                return validFrom <= targetDate && (!validTo || validTo > targetDate);
            })
            : responsibilities;

        // Group by role
        const byRole: Record<string, typeof validResponsibilities> = {};
        for (const r of validResponsibilities) {
            if (!byRole[r.role]) {
                byRole[r.role] = [];
            }
            byRole[r.role].push(r);
        }

        // Select highest confidence per role
        const resolved: Record<string, {
            entity: typeof responsibilities[0]['entity'];
            role: RoleType;
            confidence: number;
            source: typeof responsibilities[0]['source'];
            validFrom: Date;
            dataFreshnessDays: number;
            hasConflicts: boolean;
        }> = {};

        for (const [role, items] of Object.entries(byRole)) {
            const sorted = [...items].sort(
                (a: (typeof responsibilities)[0], b: (typeof responsibilities)[0]) =>
                    (b.confidence ?? 0) - (a.confidence ?? 0)
            );
            const best = sorted[0];
            const freshnessDays = Math.floor(
                (targetDate.getTime() - best.validFrom.getTime()) / (1000 * 60 * 60 * 24)
            );

            resolved[role] = {
                entity: best.entity,
                role: best.role,
                confidence: best.confidence ?? 50,
                source: best.source,
                validFrom: best.validFrom,
                dataFreshnessDays: freshnessDays,
                hasConflicts: items.length > 1,
            };
        }

        return {
            productId,
            countryCode,
            context: {
                resolvedAt: resolvedAt.toISOString(),
                validOnDate: targetDate.toISOString(),
                resolutionMode,
            },
            responsibilities: resolved,
            conflictCount: Object.values(byRole).filter(items => items.length > 1).length,
        };
    }

    /**
     * Get all responsibilities for an entity (what are they responsible for?)
     * 
     * @param entityId - Entity UUID
     * @returns Array of active responsibilities
     */
    async getForEntity(entityId: string) {
        return prisma.productResponsibility.findMany({
            where: {
                entityId,
                status: 'ACTIVE',
            },
            include: {
                product: {
                    select: {
                        id: true,
                        productName: true,
                        ean: true,
                        brand: {
                            select: {
                                id: true,
                                tradeName: true,
                            },
                        },
                    },
                },
                source: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Mark responsibility as disputed
     * 
     * @param id - Responsibility UUID
     * @param reason - Dispute reason (optional, for audit)
     */
    async dispute(id: string, reason?: string) {
        const responsibility = await prisma.productResponsibility.update({
            where: { id },
            data: { status: 'DISPUTED' },
        });

        await auditService.log({
            action: 'RESPONSIBILITY_DISPUTED',
            entityType: 'ProductResponsibility',
            entityId: id,
            newData: { reason } as Prisma.JsonObject,
        });

        return responsibility;
    }

    /**
     * Get history of responsibilities for a product
     * 
     * @param productId - Product UUID
     * @param countryCode - Optional country filter
     */
    async getHistory(productId: string, countryCode?: string) {
        // Build where clause dynamically (types will be available after migration)
        const where: Record<string, unknown> = { productId };
        if (countryCode) {
            where.countryCode = countryCode.toUpperCase();
        }

        return prisma.productResponsibility.findMany({
            where,
            include: {
                entity: {
                    select: {
                        id: true,
                        normalizedName: true,
                    },
                },
                source: true,
            },
            orderBy: [
                { countryCode: 'asc' },
                { role: 'asc' },
                { validFrom: 'desc' },
            ],
        });
    }
}

export const productResponsibilityService = new ProductResponsibilityService();
export default productResponsibilityService;
