import { Router, Request, Response, NextFunction } from 'express';
import { verificationService } from '../services';
import { validateBody } from '../middleware';
import { addVerificationSchema } from '../schemas';
import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';

const router = Router();

/**
 * @route   GET /api/v1/entities/:entityId/verification
 * @desc    Get verification history for an entity
 * @access  Public
 */
router.get(
    '/entities/:entityId/verification',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const history = await verificationService.getEntityVerificationHistory(req.params.entityId);
            const latest = await verificationService.getLatestVerificationStatus(req.params.entityId);

            res.json({
                success: true,
                data: {
                    currentStatus: latest?.status || 'UNVERIFIED',
                    history,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   POST /api/v1/entities/:entityId/verification
 * @desc    Add verification record to entity's current version
 * @access  API
 */
router.post(
    '/entities/:entityId/verification',
    validateBody(addVerificationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Get the current version of the entity
            const currentVersion = await prisma.entityVersion.findFirst({
                where: {
                    entityId: req.params.entityId,
                    isCurrent: true,
                },
            });

            if (!currentVersion) {
                throw new NotFoundError('Entity or current version');
            }

            const verification = await verificationService.addVerification(
                currentVersion.id,
                req.body
            );

            res.status(201).json({
                success: true,
                data: verification,
                message: 'Verification record added successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   POST /api/v1/versions/:versionId/verification
 * @desc    Add verification record to a specific version
 * @access  API
 */
router.post(
    '/versions/:versionId/verification',
    validateBody(addVerificationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const verification = await verificationService.addVerification(
                req.params.versionId,
                req.body
            );

            res.status(201).json({
                success: true,
                data: verification,
                message: 'Verification record added successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
