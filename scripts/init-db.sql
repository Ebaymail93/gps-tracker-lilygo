-- GPS Tracker Database Initialization for Raspberry Pi
-- This script creates the initial database structure

-- Create extensions if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create database user if not exists (for manual setup)
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gps_user') THEN
      CREATE ROLE gps_user LOGIN PASSWORD 'gps_secure_password_2024';
   END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE gps_tracker TO gps_user;
GRANT ALL ON SCHEMA public TO gps_user;

-- Optimize PostgreSQL for Raspberry Pi
ALTER SYSTEM SET shared_buffers = '128MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Create performance monitoring view
CREATE OR REPLACE VIEW system_performance AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Create database maintenance function
CREATE OR REPLACE FUNCTION maintenance_tasks()
RETURNS void AS $$
BEGIN
    -- Analyze all tables
    ANALYZE;
    
    -- Vacuum old data
    VACUUM (ANALYZE, VERBOSE);
    
    -- Log maintenance completion
    RAISE NOTICE 'Database maintenance completed at %', now();
END;
$$ LANGUAGE plpgsql;

-- Create backup function
CREATE OR REPLACE FUNCTION create_backup()
RETURNS text AS $$
DECLARE
    backup_name text;
BEGIN
    backup_name := 'gps_tracker_backup_' || to_char(now(), 'YYYY_MM_DD_HH24_MI_SS');
    
    -- This would need to be executed outside of SQL
    -- pg_dump gps_tracker > /backups/backup_name.sql
    
    RETURN backup_name;
END;
$$ LANGUAGE plpgsql;