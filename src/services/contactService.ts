import prisma from '../config/database';
import { EntityElectronicContact, BrandElectronicContact, Prisma, ElectronicContactType } from '@prisma/client';
import { CreateElectronicContactInput, ConfirmContactInput } from '../schemas';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Service for managing Electronic Contact Points
 * FIX B: Uses separate EntityElectronicContact and BrandElectronicContact models
 */
export class ContactService {
    /**
     * Create a new electronic contact for an Entity
     */
    async createForEntity(
        entityId: string,
        data: Omit<CreateElectronicContactInput, 'entityId' | 'brandId'>
    ): Promise<EntityElectronicContact> {
        // Validate entity exists
        const entity = await prisma.entity.findUnique({ where: { id: entityId } });
        if (!entity) throw new NotFoundError('Entity');

        // Validate value based on type
        this.validateContactValue(data.contactType, data.value);

        const contact = await prisma.$transaction(async (tx) => {
            const newContact = await tx.entityElectronicContact.create({
                data: {
                    entityId,
                    contactType: data.contactType,
                    value: data.value,
                    label: data.label,
                    languageCode: data.languageCode,
                    isForSafetyIssues: data.isForSafetyIssues ?? false,
                    isForConsumerComplaints: data.isForConsumerComplaints ?? false,
                    isPublic: data.isPublic ?? true,
                },
            });

            await tx.auditLog.create({
                data: {
                    action: 'CREATE',
                    entityType: 'EntityElectronicContact',
                    entityId: newContact.id,
                    newData: newContact as unknown as Prisma.JsonObject,
                },
            });

            return newContact;
        });

        return contact;
    }

    /**
     * Create a new electronic contact for a Brand
     */
    async createForBrand(
        brandId: string,
        data: Omit<CreateElectronicContactInput, 'entityId' | 'brandId'>
    ): Promise<BrandElectronicContact> {
        // Validate brand exists
        const brand = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!brand) throw new NotFoundError('Brand');

        // Validate value based on type
        this.validateContactValue(data.contactType, data.value);

        const contact = await prisma.$transaction(async (tx) => {
            const newContact = await tx.brandElectronicContact.create({
                data: {
                    brandId,
                    contactType: data.contactType,
                    value: data.value,
                    label: data.label,
                    languageCode: data.languageCode,
                    isForSafetyIssues: data.isForSafetyIssues ?? false,
                    isForConsumerComplaints: data.isForConsumerComplaints ?? false,
                    isPublic: data.isPublic ?? true,
                },
            });

            await tx.auditLog.create({
                data: {
                    action: 'CREATE',
                    entityType: 'BrandElectronicContact',
                    entityId: newContact.id,
                    newData: newContact as unknown as Prisma.JsonObject,
                },
            });

            return newContact;
        });

        return contact;
    }

    /**
     * Validate contact value based on type
     */
    private validateContactValue(contactType: ElectronicContactType, value: string): void {
        if (contactType === 'EMAIL') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                throw new ValidationError('Invalid email format', { value: ['Must be a valid email address'] });
            }
        } else if (['CONTACT_FORM', 'WEBSITE_SECTION'].includes(contactType)) {
            try {
                new URL(value);
            } catch {
                throw new ValidationError('Invalid URL format', { value: ['Must be a valid URL'] });
            }
        }
    }

    /**
     * Confirm that an entity contact allows direct communication
     */
    async confirmEntityContact(id: string, data: ConfirmContactInput): Promise<EntityElectronicContact> {
        const contact = await prisma.entityElectronicContact.findUnique({ where: { id } });
        if (!contact) {
            throw new NotFoundError('Electronic contact');
        }

        return prisma.entityElectronicContact.update({
            where: { id },
            data: {
                directCommunicationConfirmed: true,
                confirmationMethod: data.confirmationMethod,
                confirmedBy: data.confirmedBy,
                confirmedAt: new Date(),
            },
        });
    }

    /**
     * Confirm that a brand contact allows direct communication
     */
    async confirmBrandContact(id: string, data: ConfirmContactInput): Promise<BrandElectronicContact> {
        const contact = await prisma.brandElectronicContact.findUnique({ where: { id } });
        if (!contact) {
            throw new NotFoundError('Electronic contact');
        }

        return prisma.brandElectronicContact.update({
            where: { id },
            data: {
                directCommunicationConfirmed: true,
                confirmationMethod: data.confirmationMethod,
                confirmedBy: data.confirmedBy,
                confirmedAt: new Date(),
            },
        });
    }

    /**
     * Get contacts for an entity
     */
    async getForEntity(entityId: string, options?: {
        forSafetyIssues?: boolean;
        publicOnly?: boolean;
    }): Promise<EntityElectronicContact[]> {
        return prisma.entityElectronicContact.findMany({
            where: {
                entityId,
                isActive: true,
                ...(options?.forSafetyIssues && { isForSafetyIssues: true }),
                ...(options?.publicOnly && { isPublic: true }),
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get contacts for a brand
     */
    async getForBrand(brandId: string, options?: {
        forSafetyIssues?: boolean;
        publicOnly?: boolean;
    }): Promise<BrandElectronicContact[]> {
        return prisma.brandElectronicContact.findMany({
            where: {
                brandId,
                isActive: true,
                ...(options?.forSafetyIssues && { isForSafetyIssues: true }),
                ...(options?.publicOnly && { isPublic: true }),
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get all safety contacts for a brand (including linked entity contacts)
     */
    async getSafetyContactsForBrand(brandId: string): Promise<{
        brandContacts: BrandElectronicContact[];
        entityContacts: { entity: any; contacts: EntityElectronicContact[] }[];
    }> {
        // Get brand's own contacts
        const brandContacts = await this.getForBrand(brandId, {
            forSafetyIssues: true,
            publicOnly: true
        });

        // Get linked entities and their safety contacts
        const links = await prisma.brandLink.findMany({
            where: {
                brandId,
                isActive: true,
                linkType: { in: ['MANUFACTURER', 'RESPONSIBLE_PERSON', 'IMPORTER'] },
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

        const entityContacts = await Promise.all(
            links.map(async (link) => ({
                entity: link.entity,
                contacts: await this.getForEntity(link.entityId, {
                    forSafetyIssues: true,
                    publicOnly: true
                }),
            }))
        );

        return { brandContacts, entityContacts };
    }

    /**
     * Deactivate an entity contact
     */
    async deactivateEntityContact(id: string): Promise<EntityElectronicContact> {
        const contact = await prisma.entityElectronicContact.findUnique({ where: { id } });
        if (!contact) {
            throw new NotFoundError('Electronic contact');
        }

        return prisma.entityElectronicContact.update({
            where: { id },
            data: { isActive: false },
        });
    }

    /**
     * Deactivate a brand contact
     */
    async deactivateBrandContact(id: string): Promise<BrandElectronicContact> {
        const contact = await prisma.brandElectronicContact.findUnique({ where: { id } });
        if (!contact) {
            throw new NotFoundError('Electronic contact');
        }

        return prisma.brandElectronicContact.update({
            where: { id },
            data: { isActive: false },
        });
    }
}

export const contactService = new ContactService();
