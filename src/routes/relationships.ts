import { Router, Request, Response, NextFunction } from 'express';
import { entityRelationshipService } from '../services';

// Type alias (will be available from Prisma after migration)
type EntityRelationType =
    | 'PARENT_OF'
    | 'SUBSIDIARY_OF'
    | 'ACQUIRED_BY'
    | 'MERGED_INTO'
    | 'SUCCEEDED_BY'
    | 'AUTHORIZED_REP_FOR'
    | 'DISTRIBUTION_PARTNER';

const router = Router();

/**
 * @route   GET /api/v1/relationships/entity/:entityId/graph
 * @desc    Get corporate graph for an entity
 * @access  Private (API key required)
 */
router.get('/entity/:entityId/graph', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;
        const graph = await entityRelationshipService.getCorporateGraph(entityId);

        res.json({
            success: true,
            data: graph,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/relationships/entity/:entityId/parents
 * @desc    Get parent company chain
 * @access  Private (API key required)
 */
router.get('/entity/:entityId/parents', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;
        const maxDepth = parseInt(req.query.maxDepth as string) || 10;

        const chain = await entityRelationshipService.getParentChain(entityId, maxDepth);

        res.json({
            success: true,
            data: chain,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/relationships/entity/:entityId/from
 * @desc    Get relationships FROM an entity (outgoing)
 * @access  Private (API key required)
 */
router.get('/entity/:entityId/from', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;
        const relationType = req.query.type as EntityRelationType | undefined;

        const relations = await entityRelationshipService.getRelationsFrom(entityId, relationType);

        res.json({
            success: true,
            data: relations,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/relationships/entity/:entityId/to
 * @desc    Get relationships TO an entity (incoming)
 * @access  Private (API key required)
 */
router.get('/entity/:entityId/to', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId } = req.params;
        const relationType = req.query.type as EntityRelationType | undefined;

        const relations = await entityRelationshipService.getRelationsTo(entityId, relationType);

        res.json({
            success: true,
            data: relations,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/relationships
 * @desc    Create a new relationship
 * @access  Private (API key required)
 * 
 * @body    { fromEntityId, toEntityId, relationType, validFrom?, validTo?, sourceId?, confidence?, notes? }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const relationship = await entityRelationshipService.create(req.body);

        res.status(201).json({
            success: true,
            data: relationship,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/relationships/:id/end
 * @desc    End a relationship
 * @access  Private (API key required)
 */
router.put('/:id/end', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { endDate } = req.body;

        const relationship = await entityRelationshipService.end(
            id,
            endDate ? new Date(endDate) : undefined
        );

        res.json({
            success: true,
            data: relationship,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
