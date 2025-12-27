import prisma from '../config/database';
import { VerificationRecord, VerificationStatusType } from '@prisma/client';
import { AddVerificationInput } from '../schemas';
import { NotFoundError } from '../utils/errors';

/**
 * Service for managing verification records
 * Verification is INFORMATIONAL ONLY - not a legal certification
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
     */
    async getLatestVerificationStatus(entityId: string): Promise<VerificationRecord | null> {
        return prisma.verificationRecord.findFirst({
            where: {
                version: {
                    entityId,
                    isCurrent: true,
                },
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
