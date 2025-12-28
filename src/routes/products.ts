import { Router, Request, Response, NextFunction } from 'express';
import { productService } from '../services';
import { validateBody, validateQuery } from '../middleware';
import {
    createProductSchema,
    updateProductSchema,
    productQuerySchema,
    createSafetyInfoSchema,
    updateSafetyInfoSchema,
} from '../schemas';

const router = Router();

/**
 * @route   GET /api/v1/products
 * @desc    List products with filtering
 * @access  Public
 */
router.get(
    '/',
    validateQuery(productQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await productService.list(req.query as any);
            res.json({
                success: true,
                data: result.products,
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
 * @route   GET /api/v1/products/lookup/:identifier
 * @desc    Find product by EAN/GTIN/MPN
 * @access  Public
 */
router.get('/lookup/:identifier', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const product = await productService.findByIdentifier(req.params.identifier);
        if (!product) {
            res.status(404).json({
                success: false,
                error: { message: 'Product not found' },
            });
            return;
        }
        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get product by ID with safety info
 * @access  Public
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const product = await productService.getById(req.params.id);
        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product reference
 * @access  API
 */
router.post(
    '/',
    validateBody(createProductSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = await productService.create(req.body);
            res.status(201).json({
                success: true,
                data: product,
                message: 'Product created successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   PATCH /api/v1/products/:id
 * @desc    Update product
 * @access  API
 */
router.patch(
    '/:id',
    validateBody(updateProductSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = await productService.update(req.params.id, req.body);
            res.json({
                success: true,
                data: product,
                message: 'Product updated successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

// =========================================================================
// Safety Info Routes
// =========================================================================

/**
 * @route   GET /api/v1/products/:id/safety
 * @desc    Get all safety info for a product
 * @access  Public
 */
router.get('/:id/safety', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const safetyInfo = await productService.getAllSafetyInfo(req.params.id);
        res.json({
            success: true,
            data: safetyInfo,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/products/:id/safety/:countryCode
 * @desc    Get safety info for a product in a specific country
 * @access  Public
 */
router.get('/:id/safety/:countryCode', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const languageCode = req.query.lang as string;
        const safetyInfo = await productService.getSafetyInfo(
            req.params.id,
            req.params.countryCode,
            languageCode
        );

        if (!safetyInfo) {
            res.status(404).json({
                success: false,
                error: { message: 'Safety info not found for this country/language' },
            });
            return;
        }

        res.json({
            success: true,
            data: safetyInfo,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/products/:id/safety
 * @desc    Add safety info for a product
 * @access  API
 */
router.post(
    '/:id/safety',
    validateBody(createSafetyInfoSchema.omit({ productId: true })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const safetyInfo = await productService.addSafetyInfo({
                ...req.body,
                productId: req.params.id,
            });
            res.status(201).json({
                success: true,
                data: safetyInfo,
                message: 'Safety info added successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   PATCH /api/v1/safety/:id
 * @desc    Update safety info
 * @access  API
 */
router.patch(
    '/safety/:id',
    validateBody(updateSafetyInfoSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const safetyInfo = await productService.updateSafetyInfo(req.params.id, req.body);
            res.json({
                success: true,
                data: safetyInfo,
                message: 'Safety info updated successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
