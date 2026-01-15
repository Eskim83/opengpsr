import prisma from '../config/database';
import { auditService } from './index';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

// Type alias (will be available from Prisma after migration)
type EntityRelationType =
    | 'PARENT_OF'
    | 'SUBSIDIARY_OF'
    | 'ACQUIRED_BY'
    | 'MERGED_INTO'
    | 'SUCCEEDED_BY'
    | 'AUTHORIZED_REP_FOR'
    | 'DISTRIBUTION_PARTNER';

/**
 * Service for managing Entity Relationships (v2.0 P3)
 * 
 * Tracks corporate structure: parent/subsidiary, M&A, authorized representation.
 * Enables graph-based queries for corporate hierarchy.
 * 
 * @example
 * // Record parent company relationship
 * await entityRelationshipService.create({
 *   fromEntityId: subsidiaryId,
 *   toEntityId: parentId,
 *   relationType: 'SUBSIDIARY_OF',
 * });
 */
class EntityRelationshipService {
    /**
     * Create a relationship between entities
     * 
     * @param data - Relationship data
     * @returns Created EntityRelationship
     */
    async create(data: {
        fromEntityId: string;
        toEntityId: string;
        relationType: EntityRelationType;
        validFrom?: Date;
        validTo?: Date;
        sourceId?: string;
        confidence?: number;
        notes?: string;
    }) {
        // Validate both entities exist
        const [fromEntity, toEntity] = await Promise.all([
            prisma.entity.findUnique({ where: { id: data.fromEntityId } }),
            prisma.entity.findUnique({ where: { id: data.toEntityId } }),
        ]);

        if (!fromEntity) {
            throw new NotFoundError('From entity not found');
        }
        if (!toEntity) {
            throw new NotFoundError('To entity not found');
        }

        // Prevent self-reference
        if (data.fromEntityId === data.toEntityId) {
            throw new ValidationError('Cannot create relationship to self');
        }

        const relationship = await prisma.entityRelationship.create({
            data: {
                fromEntityId: data.fromEntityId,
                toEntityId: data.toEntityId,
                relationType: data.relationType,
                validFrom: data.validFrom ?? new Date(),
                validTo: data.validTo,
                sourceId: data.sourceId,
                confidence: data.confidence ?? 50,
                notes: data.notes,
            },
            include: {
                fromEntity: { select: { id: true, normalizedName: true } },
                toEntity: { select: { id: true, normalizedName: true } },
            },
        });

        await auditService.log({
            action: 'RELATIONSHIP_CREATED',
            entityType: 'EntityRelationship',
            entityId: relationship.id,
            newData: relationship as unknown as Prisma.JsonObject,
        });

        return relationship;
    }

    /**
     * Get relationships FROM an entity (outgoing)
     * 
     * @param entityId - Entity UUID
     * @param relationType - Optional type filter
     */
    async getRelationsFrom(entityId: string, relationType?: EntityRelationType) {
        const where: Record<string, unknown> = {
            fromEntityId: entityId,
            isActive: true,
        };
        if (relationType) {
            where.relationType = relationType;
        }

        return prisma.entityRelationship.findMany({
            where,
            include: {
                toEntity: {
                    select: {
                        id: true,
                        normalizedName: true,
                        normalizedCountry: true,
                    },
                },
            },
            orderBy: { relationType: 'asc' },
        });
    }

    /**
     * Get relationships TO an entity (incoming)
     * 
     * @param entityId - Entity UUID
     * @param relationType - Optional type filter
     */
    async getRelationsTo(entityId: string, relationType?: EntityRelationType) {
        const where: Record<string, unknown> = {
            toEntityId: entityId,
            isActive: true,
        };
        if (relationType) {
            where.relationType = relationType;
        }

        return prisma.entityRelationship.findMany({
            where,
            include: {
                fromEntity: {
                    select: {
                        id: true,
                        normalizedName: true,
                        normalizedCountry: true,
                    },
                },
            },
            orderBy: { relationType: 'asc' },
        });
    }

    /**
     * Get full corporate graph for an entity
     * 
     * @param entityId - Entity UUID
     * @returns Object with parents, subsidiaries, and other relationships
     */
    async getCorporateGraph(entityId: string) {
        const [relationsFrom, relationsTo] = await Promise.all([
            this.getRelationsFrom(entityId),
            this.getRelationsTo(entityId),
        ]);

        // Organize by relationship type
        const graph: Record<string, Array<{
            entityId: string;
            entityName: string;
            direction: 'from' | 'to';
            confidence: number;
        }>> = {};

        for (const rel of relationsFrom) {
            if (!graph[rel.relationType]) {
                graph[rel.relationType] = [];
            }
            graph[rel.relationType].push({
                entityId: rel.toEntityId,
                entityName: rel.toEntity.normalizedName,
                direction: 'to',
                confidence: rel.confidence,
            });
        }

        for (const rel of relationsTo) {
            if (!graph[rel.relationType]) {
                graph[rel.relationType] = [];
            }
            graph[rel.relationType].push({
                entityId: rel.fromEntityId,
                entityName: rel.fromEntity.normalizedName,
                direction: 'from',
                confidence: rel.confidence,
            });
        }

        return graph;
    }

    /**
     * End a relationship (set validTo)
     * 
     * @param relationshipId - Relationship UUID
     * @param endDate - When relationship ended
     */
    async end(relationshipId: string, endDate?: Date) {
        const relationship = await prisma.entityRelationship.update({
            where: { id: relationshipId },
            data: {
                validTo: endDate ?? new Date(),
                isActive: false,
            },
        });

        await auditService.log({
            action: 'RELATIONSHIP_ENDED',
            entityType: 'EntityRelationship',
            entityId: relationshipId,
        });

        return relationship;
    }

    /**
     * Get parent company chain (upward traversal)
     * 
     * @param entityId - Starting entity
     * @param maxDepth - Maximum levels to traverse
     */
    async getParentChain(entityId: string, maxDepth: number = 10) {
        const chain: Array<{
            entityId: string;
            entityName: string;
            level: number;
        }> = [];

        let currentId = entityId;
        let depth = 0;

        while (depth < maxDepth) {
            const parent = await prisma.entityRelationship.findFirst({
                where: {
                    fromEntityId: currentId,
                    relationType: 'SUBSIDIARY_OF',
                    isActive: true,
                },
                include: {
                    toEntity: { select: { id: true, normalizedName: true } },
                },
            });

            if (!parent) break;

            chain.push({
                entityId: parent.toEntityId,
                entityName: parent.toEntity.normalizedName,
                level: depth + 1,
            });

            currentId = parent.toEntityId;
            depth++;
        }

        return chain;
    }
}

export const entityRelationshipService = new EntityRelationshipService();
export default entityRelationshipService;
