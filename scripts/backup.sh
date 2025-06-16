#!/bin/bash

# GPS Tracker Backup Script for Raspberry Pi
# Creates automated backups of database and application data

set -e

# Configuration
BACKUP_DIR="/app/backups"
DB_NAME="gps_tracker"
DB_USER="gps_user"
DB_HOST="localhost"
DB_PORT="5432"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Database backup
echo "Creating database backup..."
PGPASSWORD="gps_secure_password_2024" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --clean \
    --if-exists \
    --format=custom \
    --file="$BACKUP_DIR/gps_tracker_db_$TIMESTAMP.backup"

# Application data backup
echo "Creating application data backup..."
tar -czf "$BACKUP_DIR/gps_tracker_app_$TIMESTAMP.tar.gz" \
    /app/logs \
    /app/uploads \
    /app/package.json \
    /app/package-lock.json

# Configuration backup
echo "Creating configuration backup..."
tar -czf "$BACKUP_DIR/gps_tracker_config_$TIMESTAMP.tar.gz" \
    /app/docker-compose.yml \
    /app/nginx/nginx.conf \
    /app/.env

# Remove old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "gps_tracker_*" -type f -mtime +$RETENTION_DAYS -delete

# Calculate backup sizes
DB_SIZE=$(du -h "$BACKUP_DIR/gps_tracker_db_$TIMESTAMP.backup" | cut -f1)
APP_SIZE=$(du -h "$BACKUP_DIR/gps_tracker_app_$TIMESTAMP.tar.gz" | cut -f1)
CONFIG_SIZE=$(du -h "$BACKUP_DIR/gps_tracker_config_$TIMESTAMP.tar.gz" | cut -f1)

echo "Backup completed successfully!"
echo "Database backup: $DB_SIZE"
echo "Application data: $APP_SIZE"
echo "Configuration: $CONFIG_SIZE"
echo "Backup location: $BACKUP_DIR"