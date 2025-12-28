import { Router, Request, Response, NextFunction } from 'express';
import { contactService } from '../services';
import { validateBody } from '../middleware';
import { createElectronicContactSchema, confirmContactSchema } from '../schemas';

const router = Router();

// =========================================================================
// Entity Contacts
// =========================================================================

/**
 * @route   POST /api/v1/contacts/entity/:entityId
 * @desc    Create a new electronic contact for an entity
 * @access  API
 */
router.post(
    '/entity/:entityId',
    validateBody(createElectronicContactSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contact = await contactService.createForEntity(req.params.entityId, req.body);
            res.status(201).json({
                success: true,
                data: contact,
                message: 'Electronic contact created successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   POST /api/v1/contacts/entity/:id/confirm
 * @desc    Confirm direct communication capability for entity contact
 * @access  API
 */
router.post(
    '/entity/:id/confirm',
    validateBody(confirmContactSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contact = await contactService.confirmEntityContact(
                req.params.id,
                req.body
            );
            res.json({
                success: true,
                data: contact,
                message: 'Contact confirmed for direct communication',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/v1/contacts/entity/:entityId
 * @desc    Get contacts for an entity
 * @access  Public
 */
router.get('/entity/:entityId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const forSafety = req.query.safety === 'true';
        const contacts = await contactService.getForEntity(req.params.entityId, {
            forSafetyIssues: forSafety,
            publicOnly: true,
        });
        res.json({
            success: true,
            data: contacts,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/contacts/entity/:id
 * @desc    Deactivate an entity contact
 * @access  API
 */
router.delete('/entity/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await contactService.deactivateEntityContact(req.params.id);
        res.json({
            success: true,
            message: 'Contact deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
});

// =========================================================================
// Brand Contacts
// =========================================================================

/**
 * @route   POST /api/v1/contacts/brand/:brandId
 * @desc    Create a new electronic contact for a brand
 * @access  API
 */
router.post(
    '/brand/:brandId',
    validateBody(createElectronicContactSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contact = await contactService.createForBrand(req.params.brandId, req.body);
            res.status(201).json({
                success: true,
                data: contact,
                message: 'Electronic contact created successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   POST /api/v1/contacts/brand/:id/confirm
 * @desc    Confirm direct communication capability for brand contact
 * @access  API
 */
router.post(
    '/brand/:id/confirm',
    validateBody(confirmContactSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contact = await contactService.confirmBrandContact(
                req.params.id,
                req.body
            );
            res.json({
                success: true,
                data: contact,
                message: 'Contact confirmed for direct communication',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/v1/contacts/brand/:brandId
 * @desc    Get contacts for a brand
 * @access  Public
 */
router.get('/brand/:brandId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const forSafety = req.query.safety === 'true';
        const contacts = await contactService.getForBrand(req.params.brandId, {
            forSafetyIssues: forSafety,
            publicOnly: true,
        });
        res.json({
            success: true,
            data: contacts,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/contacts/brand/:brandId/safety
 * @desc    Get all safety contacts for a brand (including linked entities)
 * @access  Public
 */
router.get('/brand/:brandId/safety', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contacts = await contactService.getSafetyContactsForBrand(req.params.brandId);
        res.json({
            success: true,
            data: contacts,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/contacts/brand/:id
 * @desc    Deactivate a brand contact
 * @access  API
 */
router.delete('/brand/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await contactService.deactivateBrandContact(req.params.id);
        res.json({
            success: true,
            message: 'Contact deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
});

export default router;
