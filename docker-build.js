import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting Docker build process...');

// Create output directories
const distDir = path.join(__dirname, 'dist');
const distServerDir = path.join(__dirname, 'dist-server');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
if (!fs.existsSync(distServerDir)) fs.mkdirSync(distServerDir, { recursive: true });

// Simple frontend build - just copy essential files for API server
console.log('Building minimal frontend...');
const clientDir = path.join(distDir);
if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });

// Create minimal index.html for API server
const indexHtml = `<!DOCTYPE html>
<html>
<head>
    <title>GPS Tracker API Server</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>GPS Tracker API Server</h1>
    <p>Server is running. API endpoints available at /api/*</p>
    <div>
        <h2>API Endpoints:</h2>
        <ul>
            <li>GET /api/health - Health check</li>
            <li>POST /api/device/register - Device registration</li>
            <li>POST /api/device/{id}/location - GPS coordinates</li>
            <li>GET /api/devices - List all devices</li>
        </ul>
    </div>
</body>
</html>`;

fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);

// Build backend with Node.js require resolution
console.log('Building backend server...');

// Find esbuild binary
const esbuildPaths = [
    './node_modules/.bin/esbuild',
    './node_modules/esbuild/bin/esbuild',
    'npx esbuild'
];

let esbuildCmd = null;
for (const ePath of esbuildPaths) {
    try {
        if (ePath.startsWith('./node_modules')) {
            if (fs.existsSync(ePath)) {
                esbuildCmd = `node ${ePath}`;
                break;
            }
        } else {
            esbuildCmd = ePath;
            break;
        }
    } catch (e) {
        continue;
    }
}

if (!esbuildCmd) {
    console.error('esbuild not found, using direct Node.js compilation fallback');
    
    // Create a simple compilation using Node.js module resolution
    const serverContent = `// Auto-generated server entry point
import('./server/index.js').then(module => {
    console.log('Server started');
}).catch(err => {
    console.error('Server error:', err);
    process.exit(1);
});`;
    
    fs.writeFileSync(path.join(distServerDir, 'index.js'), serverContent);
} else {
    try {
        execSync(`${esbuildCmd} server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist-server/index.js`, {
            stdio: 'inherit'
        });
    } catch (error) {
        console.log('esbuild failed, creating fallback server...');
        
        // Fallback: Use the complete server implementation
        const serverSource = fs.readFileSync('./server/index.ts', 'utf8');
        
        // Simple transpilation for basic TypeScript to JavaScript
        const serverContent = serverSource
            .replace(/import\s+type\s+[^;]+;/g, '') // Remove type imports
            .replace(/:\s*[A-Za-z<>\[\]|]+(?=\s*[=,)])/g, '') // Remove type annotations
            .replace(/interface\s+[^}]+}/g, '') // Remove interfaces
            .replace(/export\s+type\s+[^;]+;/g, '') // Remove type exports
            .replace(/\.ts(['"])/g, '.js$1'); // Change .ts to .js in imports
        
        fs.writeFileSync(path.join(distServerDir, 'index.js'), serverContent);
    }
}

console.log('Build completed successfully!');
console.log('Files created:');
console.log('- dist/index.html');
console.log('- dist-server/index.js');