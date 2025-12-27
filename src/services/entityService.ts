import prisma from '../config/database';
import { Entity, EntityVersion, EntityRole, RoleType, Prisma } from '@prisma/client';
import { CreateEntityInput, UpdateEntityInput, EntityQueryInput, AddRoleInput } from '../schemas';
import { sourceService } from './sourceService';
import { NotFoundError } from '../utils/errors';
import { config } from '../config';
import {
    normalizeName,
    normalizeVatId,
    normalizeEmail,
    normalizePhone,
    normalizeWebsite,
    normalizeCountry,
    normalizeAddress,
} from '../utils/normalize';

// Types for entity with relations
export type EntityWithRelations = Entity & {
    roles: EntityRole[];
    versions: EntityVersion[];
};

export type EntityListItem = Entity & {
    roles: EntityRole[];
    _count: { versions: number };
};

/**
 * Service for managing GPSR entities
 * Handles creation, updates, versioning, and role management
 */
export class EntityService {
    /**
     * Create a new entity with initial version
     */
    async create(data: CreateEntityInput): Promise<EntityWithRelations> {
        // Get or create the source
        const source = await sourceService.findOrCreate(data.source);

        // Normalize the input data
        const normalized = {
            normalizedName: normalizeName(data.name),
            normalizedAddress: normalizeAddress(data.address),
            normalizedCity: data.city?.trim() || null,
            normalizedCountry: normalizeCountry(data.country),
            normalizedVatId: normalizeVatId(data.vatId),
            normalizedEmail: normalizeEmail(data.email),
            normalizedPhone: normalizePhone(data.phone),
            normalizedWebsite: normalizeWebsite(data.website),
        };

        // Create entity with initial version in a transaction
        const entity = await prisma.$transaction(async (tx) => {
            // Create the entity
            const newEntity = await tx.entity.create({
                data: {
                    ...normalized,
                    // Create initial version
                    versions: {
                        create: {
                            sourceId: source.id,
                            originalData: data as unknown as Prisma.JsonObject,
                            normalizedData: normalized as unknown as Prisma.JsonObject,
                            isCurrent: true,
                        },
                    },
                    // Add role if provided
                    ...(data.role && {
                        roles: {
                            create: {
                                roleType: data.role,
                                marketContext: data.marketContext,
                            },
                        },
                    }),
                },
                include: {
                    roles: true,
                    versions: true,
                },
            });

            // Create audit log entry
            await tx.auditLog.create({
                data: {
                    action: 'CREATE',
                    entityType: 'Entity',
                    entityId: newEntity.id,
                    newData: newEntity as unknown as Prisma.JsonObject,
                },
            });

            return newEntity;
        });

        return entity;
    }

    /**
     * Update an entity (creates a new version)
     */
    async update(id: string, data: UpdateEntityInput): Promise<EntityWithRelations> {
        // Get current entity
        const current = await this.getById(id);

        // Get or create the source
        const source = await sourceService.findOrCreate(data.source);

        // Prepare normalized updates
        const updates: Partial<Entity> = {};
        if (data.name) updates.normalizedName = normalizeName(data.name);
        if (data.address !== undefined) updates.normalizedAddress = normalizeAddress(data.address);
        if (data.city !== undefined) updates.normalizedCity = data.city?.trim() || null;
        if (data.country) updates.normalizedCountry = normalizeCountry(data.country);
        if (data.vatId !== undefined) updates.normalizedVatId = normalizeVatId(data.vatId);
        if (data.email !== undefined) updates.normalizedEmail = normalizeEmail(data.email);
        if (data.phone !== undefined) updates.normalizedPhone = normalizePhone(data.phone);
        if (data.website !== undefined) updates.normalizedWebsite = normalizeWebsite(data.website);
        if (data.isActive !== undefined) updates.isActive = data.isActive;

        // Update in transaction
        const entity = await prisma.$transaction(async (tx) => {
            // Mark previous versions as not current
            await tx.entityVersion.updateMany({
                where: { entityId: id, isCurrent: true },
                data: { isCurrent: false },
            });

            // Get updated normalized data
            const normalizedData = {
                normalizedName: updates.normalizedName ?? current.normalizedName,
                normalizedAddress: updates.normalizedAddress ?? current.normalizedAddress,
                normalizedCity: updates.normalizedCity ?? current.normalizedCity,
                normalizedCountry: updates.normalizedCountry ?? current.normalizedCountry,
                normalizedVatId: updates.normalizedVatId ?? current.normalizedVatId,
                normalizedEmail: updates.normalizedEmail ?? current.normalizedEmail,
                normalizedPhone: updates.normalizedPhone ?? current.normalizedPhone,
                normalizedWebsite: updates.normalizedWebsite ?? current.normalizedWebsite,
            };

            // Update entity and create new version
            const updated = await tx.entity.update({
                where: { id },
                data: {
                    ...updates,
                    versions: {
                        create: {
                            sourceId: source.id,
                            originalData: data as unknown as Prisma.JsonObject,
                            normalizedData: normalizedData as unknown as Prisma.JsonObject,
                            changeNote: data.changeNote,
                            isCurrent: true,
                        },
                    },
                },
                include: {
                    roles: true,
                    versions: {
                        orderBy: { versionNumber: 'desc' },
                        take: 5,
                    },
                },
            });

            // Create audit log
            await tx.auditLog.create({
                data: {
                    action: 'UPDATE',
                    entityType: 'Entity',
                    entityId: id,
                    previousData: current as unknown as Prisma.JsonObject,
                    newData: updated as unknown as Prisma.JsonObject,
                },
            });

            return updated;
        });

        return entity;
    }

    /**
     * Get entity by ID with relations
     */
    async getById(id: string): Promise<EntityWithRelations> {
        const entity = await prisma.entity.findUnique({
            where: { id },
            include: {
                roles: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
                },
                versions: {
                    where: { isCurrent: true },
                    include: {
                        source: true,
                        verifications: {
                            orderBy: { verifiedAt: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });

        if (!entity) {
            throw new NotFoundError('Entity');
        }

        return entity;
    }

    /**
     * Get entity with full version history
     */
    async getWithHistory(id: string): Promise<EntityWithRelations> {
        const entity = await prisma.entity.findUnique({
            where: { id },
            include: {
                roles: {
                    orderBy: { createdAt: 'desc' },
                },
                versions: {
                    include: {
                        source: true,
                        verifications: {
                            orderBy: { verifiedAt: 'desc' },
                        },
                    },
                    orderBy: { versionNumber: 'desc' },
                },
            },
        });

        if (!entity) {
            throw new NotFoundError('Entity');
        }

        return entity;
    }

    /**
     * List entities with filtering and pagination
     */
    async list(query: EntityQueryInput): Promise<{
        entities: EntityListItem[];
        total: number;
        limit: number;
        offset: number;
    }> {
        const limit = Math.min(
            parseInt(query.limit || String(config.pagination.defaultLimit)),
            config.pagination.maxLimit
        );
        const offset = parseInt(query.offset || '0');

        // Build where clause
        const where: Prisma.EntityWhereInput = {};

        if (query.search) {
            where.normalizedName = {
                contains: query.search,
                mode: 'insensitive',
            };
        }

        if (query.country) {
            where.normalizedCountry = query.country.toUpperCase();
        }

        if (query.isActive !== undefined) {
            where.isActive = query.isActive === 'true';
        }

        if (query.role) {
            where.roles = {
                some: {
                    roleType: query.role,
                    isActive: true,
                },
            };
        }

        const [entities, total] = await Promise.all([
            prisma.entity.findMany({
                where,
                include: {
                    roles: {
                        where: { isActive: true },
                    },
                    _count: {
                        select: { versions: true },
                    },
                },
                orderBy: { normalizedName: 'asc' },
                take: limit,
                skip: offset,
            }),
            prisma.entity.count({ where }),
        ]);

        return { entities, total, limit, offset };
    }

    /**
     * Add a role to an entity
     */
    async addRole(entityId: string, data: AddRoleInput): Promise<EntityRole> {
        // Verify entity exists
        await this.getById(entityId);

        const role = await prisma.$transaction(async (tx) => {
            const newRole = await tx.entityRole.create({
                data: {
                    entityId,
                    roleType: data.roleType,
                    marketContext: data.marketContext,
                    productScope: data.productScope,
                    validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
                    validTo: data.validTo ? new Date(data.validTo) : undefined,
                },
            });

            // Audit log
            await tx.auditLog.create({
                data: {
                    action: 'ADD_ROLE',
                    entityType: 'EntityRole',
                    entityId: newRole.id,
                    newData: newRole as unknown as Prisma.JsonObject,
                },
            });

            return newRole;
        });

        return role;
    }

    /**
     * Deactivate a role (soft delete)
     */
    async deactivateRole(roleId: string): Promise<EntityRole> {
        return prisma.entityRole.update({
            where: { id: roleId },
            data: { isActive: false },
        });
    }

    /**
     * Soft delete an entity (marks as inactive)
     */
    async deactivate(id: string): Promise<Entity> {
        const entity = await this.getById(id);

        return prisma.$transaction(async (tx) => {
            const updated = await tx.entity.update({
                where: { id },
                data: { isActive: false },
            });

            await tx.auditLog.create({
                data: {
                    action: 'DEACTIVATE',
                    entityType: 'Entity',
                    entityId: id,
                    previousData: { isActive: true } as unknown as Prisma.JsonObject,
                    newData: { isActive: false } as unknown as Prisma.JsonObject,
                },
            });

            return updated;
        });
    }
}

export const entityService = new EntityService();
