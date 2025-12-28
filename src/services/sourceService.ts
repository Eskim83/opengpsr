import prisma from '../config/database';
import { Source, SourceType, Prisma } from '@prisma/client';
import { CreateSourceInput } from '../schemas';
import { NotFoundError } from '../utils/errors';
import { withP2002Retry } from '../utils/prismaRetry';

/**
 * Service for managing data sources
 * Sources track the origin of all data in the system
 * FIX: Added P2002 retry for findOrCreate race conditions
 */
export class SourceService {
    /**
     * Create a new source
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
     * Find or create a source based on type and identifier
     * FIX: Uses P2002 retry for race conditions when multiple requests
     * try to create the same source simultaneously
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

        // FIX: Wrap create in retry for race conditions
        // Two parallel requests might both not find and try to create
        return withP2002Retry(async () => {
            // Double-check inside retry in case another request created it
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

            return prisma.source.create({
                data: {
                    sourceType: data.sourceType,
                    sourceIdentifier: data.sourceIdentifier,
                    description: data.description,
                    sourceUrl: data.sourceUrl,
                    sourceName: data.sourceName,
                },
            });
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
