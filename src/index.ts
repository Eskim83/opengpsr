import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware';

// Create Express application
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// API info endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'OpenGPSR Backend',
        version: '1.0.0',
        description: 'Central data layer for GPSR entity management',
        documentation: '/api/public/schema',
        endpoints: {
            health: '/health',
            publicApi: '/api/public',
            apiV1: '/api/v1',
        },
        disclaimer: 'This system provides informational data only. It does not guarantee GPSR compliance or provide legal advice.',
    });
});

// Mount API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     OpenGPSR Backend                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                       ║
║  Environment: ${config.nodeEnv.padEnd(46)}║
║                                                               ║
║  Endpoints:                                                   ║
║    - Health:     GET  /health                                 ║
║    - Public API: GET  /api/public/*                           ║
║    - API v1:     *    /api/v1/*                               ║
║    - Schema:     GET  /api/public/schema                      ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
