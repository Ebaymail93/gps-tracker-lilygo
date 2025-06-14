#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const path = require('path');

console.log('Building GPS Tracker for Docker deployment...');

// Create directories
if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
if (!existsSync('dist-server')) mkdirSync('dist-server', { recursive: true });

try {
  // Build frontend with Vite
  console.log('Building frontend...');
  execSync('npx vite build --config vite.config.production.js', { stdio: 'inherit' });
  
  // Build backend with esbuild
  console.log('Building backend...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist-server/index.js', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}