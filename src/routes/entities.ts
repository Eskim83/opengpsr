import { Router, Request, Response, NextFunction } from 'express';
import { entityService } from '../services';
import { validateBody, validateQuery } from '../middleware';
import {
    createEntitySchema,
    updateEntitySchema,
    entityQuerySchema,
    addRoleSchema,
} from '../schemas';

const router = Router();

/**
 * @route   GET /api/v1/entities
 * @desc    List entities with filtering and pagination
 * @access  Public
 */
router.get(
    '/',
    validateQuery(entityQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await entityService.list(req.query as any);
            res.json({
                success: true,
                data: result.entities,
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
 * @route   GET /api/v1/entities/:id
 * @desc    Get entity by ID with current version
 * @access  Public
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entity = await entityService.getById(req.params.id);
        res.json({
            success: true,
            data: entity,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/entities/:id/versions
 * @desc    Get entity with full version history
 * @access  Public
 */
router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entity = await entityService.getWithHistory(req.params.id);
        res.json({
            success: true,
            data: {
                entity: {
                    id: entity.id,
                    normalizedName: entity.normalizedName,
                    normalizedCountry: entity.normalizedCountry,
                    currentVersionId: entity.currentVersionId,
                    isActive: entity.isActive,
                },
                versions: entity.versions,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/entities
 * @desc    Create a new entity
 * @access  API
 */
router.post(
    '/',
    validateBody(createEntitySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const entity = await entityService.create(req.body);
            res.status(201).json({
                success: true,
                data: entity,
                message: 'Entity created successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   PATCH /api/v1/entities/:id
 * @desc    Update entity (creates new version)
 * @access  API
 */
router.patch(
    '/:id',
    validateBody(updateEntitySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const entity = await entityService.update(req.params.id, req.body);
            res.json({
                success: true,
                data: entity,
                message: 'Entity updated successfully (new version created)',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   DELETE /api/v1/entities/:id
 * @desc    Soft delete entity (marks as inactive)
 * @access  API
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await entityService.deactivate(req.params.id);
        res.json({
            success: true,
            message: 'Entity deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/entities/:id/roles
 * @desc    Add a role to an entity
 * @access  API
 */
router.post(
    '/:id/roles',
    validateBody(addRoleSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const role = await entityService.addRole(req.params.id, req.body);
            res.status(201).json({
                success: true,
                data: role,
                message: 'Role added successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   DELETE /api/v1/entities/:entityId/roles/:roleId
 * @desc    Deactivate a role
 * @access  API
 */
router.delete(
    '/:entityId/roles/:roleId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // For now, role deactivation is handled via direct Prisma call
            // TODO: Add deactivateRole method to entityService
            const prisma = require('../config/database').default;
            await prisma.entityRole.update({
                where: { id: req.params.roleId },
                data: { isActive: false },
            });
            res.json({
                success: true,
                message: 'Role deactivated successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
