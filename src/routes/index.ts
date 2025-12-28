import { Router } from 'express';
import entitiesRouter from './entities';
import sourcesRouter from './sources';
import verificationRouter from './verification';
import publicRouter from './public';
import auditRouter from './audit';
import brandsRouter from './brands';
import productsRouter from './products';
import contactsRouter from './contacts';
import { apiRateLimiter } from '../middleware';

const router = Router();

// API v1 routes (with higher rate limits)
const v1Router = Router();
v1Router.use(apiRateLimiter);
v1Router.use('/entities', entitiesRouter);
v1Router.use('/sources', sourcesRouter);
v1Router.use('/', verificationRouter); // Verification routes are mounted at root for entity/version paths
v1Router.use('/audit', auditRouter);
v1Router.use('/brands', brandsRouter);
v1Router.use('/products', productsRouter);
v1Router.use('/contacts', contactsRouter);

// Mount versioned API
router.use('/v1', v1Router);

// Public API (with stricter rate limits)
router.use('/public', publicRouter);

export default router;
