import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../utils/errors';

interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code?: string;
        errors?: Record<string, string[]>;
    };
}

/**
 * Global error handler middleware
 * FIX: Uses proper Prisma error detection with instanceof
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    console.error('Error:', err);

    // Handle known operational errors
    if (err instanceof AppError) {
        const response: ErrorResponse = {
            success: false,
            error: {
                message: err.message,
            },
        };

        // Include validation errors if present
        if (err instanceof ValidationError) {
            response.error.errors = err.errors;
        }

        res.status(err.statusCode).json(response);
        return;
    }

    // FIX: Handle Prisma errors with proper instanceof check
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            res.status(409).json({
                success: false,
                error: {
                    message: 'A record with this data already exists',
                    code: 'DUPLICATE_ENTRY',
                },
            });
            return;
        }

        if (err.code === 'P2025') {
            res.status(404).json({
                success: false,
                error: {
                    message: 'Record not found',
                    code: 'NOT_FOUND',
                },
            });
            return;
        }

        // Other Prisma errors
        res.status(400).json({
            success: false,
            error: {
                message: 'Database operation failed',
                code: `PRISMA_${err.code}`,
            },
        });
        return;
    }

    // Handle Prisma validation errors
    if (err instanceof Prisma.PrismaClientValidationError) {
        res.status(400).json({
            success: false,
            error: {
                message: 'Invalid data provided',
                code: 'VALIDATION_ERROR',
            },
        });
        return;
    }

    // Handle unknown errors
    const statusCode = 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code: 'INTERNAL_ERROR',
        },
    });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        success: false,
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            code: 'ROUTE_NOT_FOUND',
        },
    });
}
