import prisma from '../config/database';
import { VerificationRecord, VerificationStatusType } from '@prisma/client';
import { AddVerificationInput } from '../schemas';
import { NotFoundError } from '../utils/errors';

/**
 * Service for managing verification records.
 * 
 * Verification is INFORMATIONAL ONLY - it does NOT constitute legal
 * certification or guarantee GPSR compliance. It tracks community and
 * primary source confirmations for data quality purposes.
 * 
 * @remarks
 * - Verification records are attached to specific EntityVersion snapshots
 * - Multiple verification statuses can exist for the same version
 * - Supports expiration dates for time-limited verifications
 */
export class VerificationService {
    /**
     * Add a verification record to an entity version.
     * 
     * @param versionId - EntityVersion UUID
     * @param data - Verification data (status, method, evidence)
     * @returns The created verification record
     * @throws NotFoundError if version doesn't exist
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
     * Get verification history for an entity.
     * 
     * Returns all verification records across all versions of an entity,
     * ordered by verification date (most recent first).
     * 
     * @param entityId - Entity UUID
     * @returns Array of verification records with version info
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
     * Uses Entity.currentVersionId to find the current version
     * @param entityId - Entity ID
     * @returns Latest verification record or null
     */
    async getLatestVerificationStatus(entityId: string): Promise<VerificationRecord | null> {
        // First get the entity's current version ID
        const entity = await prisma.entity.findUnique({
            where: { id: entityId },
            select: { currentVersionId: true },
        });

        if (!entity?.currentVersionId) {
            return null;
        }

        return prisma.verificationRecord.findFirst({
            where: {
                versionId: entity.currentVersionId,
            },
            orderBy: { verifiedAt: 'desc' },
        });
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
