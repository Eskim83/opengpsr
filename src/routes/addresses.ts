import { Router, Request, Response, NextFunction } from 'express';
import { addressService } from '../services';

// Type alias (will be available from Prisma after migration)
type AddressType = 'REGISTERED' | 'OPERATING' | 'RETURN' | 'SAFETY_CONTACT';

const router = Router();

/**
 * @route   GET /api/v1/addresses/entity/:entityId
 * @desc    Get addresses for an entity
 * @access  Private (API key required)
 */
router.get('/entity/:entityId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;
        const type = req.query.type as AddressType | undefined;

        const addresses = await addressService.getForEntity(entityId, type);

        res.json({
            success: true,
            data: addresses,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/addresses/search
 * @desc    Search addresses by text
 * @access  Private (API key required)
 * 
 * @query   q - Search query (required)
 * @query   country - Country code filter (optional)
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q, country, limit } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query (q) is required',
            });
        }

        const addresses = await addressService.search(
            q as string,
            country as string | undefined,
            parseInt(limit as string) || 20
        );

        res.json({
            success: true,
            data: addresses,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/addresses
 * @desc    Create a new address
 * @access  Private (API key required)
 * 
 * @body    { entityId?, streetLine1, streetLine2?, city, postalCode?, region?, countryCode, addressType?, sourceId? }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const address = await addressService.create(req.body);

        res.status(201).json({
            success: true,
            data: address,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PATCH /api/v1/addresses/:id
 * @desc    Update an address
 * @access  Private (API key required)
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const address = await addressService.update(id, req.body);

        res.json({
            success: true,
            data: address,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/addresses/:id
 * @desc    Deactivate an address
 * @access  Private (API key required)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const address = await addressService.deactivate(id);

        res.json({
            success: true,
            data: address,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
