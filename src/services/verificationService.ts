import prisma from '../config/database';
import { VerificationRecord, VerificationStatusType } from '@prisma/client';
import { AddVerificationInput } from '../schemas';
import { NotFoundError } from '../utils/errors';

/**
 * Service for managing verification records
 * Verification is INFORMATIONAL ONLY - not a legal certification
 * 
 * FIX: Uses Entity.currentVersionId instead of EntityVersion.isCurrent
 */
export class VerificationService {
    /**
     * Add a verification record to an entity version
     */
    async addVerification(
        versionId: string,
        data: AddVerificationInput
    ): Promise<VerificationRecord> {
        // Verify the version exists
        const version = await prisma.entityVersion.findUnique({
            where: { id: versionId },
        });

        if (!version) {
            throw new NotFoundError('Entity version');
        }

        return prisma.verificationRecord.create({
            data: {
                versionId,
                status: data.status,
                verifiedBy: data.verifiedBy,
                verificationMethod: data.verificationMethod,
                notes: data.notes,
                evidenceUrl: data.evidenceUrl,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
            },
        });
    }

    /**
     * Get verification history for an entity
     */
    async getEntityVerificationHistory(entityId: string): Promise<VerificationRecord[]> {
        return prisma.verificationRecord.findMany({
            where: {
                version: {
                    entityId,
                },
            },
            include: {
                version: {
                    select: {
                        id: true,
                        versionNumber: true,
                        capturedAt: true,
                    },
                },
            },
            orderBy: { verifiedAt: 'desc' },
        });
    }

    /**
     * Get the latest verification status for an entity
     * FIX: Uses Entity.currentVersionId instead of EntityVersion.isCurrent
     */
    async getLatestVerificationStatus(entityId: string): Promise<VerificationRecord | null> {
        // Get entity with currentVersionId
        const entity = await prisma.entity.findUnique({
            where: { id: entityId },
            select: { currentVersionId: true },
        });

        if (!entity?.currentVersionId) {
            return null;
        }

        // Get latest verification for current version
        return prisma.verificationRecord.findFirst({
            where: {
                versionId: entity.currentVersionId,
            },
            orderBy: { verifiedAt: 'desc' },
        });
    }

    /**
     * Get current version ID for an entity
     * Utility method for routes that need to add verification to current version
     */
    async getCurrentVersionId(entityId: string): Promise<string> {
        const entity = await prisma.entity.findUnique({
            where: { id: entityId },
            select: { currentVersionId: true },
        });

        if (!entity) {
            throw new NotFoundError('Entity');
        }

        if (!entity.currentVersionId) {
            throw new NotFoundError('Entity has no current version');
        }

        return entity.currentVersionId;
    }

    /**
     * Get verification records by status
     */
    async getByStatus(
        status: VerificationStatusType,
        options: { limit?: number; offset?: number } = {}
    ): Promise<{ records: VerificationRecord[]; total: number }> {
        const { limit = 20, offset = 0 } = options;

        const [records, total] = await Promise.all([
            prisma.verificationRecord.findMany({
                where: { status },
                include: {
                    version: {
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
                },
                orderBy: { verifiedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.verificationRecord.count({ where: { status } }),
        ]);

        return { records, total };
    }
}

export const verificationService = new VerificationService();
