import { Router } from 'express';
import entitiesRouter from './entities';
import sourcesRouter from './sources';
import verificationRouter from './verification';
import publicRouter from './public';
import auditRouter from './audit';
import brandsRouter from './brands';
import productsRouter from './products';
import contactsRouter from './contacts';
// v2.0 P0 routes
import responsibilitiesRouter from './responsibilities';
import identifiersRouter from './identifiers';
// v2.0 P1/P2/P3 routes
import claimsRouter from './claims';
import addressesRouter from './addresses';
import relationshipsRouter from './relationships';
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
// v2.0 P0 routes
v1Router.use('/responsibilities', responsibilitiesRouter);
v1Router.use('/identifiers', identifiersRouter);
// v2.0 P1/P2/P3 routes
v1Router.use('/claims', claimsRouter);
v1Router.use('/addresses', addressesRouter);
v1Router.use('/relationships', relationshipsRouter);

// Mount versioned API
router.use('/v1', v1Router);

// Public API (with stricter rate limits)
router.use('/public', publicRouter);

export default router;

