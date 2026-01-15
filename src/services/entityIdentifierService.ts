import prisma from '../config/database';
import { auditService } from './index';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

// Type alias for IdentifierType (will be available after migration)
type IdentifierType = 'VAT_EU' | 'EORI' | 'LEI' | 'DUNS' | 'KRS' | 'NIP' | 'REGON' | 'GLN' | 'COMPANY_REGISTER';

/**
 * Service for managing Entity Identifiers (v2.0 P0)
 * 
 * Provides lookup and dedup functionality via VAT, EORI, DUNS and other identifiers.
 * Each identifier type+value combination is globally unique for dedup purposes.
 * 
 * @example
 * // Find entity by VAT number
 * const entity = await identifierService.findByIdentifier('VAT_EU', 'PL1234567890');
 * 
 * @example
 * // Add EORI to entity
 * await identifierService.addIdentifier(entityId, {
 *   type: 'EORI',
 *   value: 'PL1234567890123456',
 *   sourceId,
 * });
 */
class EntityIdentifierService {
    /**
     * Add an identifier to an entity
     * 
     * @param entityId - Entity UUID
     * @param data - Identifier data
     * @returns Created EntityIdentifier record
     * @throws ValidationError if identifier already exists for different entity
     */
    async addIdentifier(
        entityId: string,
        data: {
            type: IdentifierType;
            value: string;
            countryCode?: string;
            sourceId: string;
            isPrimary?: boolean;
        }
    ) {
        // Validate entity exists
        const entity = await prisma.entity.findUnique({
            where: { id: entityId },
        });
        if (!entity) {
            throw new NotFoundError('Entity not found');
        }

        // Normalize value (uppercase, trim)
        const normalizedValue = data.value.toUpperCase().trim();

        // Check for existing identifier
        const existing = await prisma.entityIdentifier.findUnique({
            where: {
                type_value: {
                    type: data.type,
                    value: normalizedValue,
                },
            },
            include: { entity: true },
        });

        if (existing) {
            if (existing.entityId === entityId) {
                // Same entity - update if needed
                return prisma.entityIdentifier.update({
                    where: { id: existing.id },
                    data: {
                        countryCode: data.countryCode?.toUpperCase(),
                        sourceId: data.sourceId,
                        isPrimary: data.isPrimary ?? existing.isPrimary,
                    },
                    include: { entity: true, source: true },
                });
            } else {
                // Different entity - this is a duplicate detection!
                throw new ValidationError(
                    `Identifier ${data.type}:${normalizedValue} already assigned to entity "${existing.entity.normalizedName}" (${existing.entityId})`
                );
            }
        }

        // If setting as primary, unset other primaries of same type
        if (data.isPrimary) {
            await prisma.entityIdentifier.updateMany({
                where: {
                    entityId,
                    type: data.type,
                    isPrimary: true,
                },
                data: { isPrimary: false },
            });
        }

        const identifier = await prisma.entityIdentifier.create({
            data: {
                entityId,
                type: data.type,
                value: normalizedValue,
                countryCode: data.countryCode?.toUpperCase(),
                sourceId: data.sourceId,
                isPrimary: data.isPrimary ?? false,
            },
            include: { entity: true, source: true },
        });

        await auditService.log({
            action: 'IDENTIFIER_ADDED',
            entityType: 'EntityIdentifier',
            entityId: identifier.id,
            newData: identifier as unknown as Prisma.JsonObject,
        });

        return identifier;
    }

    /**
     * Find entity by identifier (dedup/lookup)
     * 
     * @param type - Identifier type (VAT_EU, EORI, etc.)
     * @param value - Identifier value
     * @returns Entity with all identifiers, or null if not found
     */
    async findByIdentifier(type: IdentifierType, value: string) {
        const normalizedValue = value.toUpperCase().trim();

        const identifier = await prisma.entityIdentifier.findUnique({
            where: {
                type_value: {
                    type,
                    value: normalizedValue,
                },
            },
            include: {
                entity: {
                    include: {
                        identifiers: true,
                        roles: { where: { isActive: true } },
                    },
                },
            },
        });

        return identifier?.entity ?? null;
    }

    /**
     * Get all identifiers for an entity
     * 
     * @param entityId - Entity UUID
     * @returns Array of identifiers
     */
    async getForEntity(entityId: string) {
        return prisma.entityIdentifier.findMany({
            where: { entityId },
            include: { source: true },
            orderBy: [
                { isPrimary: 'desc' },
                { type: 'asc' },
            ],
        });
    }

    /**
     * Search entities by partial identifier value
     * 
     * @param type - Identifier type (optional)
     * @param valuePattern - Partial value to search
     * @param limit - Max results (default 20)
     */
    async search(
        valuePattern: string,
        type?: IdentifierType,
        limit: number = 20
    ) {
        // Build where clause dynamically (Prisma types available after migration)
        const where: Record<string, unknown> = {
            value: {
                contains: valuePattern.toUpperCase().trim(),
            },
        };

        if (type) {
            where.type = type;
        }

        return prisma.entityIdentifier.findMany({
            where,
            include: {
                entity: {
                    select: {
                        id: true,
                        normalizedName: true,
                        normalizedCountry: true,
                    },
                },
            },
            take: limit,
            orderBy: { value: 'asc' },
        });
    }

    /**
     * Remove an identifier from an entity
     * 
     * @param identifierId - Identifier UUID
     */
    async removeIdentifier(identifierId: string) {
        const identifier = await prisma.entityIdentifier.delete({
            where: { id: identifierId },
        });

        await auditService.log({
            action: 'IDENTIFIER_REMOVED',
            entityType: 'EntityIdentifier',
            entityId: identifierId,
            previousData: identifier as unknown as Prisma.JsonObject,
        });

        return identifier;
    }

    /**
     * Find potential duplicates by comparing identifiers
     * 
     * @param entityId - Entity to check
     * @returns Array of potential duplicate entities
     */
    async findDuplicateCandidates(entityId: string) {
        const entity = await prisma.entity.findUnique({
            where: { id: entityId },
            include: { identifiers: true },
        });

        if (!entity) {
            throw new NotFoundError('Entity not found');
        }

        // For each identifier, find other entities with matching identifiers
        const candidates: Map<string, { entity: any; matchedIdentifiers: string[] }> = new Map();

        for (const identifier of entity.identifiers) {
            // Search for partial matches (e.g., same VAT without country prefix)
            const similar = await prisma.entityIdentifier.findMany({
                where: {
                    type: identifier.type,
                    value: {
                        contains: identifier.value.slice(-8), // Last 8 chars
                    },
                    entityId: { not: entityId },
                },
                include: {
                    entity: {
                        select: {
                            id: true,
                            normalizedName: true,
                            normalizedCountry: true,
                        },
                    },
                },
            });

            for (const s of similar) {
                const key = s.entityId;
                if (!candidates.has(key)) {
                    candidates.set(key, { entity: s.entity, matchedIdentifiers: [] });
                }
                candidates.get(key)!.matchedIdentifiers.push(`${s.type}:${s.value}`);
            }
        }

        return Array.from(candidates.values());
    }
}

export const entityIdentifierService = new EntityIdentifierService();
export default entityIdentifierService;
