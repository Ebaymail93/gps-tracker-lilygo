import { pgTable, text, serial, integer, boolean, timestamp, real, uuid, varchar, decimal, bigserial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  }
);

// Users & Authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar("role", { length: 20 }).notNull().default("user"), // 'admin' | 'user'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Device Registration
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: varchar("device_id", { length: 100 }).notNull().unique(), // MAC Address
  userId: uuid("user_id").references(() => users.id),
  deviceName: varchar("device_name", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }).notNull().default("GPS_TRACKER"),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  hardwareVersion: varchar("hardware_version", { length: 50 }),
  
  // Configuration
  config: jsonb("config").default({
    heartbeat_interval: 30000,
    gps_interval: 10000,
    lost_mode_interval: 15000,
    low_battery_threshold: 15.0
  }),
  
  // Status  
  status: varchar("status", { length: 20 }).notNull().default("offline"), // 'online' | 'offline' | 'lost_mode' | 'low_battery' | 'error'
  lastSeen: timestamp("last_seen"),
  isActive: boolean("is_active").notNull().default(true),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Location History (Time-series data)
export const deviceLocations = pgTable("device_locations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  
  // GPS Data
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  altitude: decimal("altitude", { precision: 8, scale: 2 }),
  speed: decimal("speed", { precision: 6, scale: 2 }),
  heading: decimal("heading", { precision: 5, scale: 2 }),
  satellites: integer("satellites"),
  hdop: decimal("hdop", { precision: 4, scale: 2 }), // Horizontal Dilution of Precision
  
  // Device Status
  batteryLevel: decimal("battery_level", { precision: 5, scale: 2 }),
  signalQuality: integer("signal_quality"),
  networkOperator: varchar("network_operator", { length: 100 }),
  
  // Metadata
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Device Commands
export const deviceCommands = pgTable("device_commands", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  userId: uuid("user_id").references(() => users.id),
  
  commandType: varchar("command_type", { length: 50 }).notNull(), // 'enable_lost_mode' | 'disable_lost_mode' | 'get_location' | 'update_config' | 'reboot'
  commandData: jsonb("command_data"),
  
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'sent' | 'acknowledged' | 'executed' | 'failed' | 'expired'
  
  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  executedAt: timestamp("executed_at"),
  expiresAt: timestamp("expires_at"),
});

// Device Status History
export const deviceStatusHistory = pgTable("device_status_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  
  status: varchar("status", { length: 50 }).notNull(),
  previousStatus: varchar("previous_status", { length: 50 }),
  
  // Context data
  batteryLevel: decimal("battery_level", { precision: 5, scale: 2 }),
  signalQuality: integer("signal_quality"),
  errorCount: integer("error_count"),
  
  timestamp: timestamp("timestamp").defaultNow(),
});

// Geofences
export const geofences = pgTable("geofences", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  userId: uuid("user_id").references(() => users.id),
  
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Geofence geometry
  centerLatitude: decimal("center_latitude", { precision: 10, scale: 8 }).notNull(),
  centerLongitude: decimal("center_longitude", { precision: 11, scale: 8 }).notNull(),
  radius: decimal("radius", { precision: 8, scale: 2 }).notNull(), // meters
  
  // Settings
  isActive: boolean("is_active").notNull().default(true),
  alertOnEnter: boolean("alert_on_enter").notNull().default(true),
  alertOnExit: boolean("alert_on_exit").notNull().default(true),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Geofence Alerts
export const geofenceAlerts = pgTable("geofence_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  geofenceId: uuid("geofence_id").notNull().references(() => geofences.id),
  userId: uuid("user_id").references(() => users.id),
  
  alertType: varchar("alert_type", { length: 20 }).notNull(), // 'enter' | 'exit'
  
  // Location at alert time
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  
  // Status
  isRead: boolean("is_read").notNull().default(false),
  
  // Metadata
  triggeredAt: timestamp("triggered_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Device Configurations (Pending and Applied configurations)
export const deviceConfigurations = pgTable("device_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  
  // Configuration data
  configData: jsonb("config_data").notNull(),
  
  // Status tracking
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'sent' | 'applied' | 'failed'
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  appliedAt: timestamp("applied_at"),
});

// System Logs
export const systemLogs = pgTable("system_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceId: uuid("device_id").references(() => devices.id),
  userId: uuid("user_id").references(() => users.id),
  
  level: varchar("level", { length: 20 }).notNull(), // 'info' | 'warning' | 'error' | 'debug'
  category: varchar("category", { length: 50 }).notNull().default("system"), // 'system' | 'gps' | 'network' | 'command' | 'geofence'
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  
  timestamp: timestamp("timestamp").defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeviceLocationSchema = createInsertSchema(deviceLocations).omit({
  id: true,
  createdAt: true,
});

export const insertDeviceCommandSchema = createInsertSchema(deviceCommands).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  acknowledgedAt: true,
  executedAt: true,
});

export const insertDeviceStatusHistorySchema = createInsertSchema(deviceStatusHistory).omit({
  id: true,
  timestamp: true,
});

export const insertGeofenceSchema = createInsertSchema(geofences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGeofenceAlertSchema = createInsertSchema(geofenceAlerts).omit({
  id: true,
  triggeredAt: true,
  readAt: true,
});

export const insertDeviceConfigurationSchema = createInsertSchema(deviceConfigurations).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  appliedAt: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type DeviceLocation = typeof deviceLocations.$inferSelect;
export type InsertDeviceLocation = z.infer<typeof insertDeviceLocationSchema>;

export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type InsertDeviceCommand = z.infer<typeof insertDeviceCommandSchema>;

export type DeviceStatusHistory = typeof deviceStatusHistory.$inferSelect;
export type InsertDeviceStatusHistory = z.infer<typeof insertDeviceStatusHistorySchema>;

export type Geofence = typeof geofences.$inferSelect;
export type InsertGeofence = z.infer<typeof insertGeofenceSchema>;

export type GeofenceAlert = typeof geofenceAlerts.$inferSelect;
export type InsertGeofenceAlert = z.infer<typeof insertGeofenceAlertSchema>;

export type DeviceConfiguration = typeof deviceConfigurations.$inferSelect;
export type InsertDeviceConfiguration = z.infer<typeof insertDeviceConfigurationSchema>;

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;

// Type definitions for API responses
export type DeviceStatus = "online" | "offline" | "lost_mode" | "low_battery" | "error";
export type CommandType = "enable_lost_mode" | "disable_lost_mode" | "get_location" | "update_config" | "reboot" | "enable_geofence_monitoring" | "disable_geofence_monitoring";
export type CommandStatus = "pending" | "sent" | "acknowledged" | "executed" | "failed" | "expired";
export type ConfigurationStatus = "pending" | "sent" | "applied" | "failed";
export type AlertType = "enter" | "exit";
export type LogLevel = "info" | "warning" | "error" | "debug";
export type LogCategory = "system" | "gps" | "network" | "command" | "geofence";