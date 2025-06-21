import {
  User,
  InsertUser,
  Device,
  InsertDevice,
  DeviceLocation,
  InsertDeviceLocation,
  DeviceCommand,
  InsertDeviceCommand,
  DeviceStatusHistory,
  InsertDeviceStatusHistory,
  Geofence,
  InsertGeofence,
  GeofenceAlert,
  InsertGeofenceAlert,
  DeviceConfiguration,
  InsertDeviceConfiguration,
  SystemLog,
  InsertSystemLog,
  users,
  devices,
  deviceLocations,
  deviceCommands,
  deviceStatusHistory,
  geofences,
  geofenceAlerts,
  deviceConfigurations,
  systemLogs,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Device operations
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceByDeviceId(deviceId: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, updates: Partial<Device>): Promise<Device | undefined>;
  getAllDevices(): Promise<Device[]>;
  checkDeviceExists(deviceId: string): Promise<boolean>;

  // Location operations
  addDeviceLocation(location: InsertDeviceLocation): Promise<DeviceLocation>;
  getDeviceLocations(deviceId: string, limit?: number): Promise<DeviceLocation[]>;
  getLatestLocation(deviceId: string): Promise<DeviceLocation | undefined>;

  // Command operations
  createDeviceCommand(command: InsertDeviceCommand): Promise<DeviceCommand>;
  getPendingCommandsByDevice(deviceId: string): Promise<DeviceCommand[]>;
  updateCommandStatus(commandId: string, status: string, timestamp?: Date): Promise<boolean>;
  
  // Status History operations
  addStatusHistory(history: InsertDeviceStatusHistory): Promise<DeviceStatusHistory>;
  getStatusHistory(deviceId: string, limit?: number): Promise<DeviceStatusHistory[]>;

  // Geofence operations
  createGeofence(geofence: InsertGeofence): Promise<Geofence>;
  getGeofencesByDevice(deviceId: string): Promise<Geofence[]>;
  updateGeofence(id: string, updates: Partial<Geofence>): Promise<Geofence | undefined>;
  deleteGeofence(id: string): Promise<boolean>;

  // Geofence Alert operations
  createGeofenceAlert(alert: InsertGeofenceAlert): Promise<GeofenceAlert>;
  getGeofenceAlertsByDevice(deviceId: string, limit?: number): Promise<GeofenceAlert[]>;
  markAlertAsRead(alertId: string): Promise<boolean>;
  getUnreadAlertsCount(deviceId: string): Promise<number>;

  // Device Configuration operations
  createDeviceConfiguration(config: InsertDeviceConfiguration): Promise<DeviceConfiguration>;
  getPendingConfigurationsByDevice(deviceId: string): Promise<DeviceConfiguration[]>;
  updateConfigurationStatus(configId: string, status: string, timestamp?: Date): Promise<boolean>;
  getLatestConfiguration(deviceId: string): Promise<DeviceConfiguration | undefined>;

  // System Log operations
  addSystemLog(log: InsertSystemLog): Promise<SystemLog>;
  getSystemLogs(deviceId?: string, limit?: number, date?: string, offset?: number): Promise<SystemLog[]>;
  getSystemLogsCount(deviceId?: string, date?: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  // Device operations
  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device || undefined;
  }

  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.deviceId, deviceId));
    return device || undefined;
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const [device] = await db
      .insert(devices)
      .values(insertDevice)
      .returning();
    return device;
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device | undefined> {
    const [device] = await db
      .update(devices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    return device || undefined;
  }

  async getAllDevices(): Promise<Device[]> {
    return await db.select().from(devices).orderBy(desc(devices.createdAt));
  }

  async checkDeviceExists(deviceId: string): Promise<boolean> {
    const [device] = await db.select({ id: devices.id }).from(devices).where(eq(devices.deviceId, deviceId));
    return !!device;
  }

  // Location operations
  async addDeviceLocation(insertLocation: InsertDeviceLocation): Promise<DeviceLocation> {
    const [location] = await db
      .insert(deviceLocations)
      .values(insertLocation)
      .returning();
    return location;
  }

  async getDeviceLocations(deviceId: string, limit = 100): Promise<DeviceLocation[]> {
    return await db
      .select()
      .from(deviceLocations)
      .where(eq(deviceLocations.deviceId, deviceId))
      .orderBy(desc(deviceLocations.timestamp))
      .limit(limit);
  }

  async getLatestLocation(deviceId: string): Promise<DeviceLocation | undefined> {
    const [location] = await db
      .select()
      .from(deviceLocations)
      .where(eq(deviceLocations.deviceId, deviceId))
      .orderBy(desc(deviceLocations.timestamp))
      .limit(1);
    return location || undefined;
  }

  // Command operations
  async createDeviceCommand(insertCommand: InsertDeviceCommand): Promise<DeviceCommand> {
    const [command] = await db
      .insert(deviceCommands)
      .values(insertCommand)
      .returning();
    return command;
  }

  async getPendingCommandsByDevice(deviceId: string): Promise<DeviceCommand[]> {
    return await db
      .select()
      .from(deviceCommands)
      .where(and(
        eq(deviceCommands.deviceId, deviceId),
        eq(deviceCommands.status, "pending")
      ))
      .orderBy(desc(deviceCommands.createdAt));
  }

  async updateCommandStatus(commandId: string, status: string, timestamp?: Date): Promise<boolean> {
    const updateData: any = { status };
    
    if (status === "sent") updateData.sentAt = timestamp || new Date();
    if (status === "acknowledged") updateData.acknowledgedAt = timestamp || new Date();
    if (status === "executed") updateData.executedAt = timestamp || new Date();

    const result = await db
      .update(deviceCommands)
      .set(updateData)
      .where(eq(deviceCommands.id, commandId));
    
    return (result.rowCount || 0) > 0;
  }

  // Status History operations
  async addStatusHistory(insertHistory: InsertDeviceStatusHistory): Promise<DeviceStatusHistory> {
    const [history] = await db
      .insert(deviceStatusHistory)
      .values(insertHistory)
      .returning();
    return history;
  }

  async getStatusHistory(deviceId: string, limit = 50): Promise<DeviceStatusHistory[]> {
    return await db
      .select()
      .from(deviceStatusHistory)
      .where(eq(deviceStatusHistory.deviceId, deviceId))
      .orderBy(desc(deviceStatusHistory.timestamp))
      .limit(limit);
  }

  // Geofence operations
  async createGeofence(insertGeofence: InsertGeofence): Promise<Geofence> {
    const [geofence] = await db
      .insert(geofences)
      .values(insertGeofence)
      .returning();
    return geofence;
  }

  async getGeofencesByDevice(deviceId: string): Promise<Geofence[]> {
    return await db
      .select()
      .from(geofences)
      .where(eq(geofences.deviceId, deviceId))
      .orderBy(desc(geofences.createdAt));
  }

  async updateGeofence(id: string, updates: Partial<Geofence>): Promise<Geofence | undefined> {
    const [geofence] = await db
      .update(geofences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(geofences.id, id))
      .returning();
    return geofence || undefined;
  }

  async deleteGeofence(id: string): Promise<boolean> {
    const result = await db
      .delete(geofences)
      .where(eq(geofences.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Geofence Alert operations
  async createGeofenceAlert(insertAlert: InsertGeofenceAlert): Promise<GeofenceAlert> {
    const [alert] = await db
      .insert(geofenceAlerts)
      .values(insertAlert)
      .returning();
    return alert;
  }

  async getGeofenceAlertsByDevice(deviceId: string, limit = 50): Promise<GeofenceAlert[]> {
    return await db
      .select()
      .from(geofenceAlerts)
      .where(eq(geofenceAlerts.deviceId, deviceId))
      .orderBy(desc(geofenceAlerts.triggeredAt))
      .limit(limit);
  }

  async markAlertAsRead(alertId: string): Promise<boolean> {
    const result = await db
      .update(geofenceAlerts)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(geofenceAlerts.id, alertId));
    return (result.rowCount || 0) > 0;
  }

  async getUnreadAlertsCount(deviceId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(geofenceAlerts)
      .where(and(
        eq(geofenceAlerts.deviceId, deviceId),
        eq(geofenceAlerts.isRead, false)
      ));
    return result?.count || 0;
  }

  async getLatestConfiguration(deviceId: string): Promise<DeviceConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(deviceConfigurations)
      .where(eq(deviceConfigurations.deviceId, deviceId))
      .orderBy(desc(deviceConfigurations.createdAt))
      .limit(1);
    return config || undefined;
  }

  // System Log operations
  async addSystemLog(insertLog: InsertSystemLog): Promise<SystemLog> {
    const [log] = await db
      .insert(systemLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getSystemLogs(deviceId?: string, limit = 50, date?: string, offset = 0): Promise<SystemLog[]> {
    let query = db.select().from(systemLogs);
    
    const conditions = [];
    
    if (deviceId) {
      conditions.push(eq(systemLogs.deviceId, deviceId));
    }
    
    if (date) {
      // Filter by date (start and end of day)
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      conditions.push(
        and(
          sql`${systemLogs.timestamp} >= ${startDate.toISOString()}`,
          sql`${systemLogs.timestamp} <= ${endDate.toISOString()}`
        )!
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(
        conditions.length === 1 ? conditions[0] : and(...conditions)!
      ) as any;
    }
    
    return await query
      .orderBy(desc(systemLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getSystemLogsCount(deviceId?: string, date?: string): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(systemLogs);
    
    const conditions = [];
    
    if (deviceId) {
      conditions.push(eq(systemLogs.deviceId, deviceId));
    }
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      conditions.push(
        and(
          sql`${systemLogs.timestamp} >= ${startDate.toISOString()}`,
          sql`${systemLogs.timestamp} <= ${endDate.toISOString()}`
        )!
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(
        conditions.length === 1 ? conditions[0] : and(...conditions)!
      ) as any;
    }
    
    const result = await query;
    return result[0]?.count || 0;
  }
}

export const storage = new DatabaseStorage();