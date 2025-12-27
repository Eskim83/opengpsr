import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Middleware factory for validating request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors: Record<string, string[]> = {};
                error.errors.forEach((err) => {
                    const path = err.path.join('.');
                    if (!errors[path]) {
                        errors[path] = [];
                    }
                    errors[path].push(err.message);
                });
                next(new ValidationError('Validation failed', errors));
            } else {
                next(error);
            }
        }
    };
}

/**
 * Middleware factory for validating query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            req.query = await schema.parseAsync(req.query) as any;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors: Record<string, string[]> = {};
                error.errors.forEach((err) => {
                    const path = err.path.join('.');
                    if (!errors[path]) {
                        errors[path] = [];
                    }
                    errors[path].push(err.message);
                });
                next(new ValidationError('Invalid query parameters', errors));
            } else {
                next(error);
            }
        }
    };
}

/**
 * Middleware factory for validating URL parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            req.params = await schema.parseAsync(req.params) as any;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors: Record<string, string[]> = {};
                error.errors.forEach((err) => {
                    const path = err.path.join('.');
                    if (!errors[path]) {
                        errors[path] = [];
                    }
                    errors[path].push(err.message);
                });
                next(new ValidationError('Invalid URL parameters', errors));
            } else {
                next(error);
            }
        }
    };
}
