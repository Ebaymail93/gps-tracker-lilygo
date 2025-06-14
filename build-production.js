import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

async function buildProduction() {
  try {
    console.log('GPS Tracker - Production Build Starting...');
    
    // Create output directories
    await execAsync('mkdir -p dist dist-server');
    
    console.log('Building backend server...');
    await execAsync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist-server/index.js');
    
    console.log('Creating minimal frontend for API server...');
    
    // Create simple index.html for production
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>GPS Tracker API Server</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .status { color: green; font-weight: bold; }
        .api-list { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>GPS Tracker System</h1>
    <p class="status">✅ API Server Running</p>
    <div class="api-list">
        <h3>Available Endpoints:</h3>
        <ul>
            <li><a href="/api/health">/api/health</a> - System health check</li>
            <li><a href="/api/ping">/api/ping</a> - Simple ping test</li>
            <li><strong>POST</strong> /api/device/register - Register LilyGO device</li>
            <li><strong>POST</strong> /api/device/{id}/location - GPS coordinates</li>
            <li><strong>POST</strong> /api/device/{id}/heartbeat - Device status</li>
            <li><strong>GET</strong> /api/device/{id}/commands - Pending commands</li>
        </ul>
    </div>
    <p><strong>Ready for LilyGO TTGO T-SIM7000G connections</strong></p>
</body>
</html>`;
    
    fs.writeFileSync('dist/index.html', htmlContent);
    
    console.log('✅ Production build completed successfully!');
    console.log('📡 Backend: dist-server/index.js');
    console.log('🌐 Frontend: dist/index.html');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildProduction();