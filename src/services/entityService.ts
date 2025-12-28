import prisma from '../config/database';
import { Entity, EntityVersion, EntityRole, Prisma, RoleType, MarketContext, EntityElectronicContact } from '@prisma/client';
import { CreateEntityInput, UpdateEntityInput, EntityQueryInput, AddRoleInput } from '../schemas';
import { sourceService } from './sourceService';
import { auditService } from './auditService';
import { NotFoundError } from '../utils/errors';
import { withP2002Retry } from '../utils/prismaRetry';
import {
    normalizeName,
    normalizeVatId,
    normalizePhone,
    normalizeWebsite,
    normalizeCountry,
    normalizeAddress
} from '../utils/normalize';
import { config } from '../config';

// Types
export type EntityWithRelations = Entity & {
    roles: EntityRole[];
    contacts: EntityElectronicContact[];
};

export type EntityWithRoles = Entity & {
    roles: EntityRole[];
};

/**
 * Service for managing GPSR Entities
 * Uses per-entity version numbering and currentVersionId pointer
 * FIX: Added P2002 retry for version number race conditions
 */
export class EntityService {
    /**
     * Create a new entity with initial version
     */
    async create(data: CreateEntityInput): Promise<Entity> {
        const source = await sourceService.findOrCreate(data.source);

        // Normalize input data
        const normalizedName = normalizeName(data.name);
        const normalizedCountry = normalizeCountry(data.country);
        const normalizedAddress = data.address ? normalizeAddress(data.address) : null;
        const normalizedVatId = data.vatId ? normalizeVatId(data.vatId) : null;
        const normalizedPhone = data.phone ? normalizePhone(data.phone) : null;
        const normalizedWebsite = data.website ? normalizeWebsite(data.website) : null;

        const entity = await prisma.$transaction(async (tx) => {
            // Create entity first
            const newEntity = await tx.entity.create({
                data: {
                    normalizedName,
                    normalizedAddress,
                    normalizedCity: data.city,
                    normalizedCountry,
                    normalizedVatId,
                    normalizedPhone,
                    normalizedWebsite,
                },
            });

            // Create initial version (version 1) - no race possible on create
            const version = await tx.entityVersion.create({
                data: {
                    entityId: newEntity.id,
                    sourceId: source.id,
                    versionNumber: 1,
                    originalData: data as unknown as Prisma.JsonObject,
                    normalizedData: {
                        name: normalizedName,
                        address: normalizedAddress,
                        city: data.city,
                        country: normalizedCountry,
                        vatId: normalizedVatId,
                        phone: normalizedPhone,
                        website: normalizedWebsite,
                    } as unknown as Prisma.JsonObject,
                },
            });

            // Update entity with current version pointer
            const updatedEntity = await tx.entity.update({
                where: { id: newEntity.id },
                data: { currentVersionId: version.id },
            });

            // Create role if provided
            if (data.role) {
                await tx.entityRole.create({
                    data: {
                        entityId: newEntity.id,
                        roleType: data.role,
                        marketContext: (data.marketContext as MarketContext) || 'GLOBAL',
                    },
                });
            }

            // Audit log
            await tx.auditLog.create({
                data: {
                    action: 'CREATE',
                    entityType: 'Entity',
                    entityId: newEntity.id,
                    newData: updatedEntity as unknown as Prisma.JsonObject,
                },
            });

            return updatedEntity;
        });

        return entity;
    }

    /**
     * Update entity (creates new version)
     * FIX: Uses P2002 retry for version number race conditions
     */
    async update(id: string, data: UpdateEntityInput): Promise<Entity> {
        const current = await this.getById(id);
        const source = await sourceService.findOrCreate(data.source);

        // Build updates
        const updates: Partial<Entity> = {};
        if (data.name) updates.normalizedName = normalizeName(data.name);
        if (data.country) updates.normalizedCountry = normalizeCountry(data.country);
        if (data.address !== undefined) updates.normalizedAddress = data.address ? normalizeAddress(data.address) : null;
        if (data.city !== undefined) updates.normalizedCity = data.city;
        if (data.vatId !== undefined) updates.normalizedVatId = data.vatId ? normalizeVatId(data.vatId) : null;
        if (data.phone !== undefined) updates.normalizedPhone = data.phone ? normalizePhone(data.phone) : null;
        if (data.website !== undefined) updates.normalizedWebsite = data.website ? normalizeWebsite(data.website) : null;
        if (data.isActive !== undefined) updates.isActive = data.isActive;

        // FIX: Wrap in retry for P2002 race conditions
        const entity = await withP2002Retry(async () => {
            return prisma.$transaction(async (tx) => {
                // Get current max version number INSIDE transaction
                const maxVersion = await tx.entityVersion.aggregate({
                    where: { entityId: id },
                    _max: { versionNumber: true },
                });
                const nextVersionNumber = (maxVersion._max.versionNumber || 0) + 1;

                // Create new version
                const newVersion = await tx.entityVersion.create({
                    data: {
                        entityId: id,
                        sourceId: source.id,
                        versionNumber: nextVersionNumber,
                        originalData: data as unknown as Prisma.JsonObject,
                        normalizedData: {
                            name: updates.normalizedName ?? current.normalizedName,
                            address: updates.normalizedAddress ?? current.normalizedAddress,
                            city: updates.normalizedCity ?? current.normalizedCity,
                            country: updates.normalizedCountry ?? current.normalizedCountry,
                            vatId: updates.normalizedVatId ?? current.normalizedVatId,
                            phone: updates.normalizedPhone ?? current.normalizedPhone,
                            website: updates.normalizedWebsite ?? current.normalizedWebsite,
                        } as unknown as Prisma.JsonObject,
                        changeNote: data.changeNote,
                    },
                });

                // Update entity with new current version pointer
                const updated = await tx.entity.update({
                    where: { id },
                    data: {
                        ...updates,
                        currentVersionId: newVersion.id,
                    },
                });

                // Audit log
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
                    where: { isActive: true, validTo: null },
                    orderBy: { createdAt: 'desc' },
                },
                contacts: {
                    where: { isActive: true },
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
    async getWithHistory(id: string): Promise<Entity & {
        versions: EntityVersion[];
    }> {
        const entity = await prisma.entity.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { versionNumber: 'desc' },
                    include: {
                        source: true,
                        verifications: true,
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
     * List entities with filtering
     * FIX: Return type correctly includes roles
     */
    async list(query: EntityQueryInput): Promise<{
        entities: EntityWithRoles[];
        total: number;
        limit: number;
        offset: number;
    }> {
        const limit = Math.min(
            parseInt(query.limit || String(config.pagination.defaultLimit)),
            config.pagination.maxLimit
        );
        const offset = parseInt(query.offset || '0');

        const where: Prisma.EntityWhereInput = {};

        if (query.search) {
            where.normalizedName = { contains: query.search, mode: 'insensitive' };
        }
        if (query.country) {
            where.normalizedCountry = query.country.toUpperCase();
        }
        if (query.role) {
            where.roles = { some: { roleType: query.role, isActive: true } };
        }
        if (query.isActive !== undefined) {
            where.isActive = query.isActive === 'true';
        } else {
            where.isActive = true;
        }

        const [entities, total] = await Promise.all([
            prisma.entity.findMany({
                where,
                include: {
                    roles: {
                        where: { isActive: true, validTo: null },
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
        await this.getById(entityId);

        const role = await prisma.entityRole.create({
            data: {
                entityId,
                roleType: data.roleType,
                marketContext: (data.marketContext as MarketContext) || 'GLOBAL',
                productScope: data.productScope,
                validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
                validTo: data.validTo ? new Date(data.validTo) : undefined,
            },
        });

        await auditService.log({
            action: 'ADD_ROLE',
            entityType: 'EntityRole',
            entityId: role.id,
            newData: role,
        });

        return role;
    }

    /**
     * Deactivate an entity (soft delete)
     */
    async deactivate(id: string): Promise<Entity> {
        await this.getById(id);

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
