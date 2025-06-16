import express, { type Request, Response } from 'express';
import { registerRoutes } from './routes';
import { setupAuth } from './auth';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import { initializeDatabase } from './db-init';
import { deviceMonitor } from './device-monitor';
import pkg from '../package.json';
import { setupSwagger } from './swagger';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Session configuration for production
  const PgSession = ConnectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        conString:
          process.env.DATABASE_URL ||
          'postgresql://gps_user:gps_secure_password@postgres:5432/gps_tracker',
        tableName: 'sessions', // Aggiungi la 's' finale
      }),
      secret: process.env.SESSION_SECRET || 'gps_tracker_secure_secret_2024',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // <-- Disabilita secure per localhost HTTP
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // Setup authentication
  setupAuth(app);

  // API Routes
  const server = await registerRoutes(app);
  setupSwagger(app);

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: pkg.version,
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 Starting GPS Tracker in production mode');

    // Serve built frontend
    app.use(express.static('dist'));

    // Handle SPA routing
    app.get('*', (req: Request, res: Response) => {
      // Skip API routes
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile('index.html', { root: 'dist' });
    });
  } else {
    // Development mode with Vite
    console.log('🔧 Starting GPS Tracker in development mode');
    try {
      const { setupVite } = await import('./vite.js');
      await setupVite(app, server);
      console.log(
        `🚀 GPS Tracker dev server running at http://localhost:${PORT}`
      );
    } catch (error) {
      console.error('Failed to setup Vite in development mode:', error);
      // Fallback to production mode
      app.use(express.static('dist'));
      app.get('*', (req: Request, res: Response) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ error: 'API endpoint not found' });
        }
        res.sendFile('index.html', { root: 'dist' });
      });
    }
  }

  // Setup Swagger documentation

  // Start server
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 GPS Tracker server running on port ${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);

    // Initialize database
    try {
      await initializeDatabase();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
    }

    // Start device monitoring
    try {
      deviceMonitor.start();
      console.log('✅ Device monitoring started');
    } catch (error) {
      console.error('❌ Device monitoring failed to start:', error);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    deviceMonitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    deviceMonitor.stop();
    process.exit(0);
  });
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default startServer;
