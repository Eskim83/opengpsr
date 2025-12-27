import { Router } from 'express';
import entitiesRouter from './entities';
import sourcesRouter from './sources';
import verificationRouter from './verification';
import publicRouter from './public';
import auditRouter from './audit';
import { apiRateLimiter } from '../middleware';

const router = Router();

// API v1 routes (with higher rate limits)
const v1Router = Router();
v1Router.use(apiRateLimiter);
v1Router.use('/entities', entitiesRouter);
v1Router.use('/sources', sourcesRouter);
v1Router.use('/', verificationRouter); // Verification routes are mounted at root for entity/version paths
v1Router.use('/audit', auditRouter);

// Mount versioned API
router.use('/v1', v1Router);

// Public API (with stricter rate limits)
router.use('/public', publicRouter);

export default router;
