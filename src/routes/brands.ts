import { Router, Request, Response, NextFunction } from 'express';
import { brandService } from '../services';
import { validateBody, validateQuery } from '../middleware';
import {
    createBrandSchema,
    updateBrandSchema,
    brandQuerySchema,
    createBrandLinkSchema,
} from '../schemas';
import { MarketContext } from '@prisma/client';

const router = Router();

/**
 * @route   GET /api/v1/brands
 * @desc    List brands with filtering
 * @access  Public
 */
router.get(
    '/',
    validateQuery(brandQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await brandService.list(req.query as any);
            res.json({
                success: true,
                data: result.brands,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    hasMore: result.offset + result.limit < result.total,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/v1/brands/:id
 * @desc    Get brand by ID with linked entities
 * @access  Public
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const brand = await brandService.getById(req.params.id);
        res.json({
            success: true,
            data: brand,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/brands
 * @desc    Create a new brand
 * @access  API
 */
router.post(
    '/',
    validateBody(createBrandSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const brand = await brandService.create(req.body);
            res.status(201).json({
                success: true,
                data: brand,
                message: 'Brand created successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   PATCH /api/v1/brands/:id
 * @desc    Update brand (creates new version)
 * @access  API
 */
router.patch(
    '/:id',
    validateBody(updateBrandSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const brand = await brandService.update(req.params.id, req.body);
            res.json({
                success: true,
                data: brand,
                message: 'Brand updated successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   DELETE /api/v1/brands/:id
 * @desc    Deactivate brand
 * @access  API
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await brandService.deactivate(req.params.id);
        res.json({
            success: true,
            message: 'Brand deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/brands/:id/links
 * @desc    Link brand to an entity
 * @access  API
 */
router.post(
    '/:id/links',
    validateBody(createBrandLinkSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const link = await brandService.addEntityLink(req.params.id, req.body);
            res.status(201).json({
                success: true,
                data: link,
                message: 'Brand linked to entity successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/v1/brands/:id/entities
 * @desc    Get entities linked to a brand
 * @access  Public
 */
router.get('/:id/entities', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const linkType = req.query.linkType as any;
        const marketContext = req.query.marketContext as MarketContext | undefined;

        const links = await brandService.getLinkedEntities(
            req.params.id,
            linkType,
            marketContext
        );

        res.json({
            success: true,
            data: links,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
