import prisma from '../config/database';
import { auditService } from './index';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import crypto from 'crypto';

// Type alias (will be available from Prisma after migration)
type ApiClientScope = 'READ_PUBLIC' | 'READ_PRIVATE' | 'WRITE' | 'ADMIN' | 'SAFETY_ALERTS';

/**
 * Service for managing API Clients (v2.0 P3)
 * 
 * Multi-tenant API access with scoped permissions and rate limiting.
 * API keys are hashed for security, with prefix stored for identification.
 * 
 * @example
 * // Create new API client
 * const { client, apiKey } = await apiClientService.create({
 *   name: 'Marketplace Integration',
 *   contactEmail: 'api@marketplace.com',
 *   scopes: ['READ_PUBLIC', 'READ_PRIVATE'],
 * });
 */
class ApiClientService {
    /**
     * Create a new API client
     * 
     * @param data - Client data
     * @returns Created client with plaintext API key (only shown once!)
     */
    async create(data: {
        name: string;
        description?: string;
        contactEmail: string;
        organizationId?: string;
        scopes: ApiClientScope[];
        rateLimit?: number;
        expiresAt?: Date;
    }) {
        // Generate secure API key
        const apiKey = this.generateApiKey();
        const apiKeyHash = this.hashApiKey(apiKey);
        const apiKeyPrefix = apiKey.substring(0, 8);

        const client = await prisma.apiClient.create({
            data: {
                name: data.name,
                description: data.description,
                contactEmail: data.contactEmail,
                organizationId: data.organizationId,
                apiKeyHash,
                apiKeyPrefix,
                scopes: data.scopes,
                rateLimit: data.rateLimit ?? 1000,
                expiresAt: data.expiresAt,
            },
        });

        await auditService.log({
            action: 'API_CLIENT_CREATED',
            entityType: 'ApiClient',
            entityId: client.id,
            newData: { name: client.name, scopes: client.scopes } as unknown as Prisma.JsonObject,
        });

        // Return client with plaintext key (only shown once!)
        return {
            client,
            apiKey, // This is the only time the full key is available!
        };
    }

    /**
     * Validate API key and return client if valid
     * 
     * @param apiKey - API key to validate
     * @returns Client if valid, null otherwise
     */
    async validateKey(apiKey: string) {
        const apiKeyHash = this.hashApiKey(apiKey);
        const apiKeyPrefix = apiKey.substring(0, 8);

        const client = await prisma.apiClient.findFirst({
            where: {
                apiKeyPrefix,
                apiKeyHash,
                isActive: true,
            },
        });

        if (!client) {
            return null;
        }

        // Check expiration
        if (client.expiresAt && client.expiresAt < new Date()) {
            return null;
        }

        // Update last used
        await prisma.apiClient.update({
            where: { id: client.id },
            data: { lastUsedAt: new Date() },
        });

        return client;
    }

    /**
     * Check if client has required scope
     * 
     * @param clientId - Client UUID
     * @param requiredScope - Scope to check
     */
    async hasScope(clientId: string, requiredScope: ApiClientScope): Promise<boolean> {
        const client = await prisma.apiClient.findUnique({
            where: { id: clientId },
        });

        if (!client || !client.isActive) {
            return false;
        }

        // ADMIN has all scopes
        if (client.scopes.includes('ADMIN')) {
            return true;
        }

        return client.scopes.includes(requiredScope);
    }

    /**
     * Get client by ID
     * 
     * @param clientId - Client UUID
     */
    async getById(clientId: string) {
        const client = await prisma.apiClient.findUnique({
            where: { id: clientId },
        });

        if (!client) {
            throw new NotFoundError('API client not found');
        }

        return client;
    }

    /**
     * List all clients
     * 
     * @param includeInactive - Include deactivated clients
     */
    async list(includeInactive: boolean = false) {
        const where: Record<string, unknown> = {};
        if (!includeInactive) {
            where.isActive = true;
        }

        return prisma.apiClient.findMany({
            where,
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Update client scopes or settings
     * 
     * @param clientId - Client UUID
     * @param data - Updated fields
     */
    async update(
        clientId: string,
        data: Partial<{
            name: string;
            description: string;
            scopes: ApiClientScope[];
            rateLimit: number;
            expiresAt: Date;
        }>
    ) {
        const existing = await prisma.apiClient.findUnique({
            where: { id: clientId },
        });

        if (!existing) {
            throw new NotFoundError('API client not found');
        }

        const client = await prisma.apiClient.update({
            where: { id: clientId },
            data,
        });

        await auditService.log({
            action: 'API_CLIENT_UPDATED',
            entityType: 'ApiClient',
            entityId: clientId,
            previousData: { scopes: existing.scopes } as unknown as Prisma.JsonObject,
            newData: { scopes: client.scopes } as unknown as Prisma.JsonObject,
        });

        return client;
    }

    /**
     * Rotate API key (generate new one)
     * 
     * @param clientId - Client UUID
     * @returns New API key (shown only once!)
     */
    async rotateKey(clientId: string) {
        const existing = await prisma.apiClient.findUnique({
            where: { id: clientId },
        });

        if (!existing) {
            throw new NotFoundError('API client not found');
        }

        const newApiKey = this.generateApiKey();
        const apiKeyHash = this.hashApiKey(newApiKey);
        const apiKeyPrefix = newApiKey.substring(0, 8);

        await prisma.apiClient.update({
            where: { id: clientId },
            data: {
                apiKeyHash,
                apiKeyPrefix,
            },
        });

        await auditService.log({
            action: 'API_KEY_ROTATED',
            entityType: 'ApiClient',
            entityId: clientId,
        });

        return { apiKey: newApiKey };
    }

    /**
     * Deactivate a client
     * 
     * @param clientId - Client UUID
     */
    async deactivate(clientId: string) {
        const client = await prisma.apiClient.update({
            where: { id: clientId },
            data: { isActive: false },
        });

        await auditService.log({
            action: 'API_CLIENT_DEACTIVATED',
            entityType: 'ApiClient',
            entityId: clientId,
        });

        return client;
    }

    /**
     * Generate a secure API key
     */
    private generateApiKey(): string {
        // Format: ogpsr_[32 random hex chars]
        const randomBytes = crypto.randomBytes(32);
        return `ogpsr_${randomBytes.toString('hex')}`;
    }

    /**
     * Hash API key for storage
     */
    private hashApiKey(apiKey: string): string {
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }
}

export const apiClientService = new ApiClientService();
export default apiClientService;
