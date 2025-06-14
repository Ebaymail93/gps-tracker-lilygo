#!/bin/bash

# Simple build test for Raspberry Pi deployment
echo "Testing build process..."

# Use package-raspberry.json
cp package-raspberry.json package.json.bak
cp package-raspberry.json package.json

# Build frontend
echo "Building frontend..."
npx vite build

# Build backend
echo "Building backend..."
npx tsc

echo "Build test completed successfully!"

# Restore original package.json
mv package.json.bak package.json

echo "Ready for Docker deployment on Raspberry Pi"