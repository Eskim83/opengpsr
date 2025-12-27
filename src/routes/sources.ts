import { Router, Request, Response, NextFunction } from 'express';
import { sourceService } from '../services';
import { validateBody } from '../middleware';
import { createSourceSchema } from '../schemas';
import { SourceType } from '@prisma/client';

const router = Router();

/**
 * @route   GET /api/v1/sources
 * @desc    List all sources
 * @access  Public
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;
        const sourceType = req.query.sourceType as SourceType | undefined;

        const result = await sourceService.list({ sourceType, limit, offset });

        res.json({
            success: true,
            data: result.sources,
            pagination: {
                total: result.total,
                limit,
                offset,
                hasMore: offset + limit < result.total,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/sources/:id
 * @desc    Get source by ID
 * @access  Public
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const source = await sourceService.getById(req.params.id);
        res.json({
            success: true,
            data: source,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/sources
 * @desc    Create a new source
 * @access  API
 */
router.post(
    '/',
    validateBody(createSourceSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const source = await sourceService.create(req.body);
            res.status(201).json({
                success: true,
                data: source,
                message: 'Source created successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
