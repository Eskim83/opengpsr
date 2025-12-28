import prisma from '../config/database';
import { Brand, BrandLink, BrandVersion, Prisma, BrandLinkType, MarketContext, BrandElectronicContact } from '@prisma/client';
import {
    CreateBrandInput,
    UpdateBrandInput,
    BrandQueryInput,
    CreateBrandLinkInput
} from '../schemas';
import { sourceService } from './sourceService';
import { NotFoundError } from '../utils/errors';
import { withP2002Retry } from '../utils/prismaRetry';
import { config } from '../config';

// Types
export type BrandWithRelations = Brand & {
    entityLinks: (BrandLink & { entity: { id: string; normalizedName: string; normalizedCountry: string } })[];
    products: { id: string; productName: string; ean: string | null }[];
    contacts: BrandElectronicContact[];
};

/**
 * Service for managing Brands (trade names / trademarks)
 * Uses per-brand version numbering and currentVersionId pointer
 * FIX: Added P2002 retry for version number race conditions
 */
export class BrandService {
    /**
     * Create a new brand with initial version
     */
    async create(data: CreateBrandInput): Promise<Brand> {
        const source = await sourceService.findOrCreate(data.source);

        const brand = await prisma.$transaction(async (tx) => {
            // Create brand first
            const newBrand = await tx.brand.create({
                data: {
                    tradeName: data.tradeName,
                    tradeMarkNumber: data.tradeMarkNumber,
                    tradeMarkOffice: data.tradeMarkOffice,
                    logoUrl: data.logoUrl,
                    description: data.description,
                },
            });

            // Create initial version (version 1) - no race possible on create
            const version = await tx.brandVersion.create({
                data: {
                    brandId: newBrand.id,
                    sourceId: source.id,
                    versionNumber: 1,
                    originalData: data as unknown as Prisma.JsonObject,
                    normalizedData: {
                        tradeName: data.tradeName,
                        tradeMarkNumber: data.tradeMarkNumber,
                        tradeMarkOffice: data.tradeMarkOffice,
                    } as unknown as Prisma.JsonObject,
                },
            });

            // Update brand with current version pointer
            const updatedBrand = await tx.brand.update({
                where: { id: newBrand.id },
                data: { currentVersionId: version.id },
            });

            await tx.auditLog.create({
                data: {
                    action: 'CREATE',
                    entityType: 'Brand',
                    entityId: newBrand.id,
                    newData: updatedBrand as unknown as Prisma.JsonObject,
                },
            });

            return updatedBrand;
        });

        return brand;
    }

    /**
     * Update a brand (creates new version)
     * FIX: Uses P2002 retry for version number race conditions
     */
    async update(id: string, data: UpdateBrandInput): Promise<Brand> {
        const current = await this.getById(id);
        const source = await sourceService.findOrCreate(data.source);

        const updates: Partial<Brand> = {};
        if (data.tradeName) updates.tradeName = data.tradeName;
        if (data.tradeMarkNumber !== undefined) updates.tradeMarkNumber = data.tradeMarkNumber;
        if (data.tradeMarkOffice !== undefined) updates.tradeMarkOffice = data.tradeMarkOffice;
        if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl || null;
        if (data.description !== undefined) updates.description = data.description;
        if (data.isVerified !== undefined) updates.isVerified = data.isVerified;
        if (data.isActive !== undefined) updates.isActive = data.isActive;

        // FIX: Wrap in retry for P2002 race conditions
        const brand = await withP2002Retry(async () => {
            return prisma.$transaction(async (tx) => {
                // Get current max version number INSIDE transaction
                const maxVersion = await tx.brandVersion.aggregate({
                    where: { brandId: id },
                    _max: { versionNumber: true },
                });
                const nextVersionNumber = (maxVersion._max.versionNumber || 0) + 1;

                // Create new version
                const newVersion = await tx.brandVersion.create({
                    data: {
                        brandId: id,
                        sourceId: source.id,
                        versionNumber: nextVersionNumber,
                        originalData: data as unknown as Prisma.JsonObject,
                        normalizedData: {
                            tradeName: updates.tradeName ?? current.tradeName,
                            tradeMarkNumber: updates.tradeMarkNumber ?? current.tradeMarkNumber,
                        } as unknown as Prisma.JsonObject,
                        changeNote: data.changeNote,
                    },
                });

                // Update brand with new current version pointer
                const updated = await tx.brand.update({
                    where: { id },
                    data: {
                        ...updates,
                        currentVersionId: newVersion.id,
                    },
                });

                await tx.auditLog.create({
                    data: {
                        action: 'UPDATE',
                        entityType: 'Brand',
                        entityId: id,
                        previousData: current as unknown as Prisma.JsonObject,
                        newData: updated as unknown as Prisma.JsonObject,
                    },
                });

                return updated;
            });
        });

        return brand;
    }

    /**
     * Get brand by ID with relations
     */
    async getById(id: string): Promise<BrandWithRelations> {
        const brand = await prisma.brand.findUnique({
            where: { id },
            include: {
                entityLinks: {
                    where: { isActive: true },
                    include: {
                        entity: {
                            select: {
                                id: true,
                                normalizedName: true,
                                normalizedCountry: true,
                            },
                        },
                    },
                },
                products: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        productName: true,
                        ean: true,
                    },
                    take: 10,
                },
                contacts: {
                    where: { isActive: true, isPublic: true },
                },
                safetyAlerts: {
                    where: { isActive: true },
                    orderBy: { alertDate: 'desc' },
                    take: 5,
                },
            },
        });

        if (!brand) {
            throw new NotFoundError('Brand');
        }

        return brand as BrandWithRelations;
    }

    /**
     * List brands with filtering
     */
    async list(query: BrandQueryInput): Promise<{
        brands: Brand[];
        total: number;
        limit: number;
        offset: number;
    }> {
        const limit = Math.min(
            parseInt(query.limit || String(config.pagination.defaultLimit)),
            config.pagination.maxLimit
        );
        const offset = parseInt(query.offset || '0');

        const where: Prisma.BrandWhereInput = {};

        if (query.search) {
            where.tradeName = { contains: query.search, mode: 'insensitive' };
        }
        if (query.isVerified !== undefined) {
            where.isVerified = query.isVerified === 'true';
        }
        if (query.isActive !== undefined) {
            where.isActive = query.isActive === 'true';
        } else {
            where.isActive = true;
        }

        const [brands, total] = await Promise.all([
            prisma.brand.findMany({
                where,
                orderBy: { tradeName: 'asc' },
                take: limit,
                skip: offset,
            }),
            prisma.brand.count({ where }),
        ]);

        return { brands, total, limit, offset };
    }

    /**
     * Link a brand to an entity
     */
    async addEntityLink(brandId: string, data: CreateBrandLinkInput): Promise<BrandLink> {
        // Verify both exist
        await this.getById(brandId);

        const entityExists = await prisma.entity.findUnique({ where: { id: data.entityId } });
        if (!entityExists) {
            throw new NotFoundError('Entity');
        }

        const link = await prisma.$transaction(async (tx) => {
            const newLink = await tx.brandLink.create({
                data: {
                    brandId,
                    entityId: data.entityId,
                    linkType: data.linkType,
                    marketContext: (data.marketContext as MarketContext) || 'GLOBAL',
                    productScope: data.productScope,
                    validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
                    validTo: data.validTo ? new Date(data.validTo) : undefined,
                },
            });

            await tx.auditLog.create({
                data: {
                    action: 'LINK_BRAND',
                    entityType: 'BrandLink',
                    entityId: newLink.id,
                    newData: newLink as unknown as Prisma.JsonObject,
                },
            });

            return newLink;
        });

        return link;
    }

    /**
     * Get entities linked to a brand by role
     */
    async getLinkedEntities(brandId: string, linkType?: BrandLinkType, marketContext?: MarketContext) {
        return prisma.brandLink.findMany({
            where: {
                brandId,
                isActive: true,
                ...(linkType && { linkType }),
                ...(marketContext && { marketContext }),
            },
            include: {
                entity: {
                    include: {
                        contacts: {
                            where: { isActive: true, isPublic: true },
                        },
                    },
                },
            },
        });
    }

    /**
     * Deactivate a brand (soft delete)
     */
    async deactivate(id: string): Promise<Brand> {
        await this.getById(id);

        return prisma.$transaction(async (tx) => {
            const updated = await tx.brand.update({
                where: { id },
                data: { isActive: false },
            });

            await tx.auditLog.create({
                data: {
                    action: 'DEACTIVATE',
                    entityType: 'Brand',
                    entityId: id,
                    previousData: { isActive: true } as unknown as Prisma.JsonObject,
                    newData: { isActive: false } as unknown as Prisma.JsonObject,
                },
            });

            return updated;
        });
    }
}

export const brandService = new BrandService();
