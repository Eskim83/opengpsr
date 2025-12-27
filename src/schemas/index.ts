import { z } from 'zod';
import { RoleType, SourceType, VerificationStatusType } from '@prisma/client';

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
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(50).optional(),
    website: z.string().url().optional().or(z.literal('')),

    // Role (optional on creation)
    role: z.nativeEnum(RoleType).optional(),
    marketContext: z.string().max(100).optional(),

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
    email: z.string().email().optional().or(z.literal('')),
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
// Role Schemas
// ============================================================================

export const addRoleSchema = z.object({
    roleType: z.nativeEnum(RoleType),
    marketContext: z.string().max(100).optional(),
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
export type AddRoleInput = z.infer<typeof addRoleSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type AddVerificationInput = z.infer<typeof addVerificationSchema>;
