import { Request, Response, Router } from "express";
import type { Express } from "express";
import { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { deviceMonitor } from "./device-monitor";
import { setupAuth, isAuthenticated } from "./auth";
import {
  insertDeviceSchema,
  insertDeviceLocationSchema,
  insertDeviceCommandSchema,
  insertGeofenceSchema,
  insertSystemLogSchema,
  CommandType,
  DeviceStatus,
} from "@shared/schema";

const router = Router();

// Health Check Endpoint for Raspberry Pi monitoring
router.get("/api/health", async (req: Request, res: Response) => {
  try {
    // Check database connection
    const dbCheck = await storage.getAllDevices();
    
    // System info
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
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Database connection failed"
    });
  }
});

// Direct HTTP Endpoints for Arduino Devices
router.get("/api/ping", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    message: "GPS Tracker Server is running"
  });
});

router.get("/api/device/:deviceId/exists", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const exists = await storage.checkDeviceExists(deviceId);
    res.json({ exists });
  } catch (error) {
    console.error("Device exists error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/device/register", async (req: Request, res: Response) => {
  try {
    const deviceData = {
      ...req.body,
      config: {
        heartbeat_interval: 300000,     // 5 minuti (300 secondi)
        gps_interval: 10000,           // 10 secondi (deprecated)
        lost_mode_interval: 15000,     // 15 secondi in lost mode
        command_check_interval: 30000, // 30 secondi
        low_battery_threshold: 15.0,   // 15%
        gps_accuracy_threshold: 10.0   // 10 metri
      }
    };
    
    const validatedData = insertDeviceSchema.parse(deviceData);
    const device = await storage.createDevice(validatedData);
    
    await storage.addSystemLog({
      deviceId: device.id,
      level: "info",
      category: "system",
      message: `Device registered with default config: ${device.deviceName} (${device.deviceId})`
    });
    
    res.status(201).json(device);
  } catch (error) {
    console.error("Device register error:", error);
    res.status(400).json({ error: "Invalid device data" });
  }
});

router.post("/api/device/:deviceId/location", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const device = await storage.getDeviceByDeviceId(deviceId);
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
    
    const validatedLocation = insertDeviceLocationSchema.parse(locationData);
    const location = await storage.addDeviceLocation(validatedLocation);
    
    // Aggiorna attività dispositivo tramite monitor
    await deviceMonitor.updateDeviceActivity(deviceId);
    
    // Controlla geofencing automaticamente lato server
    await checkGeofencing(device.id, parseFloat(req.body.latitude), parseFloat(req.body.longitude));
    
    res.status(201).json(location);
  } catch (error) {
    console.error("Device location error:", error);
    res.status(400).json({ error: "Invalid location data" });
  }
});

router.post("/api/device/:deviceId/heartbeat", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { status, batteryLevel, signalQuality } = req.body;
    
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    await deviceMonitor.updateDeviceActivity(deviceId);
    
    if (status) {
      await storage.addStatusHistory({
        deviceId: device.id,
        status,
        batteryLevel: batteryLevel || null,
        signalQuality: signalQuality || null
      });
    }
    
    // Recupera comandi pendenti insieme al heartbeat
    const pendingCommands = await storage.getPendingCommandsByDevice(device.id);
    
    res.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      config: device.config || {},
      commands: pendingCommands
    });
  } catch (error) {
    console.error("Device heartbeat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/device/:deviceId/config", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    res.json({
      config: device.config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Device config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/device/:deviceId/commands", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    // Get both pending commands and pending configurations
    const commands = await storage.getPendingCommandsByDevice(device.id);
    const pendingConfigs = await storage.getPendingConfigurationsByDevice(device.id);
    
    // Include pending configurations as commands
    const allCommands = [
      ...commands,
      ...pendingConfigs.map(config => ({
        id: config.id,
        deviceId: config.deviceId,
        commandType: "update_config" as const,
        commandData: config.configData,
        status: config.status,
        createdAt: config.createdAt,
        sentAt: config.sentAt,
        executedAt: config.appliedAt
      }))
    ];
    
    res.json(allCommands);
  } catch (error) {
    console.error("Device commands error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/device/:deviceId/commands/:commandId/ack", async (req: Request, res: Response) => {
  try {
    const { commandId } = req.params;
    const { status } = req.body;
    
    const updated = await storage.updateCommandStatus(
      commandId, 
      status || "acknowledged",
      new Date()
    );
    
    if (!updated) {
      return res.status(404).json({ error: "Command not found" });
    }
    
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Proxy error - command ack:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Device Registration & Discovery APIs (protected)
router.get("/api/devices/:deviceId/exists", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const exists = await storage.checkDeviceExists(deviceId);
    res.json({ exists });
  } catch (error) {
    console.error("Check device exists error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/devices/register", async (req: Request, res: Response) => {
  try {
    const deviceData = insertDeviceSchema.parse(req.body);
    
    // Check if device already exists
    const existingDevice = await storage.getDeviceByDeviceId(deviceData.deviceId);
    if (existingDevice) {
      return res.status(409).json({ error: "Device already registered" });
    }
    
    const device = await storage.createDevice(deviceData);
    
    // Log registration
    await storage.addSystemLog({
      deviceId: device.id,
      level: "info",
      category: "system",
      message: `Device registered: ${device.deviceName || device.deviceId}`,
    });
    
    res.status(201).json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid device data", details: error.errors });
    }
    console.error("Device registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.get("/api/devices/:deviceId", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    res.json(device);
  } catch (error) {
    console.error("Get device error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/devices/:deviceId/config", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    res.json({ config: device.config });
  } catch (error) {
    console.error("Get device config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/devices/:deviceId", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const updatedDevice = await storage.updateDevice(device.id, req.body);
    res.json(updatedDevice);
  } catch (error) {
    console.error("Update device error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/devices", async (req: Request, res: Response) => {
  try {
    const devices = await storage.getAllDevices();
    res.json(devices);
  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Device Status & Live Data APIs
router.post("/api/devices/:deviceId/heartbeat", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const { batteryLevel, signalQuality, status, networkOperator } = req.body;
    
    // Update device status
    await storage.updateDevice(device.id, {
      status: status || "online",
      lastSeen: new Date(),
    });
    
    // Add status history if status changed
    if (status && status !== device.status) {
      await storage.addStatusHistory({
        deviceId: device.id,
        status,
        previousStatus: device.status,
        batteryLevel: batteryLevel ? String(batteryLevel) : null,
        signalQuality: signalQuality ? Number(signalQuality) : null,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/devices/:deviceId/status", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const latestLocation = await storage.getLatestLocation(device.id);
    const unreadAlerts = await storage.getUnreadAlertsCount(device.id);
    
    res.json({
      device,
      latestLocation,
      unreadAlertsCount: unreadAlerts,
    });
  } catch (error) {
    console.error("Get device status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/devices/:deviceId/location", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const locationData = insertDeviceLocationSchema.parse({
      ...req.body,
      deviceId: device.id,
      timestamp: new Date(req.body.timestamp || Date.now()),
    });
    
    const location = await storage.addDeviceLocation(locationData);
    
    // Update device last seen
    await storage.updateDevice(device.id, { lastSeen: new Date() });
    
    // Check geofencing (simplified for now)
    await checkGeofencing(device.id, parseFloat(locationData.latitude), parseFloat(locationData.longitude));
    
    res.status(201).json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid location data", details: error.errors });
    }
    console.error("Add location error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/devices/:deviceId/history", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const limit = parseInt(req.query.limit as string) || 100;
    const locations = await storage.getDeviceLocations(device.id, limit);
    
    res.json(locations);
  } catch (error) {
    console.error("Get device history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Command System APIs
router.get("/api/devices/:deviceId/commands", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const commands = await storage.getPendingCommandsByDevice(device.id);
    res.json(commands);
  } catch (error) {
    console.error("Get commands error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/devices/:deviceId/commands", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const commandData = insertDeviceCommandSchema.parse({
      ...req.body,
      deviceId: device.id,
    });
    
    // Check for existing pending commands of the same type (except for update_config)
    if (commandData.commandType !== "update_config") {
      const pendingCommands = await storage.getPendingCommandsByDevice(device.id);
      const existingCommand = pendingCommands.find(cmd => 
        cmd.commandType === commandData.commandType && cmd.status === 'pending'
      );
      
      if (existingCommand) {
        return res.status(400).json({ 
          error: `${commandData.commandType} command already pending for this device`,
          existingCommandId: existingCommand.id
        });
      }
    } else {
      // For update_config, cancel any existing pending config commands
      const pendingCommands = await storage.getPendingCommandsByDevice(device.id);
      const existingConfigCommands = pendingCommands.filter(cmd => 
        cmd.commandType === "update_config" && cmd.status === 'pending'
      );
      
      // Cancel existing config commands
      for (const existingCmd of existingConfigCommands) {
        await storage.updateCommandStatus(existingCmd.id, "cancelled");
      }
    }
    
    const command = await storage.createDeviceCommand(commandData);
    
    // For update_config commands, also save the configuration to the database
    if (commandData.commandType === "update_config" && commandData.commandData) {
      await storage.createDeviceConfiguration({
        deviceId: device.id,
        configData: commandData.commandData,
        status: "pending",
      });
    }
    
    // Log command creation
    await storage.addSystemLog({
      deviceId: device.id,
      level: "info",
      category: "command",
      message: `Command created: ${command.commandType}`,
      metadata: { commandId: command.id },
    });
    
    res.status(201).json(command);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid command data", details: error.errors });
    }
    console.error("Create command error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/devices/:deviceId/commands/:commandId/ack", async (req: Request, res: Response) => {
  try {
    const { deviceId, commandId } = req.params;
    const { status } = req.body;
    
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    // Try to update command status first
    let success = await storage.updateCommandStatus(commandId, status);
    
    // If command not found, try configuration status
    if (!success) {
      success = await storage.updateConfigurationStatus(commandId, status === "executed" ? "applied" : status);
    }
    
    if (!success) {
      return res.status(404).json({ error: "Command or configuration not found" });
    }
    
    // Return updated configuration
    const updatedDevice = await storage.getDevice(device.id);
    const response = {
      success: true,
      config: updatedDevice?.config || {},
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error("Command acknowledgment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Geofence APIs
router.get("/api/devices/:deviceId/geofences", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const geofences = await storage.getGeofencesByDevice(device.id);
    res.json(geofences);
  } catch (error) {
    console.error("Get geofences error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/devices/:deviceId/geofences", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const geofenceData = insertGeofenceSchema.parse({
      ...req.body,
      deviceId: device.id,
    });
    
    const geofence = await storage.createGeofence(geofenceData);
    
    // Attiva monitoraggio GPS quando viene creata una geofence
    await enableGeofenceMonitoring(device.id, deviceId);
    
    res.status(201).json(geofence);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid geofence data", details: error.errors });
    }
    console.error("Create geofence error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/devices/:deviceId/geofences/:geofenceId", async (req: Request, res: Response) => {
  try {
    const { deviceId, geofenceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const success = await storage.deleteGeofence(geofenceId);
    
    if (!success) {
      return res.status(404).json({ error: "Geofence not found" });
    }
    
    // Verifica se disattivare il monitoraggio GPS
    await disableGeofenceMonitoring(device.id, deviceId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Delete geofence error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Lost Mode APIs
router.post("/api/devices/:deviceId/lost-mode", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { lostMode } = req.body;
    
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    // Check for existing pending commands
    const pendingCommands = await storage.getPendingCommandsByDevice(device.id);
    const existingLostModeCommand = pendingCommands.find(cmd => 
      cmd.commandType === "enable_lost_mode" || cmd.commandType === "disable_lost_mode"
    );
    
    if (lostMode) {
      // Enabling lost mode
      if (existingLostModeCommand && existingLostModeCommand.commandType === "enable_lost_mode") {
        return res.status(400).json({ 
          error: "Lost mode command already pending",
          canCancel: true,
          commandId: existingLostModeCommand.id
        });
      }
      
      // Cancel any disable command if exists
      if (existingLostModeCommand && existingLostModeCommand.commandType === "disable_lost_mode") {
        await storage.updateCommandStatus(existingLostModeCommand.id, "cancelled");
      }
      
      // Create enable command
      const command = await storage.createDeviceCommand({
        deviceId: device.id,
        commandType: "enable_lost_mode",
        status: "pending",
      });
      
      await storage.addSystemLog({
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
      
    } else {
      // Disabling lost mode
      if (existingLostModeCommand && existingLostModeCommand.commandType === "disable_lost_mode") {
        return res.status(400).json({ 
          error: "Lost mode disable command already pending",
          canCancel: true,
          commandId: existingLostModeCommand.id
        });
      }
      
      // Cancel any enable command if exists
      if (existingLostModeCommand && existingLostModeCommand.commandType === "enable_lost_mode") {
        await storage.updateCommandStatus(existingLostModeCommand.id, "cancelled");
      }
      
      // Create disable command
      const command = await storage.createDeviceCommand({
        deviceId: device.id,
        commandType: "disable_lost_mode", 
        status: "pending",
      });
      
      await storage.addSystemLog({
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
    
  } catch (error) {
    console.error("Lost mode error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cancel command endpoint
router.delete("/api/devices/:deviceId/commands/:commandId", async (req: Request, res: Response) => {
  try {
    const { deviceId, commandId } = req.params;
    
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    // Cancel the command
    const success = await storage.updateCommandStatus(commandId, "cancelled");
    
    if (!success) {
      return res.status(404).json({ error: "Command not found" });
    }
    
    await storage.addSystemLog({
      deviceId: device.id,
      level: "info",
      category: "command",
      message: `Command ${commandId} cancelled by user`,
    });
    
    res.json({ success: true, message: "Command cancelled" });
  } catch (error) {
    console.error("Cancel command error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get device status with pending commands
router.get("/api/devices/:deviceId/status", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    // Get pending commands
    const pendingCommands = await storage.getPendingCommandsByDevice(device.id);
    const lostModeCommand = pendingCommands.find(cmd => 
      cmd.commandType === "enable_lost_mode" || cmd.commandType === "disable_lost_mode"
    );
    
    res.json({
      device,
      pendingCommands,
      lostModeCommand,
      hasLostModeCommand: !!lostModeCommand
    });
  } catch (error) {
    console.error("Get device status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// System Logs APIs
router.get("/api/system-logs", async (req: Request, res: Response) => {
  try {
    const deviceIdParam = req.query.deviceId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const date = req.query.date as string;
    
    let deviceUuid: string | undefined = undefined;
    if (deviceIdParam) {
      const device = await storage.getDeviceByDeviceId(deviceIdParam);
      deviceUuid = device?.id;
    }
    
    const [logs, totalCount] = await Promise.all([
      storage.getSystemLogs(deviceUuid, limit, date, offset),
      storage.getSystemLogsCount(deviceUuid, date)
    ]);
    
    res.json({
      logs,
      totalCount,
      hasMore: offset + limit < totalCount
    });
  } catch (error) {
    console.error("Get system logs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Geofence Alerts APIs  
router.get("/api/devices/:deviceId/geofence-alerts", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = await storage.getGeofenceAlertsByDevice(device.id, limit);
    
    res.json(alerts);
  } catch (error) {
    console.error("Get geofence alerts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/devices/:deviceId/unread-alerts-count", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = await storage.getDeviceByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    const count = await storage.getUnreadAlertsCount(device.id);
    res.json({ count });
  } catch (error) {
    console.error("Get unread alerts count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper functions
async function checkGeofencing(deviceId: string, latitude: number, longitude: number) {
  try {
    const geofences = await storage.getGeofencesByDevice(deviceId);
    
    for (const geofence of geofences) {
      if (!geofence.isActive) continue;
      
      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(geofence.centerLatitude),
        parseFloat(geofence.centerLongitude)
      );
      
      const isInside = distance <= parseFloat(geofence.radius);
      
      // Simple geofence logic - in a real implementation you'd track previous state
      if (isInside && geofence.alertOnEnter) {
        await storage.createGeofenceAlert({
          deviceId,
          geofenceId: geofence.id,
          alertType: "enter",
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        });
        
        await storage.addSystemLog({
          deviceId,
          level: "warning",
          category: "geofence",
          message: `Device entered geofence: ${geofence.name}`,
          metadata: { geofenceId: geofence.id, latitude, longitude },
        });
      }
    }
  } catch (error) {
    console.error("Geofencing check error:", error);
  }
}

async function enableGeofenceMonitoring(deviceUuid: string, deviceId: string) {
  try {
    // Crea comando per attivare GPS per monitoraggio geofence
    const command = await storage.createDeviceCommand({
      deviceId: deviceUuid,
      commandType: "enable_geofence_monitoring",
      commandData: { 
        interval: 30000, // GPS ogni 30 secondi per geofence monitoring
        reason: "geofence_created"
      },
      status: "pending"
    });

    await storage.addSystemLog({
      deviceId: deviceUuid,
      level: "info",
      category: "geofence",
      message: `Geofence monitoring enabled - GPS activation command sent`,
      metadata: { commandId: command.id, deviceId }
    });

    console.log(`Geofence monitoring enabled for device ${deviceId} - Command ${command.id} created`);
  } catch (error) {
    console.error("Error enabling geofence monitoring:", error);
  }
}

async function disableGeofenceMonitoring(deviceUuid: string, deviceId: string) {
  try {
    // Verifica se ci sono ancora geofence attive
    const activeGeofences = await storage.getGeofencesByDevice(deviceUuid);
    
    if (activeGeofences.length === 0) {
      // Nessuna geofence attiva, disattiva GPS
      const command = await storage.createDeviceCommand({
        deviceId: deviceUuid,
        commandType: "disable_geofence_monitoring",
        commandData: { 
          reason: "no_active_geofences"
        },
        status: "pending"
      });

      await storage.addSystemLog({
        deviceId: deviceUuid,
        level: "info", 
        category: "geofence",
        message: `Geofence monitoring disabled - no active geofences`,
        metadata: { commandId: command.id, deviceId }
      });

      console.log(`Geofence monitoring disabled for device ${deviceId} - Command ${command.id} created`);
    }
  } catch (error) {
    console.error("Error disabling geofence monitoring:", error);
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication first
  await setupAuth(app);
  
  app.use(router);
  
  const server = new Server(app);
  return server;
}