/**
 * Custom error classes for the application.
 * 
 * All application errors extend AppError, which includes:
 * - HTTP status code for API responses
 * - isOperational flag to distinguish from programming errors
 * - Proper prototype chain for instanceof checks
 */

/**
 * Base application error class.
 * 
 * All custom errors should extend this class. The error handler
 * middleware checks for AppError instances to return appropriate
 * HTTP responses.
 * 
 * @example
 * ```typescript
 * throw new AppError('Something went wrong', 500);
 * ```
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error thrown when a requested resource is not found.
 * Returns HTTP 404.
 * 
 * @example
 * ```typescript
 * throw new NotFoundError('Entity'); // "Entity not found"
 * ```
 */
export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

/**
 * Error thrown for validation failures.
 * Returns HTTP 400 with field-level error details.
 * 
 * @example
 * ```typescript
 * throw new ValidationError('Invalid input', {
 *   email: ['Must be a valid email'],
 *   name: ['Required']
 * });
 * ```
 */
export class ValidationError extends AppError {
    public readonly errors: Record<string, string[]>;

    constructor(message: string, errors: Record<string, string[]> = {}) {
        super(message, 400);
        this.errors = errors;
    }
}

/**
 * Error thrown when attempting to create a duplicate resource.
 * Returns HTTP 409.
 */
export class ConflictError extends AppError {
    constructor(message: string = 'Resource already exists') {
        super(message, 409);
    }
}

/**
 * Error thrown for authentication failures.
 * Returns HTTP 401.
 */
export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401);
    }
}

/**
 * Error thrown for authorization failures.
 * Returns HTTP 403.
 */
export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
        super(message, 403);
    }
}
