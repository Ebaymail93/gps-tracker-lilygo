import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { deviceMonitor } from "./device-monitor";
import { initializeDatabase } from "./db-init";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

async function startServer() {
  try {
    console.log("🔧 Initializing database...");
    await initializeDatabase();
    console.log("✅ Database connection verified");

    console.log("🚀 Starting device monitor...");
    deviceMonitor.start();
    console.log("✅ Device monitoring active");

    const server = await registerRoutes(app);

    // Basic static file serving for development
    app.get("*", (req, res) => {
      res.send(`
        <html>
          <head><title>GPS Tracker - Development</title></head>
          <body>
            <h1>GPS Tracker API Server</h1>
            <p>Server is running on port ${process.env.PORT || 3000}</p>
            <p>API endpoints available at <code>/api/*</code></p>
            <ul>
              <li><a href="/api/health">/api/health</a> - System health check</li>
              <li><a href="/api/ping">/api/ping</a> - Simple ping test</li>
            </ul>
          </body>
        </html>
      `);
    });

    const port = parseInt(process.env.PORT || '3000');
    server.listen(port, "0.0.0.0", () => {
      console.log(`🌐 GPS Tracker server running on http://0.0.0.0:${port}`);
      console.log(`📡 Ready for LilyGO TTGO T-SIM7000G connections`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();