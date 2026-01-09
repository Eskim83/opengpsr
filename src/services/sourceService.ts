import prisma from '../config/database';
import { Source, SourceType } from '@prisma/client';
import { CreateSourceInput } from '../schemas';
import { NotFoundError } from '../utils/errors';

/**
 * Service for managing data sources.
 * 
 * Sources track the origin of all data in the system for transparency
 * and audit purposes. Every piece of entity/brand data must have a source.
 * 
 * @remarks
 * - Sources are identified by type + identifier combination
 * - findOrCreate prevents duplicate sources
 * - Supports various source types (community, official registry, etc.)
 */
export class SourceService {
    /**
     * Create a new source.
     * 
     * @param data - Source data including type and optional identifiers
     * @returns The created source
     */
    async create(data: CreateSourceInput): Promise<Source> {
        return prisma.source.create({
            data: {
                sourceType: data.sourceType,
                sourceIdentifier: data.sourceIdentifier,
                description: data.description,
                sourceUrl: data.sourceUrl,
                sourceName: data.sourceName,
                trustNote: data.trustNote,
            },
        });
    }

    /**
     * Find or create a source based on type and identifier.
     * 
     * If a source with the same type and identifier exists, returns it.
     * Otherwise, creates a new source. This prevents duplicate source
     * records for the same data origin.
     * 
     * @param data - Source data with type and optional identifier
     * @returns Existing or newly created source
     */
    async findOrCreate(data: {
        sourceType: SourceType;
        sourceIdentifier?: string;
        description?: string;
        sourceUrl?: string;
        sourceName?: string;
    }): Promise<Source> {
        // Try to find existing source with same type and identifier
        if (data.sourceIdentifier) {
            const existing = await prisma.source.findFirst({
                where: {
                    sourceType: data.sourceType,
                    sourceIdentifier: data.sourceIdentifier,
                },
            });

            if (existing) {
                return existing;
            }
        }

        // Create new source
        return prisma.source.create({
            data: {
                sourceType: data.sourceType,
                sourceIdentifier: data.sourceIdentifier,
                description: data.description,
                sourceUrl: data.sourceUrl,
                sourceName: data.sourceName,
            },
        });
    }

    /**
     * Get a source by ID
     */
    async getById(id: string): Promise<Source> {
        const source = await prisma.source.findUnique({
            where: { id },
        });

        if (!source) {
            throw new NotFoundError('Source');
        }

        return source;
    }

    /**
     * List all sources with optional filtering
     */
    async list(options: {
        sourceType?: SourceType;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ sources: Source[]; total: number }> {
        const { sourceType, limit = 20, offset = 0 } = options;

        const where = sourceType ? { sourceType } : {};

        const [sources, total] = await Promise.all([
            prisma.source.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.source.count({ where }),
        ]);

        return { sources, total };
    }
}

export const sourceService = new SourceService();
