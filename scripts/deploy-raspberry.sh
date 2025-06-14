#!/bin/bash

# GPS Tracker - Raspberry Pi Deployment Script
set -e

echo "🚀 Starting GPS Tracker deployment on Raspberry Pi..."

# Check if we're in the right directory
#if [ ! -f "podman-compose.raspberry.yml" ]; then
#    echo "❌ podman-compose.raspberry.yml not found in current directory"
#    echo "Please run this script from the project root directory:"
#    echo "  cd /path/to/gps-tracker"
#    echo "  ./scripts/deploy-raspberry.sh"
#    exit 1
#fi

# Check if Docker is installed
#if ! command -v docker &> /dev/null; then
#    echo "❌ Docker not found. Installing Docker..."
#    curl -fsSL https://get.docker.com -o get-docker.sh
#    sh get-docker.sh
#    sudo usermod -aG docker $USER
#    echo "✅ Docker installed. Please logout and login again, then rerun this script."
#    exit 1
#fi

# Check if Docker Compose is installed
if ! command -v podman-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y podman-compose
fi

# Create necessary directories
echo "📁 Creating directory structure..."
mkdir -p logs
mkdir -p backups
mkdir -p nginx/ssl

# Generate SSL certificates if they don't exist
if [ ! -f "nginx/ssl/server.crt" ] || [ ! -f "nginx/ssl/server.key" ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/server.key \
        -out nginx/ssl/server.crt \
        -subj "/C=IT/ST=Italy/L=City/O=GPS-Tracker/CN=raspberry-gps"
fi

# Create environment file if it doesn't exist
if [ ! -f ".env.raspberry" ]; then
    echo "⚙️ Creating environment configuration..."
    cat > .env.raspberry << EOF
# Database Configuration
DATABASE_URL=postgresql://gps_user:gps_secure_password@postgres:5432/gps_tracker
POSTGRES_PASSWORD=gps_secure_password

# Application Configuration
SESSION_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
PORT=3000

# Network Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=gps_tracker
POSTGRES_USER=gps_user
EOF
    echo "✅ Environment file created at .env.raspberry"
    echo "📝 Please review and update the configuration if needed."
fi

# Build and start services
echo "🏗️ Building Docker images..."
podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry build

echo "🚀 Starting services..."
podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database initialization
echo "🗄️ Initializing database..."
podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry exec gps-tracker npm run db:init || true

# Show status
echo "📊 Service status:"
podman-compose -f podman-compose.raspberry.yml ps

# Get Raspberry Pi IP
PI_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ GPS Tracker deployed successfully!"
echo ""
echo "🌐 Access URLs:"
echo "   HTTP:  http://$PI_IP"
echo "   HTTPS: https://$PI_IP"
echo ""
echo "📋 Service Management Commands:"
echo "   Start:   podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry up -d"
echo "   Stop:    podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry down"
echo "   Logs:    podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry logs -f"
echo "   Restart: podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry restart"
echo ""
echo "🔧 Database Management:"
echo "   Backup:  podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry exec postgres pg_dump -U gps_user gps_tracker > backups/backup-$(date +%Y%m%d-%H%M%S).sql"
echo "   Restore: podman-compose -f podman-compose.raspberry.yml --env-file .env.raspberry exec -T postgres psql -U gps_user gps_tracker < backups/your-backup.sql"
echo ""