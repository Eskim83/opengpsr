import prisma from '../config/database';
import { AuditLog, Prisma } from '@prisma/client';

/**
 * Service for audit logging.
 * 
 * Tracks all significant operations in the system for transparency,
 * debugging, and compliance purposes. Audit logs are immutable and
 * include full before/after data snapshots.
 * 
 * @remarks
 * - Audit logs are created automatically by service layer operations
 * - Supports filtering by action, entity type, and performer
 * - Includes optional IP address and user agent for web requests
 */
export class AuditService {
    /**
     * Create an audit log entry.
     * 
     * @param data - Audit data including action, entity info, and data snapshots
     * @returns The created audit log entry
     */
    async log(data: {
        action: string;
        entityType: string;
        entityId: string;
        previousData?: object;
        newData?: object;
        performedBy?: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<AuditLog> {
        return prisma.auditLog.create({
            data: {
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                previousData: data.previousData as Prisma.JsonObject | undefined,
                newData: data.newData as Prisma.JsonObject | undefined,
                performedBy: data.performedBy,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
        });
    }

    /**
     * Get audit logs for a specific entity.
     * 
     * @param entityType - Type of entity (e.g., 'Entity', 'Brand', 'ProductReference')
     * @param entityId - Entity UUID
     * @param options - Pagination options
     * @returns Paginated audit logs with total count
     */
    async getForEntity(
        entityType: string,
        entityId: string,
        options: { limit?: number; offset?: number } = {}
    ): Promise<{ logs: AuditLog[]; total: number }> {
        const { limit = 50, offset = 0 } = options;

        const where = { entityType, entityId };

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.auditLog.count({ where }),
        ]);

        return { logs, total };
    }

    /**
     * Get recent audit logs with optional filtering.
     * 
     * @param options - Filter options (limit, action, entityType)
     * @returns Array of recent audit logs
     */
    async getRecent(options: {
        limit?: number;
        action?: string;
        entityType?: string;
    } = {}): Promise<AuditLog[]> {
        const { limit = 100, action, entityType } = options;

        const where: Prisma.AuditLogWhereInput = {};
        if (action) where.action = action;
        if (entityType) where.entityType = entityType;

        return prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}

export const auditService = new AuditService();
