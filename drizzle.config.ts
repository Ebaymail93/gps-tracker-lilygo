import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: 'postgres',
    port: 5432,
    user: 'gps_user',
    password: 'gps_secure_password',
    database: 'gps_tracker',
    ssl: false,
  },
});
