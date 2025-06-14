"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceMonitor = void 0;
const storage_1 = require("./storage");
class DeviceMonitor {
    intervalId = null;
    HEARTBEAT_TIMEOUT = 5 * 60 * 1000;
    CHECK_INTERVAL = 60 * 1000;
    start() {
        if (this.intervalId) {
            this.stop();
        }
        console.log("Starting device monitor...");
        this.intervalId = setInterval(() => {
            this.checkDevicesStatus();
        }, this.CHECK_INTERVAL);
        this.checkDevicesStatus();
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("Device monitor stopped");
        }
    }
    async checkDevicesStatus() {
        try {
            const devices = await storage_1.storage.getAllDevices();
            const now = new Date();
            for (const device of devices) {
                if (!device.lastSeen) {
                    continue;
                }
                const lastSeenTime = new Date(device.lastSeen).getTime();
                const timeSinceLastSeen = now.getTime() - lastSeenTime;
                if (timeSinceLastSeen > this.HEARTBEAT_TIMEOUT) {
                    if (device.status !== "offline") {
                        console.log(`Device ${device.deviceId} is now offline (last seen: ${device.lastSeen})`);
                        await storage_1.storage.updateDevice(device.id, {
                            status: "offline",
                            isActive: false
                        });
                        await storage_1.storage.addSystemLog({
                            deviceId: device.id,
                            level: "warning",
                            category: "system",
                            message: `Device ${device.deviceName || device.deviceId} went offline - no heartbeat for ${Math.round(timeSinceLastSeen / 1000 / 60)} minutes`
                        });
                    }
                }
                else {
                    if (device.status === "offline" && device.isActive === false) {
                        console.log(`Device ${device.deviceId} is back online`);
                        await storage_1.storage.updateDevice(device.id, {
                            status: "online",
                            isActive: true
                        });
                        await storage_1.storage.addSystemLog({
                            deviceId: device.id,
                            level: "info",
                            category: "system",
                            message: `Device ${device.deviceName || device.deviceId} is back online`
                        });
                    }
                }
            }
        }
        catch (error) {
            console.error("Error checking devices status:", error);
        }
    }
    async updateDeviceActivity(deviceId) {
        try {
            const device = await storage_1.storage.getDeviceByDeviceId(deviceId);
            if (!device)
                return;
            if (device.status === "offline" || !device.isActive) {
                await storage_1.storage.updateDevice(device.id, {
                    status: "online",
                    isActive: true,
                    lastSeen: new Date()
                });
                await storage_1.storage.addSystemLog({
                    deviceId: device.id,
                    level: "info",
                    category: "system",
                    message: `Device ${device.deviceName || device.deviceId} reconnected`
                });
                console.log(`Device ${deviceId} marked as online after receiving data`);
            }
            else {
                await storage_1.storage.updateDevice(device.id, {
                    lastSeen: new Date()
                });
            }
        }
        catch (error) {
            console.error("Error updating device activity:", error);
        }
    }
    getHeartbeatTimeout() {
        return this.HEARTBEAT_TIMEOUT;
    }
    getCheckInterval() {
        return this.CHECK_INTERVAL;
    }
}
exports.deviceMonitor = new DeviceMonitor();
