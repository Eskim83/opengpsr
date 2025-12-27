import { Router, Request, Response, NextFunction } from 'express';
import { auditService } from '../services';
import prisma from '../config/database';

const router = Router();

/**
 * @route   GET /api/v1/audit/entity/:entityType/:entityId
 * @desc    Get audit logs for a specific entity
 * @access  API
 */
router.get(
    '/entity/:entityType/:entityId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { entityType, entityId } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            const result = await auditService.getForEntity(entityType, entityId, { limit, offset });

            res.json({
                success: true,
                data: result.logs,
                pagination: {
                    total: result.total,
                    limit,
                    offset,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/v1/audit/recent
 * @desc    Get recent audit logs
 * @access  API
 */
router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const action = req.query.action as string;
        const entityType = req.query.entityType as string;

        const logs = await auditService.getRecent({ limit, action, entityType });

        res.json({
            success: true,
            data: logs,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
