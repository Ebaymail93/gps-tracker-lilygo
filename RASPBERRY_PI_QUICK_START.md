# GPS Tracker - Raspberry Pi Quick Start

## Deployment Steps

1. **Clone the project on your Raspberry Pi:**
   ```bash
   git clone <your-repo-url>
   cd gps-tracker
   ```

2. **Run the deployment script:**
   ```bash
   ./scripts/deploy-raspberry.sh
   ```

3. **Access the application:**
   - HTTP: `http://[raspberry-pi-ip]`
   - HTTPS: `https://[raspberry-pi-ip]`

## Recent Fixes Applied

✅ **Docker Build Issues Resolved:**
- Fixed `connect-pg-simple` version from `^11.0.1` to `^10.0.0`
- Fixed `@tailwindcss/vite` version to `^4.1.10`
- Created dedicated build script `build-raspberry.js` to avoid configuration conflicts
- Separated Vite config for production deployment

✅ **Backend Compilation Fixed:**
- Uses esbuild for reliable TypeScript compilation
- Single bundled output file prevents module loading errors
- Correct ESM format for Node.js execution

## What the script does automatically:
- Installs Docker and Docker Compose if needed
- Creates SSL certificates
- Sets up PostgreSQL database
- Builds and starts the GPS tracker application
- Configures secure environment variables

## Service Management:
```bash
# Start services
docker-compose -f docker-compose.raspberry.yml --env-file .env.raspberry up -d

# Stop services
docker-compose -f docker-compose.raspberry.yml --env-file .env.raspberry down

# View logs
docker-compose -f docker-compose.raspberry.yml --env-file .env.raspberry logs -f

# Restart services
docker-compose -f docker-compose.raspberry.yml --env-file .env.raspberry restart
```

## API Endpoints for LilyGO devices:
- Device registration: `POST /api/device/register`
- Location updates: `POST /api/device/{deviceId}/location`
- Heartbeat: `POST /api/device/{deviceId}/heartbeat`
- Get config: `GET /api/device/{deviceId}/config`
- Get commands: `GET /api/device/{deviceId}/commands`

The system is ready for production use with your LilyGO TTGO T-SIM7000G devices.