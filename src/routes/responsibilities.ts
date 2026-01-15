import { Router, Request, Response, NextFunction } from 'express';
import { productResponsibilityService } from '../services';
import { RoleType } from '@prisma/client';

const router = Router();

/**
 * @route   GET /api/v1/responsibilities/product/:productId
 * @desc    Get responsibilities for a product
 * @access  Private (API key required)
 */
router.get('/product/:productId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId } = req.params;
        const { country, role } = req.query;

        const responsibilities = await productResponsibilityService.getForProduct(
            productId,
            country as string | undefined,
            role as RoleType | undefined
        );

        res.json({
            success: true,
            data: responsibilities,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/responsibilities/product/:productId/resolved
 * @desc    Get resolved view (best known truth) for product responsibilities
 * @access  Private (API key required)
 * 
 * @query   country - Required: ISO 3166-1 alpha-2 country code
 */
router.get('/product/:productId/resolved', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId } = req.params;
        const { country } = req.query;

        if (!country) {
            return res.status(400).json({
                success: false,
                error: 'Country code is required',
            });
        }

        const resolved = await productResponsibilityService.getResolved(
            productId,
            country as string
        );

        res.json({
            success: true,
            data: resolved,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/responsibilities/product/:productId/history
 * @desc    Get full history of responsibilities for a product
 * @access  Private (API key required)
 */
router.get('/product/:productId/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId } = req.params;
        const { country } = req.query;

        const history = await productResponsibilityService.getHistory(
            productId,
            country as string | undefined
        );

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/responsibilities/entity/:entityId
 * @desc    Get all responsibilities assigned to an entity
 * @access  Private (API key required)
 */
router.get('/entity/:entityId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;

        const responsibilities = await productResponsibilityService.getForEntity(entityId);

        res.json({
            success: true,
            data: responsibilities,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/responsibilities
 * @desc    Assign responsibility for a product
 * @access  Private (API key required)
 * 
 * @body    productId, countryCode, entityId, role, sourceId, confidence?, validFrom?, validTo?
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const responsibility = await productResponsibilityService.assign(req.body);

        res.status(201).json({
            success: true,
            data: responsibility,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/responsibilities/:id/dispute
 * @desc    Mark a responsibility as disputed
 * @access  Private (API key required)
 */
router.put('/:id/dispute', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const responsibility = await productResponsibilityService.dispute(id, reason);

        res.json({
            success: true,
            data: responsibility,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
