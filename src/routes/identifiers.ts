import { Router, Request, Response, NextFunction } from 'express';
import { entityIdentifierService } from '../services';

// Type alias for IdentifierType (will be available from Prisma after migration)
type IdentifierType = 'VAT_EU' | 'EORI' | 'LEI' | 'DUNS' | 'KRS' | 'NIP' | 'REGON' | 'GLN' | 'COMPANY_REGISTER';

const router = Router();

/**
 * @route   GET /api/v1/identifiers/lookup
 * @desc    Find entity by identifier (dedup/lookup)
 * @access  Private (API key required)
 * 
 * @query   type - Identifier type (VAT_EU, EORI, etc.)
 * @query   value - Identifier value
 */
router.get('/lookup', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, value } = req.query;

        if (!type || !value) {
            return res.status(400).json({
                success: false,
                error: 'Both type and value are required',
            });
        }

        const entity = await entityIdentifierService.findByIdentifier(
            type as IdentifierType,
            value as string
        );

        if (!entity) {
            return res.status(404).json({
                success: false,
                error: 'Entity not found for this identifier',
            });
        }

        res.json({
            success: true,
            data: entity,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/identifiers/search
 * @desc    Search entities by partial identifier value
 * @access  Private (API key required)
 * 
 * @query   q - Search pattern
 * @query   type - Optional: filter by identifier type
 * @query   limit - Optional: max results (default 20)
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q, type, limit } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query (q) is required',
            });
        }

        const results = await entityIdentifierService.search(
            q as string,
            type as IdentifierType | undefined,
            limit ? parseInt(limit as string, 10) : undefined
        );

        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/identifiers/entity/:entityId
 * @desc    Get all identifiers for an entity
 * @access  Private (API key required)
 */
router.get('/entity/:entityId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;

        const identifiers = await entityIdentifierService.getForEntity(entityId);

        res.json({
            success: true,
            data: identifiers,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/identifiers/entity/:entityId/duplicates
 * @desc    Find potential duplicate entities based on identifiers
 * @access  Private (API key required)
 */
router.get('/entity/:entityId/duplicates', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;

        const candidates = await entityIdentifierService.findDuplicateCandidates(entityId);

        res.json({
            success: true,
            data: candidates,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/identifiers/entity/:entityId
 * @desc    Add an identifier to an entity
 * @access  Private (API key required)
 * 
 * @body    type, value, countryCode?, sourceId, isPrimary?
 */
router.post('/entity/:entityId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;

        const identifier = await entityIdentifierService.addIdentifier(entityId, req.body);

        res.status(201).json({
            success: true,
            data: identifier,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/identifiers/:id
 * @desc    Remove an identifier
 * @access  Private (API key required)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        await entityIdentifierService.removeIdentifier(id);

        res.json({
            success: true,
            message: 'Identifier removed',
        });
    } catch (error) {
        next(error);
    }
});

export default router;
