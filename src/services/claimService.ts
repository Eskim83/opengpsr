import prisma from '../config/database';
import { auditService } from './index';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

// Type aliases (will be available from Prisma after migration)
type ClaimStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'DISPUTED' | 'SUPERSEDED';
type ClaimSubject = 'ENTITY' | 'BRAND' | 'PRODUCT' | 'RESPONSIBILITY' | 'CONTACT' | 'ADDRESS';
type EvidenceType = 'URL' | 'FILE' | 'IMAGE' | 'PDF' | 'TEXT_SNAPSHOT' | 'LABEL_PHOTO' | 'REGISTRY_EXTRACT';

/**
 * Service for managing Claims and Evidence (v2.0 P1)
 * 
 * Enables granular verification at attribute level rather than entity level.
 * Each claim can be verified, disputed, or superseded independently.
 * 
 * @example
 * // Submit a claim about an entity's address
 * await claimService.submit({
 *   subject: 'ENTITY',
 *   subjectId: entityId,
 *   attribute: 'address',
 *   value: 'ul. Nowa 123, Warszawa',
 *   sourceId,
 *   evidence: [{ type: 'URL', url: 'https://krs.gov.pl/...' }]
 * });
 */
class ClaimService {
    /**
     * Submit a new claim with optional evidence
     * 
     * @param data - Claim data including subject, attribute, value, and evidence
     * @returns Created Claim with evidence
     */
    async submit(data: {
        subject: ClaimSubject;
        subjectId: string;
        attribute: string;
        value: string;
        sourceId: string;
        confidence?: number;
        evidence?: Array<{
            type: EvidenceType;
            url?: string;
            content?: string;
            contentHash?: string;
        }>;
    }) {
        // Validate source exists
        const source = await prisma.source.findUnique({
            where: { id: data.sourceId },
        });
        if (!source) {
            throw new NotFoundError('Source not found');
        }

        // Create claim with evidence in transaction
        const claim = await prisma.claim.create({
            data: {
                subject: data.subject,
                subjectId: data.subjectId,
                attribute: data.attribute,
                value: data.value,
                sourceId: data.sourceId,
                confidence: data.confidence ?? 50,
                status: 'PROPOSED',
                evidence: data.evidence ? {
                    create: data.evidence.map(e => ({
                        type: e.type,
                        url: e.url,
                        content: e.content,
                        contentHash: e.contentHash,
                    })),
                } : undefined,
            },
            include: {
                evidence: true,
                source: true,
            },
        });

        await auditService.log({
            action: 'CLAIM_SUBMITTED',
            entityType: 'Claim',
            entityId: claim.id,
            newData: claim as unknown as Prisma.JsonObject,
        });

        return claim;
    }

    /**
     * Accept a claim (verify it as correct)
     * 
     * @param claimId - Claim UUID
     * @param reviewedBy - Reviewer identifier
     * @param notes - Optional review notes
     */
    async accept(claimId: string, reviewedBy: string, notes?: string) {
        const claim = await prisma.claim.update({
            where: { id: claimId },
            data: {
                status: 'ACCEPTED',
                reviewedBy,
                reviewedAt: new Date(),
                reviewNotes: notes,
            },
            include: { evidence: true },
        });

        await auditService.log({
            action: 'CLAIM_ACCEPTED',
            entityType: 'Claim',
            entityId: claimId,
            newData: { reviewedBy, notes } as unknown as Prisma.JsonObject,
        });

        return claim;
    }

    /**
     * Reject a claim
     * 
     * @param claimId - Claim UUID
     * @param reviewedBy - Reviewer identifier
     * @param notes - Rejection reason
     */
    async reject(claimId: string, reviewedBy: string, notes: string) {
        const claim = await prisma.claim.update({
            where: { id: claimId },
            data: {
                status: 'REJECTED',
                reviewedBy,
                reviewedAt: new Date(),
                reviewNotes: notes,
            },
        });

        await auditService.log({
            action: 'CLAIM_REJECTED',
            entityType: 'Claim',
            entityId: claimId,
            newData: { reviewedBy, notes } as unknown as Prisma.JsonObject,
        });

        return claim;
    }

    /**
     * Dispute a claim (contest its validity)
     * 
     * @param claimId - Claim UUID
     * @param disputedBy - Who is disputing
     * @param reason - Dispute reason
     */
    async dispute(claimId: string, disputedBy: string, reason: string) {
        const claim = await prisma.claim.update({
            where: { id: claimId },
            data: {
                status: 'DISPUTED',
                reviewNotes: reason,
            },
        });

        await auditService.log({
            action: 'CLAIM_DISPUTED',
            entityType: 'Claim',
            entityId: claimId,
            newData: { disputedBy, reason } as unknown as Prisma.JsonObject,
        });

        return claim;
    }

    /**
     * Supersede a claim with a new one
     * 
     * @param oldClaimId - Claim to supersede
     * @param newClaimData - New claim data
     */
    async supersede(
        oldClaimId: string,
        newClaimData: {
            value: string;
            sourceId: string;
            confidence?: number;
        }
    ) {
        const oldClaim = await prisma.claim.findUnique({
            where: { id: oldClaimId },
        });

        if (!oldClaim) {
            throw new NotFoundError('Claim not found');
        }

        // Create new claim and mark old as superseded
        const [updatedOld, newClaim] = await prisma.$transaction([
            prisma.claim.update({
                where: { id: oldClaimId },
                data: { status: 'SUPERSEDED' },
            }),
            prisma.claim.create({
                data: {
                    subject: oldClaim.subject,
                    subjectId: oldClaim.subjectId,
                    attribute: oldClaim.attribute,
                    value: newClaimData.value,
                    sourceId: newClaimData.sourceId,
                    confidence: newClaimData.confidence ?? 50,
                    status: 'PROPOSED',
                    supersededById: oldClaimId,
                },
                include: { evidence: true },
            }),
        ]);

        await auditService.log({
            action: 'CLAIM_SUPERSEDED',
            entityType: 'Claim',
            entityId: oldClaimId,
            newData: { newClaimId: newClaim.id } as unknown as Prisma.JsonObject,
        });

        return newClaim;
    }

    /**
     * Get claims for a subject
     * 
     * @param subject - Subject type
     * @param subjectId - Subject UUID
     * @param status - Optional status filter
     */
    async getForSubject(
        subject: ClaimSubject,
        subjectId: string,
        status?: ClaimStatus
    ) {
        const where: Record<string, unknown> = { subject, subjectId };
        if (status) {
            where.status = status;
        }

        return prisma.claim.findMany({
            where,
            include: {
                evidence: true,
                source: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get pending claims for review
     * 
     * @param limit - Max results
     */
    async getPending(limit: number = 50) {
        return prisma.claim.findMany({
            where: { status: 'PROPOSED' },
            include: {
                evidence: true,
                source: true,
            },
            orderBy: [
                { confidence: 'desc' },
                { createdAt: 'asc' },
            ],
            take: limit,
        });
    }

    /**
     * Add evidence to existing claim
     * 
     * @param claimId - Claim UUID
     * @param evidence - Evidence data
     */
    async addEvidence(
        claimId: string,
        evidence: {
            type: EvidenceType;
            url?: string;
            content?: string;
            contentHash?: string;
        }
    ) {
        const claim = await prisma.claim.findUnique({
            where: { id: claimId },
        });

        if (!claim) {
            throw new NotFoundError('Claim not found');
        }

        return prisma.evidence.create({
            data: {
                claimId,
                type: evidence.type,
                url: evidence.url,
                content: evidence.content,
                contentHash: evidence.contentHash,
            },
        });
    }
}

export const claimService = new ClaimService();
export default claimService;
