import { z } from 'zod';
import {
    RoleType,
    SourceType,
    VerificationStatusType,
    BrandLinkType,
    ElectronicContactType,
    MarketContext
} from '@prisma/client';

// ============================================================================
// Entity Schemas
// ============================================================================

export const createEntitySchema = z.object({
    // Required fields
    name: z.string().min(1, 'Name is required').max(500),
    country: z.string().length(2, 'Country must be ISO 3166-1 alpha-2 code'),

    // Optional fields
    address: z.string().max(500).optional(),
    city: z.string().max(200).optional(),
    vatId: z.string().max(50).optional(),
    phone: z.string().max(50).optional(),
    website: z.string().url().optional().or(z.literal('')),

    // Role (optional on creation)
    role: z.nativeEnum(RoleType).optional(),
    marketContext: z.nativeEnum(MarketContext).optional(),

    // Source information (required)
    source: z.object({
        sourceType: z.nativeEnum(SourceType),
        sourceIdentifier: z.string().max(500).optional(),
        description: z.string().max(1000).optional(),
        sourceUrl: z.string().url().optional(),
        sourceName: z.string().max(200).optional(),
    }),
});

export const updateEntitySchema = z.object({
    name: z.string().min(1).max(500).optional(),
    country: z.string().length(2).optional(),
    address: z.string().max(500).optional(),
    city: z.string().max(200).optional(),
    vatId: z.string().max(50).optional(),
    phone: z.string().max(50).optional(),
    website: z.string().url().optional().or(z.literal('')),
    isActive: z.boolean().optional(),

    // Change tracking
    changeNote: z.string().max(500).optional(),

    // Source for this update
    source: z.object({
        sourceType: z.nativeEnum(SourceType),
        sourceIdentifier: z.string().max(500).optional(),
        description: z.string().max(1000).optional(),
    }),
});

export const entityQuerySchema = z.object({
    search: z.string().optional(),
    country: z.string().length(2).optional(),
    role: z.nativeEnum(RoleType).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
});

// ============================================================================
// Brand Schemas
// ============================================================================

export const createBrandSchema = z.object({
    tradeName: z.string().min(1, 'Trade name is required').max(300),
    tradeMarkNumber: z.string().max(100).optional(),
    tradeMarkOffice: z.string().max(50).optional(),
    logoUrl: z.string().url().optional(),
    description: z.string().max(1000).optional(),

    // Source information
    source: z.object({
        sourceType: z.nativeEnum(SourceType),
        sourceIdentifier: z.string().max(500).optional(),
        description: z.string().max(1000).optional(),
    }),
});

export const updateBrandSchema = z.object({
    tradeName: z.string().min(1).max(300).optional(),
    tradeMarkNumber: z.string().max(100).optional(),
    tradeMarkOffice: z.string().max(50).optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
    description: z.string().max(1000).optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    changeNote: z.string().max(500).optional(),

    source: z.object({
        sourceType: z.nativeEnum(SourceType),
        sourceIdentifier: z.string().max(500).optional(),
    }),
});

export const brandQuerySchema = z.object({
    search: z.string().optional(),
    isVerified: z.enum(['true', 'false']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
});

export const createBrandLinkSchema = z.object({
    entityId: z.string().uuid(),
    linkType: z.nativeEnum(BrandLinkType),
    marketContext: z.nativeEnum(MarketContext).optional(), // Defaults to GLOBAL
    productScope: z.string().max(500).optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
});

// ============================================================================
// Electronic Contact Schemas - FIX B: Separate schemas for entity/brand
// ============================================================================

export const createElectronicContactSchema = z.object({
    contactType: z.nativeEnum(ElectronicContactType),
    value: z.string().min(1).max(500), // email or URL
    label: z.string().max(200).optional(),
    languageCode: z.string().length(2).optional(),

    // Purpose flags
    isForSafetyIssues: z.boolean().optional(),
    isForConsumerComplaints: z.boolean().optional(),
    isPublic: z.boolean().optional(),
});

export const confirmContactSchema = z.object({
    confirmationMethod: z.string().max(200),
    confirmedBy: z.string().max(200).optional(),
});

// ============================================================================
// Product & Safety Schemas
// ============================================================================

export const createProductSchema = z.object({
    brandId: z.string().uuid(),
    productName: z.string().min(1).max(500),

    // Product identifiers (at least one recommended)
    ean: z.string().regex(/^\d{8,14}$/, 'EAN must be 8-14 digits').optional(),
    gtin: z.string().regex(/^\d{8,14}$/, 'GTIN must be 8-14 digits').optional(),
    mpn: z.string().max(100).optional(),
    modelNumber: z.string().max(100).optional(),
    sku: z.string().max(100).optional(),

    // Optional info
    productCategory: z.string().max(200).optional(),
    imageUrl: z.string().url().optional(),
    productUrl: z.string().url().optional(),
});

export const updateProductSchema = z.object({
    productName: z.string().min(1).max(500).optional(),
    ean: z.string().regex(/^\d{8,14}$/).optional(),
    gtin: z.string().regex(/^\d{8,14}$/).optional(),
    mpn: z.string().max(100).optional(),
    modelNumber: z.string().max(100).optional(),
    sku: z.string().max(100).optional(),
    productCategory: z.string().max(200).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    productUrl: z.string().url().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
});

export const productQuerySchema = z.object({
    brandId: z.string().uuid().optional(),
    search: z.string().optional(),
    ean: z.string().optional(),
    gtin: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
});

export const createSafetyInfoSchema = z.object({
    productId: z.string().uuid(),
    countryCode: z.string().length(2, 'Country code must be ISO 3166-1 alpha-2'),
    languageCode: z.string().length(2, 'Language code must be ISO 639-1'),

    // Safety content
    warningText: z.string().max(5000).optional(),
    safetyInstructions: z.string().max(10000).optional(),
    ageRestriction: z.string().max(20).optional(),
    hazardSymbols: z.array(z.string().max(50)).optional(),

    // Documentation
    documentUrl: z.string().url().optional(),
    documentType: z.enum(['manual', 'safety_sheet', 'declaration', 'other']).optional(),

    // Source
    source: z.object({
        sourceType: z.nativeEnum(SourceType),
        sourceIdentifier: z.string().max(500).optional(),
    }).optional(),
});

export const updateSafetyInfoSchema = z.object({
    warningText: z.string().max(5000).optional(),
    safetyInstructions: z.string().max(10000).optional(),
    ageRestriction: z.string().max(20).optional(),
    hazardSymbols: z.array(z.string().max(50)).optional(),
    documentUrl: z.string().url().optional().or(z.literal('')),
    documentType: z.enum(['manual', 'safety_sheet', 'declaration', 'other']).optional(),
    isActive: z.boolean().optional(),
});

// ============================================================================
// Role Schemas
// ============================================================================

export const addRoleSchema = z.object({
    roleType: z.nativeEnum(RoleType),
    marketContext: z.nativeEnum(MarketContext).optional(), // Defaults to GLOBAL
    productScope: z.string().max(500).optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
});

// ============================================================================
// Source Schemas
// ============================================================================

export const createSourceSchema = z.object({
    sourceType: z.nativeEnum(SourceType),
    sourceIdentifier: z.string().max(500).optional(),
    description: z.string().max(1000).optional(),
    sourceUrl: z.string().url().optional(),
    sourceName: z.string().max(200).optional(),
    trustNote: z.string().max(500).optional(),
});

// ============================================================================
// Verification Schemas
// ============================================================================

export const addVerificationSchema = z.object({
    status: z.nativeEnum(VerificationStatusType),
    verifiedBy: z.string().max(200).optional(),
    verificationMethod: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    evidenceUrl: z.string().url().optional(),
    expiresAt: z.string().datetime().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type EntityQueryInput = z.infer<typeof entityQuerySchema>;

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type BrandQueryInput = z.infer<typeof brandQuerySchema>;
export type CreateBrandLinkInput = z.infer<typeof createBrandLinkSchema>;

export type CreateElectronicContactInput = z.infer<typeof createElectronicContactSchema>;
export type ConfirmContactInput = z.infer<typeof confirmContactSchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type CreateSafetyInfoInput = z.infer<typeof createSafetyInfoSchema>;
export type UpdateSafetyInfoInput = z.infer<typeof updateSafetyInfoSchema>;

export type AddRoleInput = z.infer<typeof addRoleSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type AddVerificationInput = z.infer<typeof addVerificationSchema>;
