import { Router, Request, Response, NextFunction } from 'express';
import { claimService } from '../services';

// Type aliases (will be available from Prisma after migration)
type ClaimStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'DISPUTED' | 'SUPERSEDED';
type ClaimSubject = 'ENTITY' | 'BRAND' | 'PRODUCT' | 'RESPONSIBILITY' | 'CONTACT' | 'ADDRESS';
type EvidenceType = 'URL' | 'FILE' | 'IMAGE' | 'PDF' | 'TEXT_SNAPSHOT' | 'LABEL_PHOTO' | 'REGISTRY_EXTRACT';

const router = Router();

/**
 * @route   GET /api/v1/claims/pending
 * @desc    Get pending claims for review
 * @access  Private (API key required)
 */
router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const claims = await claimService.getPending(limit);

        res.json({
            success: true,
            data: claims,
            count: claims.length,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/claims/subject/:subject/:subjectId
 * @desc    Get claims for a specific subject
 * @access  Private (API key required)
 */
router.get('/subject/:subject/:subjectId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { subject, subjectId } = req.params;
        const status = req.query.status as ClaimStatus | undefined;

        const claims = await claimService.getForSubject(
            subject as ClaimSubject,
            subjectId,
            status
        );

        res.json({
            success: true,
            data: claims,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/claims
 * @desc    Submit a new claim
 * @access  Private (API key required)
 * 
 * @body    { subject, subjectId, attribute, value, sourceId, confidence?, evidence? }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const claim = await claimService.submit(req.body);

        res.status(201).json({
            success: true,
            data: claim,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/claims/:id/accept
 * @desc    Accept a claim
 * @access  Private (API key required)
 */
router.put('/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { reviewedBy, notes } = req.body;

        if (!reviewedBy) {
            return res.status(400).json({
                success: false,
                error: 'reviewedBy is required',
            });
        }

        const claim = await claimService.accept(id, reviewedBy, notes);

        res.json({
            success: true,
            data: claim,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/claims/:id/reject
 * @desc    Reject a claim
 * @access  Private (API key required)
 */
router.put('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { reviewedBy, notes } = req.body;

        if (!reviewedBy || !notes) {
            return res.status(400).json({
                success: false,
                error: 'reviewedBy and notes are required',
            });
        }

        const claim = await claimService.reject(id, reviewedBy, notes);

        res.json({
            success: true,
            data: claim,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/claims/:id/dispute
 * @desc    Dispute a claim
 * @access  Private (API key required)
 */
router.put('/:id/dispute', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { disputedBy, reason } = req.body;

        if (!disputedBy || !reason) {
            return res.status(400).json({
                success: false,
                error: 'disputedBy and reason are required',
            });
        }

        const claim = await claimService.dispute(id, disputedBy, reason);

        res.json({
            success: true,
            data: claim,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/claims/:id/supersede
 * @desc    Supersede a claim with new data
 * @access  Private (API key required)
 */
router.post('/:id/supersede', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { value, sourceId, confidence } = req.body;

        if (!value || !sourceId) {
            return res.status(400).json({
                success: false,
                error: 'value and sourceId are required',
            });
        }

        const newClaim = await claimService.supersede(id, { value, sourceId, confidence });

        res.status(201).json({
            success: true,
            data: newClaim,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/claims/:id/evidence
 * @desc    Add evidence to a claim
 * @access  Private (API key required)
 */
router.post('/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const evidence = await claimService.addEvidence(id, req.body);

        res.status(201).json({
            success: true,
            data: evidence,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
