import { Router, Request, Response, NextFunction } from 'express';
import { contactService } from '../services';
import { validateBody } from '../middleware';
import { createElectronicContactSchema, confirmContactSchema } from '../schemas';

const router = Router();

/**
 * @route   POST /api/v1/contacts
 * @desc    Create a new electronic contact
 * @access  API
 */
router.post(
    '/',
    validateBody(createElectronicContactSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contact = await contactService.create(req.body);
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
 * @route   POST /api/v1/contacts/:id/confirm
 * @desc    Confirm direct communication capability
 * @access  API
 */
router.post(
    '/:id/confirm',
    validateBody(confirmContactSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contact = await contactService.confirmDirectCommunication(
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
 * @route   DELETE /api/v1/contacts/:id
 * @desc    Deactivate a contact
 * @access  API
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await contactService.deactivate(req.params.id);
        res.json({
            success: true,
            message: 'Contact deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
});

export default router;
