"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const schema_1 = require("@shared/schema");
const db_1 = require("./db");
const drizzle_orm_1 = require("drizzle-orm");
class DatabaseStorage {
    async getUser(id) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return user;
    }
    async getUserByEmail(email) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        return user;
    }
    async createUser(insertUser) {
        const [user] = await db_1.db
            .insert(schema_1.users)
            .values(insertUser)
            .returning();
        return user;
    }
    async getDevice(id) {
        const [device] = await db_1.db.select().from(schema_1.devices).where((0, drizzle_orm_1.eq)(schema_1.devices.id, id));
        return device || undefined;
    }
    async getDeviceByDeviceId(deviceId) {
        const [device] = await db_1.db.select().from(schema_1.devices).where((0, drizzle_orm_1.eq)(schema_1.devices.deviceId, deviceId));
        return device || undefined;
    }
    async createDevice(insertDevice) {
        const [device] = await db_1.db
            .insert(schema_1.devices)
            .values(insertDevice)
            .returning();
        return device;
    }
    async updateDevice(id, updates) {
        const [device] = await db_1.db
            .update(schema_1.devices)
            .set({ ...updates, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.devices.id, id))
            .returning();
        return device || undefined;
    }
    async getAllDevices() {
        return await db_1.db.select().from(schema_1.devices).orderBy((0, drizzle_orm_1.desc)(schema_1.devices.createdAt));
    }
    async checkDeviceExists(deviceId) {
        const [device] = await db_1.db.select({ id: schema_1.devices.id }).from(schema_1.devices).where((0, drizzle_orm_1.eq)(schema_1.devices.deviceId, deviceId));
        return !!device;
    }
    async addDeviceLocation(insertLocation) {
        const [location] = await db_1.db
            .insert(schema_1.deviceLocations)
            .values(insertLocation)
            .returning();
        return location;
    }
    async getDeviceLocations(deviceId, limit = 100) {
        return await db_1.db
            .select()
            .from(schema_1.deviceLocations)
            .where((0, drizzle_orm_1.eq)(schema_1.deviceLocations.deviceId, deviceId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deviceLocations.timestamp))
            .limit(limit);
    }
    async getLatestLocation(deviceId) {
        const [location] = await db_1.db
            .select()
            .from(schema_1.deviceLocations)
            .where((0, drizzle_orm_1.eq)(schema_1.deviceLocations.deviceId, deviceId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deviceLocations.timestamp))
            .limit(1);
        return location || undefined;
    }
    async createDeviceCommand(insertCommand) {
        const [command] = await db_1.db
            .insert(schema_1.deviceCommands)
            .values(insertCommand)
            .returning();
        return command;
    }
    async getPendingCommandsByDevice(deviceId) {
        return await db_1.db
            .select()
            .from(schema_1.deviceCommands)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deviceCommands.deviceId, deviceId), (0, drizzle_orm_1.eq)(schema_1.deviceCommands.status, "pending")))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deviceCommands.createdAt));
    }
    async updateCommandStatus(commandId, status, timestamp) {
        const updateData = { status };
        if (status === "sent")
            updateData.sentAt = timestamp || new Date();
        if (status === "acknowledged")
            updateData.acknowledgedAt = timestamp || new Date();
        if (status === "executed")
            updateData.executedAt = timestamp || new Date();
        const result = await db_1.db
            .update(schema_1.deviceCommands)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.deviceCommands.id, commandId));
        return (result.rowCount || 0) > 0;
    }
    async addStatusHistory(insertHistory) {
        const [history] = await db_1.db
            .insert(schema_1.deviceStatusHistory)
            .values(insertHistory)
            .returning();
        return history;
    }
    async getStatusHistory(deviceId, limit = 50) {
        return await db_1.db
            .select()
            .from(schema_1.deviceStatusHistory)
            .where((0, drizzle_orm_1.eq)(schema_1.deviceStatusHistory.deviceId, deviceId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deviceStatusHistory.timestamp))
            .limit(limit);
    }
    async createGeofence(insertGeofence) {
        const [geofence] = await db_1.db
            .insert(schema_1.geofences)
            .values(insertGeofence)
            .returning();
        return geofence;
    }
    async getGeofencesByDevice(deviceId) {
        return await db_1.db
            .select()
            .from(schema_1.geofences)
            .where((0, drizzle_orm_1.eq)(schema_1.geofences.deviceId, deviceId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.geofences.createdAt));
    }
    async updateGeofence(id, updates) {
        const [geofence] = await db_1.db
            .update(schema_1.geofences)
            .set({ ...updates, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.geofences.id, id))
            .returning();
        return geofence || undefined;
    }
    async deleteGeofence(id) {
        const result = await db_1.db
            .delete(schema_1.geofences)
            .where((0, drizzle_orm_1.eq)(schema_1.geofences.id, id));
        return (result.rowCount || 0) > 0;
    }
    async createGeofenceAlert(insertAlert) {
        const [alert] = await db_1.db
            .insert(schema_1.geofenceAlerts)
            .values(insertAlert)
            .returning();
        return alert;
    }
    async getGeofenceAlertsByDevice(deviceId, limit = 50) {
        return await db_1.db
            .select()
            .from(schema_1.geofenceAlerts)
            .where((0, drizzle_orm_1.eq)(schema_1.geofenceAlerts.deviceId, deviceId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.geofenceAlerts.triggeredAt))
            .limit(limit);
    }
    async markAlertAsRead(alertId) {
        const result = await db_1.db
            .update(schema_1.geofenceAlerts)
            .set({ isRead: true, readAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.geofenceAlerts.id, alertId));
        return (result.rowCount || 0) > 0;
    }
    async getUnreadAlertsCount(deviceId) {
        const [result] = await db_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.geofenceAlerts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.geofenceAlerts.deviceId, deviceId), (0, drizzle_orm_1.eq)(schema_1.geofenceAlerts.isRead, false)));
        return result?.count || 0;
    }
    async createDeviceConfiguration(insertConfig) {
        const existingPending = await db_1.db
            .select()
            .from(schema_1.deviceConfigurations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deviceConfigurations.deviceId, insertConfig.deviceId), (0, drizzle_orm_1.eq)(schema_1.deviceConfigurations.status, "pending")))
            .limit(1);
        if (existingPending.length > 0) {
            const [config] = await db_1.db
                .update(schema_1.deviceConfigurations)
                .set({
                configData: insertConfig.configData,
                createdAt: new Date(),
                sentAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.deviceConfigurations.id, existingPending[0].id))
                .returning();
            return config;
        }
        else {
            const [config] = await db_1.db
                .insert(schema_1.deviceConfigurations)
                .values({
                ...insertConfig,
                sentAt: new Date()
            })
                .returning();
            return config;
        }
    }
    async getPendingConfigurationsByDevice(deviceId) {
        return await db_1.db
            .select()
            .from(schema_1.deviceConfigurations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deviceConfigurations.deviceId, deviceId), (0, drizzle_orm_1.eq)(schema_1.deviceConfigurations.status, "pending")))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deviceConfigurations.createdAt));
    }
    async updateConfigurationStatus(configId, status, timestamp) {
        const updateData = { status };
        if (status === "sent")
            updateData.sentAt = timestamp || new Date();
        if (status === "applied")
            updateData.appliedAt = timestamp || new Date();
        const result = await db_1.db
            .update(schema_1.deviceConfigurations)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.deviceConfigurations.id, configId));
        return result.rowCount !== null && result.rowCount > 0;
    }
    async getLatestConfiguration(deviceId) {
        const [config] = await db_1.db
            .select()
            .from(schema_1.deviceConfigurations)
            .where((0, drizzle_orm_1.eq)(schema_1.deviceConfigurations.deviceId, deviceId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deviceConfigurations.createdAt))
            .limit(1);
        return config || undefined;
    }
    async addSystemLog(insertLog) {
        const [log] = await db_1.db
            .insert(schema_1.systemLogs)
            .values(insertLog)
            .returning();
        return log;
    }
    async getSystemLogs(deviceId, limit = 50, date, offset = 0) {
        let query = db_1.db.select().from(schema_1.systemLogs);
        const conditions = [];
        if (deviceId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.systemLogs.deviceId, deviceId));
        }
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            conditions.push((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_1.systemLogs.timestamp} >= ${startDate.toISOString()}`, (0, drizzle_orm_1.sql) `${schema_1.systemLogs.timestamp} <= ${endDate.toISOString()}`));
        }
        if (conditions.length > 0) {
            query = query.where(conditions.length === 1 ? conditions[0] : (0, drizzle_orm_1.and)(...conditions));
        }
        return await query
            .orderBy((0, drizzle_orm_1.desc)(schema_1.systemLogs.timestamp))
            .limit(limit)
            .offset(offset);
    }
    async getSystemLogsCount(deviceId, date) {
        let query = db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema_1.systemLogs);
        const conditions = [];
        if (deviceId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.systemLogs.deviceId, deviceId));
        }
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            conditions.push((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_1.systemLogs.timestamp} >= ${startDate.toISOString()}`, (0, drizzle_orm_1.sql) `${schema_1.systemLogs.timestamp} <= ${endDate.toISOString()}`));
        }
        if (conditions.length > 0) {
            query = query.where(conditions.length === 1 ? conditions[0] : (0, drizzle_orm_1.and)(...conditions));
        }
        const result = await query;
        return result[0]?.count || 0;
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
