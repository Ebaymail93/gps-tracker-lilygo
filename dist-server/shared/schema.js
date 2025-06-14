"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertSystemLogSchema = exports.insertDeviceConfigurationSchema = exports.insertGeofenceAlertSchema = exports.insertGeofenceSchema = exports.insertDeviceStatusHistorySchema = exports.insertDeviceCommandSchema = exports.insertDeviceLocationSchema = exports.insertDeviceSchema = exports.insertUserSchema = exports.systemLogs = exports.deviceConfigurations = exports.geofenceAlerts = exports.geofences = exports.deviceStatusHistory = exports.deviceCommands = exports.deviceLocations = exports.devices = exports.users = exports.sessions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    sid: (0, pg_core_1.varchar)("sid").primaryKey(),
    sess: (0, pg_core_1.jsonb)("sess").notNull(),
    expire: (0, pg_core_1.timestamp)("expire").notNull(),
});
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)("password_hash", { length: 255 }).notNull(),
    firstName: (0, pg_core_1.varchar)("first_name", { length: 100 }),
    lastName: (0, pg_core_1.varchar)("last_name", { length: 100 }),
    role: (0, pg_core_1.varchar)("role", { length: 20 }).notNull().default("user"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.devices = (0, pg_core_1.pgTable)("devices", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    deviceId: (0, pg_core_1.varchar)("device_id", { length: 100 }).notNull().unique(),
    userId: (0, pg_core_1.uuid)("user_id").references(() => exports.users.id),
    deviceName: (0, pg_core_1.varchar)("device_name", { length: 255 }),
    deviceType: (0, pg_core_1.varchar)("device_type", { length: 50 }).notNull().default("GPS_TRACKER"),
    firmwareVersion: (0, pg_core_1.varchar)("firmware_version", { length: 50 }),
    hardwareVersion: (0, pg_core_1.varchar)("hardware_version", { length: 50 }),
    config: (0, pg_core_1.jsonb)("config").default({
        heartbeat_interval: 30000,
        gps_interval: 10000,
        lost_mode_interval: 15000,
        low_battery_threshold: 15.0
    }),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).notNull().default("offline"),
    lastSeen: (0, pg_core_1.timestamp)("last_seen"),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.deviceLocations = (0, pg_core_1.pgTable)("device_locations", {
    id: (0, pg_core_1.bigserial)("id", { mode: "number" }).primaryKey(),
    deviceId: (0, pg_core_1.uuid)("device_id").notNull().references(() => exports.devices.id),
    latitude: (0, pg_core_1.decimal)("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: (0, pg_core_1.decimal)("longitude", { precision: 11, scale: 8 }).notNull(),
    altitude: (0, pg_core_1.decimal)("altitude", { precision: 8, scale: 2 }),
    speed: (0, pg_core_1.decimal)("speed", { precision: 6, scale: 2 }),
    heading: (0, pg_core_1.decimal)("heading", { precision: 5, scale: 2 }),
    satellites: (0, pg_core_1.integer)("satellites"),
    hdop: (0, pg_core_1.decimal)("hdop", { precision: 4, scale: 2 }),
    batteryLevel: (0, pg_core_1.decimal)("battery_level", { precision: 5, scale: 2 }),
    signalQuality: (0, pg_core_1.integer)("signal_quality"),
    networkOperator: (0, pg_core_1.varchar)("network_operator", { length: 100 }),
    timestamp: (0, pg_core_1.timestamp)("timestamp").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.deviceCommands = (0, pg_core_1.pgTable)("device_commands", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    deviceId: (0, pg_core_1.uuid)("device_id").notNull().references(() => exports.devices.id),
    userId: (0, pg_core_1.uuid)("user_id").references(() => exports.users.id),
    commandType: (0, pg_core_1.varchar)("command_type", { length: 50 }).notNull(),
    commandData: (0, pg_core_1.jsonb)("command_data"),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).notNull().default("pending"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    sentAt: (0, pg_core_1.timestamp)("sent_at"),
    acknowledgedAt: (0, pg_core_1.timestamp)("acknowledged_at"),
    executedAt: (0, pg_core_1.timestamp)("executed_at"),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
});
exports.deviceStatusHistory = (0, pg_core_1.pgTable)("device_status_history", {
    id: (0, pg_core_1.bigserial)("id", { mode: "number" }).primaryKey(),
    deviceId: (0, pg_core_1.uuid)("device_id").notNull().references(() => exports.devices.id),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).notNull(),
    previousStatus: (0, pg_core_1.varchar)("previous_status", { length: 50 }),
    batteryLevel: (0, pg_core_1.decimal)("battery_level", { precision: 5, scale: 2 }),
    signalQuality: (0, pg_core_1.integer)("signal_quality"),
    errorCount: (0, pg_core_1.integer)("error_count"),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(),
});
exports.geofences = (0, pg_core_1.pgTable)("geofences", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    deviceId: (0, pg_core_1.uuid)("device_id").notNull().references(() => exports.devices.id),
    userId: (0, pg_core_1.uuid)("user_id").references(() => exports.users.id),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    centerLatitude: (0, pg_core_1.decimal)("center_latitude", { precision: 10, scale: 8 }).notNull(),
    centerLongitude: (0, pg_core_1.decimal)("center_longitude", { precision: 11, scale: 8 }).notNull(),
    radius: (0, pg_core_1.decimal)("radius", { precision: 8, scale: 2 }).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    alertOnEnter: (0, pg_core_1.boolean)("alert_on_enter").notNull().default(true),
    alertOnExit: (0, pg_core_1.boolean)("alert_on_exit").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.geofenceAlerts = (0, pg_core_1.pgTable)("geofence_alerts", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    deviceId: (0, pg_core_1.uuid)("device_id").notNull().references(() => exports.devices.id),
    geofenceId: (0, pg_core_1.uuid)("geofence_id").notNull().references(() => exports.geofences.id),
    userId: (0, pg_core_1.uuid)("user_id").references(() => exports.users.id),
    alertType: (0, pg_core_1.varchar)("alert_type", { length: 20 }).notNull(),
    latitude: (0, pg_core_1.decimal)("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: (0, pg_core_1.decimal)("longitude", { precision: 11, scale: 8 }).notNull(),
    isRead: (0, pg_core_1.boolean)("is_read").notNull().default(false),
    triggeredAt: (0, pg_core_1.timestamp)("triggered_at").defaultNow(),
    readAt: (0, pg_core_1.timestamp)("read_at"),
});
exports.deviceConfigurations = (0, pg_core_1.pgTable)("device_configurations", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    deviceId: (0, pg_core_1.uuid)("device_id").notNull().references(() => exports.devices.id),
    configData: (0, pg_core_1.jsonb)("config_data").notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).notNull().default("pending"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    sentAt: (0, pg_core_1.timestamp)("sent_at"),
    appliedAt: (0, pg_core_1.timestamp)("applied_at"),
});
exports.systemLogs = (0, pg_core_1.pgTable)("system_logs", {
    id: (0, pg_core_1.bigserial)("id", { mode: "number" }).primaryKey(),
    deviceId: (0, pg_core_1.uuid)("device_id").references(() => exports.devices.id),
    userId: (0, pg_core_1.uuid)("user_id").references(() => exports.users.id),
    level: (0, pg_core_1.varchar)("level", { length: 20 }).notNull(),
    category: (0, pg_core_1.varchar)("category", { length: 50 }).notNull().default("system"),
    message: (0, pg_core_1.text)("message").notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(),
});
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertDeviceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.devices).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertDeviceLocationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.deviceLocations).omit({
    id: true,
    createdAt: true,
});
exports.insertDeviceCommandSchema = (0, drizzle_zod_1.createInsertSchema)(exports.deviceCommands).omit({
    id: true,
    createdAt: true,
    sentAt: true,
    acknowledgedAt: true,
    executedAt: true,
});
exports.insertDeviceStatusHistorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.deviceStatusHistory).omit({
    id: true,
    timestamp: true,
});
exports.insertGeofenceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.geofences).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertGeofenceAlertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.geofenceAlerts).omit({
    id: true,
    triggeredAt: true,
    readAt: true,
});
exports.insertDeviceConfigurationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.deviceConfigurations).omit({
    id: true,
    createdAt: true,
    sentAt: true,
    appliedAt: true,
});
exports.insertSystemLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.systemLogs).omit({
    id: true,
    timestamp: true,
});
