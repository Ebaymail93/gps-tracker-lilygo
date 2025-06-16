# Multi-stage build for Raspberry Pi ARM64
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies for build
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build frontend with Vite
RUN npm run build

# Production stage optimized for Raspberry Pi
FROM node:20-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    tzdata \
    dumb-init \
    bash

# Create app user
RUN addgroup -g 1001 -S nodejs &&
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built frontend from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy server files
COPY --chown=nodejs:nodejs server ./server
COPY --chown=nodejs:nodejs shared ./shared
COPY --chown=nodejs:nodejs drizzle.config.ts ./
COPY --chown=nodejs:nodejs tsconfig.json ./

# Install tsx for TypeScript execution
RUN npm install tsx --save

# Create directories for logs and uploads
RUN mkdir -p /app/logs /app/uploads &&
    chown -R nodejs:nodejs /app/logs /app/uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application with tsx for TypeScript support
CMD ["npx", "tsx", "server/index.ts"]
