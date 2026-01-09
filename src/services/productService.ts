import prisma from '../config/database';
import { ProductReference, SafetyInfo, Prisma } from '@prisma/client';
import {
    CreateProductInput,
    UpdateProductInput,
    ProductQueryInput,
    CreateSafetyInfoInput,
    UpdateSafetyInfoInput
} from '../schemas';
import { sourceService } from './sourceService';
import { NotFoundError } from '../utils/errors';
import { config } from '../config';

/**
 * Product with current safety information and brand details.
 * Used for product detail views and lookups.
 */
export type ProductWithSafety = ProductReference & {
    safetyInfo: SafetyInfo[];
    brand: { id: string; tradeName: string };
};

/**
 * Service for managing Product References and Safety Information.
 * 
 * Products are identified by EAN/GTIN/MPN and linked to brands.
 * Safety information is versioned per country/language combination,
 * allowing for localized warnings and documentation.
 * 
 * @remarks
 * - Uses `isCurrent` flag for SafetyInfo versioning
 * - Products can have multiple safety info records for different markets
 * - Supports product lookup by EAN, GTIN, or MPN
 */
export class ProductService {
    /**
     * Create a new product reference.
     * 
     * @param data - Product data including brand ID and identifiers
     * @returns The created product
     * @throws NotFoundError if brand doesn't exist
     */
    async create(data: CreateProductInput): Promise<ProductReference> {
        // Verify brand exists
        const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
        if (!brand) {
            throw new NotFoundError('Brand');
        }

        const product = await prisma.$transaction(async (tx) => {
            const newProduct = await tx.productReference.create({
                data: {
                    brandId: data.brandId,
                    productName: data.productName,
                    ean: data.ean,
                    gtin: data.gtin,
                    mpn: data.mpn,
                    modelNumber: data.modelNumber,
                    sku: data.sku,
                    productCategory: data.productCategory,
                    imageUrl: data.imageUrl,
                    productUrl: data.productUrl,
                },
            });

            await tx.auditLog.create({
                data: {
                    action: 'CREATE',
                    entityType: 'ProductReference',
                    entityId: newProduct.id,
                    newData: newProduct as unknown as Prisma.JsonObject,
                },
            });

            return newProduct;
        });

        return product;
    }

    /**
     * Update a product reference.
     * 
     * @param id - Product UUID
     * @param data - Update data
     * @returns The updated product
     * @throws NotFoundError if product doesn't exist
     */
    async update(id: string, data: UpdateProductInput): Promise<ProductReference> {
        const current = await this.getById(id);

        const updates: Partial<ProductReference> = {};
        if (data.productName) updates.productName = data.productName;
        if (data.ean !== undefined) updates.ean = data.ean;
        if (data.gtin !== undefined) updates.gtin = data.gtin;
        if (data.mpn !== undefined) updates.mpn = data.mpn;
        if (data.modelNumber !== undefined) updates.modelNumber = data.modelNumber;
        if (data.sku !== undefined) updates.sku = data.sku;
        if (data.productCategory !== undefined) updates.productCategory = data.productCategory;
        if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl || null;
        if (data.productUrl !== undefined) updates.productUrl = data.productUrl || null;
        if (data.isActive !== undefined) updates.isActive = data.isActive;

        const product = await prisma.$transaction(async (tx) => {
            const updated = await tx.productReference.update({
                where: { id },
                data: updates,
            });

            await tx.auditLog.create({
                data: {
                    action: 'UPDATE',
                    entityType: 'ProductReference',
                    entityId: id,
                    previousData: current as unknown as Prisma.JsonObject,
                    newData: updated as unknown as Prisma.JsonObject,
                },
            });

            return updated;
        });

        return product;
    }

    /**
     * Get product by ID with current safety info.
     * 
     * Only returns active, current safety information.
     * 
     * @param id - Product UUID
     * @returns Product with safety info and brand
     * @throws NotFoundError if product doesn't exist
     */
    async getById(id: string): Promise<ProductWithSafety> {
        const product = await prisma.productReference.findUnique({
            where: { id },
            include: {
                brand: {
                    select: { id: true, tradeName: true },
                },
                safetyInfo: {
                    where: { isActive: true, isCurrent: true },
                    orderBy: { countryCode: 'asc' },
                },
            },
        });

        if (!product) {
            throw new NotFoundError('Product');
        }

        return product;
    }

    /**
     * Find product by EAN, GTIN, or MPN.
     * 
     * Searches across all product identifiers for a match.
     * Useful for barcode scanning and product lookups.
     * 
     * @param identifier - EAN, GTIN, or MPN to search for
     * @returns Matching product or null if not found
     */
    async findByIdentifier(identifier: string): Promise<ProductReference | null> {
        return prisma.productReference.findFirst({
            where: {
                isActive: true,
                OR: [
                    { ean: identifier },
                    { gtin: identifier },
                    { mpn: identifier },
                ],
            },
            include: {
                brand: true,
                safetyInfo: {
                    where: { isActive: true, isCurrent: true },
                },
            },
        });
    }

    /**
     * List products with filtering
     */
    async list(query: ProductQueryInput): Promise<{
        products: ProductReference[];
        total: number;
        limit: number;
        offset: number;
    }> {
        const limit = Math.min(
            parseInt(query.limit || String(config.pagination.defaultLimit)),
            config.pagination.maxLimit
        );
        const offset = parseInt(query.offset || '0');

        const where: Prisma.ProductReferenceWhereInput = { isActive: true };

        if (query.brandId) {
            where.brandId = query.brandId;
        }
        if (query.search) {
            where.productName = { contains: query.search, mode: 'insensitive' };
        }
        if (query.ean) {
            where.ean = query.ean;
        }
        if (query.gtin) {
            where.gtin = query.gtin;
        }

        const [products, total] = await Promise.all([
            prisma.productReference.findMany({
                where,
                include: {
                    brand: { select: { id: true, tradeName: true } },
                },
                orderBy: { productName: 'asc' },
                take: limit,
                skip: offset,
            }),
            prisma.productReference.count({ where }),
        ]);

        return { products, total, limit, offset };
    }

    // =========================================================================
    // Safety Info Methods - FIX A: Proper versioning
    // =========================================================================

    /**
     * Add safety information for a product in a specific country/language.
     * 
     * Creates a new version of safety info for the given product/country/language
     * combination. Previous versions are marked as non-current but preserved
     * for audit trail.
     * 
     * @param data - Safety info data including product ID, country, language, and content
     * @returns The created safety info record
     * @throws NotFoundError if product doesn't exist
     */
    async addSafetyInfo(data: CreateSafetyInfoInput): Promise<SafetyInfo> {
        // Verify product exists
        await this.getById(data.productId);

        // Get or create source if provided
        let sourceId: string | undefined;
        if (data.source) {
            const source = await sourceService.findOrCreate(data.source);
            sourceId = source.id;
        }

        const countryCode = data.countryCode.toUpperCase();
        const languageCode = data.languageCode.toLowerCase();

        const safetyInfo = await prisma.$transaction(async (tx) => {
            // Find current version for this product/country/language
            const currentVersion = await tx.safetyInfo.findFirst({
                where: {
                    productId: data.productId,
                    countryCode,
                    languageCode,
                    isCurrent: true,
                },
            });

            // Calculate next version number
            const maxVersion = await tx.safetyInfo.aggregate({
                where: {
                    productId: data.productId,
                    countryCode,
                    languageCode,
                },
                _max: { versionNumber: true },
            });
            const nextVersionNumber = (maxVersion._max.versionNumber || 0) + 1;

            // Mark old version as not current
            if (currentVersion) {
                await tx.safetyInfo.update({
                    where: { id: currentVersion.id },
                    data: {
                        isCurrent: false,
                        validTo: new Date(),
                    },
                });
            }

            // Create new version
            const newInfo = await tx.safetyInfo.create({
                data: {
                    productId: data.productId,
                    countryCode,
                    languageCode,
                    warningText: data.warningText,
                    safetyInstructions: data.safetyInstructions,
                    ageRestriction: data.ageRestriction,
                    hazardSymbols: data.hazardSymbols || [],
                    documentUrl: data.documentUrl,
                    documentType: data.documentType,
                    sourceId,
                    versionNumber: nextVersionNumber,
                    isCurrent: true,
                    supersededBy: null,
                },
            });

            // Link old version to new
            if (currentVersion) {
                await tx.safetyInfo.update({
                    where: { id: currentVersion.id },
                    data: { supersededBy: newInfo.id },
                });
            }

            await tx.auditLog.create({
                data: {
                    action: 'CREATE',
                    entityType: 'SafetyInfo',
                    entityId: newInfo.id,
                    newData: newInfo as unknown as Prisma.JsonObject,
                },
            });

            return newInfo;
        });

        return safetyInfo;
    }

    /**
     * Update current safety information (creates new version).
     * 
     * If updating the current version, creates a new version with the
     * updated data. Historical versions are updated in place (rare case).
     * 
     * @param id - SafetyInfo UUID
     * @param data - Update data
     * @returns The updated/new safety info
     * @throws NotFoundError if safety info doesn't exist
     */
    async updateSafetyInfo(id: string, data: UpdateSafetyInfoInput): Promise<SafetyInfo> {
        const current = await prisma.safetyInfo.findUnique({ where: { id } });
        if (!current) {
            throw new NotFoundError('Safety info');
        }

        // If updating current version, create new version
        if (current.isCurrent) {
            return this.addSafetyInfo({
                productId: current.productId,
                countryCode: current.countryCode,
                languageCode: current.languageCode,
                warningText: data.warningText ?? current.warningText ?? undefined,
                safetyInstructions: data.safetyInstructions ?? current.safetyInstructions ?? undefined,
                ageRestriction: data.ageRestriction ?? current.ageRestriction ?? undefined,
                hazardSymbols: data.hazardSymbols ?? current.hazardSymbols,
                documentUrl: data.documentUrl ?? current.documentUrl ?? undefined,
                documentType: (data.documentType ?? current.documentType) as any,
            });
        }

        // If updating historical version (rare), just update in place
        return prisma.safetyInfo.update({
            where: { id },
            data: {
                warningText: data.warningText,
                safetyInstructions: data.safetyInstructions,
                ageRestriction: data.ageRestriction,
                hazardSymbols: data.hazardSymbols,
                documentUrl: data.documentUrl || undefined,
                isActive: data.isActive,
            },
        });
    }

    /**
     * Get current safety info for a product in a specific country/language
     */
    async getSafetyInfo(productId: string, countryCode: string, languageCode?: string): Promise<SafetyInfo | null> {
        return prisma.safetyInfo.findFirst({
            where: {
                productId,
                countryCode: countryCode.toUpperCase(),
                ...(languageCode && { languageCode: languageCode.toLowerCase() }),
                isActive: true,
                isCurrent: true,
            },
        });
    }

    /**
     * Get all current safety info for a product
     */
    async getAllSafetyInfo(productId: string): Promise<SafetyInfo[]> {
        return prisma.safetyInfo.findMany({
            where: { productId, isActive: true, isCurrent: true },
            orderBy: [{ countryCode: 'asc' }, { languageCode: 'asc' }],
        });
    }

    /**
     * Get safety info history for a product/country/language
     */
    async getSafetyInfoHistory(productId: string, countryCode: string, languageCode: string): Promise<SafetyInfo[]> {
        return prisma.safetyInfo.findMany({
            where: {
                productId,
                countryCode: countryCode.toUpperCase(),
                languageCode: languageCode.toLowerCase(),
            },
            orderBy: { versionNumber: 'desc' },
        });
    }
}

export const productService = new ProductService();
