import dotenv from 'dotenv';
import express from 'express';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET?.trim() || '';
if (!jwtSecret) {
  console.error(
    'FATAL: JWT_SECRET is missing. Create server/.env (see project .env.example) and set JWT_SECRET.'
  );
  process.exit(1);
}
if (jwtSecret.length < 32 || /^change-me/i.test(jwtSecret)) {
  console.error('FATAL: JWT_SECRET is too weak. Use a random secret with at least 32 characters.');
  process.exit(1);
}
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/security.js';
import { refreshOverdueInstallments } from './services/installmentService.js';
import { runMigrations } from '../migrations/index.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const allowedOrigins = String(process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    ...corsOptions,
  })
);
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', apiLimiter, routes);

// Serve static files from the React app in production
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if we are in production and serve the client dist folder
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/health', (_req, res) => res.json({ ok: true }));
}

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});


// ... existing imports ...
app.use((err, _req, res, _next) => {
  if (err?.message === 'CORS origin not allowed') {
    return res.status(403).json({ error: err.message });
  }

  console.error('Unhandled server error', err);
  return res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel
export default app;

const port = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    console.log('Starting CLIC Campus API initialization...');
    
    // 1. Test Database Connection
    const { testConnection } = await import('./config/db.js');
    const dbOk = await testConnection();
    if (!dbOk) {
      console.error('FATAL: Could not establish database connection after multiple retries.');
      // In serverless, we might not want to exit(1) immediately if it's a transient error
      if (process.env.NODE_ENV !== 'production') process.exit(1);
    }

    // 2. Run Migrations
    await runMigrations();
    
    // 3. Status Refresh
    await refreshOverdueInstallments();

    // 4. Listen (Only if not in Vercel/serverless environment)
    if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
        app.listen(port, () => {
          console.log(`CLIC Campus API listening on port ${port}`);
        });
    }
  } catch (err) {
    console.error('FAILED to start server:', err);
    if (process.env.NODE_ENV !== 'production') process.exit(1);
  }
}

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}` || process.env.NODE_ENV !== 'production') {
    startServer();
}


