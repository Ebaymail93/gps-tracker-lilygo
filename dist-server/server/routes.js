"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const express_1 = require("express");
const http_1 = require("http");
const zod_1 = require("zod");
const storage_1 = require("./storage");
const device_monitor_1 = require("./device-monitor");
const auth_1 = require("./auth");
const schema_1 = require("@shared/schema");
const router = (0, express_1.Router)();
router.get("/api/health", async (req, res) => {
    try {
        const dbCheck = await storage_1.storage.getAllDevices();
        const healthStatus = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            database: "connected",
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: "1.0.0",
            environment: process.env.NODE_ENV || "development"
        };
        res.json(healthStatus);
    }
    catch (error) {
        console.error("Health check failed:", error);
        res.status(503).json({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            error: "Database connection failed"
        });
    }
});
router.get("/api/ping", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "GPS Tracker Server is running"
    });
});
router.get("/api/device/:deviceId/exists", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const exists = await storage_1.storage.checkDeviceExists(deviceId);
        res.json({ exists });
    }
    catch (error) {
        console.error("Device exists error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/device/register", async (req, res) => {
    try {
        const deviceData = {
            ...req.body,
            config: {
                heartbeat_interval: 300000,
                gps_interval: 10000,
                lost_mode_interval: 15000,
                command_check_interval: 30000,
                low_battery_threshold: 15.0,
                gps_accuracy_threshold: 10.0
            }
        };
        const validatedData = schema_1.insertDeviceSchema.parse(deviceData);
        const device = await storage_1.storage.createDevice(validatedData);
        await storage_1.storage.addSystemLog({
            deviceId: device.id,
            level: "info",
            category: "system",
            message: `Device registered with default config: ${device.deviceName} (${device.deviceId})`
        });
        res.status(201).json(device);
    }
    catch (error) {
        console.error("Device register error:", error);
        res.status(400).json({ error: "Invalid device data" });
    }
});
router.post("/api/device/:deviceId/location", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const locationData = {
            deviceId: device.id,
            latitude: String(req.body.latitude),
            longitude: String(req.body.longitude),
            altitude: req.body.altitude ? String(req.body.altitude) : null,
            speed: req.body.speed ? String(req.body.speed) : null,
            heading: req.body.heading ? String(req.body.heading) : null,
            accuracy: req.body.accuracy ? String(req.body.accuracy) : null,
            batteryLevel: req.body.batteryLevel || null,
            signalQuality: req.body.signalQuality || null,
            timestamp: new Date()
        };
        const validatedLocation = schema_1.insertDeviceLocationSchema.parse(locationData);
        const location = await storage_1.storage.addDeviceLocation(validatedLocation);
        await device_monitor_1.deviceMonitor.updateDeviceActivity(deviceId);
        await checkGeofencing(device.id, parseFloat(req.body.latitude), parseFloat(req.body.longitude));
        res.status(201).json(location);
    }
    catch (error) {
        console.error("Device location error:", error);
        res.status(400).json({ error: "Invalid location data" });
    }
});
router.post("/api/device/:deviceId/heartbeat", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { status, batteryLevel, signalQuality } = req.body;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        await device_monitor_1.deviceMonitor.updateDeviceActivity(deviceId);
        if (status) {
            await storage_1.storage.addStatusHistory({
                deviceId: device.id,
                status,
                batteryLevel: batteryLevel || null,
                signalQuality: signalQuality || null
            });
        }
        const pendingCommands = await storage_1.storage.getPendingCommandsByDevice(device.id);
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            config: device.config || {},
            commands: pendingCommands
        });
    }
    catch (error) {
        console.error("Device heartbeat error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/device/:deviceId/config", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        res.json({
            config: device.config,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error("Device config error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/device/:deviceId/commands", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const commands = await storage_1.storage.getPendingCommandsByDevice(device.id);
        const pendingConfigs = await storage_1.storage.getPendingConfigurationsByDevice(device.id);
        const allCommands = [
            ...commands,
            ...pendingConfigs.map(config => ({
                id: config.id,
                deviceId: config.deviceId,
                commandType: "update_config",
                commandData: config.configData,
                status: config.status,
                createdAt: config.createdAt,
                sentAt: config.sentAt,
                executedAt: config.appliedAt
            }))
        ];
        res.json(allCommands);
    }
    catch (error) {
        console.error("Device commands error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/device/:deviceId/commands/:commandId/ack", async (req, res) => {
    try {
        const { commandId } = req.params;
        const { status } = req.body;
        const updated = await storage_1.storage.updateCommandStatus(commandId, status || "acknowledged", new Date());
        if (!updated) {
            return res.status(404).json({ error: "Command not found" });
        }
        res.json({ success: true, timestamp: new Date().toISOString() });
    }
    catch (error) {
        console.error("Proxy error - command ack:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/exists", auth_1.isAuthenticated, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const exists = await storage_1.storage.checkDeviceExists(deviceId);
        res.json({ exists });
    }
    catch (error) {
        console.error("Check device exists error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/devices/register", async (req, res) => {
    try {
        const deviceData = schema_1.insertDeviceSchema.parse(req.body);
        const existingDevice = await storage_1.storage.getDeviceByDeviceId(deviceData.deviceId);
        if (existingDevice) {
            return res.status(409).json({ error: "Device already registered" });
        }
        const device = await storage_1.storage.createDevice(deviceData);
        await storage_1.storage.addSystemLog({
            deviceId: device.id,
            level: "info",
            category: "system",
            message: `Device registered: ${device.deviceName || device.deviceId}`,
        });
        res.status(201).json(device);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid device data", details: error.errors });
        }
        console.error("Device registration error:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});
router.get("/api/devices/:deviceId", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        res.json(device);
    }
    catch (error) {
        console.error("Get device error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/config", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        res.json({ config: device.config });
    }
    catch (error) {
        console.error("Get device config error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.put("/api/devices/:deviceId", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const updatedDevice = await storage_1.storage.updateDevice(device.id, req.body);
        res.json(updatedDevice);
    }
    catch (error) {
        console.error("Update device error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices", async (req, res) => {
    try {
        const devices = await storage_1.storage.getAllDevices();
        res.json(devices);
    }
    catch (error) {
        console.error("Get devices error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/devices/:deviceId/heartbeat", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const { batteryLevel, signalQuality, status, networkOperator } = req.body;
        await storage_1.storage.updateDevice(device.id, {
            status: status || "online",
            lastSeen: new Date(),
        });
        if (status && status !== device.status) {
            await storage_1.storage.addStatusHistory({
                deviceId: device.id,
                status,
                previousStatus: device.status,
                batteryLevel: batteryLevel ? String(batteryLevel) : null,
                signalQuality: signalQuality ? Number(signalQuality) : null,
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Heartbeat error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/status", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const latestLocation = await storage_1.storage.getLatestLocation(device.id);
        const unreadAlerts = await storage_1.storage.getUnreadAlertsCount(device.id);
        res.json({
            device,
            latestLocation,
            unreadAlertsCount: unreadAlerts,
        });
    }
    catch (error) {
        console.error("Get device status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/devices/:deviceId/location", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const locationData = schema_1.insertDeviceLocationSchema.parse({
            ...req.body,
            deviceId: device.id,
            timestamp: new Date(req.body.timestamp || Date.now()),
        });
        const location = await storage_1.storage.addDeviceLocation(locationData);
        await storage_1.storage.updateDevice(device.id, { lastSeen: new Date() });
        await checkGeofencing(device.id, parseFloat(locationData.latitude), parseFloat(locationData.longitude));
        res.status(201).json(location);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid location data", details: error.errors });
        }
        console.error("Add location error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/history", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const limit = parseInt(req.query.limit) || 100;
        const locations = await storage_1.storage.getDeviceLocations(device.id, limit);
        res.json(locations);
    }
    catch (error) {
        console.error("Get device history error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/commands", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const commands = await storage_1.storage.getPendingCommandsByDevice(device.id);
        res.json(commands);
    }
    catch (error) {
        console.error("Get commands error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/devices/:deviceId/commands", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const commandData = schema_1.insertDeviceCommandSchema.parse({
            ...req.body,
            deviceId: device.id,
        });
        if (commandData.commandType !== "update_config") {
            const pendingCommands = await storage_1.storage.getPendingCommandsByDevice(device.id);
            const existingCommand = pendingCommands.find(cmd => cmd.commandType === commandData.commandType && cmd.status === 'pending');
            if (existingCommand) {
                return res.status(400).json({
                    error: `${commandData.commandType} command already pending for this device`,
                    existingCommandId: existingCommand.id
                });
            }
        }
        else {
            const pendingCommands = await storage_1.storage.getPendingCommandsByDevice(device.id);
            const existingConfigCommands = pendingCommands.filter(cmd => cmd.commandType === "update_config" && cmd.status === 'pending');
            for (const existingCmd of existingConfigCommands) {
                await storage_1.storage.updateCommandStatus(existingCmd.id, "cancelled");
            }
        }
        const command = await storage_1.storage.createDeviceCommand(commandData);
        if (commandData.commandType === "update_config" && commandData.commandData) {
            await storage_1.storage.createDeviceConfiguration({
                deviceId: device.id,
                configData: commandData.commandData,
                status: "pending",
            });
        }
        await storage_1.storage.addSystemLog({
            deviceId: device.id,
            level: "info",
            category: "command",
            message: `Command created: ${command.commandType}`,
            metadata: { commandId: command.id },
        });
        res.status(201).json(command);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid command data", details: error.errors });
        }
        console.error("Create command error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/devices/:deviceId/commands/:commandId/ack", async (req, res) => {
    try {
        const { deviceId, commandId } = req.params;
        const { status } = req.body;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        let success = await storage_1.storage.updateCommandStatus(commandId, status);
        if (!success) {
            success = await storage_1.storage.updateConfigurationStatus(commandId, status === "executed" ? "applied" : status);
        }
        if (!success) {
            return res.status(404).json({ error: "Command or configuration not found" });
        }
        const updatedDevice = await storage_1.storage.getDevice(device.id);
        const response = {
            success: true,
            config: updatedDevice?.config || {},
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        console.error("Command acknowledgment error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/geofences", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const geofences = await storage_1.storage.getGeofencesByDevice(device.id);
        res.json(geofences);
    }
    catch (error) {
        console.error("Get geofences error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/devices/:deviceId/geofences", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const geofenceData = schema_1.insertGeofenceSchema.parse({
            ...req.body,
            deviceId: device.id,
        });
        const geofence = await storage_1.storage.createGeofence(geofenceData);
        await enableGeofenceMonitoring(device.id, deviceId);
        res.status(201).json(geofence);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid geofence data", details: error.errors });
        }
        console.error("Create geofence error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.delete("/api/devices/:deviceId/geofences/:geofenceId", async (req, res) => {
    try {
        const { deviceId, geofenceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const success = await storage_1.storage.deleteGeofence(geofenceId);
        if (!success) {
            return res.status(404).json({ error: "Geofence not found" });
        }
        await disableGeofenceMonitoring(device.id, deviceId);
        res.json({ success: true });
    }
    catch (error) {
        console.error("Delete geofence error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/devices/:deviceId/lost-mode", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { lostMode } = req.body;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const pendingCommands = await storage_1.storage.getPendingCommandsByDevice(device.id);
        const existingLostModeCommand = pendingCommands.find(cmd => cmd.commandType === "enable_lost_mode" || cmd.commandType === "disable_lost_mode");
        if (lostMode) {
            if (existingLostModeCommand && existingLostModeCommand.commandType === "enable_lost_mode") {
                return res.status(400).json({
                    error: "Lost mode command already pending",
                    canCancel: true,
                    commandId: existingLostModeCommand.id
                });
            }
            if (existingLostModeCommand && existingLostModeCommand.commandType === "disable_lost_mode") {
                await storage_1.storage.updateCommandStatus(existingLostModeCommand.id, "cancelled");
            }
            const command = await storage_1.storage.createDeviceCommand({
                deviceId: device.id,
                commandType: "enable_lost_mode",
                status: "pending",
            });
            await storage_1.storage.addSystemLog({
                deviceId: device.id,
                level: "info",
                category: "command",
                message: `Lost mode enable command sent (ID: ${command.id})`,
            });
            res.json({
                success: true,
                message: "Lost mode command sent to device",
                commandId: command.id,
                status: "pending"
            });
        }
        else {
            if (existingLostModeCommand && existingLostModeCommand.commandType === "disable_lost_mode") {
                return res.status(400).json({
                    error: "Lost mode disable command already pending",
                    canCancel: true,
                    commandId: existingLostModeCommand.id
                });
            }
            if (existingLostModeCommand && existingLostModeCommand.commandType === "enable_lost_mode") {
                await storage_1.storage.updateCommandStatus(existingLostModeCommand.id, "cancelled");
            }
            const command = await storage_1.storage.createDeviceCommand({
                deviceId: device.id,
                commandType: "disable_lost_mode",
                status: "pending",
            });
            await storage_1.storage.addSystemLog({
                deviceId: device.id,
                level: "info",
                category: "command",
                message: `Lost mode disable command sent (ID: ${command.id})`,
            });
            res.json({
                success: true,
                message: "Lost mode disable command sent to device",
                commandId: command.id,
                status: "pending"
            });
        }
    }
    catch (error) {
        console.error("Lost mode error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.delete("/api/devices/:deviceId/commands/:commandId", async (req, res) => {
    try {
        const { deviceId, commandId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const success = await storage_1.storage.updateCommandStatus(commandId, "cancelled");
        if (!success) {
            return res.status(404).json({ error: "Command not found" });
        }
        await storage_1.storage.addSystemLog({
            deviceId: device.id,
            level: "info",
            category: "command",
            message: `Command ${commandId} cancelled by user`,
        });
        res.json({ success: true, message: "Command cancelled" });
    }
    catch (error) {
        console.error("Cancel command error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/status", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const pendingCommands = await storage_1.storage.getPendingCommandsByDevice(device.id);
        const lostModeCommand = pendingCommands.find(cmd => cmd.commandType === "enable_lost_mode" || cmd.commandType === "disable_lost_mode");
        res.json({
            device,
            pendingCommands,
            lostModeCommand,
            hasLostModeCommand: !!lostModeCommand
        });
    }
    catch (error) {
        console.error("Get device status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/system-logs", async (req, res) => {
    try {
        const deviceIdParam = req.query.deviceId;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const date = req.query.date;
        let deviceUuid = undefined;
        if (deviceIdParam) {
            const device = await storage_1.storage.getDeviceByDeviceId(deviceIdParam);
            deviceUuid = device?.id;
        }
        const [logs, totalCount] = await Promise.all([
            storage_1.storage.getSystemLogs(deviceUuid, limit, date, offset),
            storage_1.storage.getSystemLogsCount(deviceUuid, date)
        ]);
        res.json({
            logs,
            totalCount,
            hasMore: offset + limit < totalCount
        });
    }
    catch (error) {
        console.error("Get system logs error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/geofence-alerts", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const limit = parseInt(req.query.limit) || 50;
        const alerts = await storage_1.storage.getGeofenceAlertsByDevice(device.id, limit);
        res.json(alerts);
    }
    catch (error) {
        console.error("Get geofence alerts error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/api/devices/:deviceId/unread-alerts-count", async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }
        const count = await storage_1.storage.getUnreadAlertsCount(device.id);
        res.json({ count });
    }
    catch (error) {
        console.error("Get unread alerts count error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
async function checkGeofencing(deviceId, latitude, longitude) {
    try {
        const geofences = await storage_1.storage.getGeofencesByDevice(deviceId);
        for (const geofence of geofences) {
            if (!geofence.isActive)
                continue;
            const distance = calculateDistance(latitude, longitude, parseFloat(geofence.centerLatitude), parseFloat(geofence.centerLongitude));
            const isInside = distance <= parseFloat(geofence.radius);
            if (isInside && geofence.alertOnEnter) {
                await storage_1.storage.createGeofenceAlert({
                    deviceId,
                    geofenceId: geofence.id,
                    alertType: "enter",
                    latitude: latitude.toString(),
                    longitude: longitude.toString(),
                });
                await storage_1.storage.addSystemLog({
                    deviceId,
                    level: "warning",
                    category: "geofence",
                    message: `Device entered geofence: ${geofence.name}`,
                    metadata: { geofenceId: geofence.id, latitude, longitude },
                });
            }
        }
    }
    catch (error) {
        console.error("Geofencing check error:", error);
    }
}
async function enableGeofenceMonitoring(deviceUuid, deviceId) {
    try {
        const command = await storage_1.storage.createDeviceCommand({
            deviceId: deviceUuid,
            commandType: "enable_geofence_monitoring",
            commandData: {
                interval: 30000,
                reason: "geofence_created"
            },
            status: "pending"
        });
        await storage_1.storage.addSystemLog({
            deviceId: deviceUuid,
            level: "info",
            category: "geofence",
            message: `Geofence monitoring enabled - GPS activation command sent`,
            metadata: { commandId: command.id, deviceId }
        });
        console.log(`Geofence monitoring enabled for device ${deviceId} - Command ${command.id} created`);
    }
    catch (error) {
        console.error("Error enabling geofence monitoring:", error);
    }
}
async function disableGeofenceMonitoring(deviceUuid, deviceId) {
    try {
        const activeGeofences = await storage_1.storage.getGeofencesByDevice(deviceUuid);
        if (activeGeofences.length === 0) {
            const command = await storage_1.storage.createDeviceCommand({
                deviceId: deviceUuid,
                commandType: "disable_geofence_monitoring",
                commandData: {
                    reason: "no_active_geofences"
                },
                status: "pending"
            });
            await storage_1.storage.addSystemLog({
                deviceId: deviceUuid,
                level: "info",
                category: "geofence",
                message: `Geofence monitoring disabled - no active geofences`,
                metadata: { commandId: command.id, deviceId }
            });
            console.log(`Geofence monitoring disabled for device ${deviceId} - Command ${command.id} created`);
        }
    }
    catch (error) {
        console.error("Error disabling geofence monitoring:", error);
    }
}
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
async function registerRoutes(app) {
    await (0, auth_1.setupAuth)(app);
    app.use(router);
    const server = new http_1.Server(app);
    return server;
}
