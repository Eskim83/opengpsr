import { Prisma } from '@prisma/client';

/**
 * Retry wrapper for operations that may hit P2002 (unique constraint violation)
 * This is useful for version number race conditions
 * 
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns The result of the operation
 */
export async function withP2002Retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (isPrismaP2002Error(error)) {
                lastError = error as Error;
                console.warn(`P2002 conflict on attempt ${attempt}/${maxRetries}, retrying...`);

                // Small delay before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 10 * Math.pow(2, attempt)));
                continue;
            }
            // Not a P2002 error, rethrow immediately
            throw error;
        }
    }

    // All retries exhausted
    throw lastError || new Error('Max retries exceeded');
}

/**
 * Check if an error is a Prisma P2002 (unique constraint violation)
 */
export function isPrismaP2002Error(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
    );
}

/**
 * Check if an error is a Prisma P2025 (record not found)
 */
export function isPrismaP2025Error(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
    );
}

/**
 * Check if an error is any known Prisma error
 */
export function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError;
}
