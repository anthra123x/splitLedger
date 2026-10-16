import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initDatabase } from './config/database.js';
import { WorkerDaemon } from './queue/WorkerDaemon.js';
import apiRoutes from './routes/api.js';

export const app = express();

// Initialize database & tables (Neon PostgreSQL / SQLite)
initDatabase().catch(err => {
  console.error('[DB Init Error]', err);
});

// Initialize dedicated SplitLLM worker daemon
WorkerDaemon.init();

// Security and CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Payload limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for document previews/uploads
app.use('/uploads', express.static(config.uploadDir));

// API Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SplitLedger Engine',
    database: config.databaseUrl ? 'Neon PostgreSQL (Serverless)' : 'SQLite (Local)',
    ai_model: config.openRouterModel,
    language: 'TypeScript'
  });
});

// Centralized error handling (OWASP defense: no stack traces leaked)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SplitLedger Error]', {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    error: err.message || 'Ha ocurrido un error interno en el servidor contable.',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// Start listener when executed directly (not when imported as a serverless handler)
if (process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`[INFO] Servidor SplitLedger (TypeScript) activo en http://localhost:${config.port}`);
    console.log(`[DATABASE] Base de datos: ${config.databaseUrl ? 'Neon PostgreSQL (Cloud)' : 'SQLite (Local)'}`);
    console.log(`[AI_ENGINE] Motor IA: ${config.openRouterModel}`);
  });
}

export default app;
