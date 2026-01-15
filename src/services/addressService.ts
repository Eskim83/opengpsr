import prisma from '../config/database';
import { auditService } from './index';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../utils/errors';

// Type alias (will be available from Prisma after migration)
type AddressType = 'REGISTERED' | 'OPERATING' | 'RETURN' | 'SAFETY_CONTACT';

/**
 * Service for managing Addresses (v2.0 P2)
 * 
 * Handles first-class address entities that can be linked to entities
 * with different types (registered, operating, return, safety contact).
 * 
 * @example
 * // Add registered address to entity
 * await addressService.create({
 *   entityId,
 *   addressType: 'REGISTERED',
 *   streetLine1: 'ul. Główna 1',
 *   city: 'Warszawa',
 *   postalCode: '00-001',
 *   countryCode: 'PL',
 *   sourceId,
 * });
 */
class AddressService {
    /**
     * Create a new address
     * 
     * @param data - Address data
     * @returns Created Address
     */
    async create(data: {
        entityId?: string;
        streetLine1: string;
        streetLine2?: string;
        city: string;
        postalCode?: string;
        region?: string;
        countryCode: string;
        addressType?: AddressType;
        sourceId?: string;
    }) {
        // Normalize the full address for search
        const normalizedFull = this.normalizeAddress(data);

        const address = await prisma.address.create({
            data: {
                entityId: data.entityId,
                streetLine1: data.streetLine1,
                streetLine2: data.streetLine2,
                city: data.city,
                postalCode: data.postalCode,
                region: data.region,
                countryCode: data.countryCode.toUpperCase(),
                normalizedFull,
                addressType: data.addressType ?? 'REGISTERED',
                sourceId: data.sourceId,
            },
            include: {
                entity: true,
                source: true,
            },
        });

        await auditService.log({
            action: 'ADDRESS_CREATED',
            entityType: 'Address',
            entityId: address.id,
            newData: address as unknown as Prisma.JsonObject,
        });

        return address;
    }

    /**
     * Get addresses for an entity
     * 
     * @param entityId - Entity UUID
     * @param type - Optional type filter
     */
    async getForEntity(entityId: string, type?: AddressType) {
        const where: Record<string, unknown> = { entityId, isActive: true };
        if (type) {
            where.addressType = type;
        }

        return prisma.address.findMany({
            where,
            include: { source: true },
            orderBy: { addressType: 'asc' },
        });
    }

    /**
     * Search addresses by normalized text
     * 
     * @param query - Search query
     * @param countryCode - Optional country filter
     * @param limit - Max results
     */
    async search(query: string, countryCode?: string, limit: number = 20) {
        const normalizedQuery = query.toLowerCase().trim();

        const where: Record<string, unknown> = {
            normalizedFull: { contains: normalizedQuery },
            isActive: true,
        };

        if (countryCode) {
            where.countryCode = countryCode.toUpperCase();
        }

        return prisma.address.findMany({
            where,
            include: {
                entity: {
                    select: {
                        id: true,
                        normalizedName: true,
                    },
                },
            },
            take: limit,
            orderBy: { normalizedFull: 'asc' },
        });
    }

    /**
     * Update an address
     * 
     * @param addressId - Address UUID
     * @param data - Updated fields
     */
    async update(
        addressId: string,
        data: Partial<{
            streetLine1: string;
            streetLine2: string;
            city: string;
            postalCode: string;
            region: string;
            countryCode: string;
            addressType: AddressType;
        }>
    ) {
        const existing = await prisma.address.findUnique({
            where: { id: addressId },
        });

        if (!existing) {
            throw new NotFoundError('Address not found');
        }

        // Recalculate normalized address
        const updatedData = { ...existing, ...data };
        const normalizedFull = this.normalizeAddress(updatedData);

        const address = await prisma.address.update({
            where: { id: addressId },
            data: {
                ...data,
                countryCode: data.countryCode?.toUpperCase(),
                normalizedFull,
            },
            include: { entity: true },
        });

        await auditService.log({
            action: 'ADDRESS_UPDATED',
            entityType: 'Address',
            entityId: addressId,
            previousData: existing as unknown as Prisma.JsonObject,
            newData: address as unknown as Prisma.JsonObject,
        });

        return address;
    }

    /**
     * Deactivate an address
     * 
     * @param addressId - Address UUID
     */
    async deactivate(addressId: string) {
        const address = await prisma.address.update({
            where: { id: addressId },
            data: { isActive: false },
        });

        await auditService.log({
            action: 'ADDRESS_DEACTIVATED',
            entityType: 'Address',
            entityId: addressId,
        });

        return address;
    }

    /**
     * Normalize address for search
     */
    private normalizeAddress(data: {
        streetLine1: string;
        streetLine2?: string | null;
        city: string;
        postalCode?: string | null;
        region?: string | null;
        countryCode: string;
    }): string {
        const parts = [
            data.streetLine1,
            data.streetLine2,
            data.postalCode,
            data.city,
            data.region,
            data.countryCode,
        ].filter(Boolean);

        return parts.join(' ').toLowerCase().trim();
    }
}

export const addressService = new AddressService();
export default addressService;
