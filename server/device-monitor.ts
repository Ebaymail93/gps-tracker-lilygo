import { storage } from "./storage";

class DeviceMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minuti in millisecondi
  private readonly CHECK_INTERVAL = 60 * 1000; // Controlla ogni minuto

  start() {
    if (this.intervalId) {
      this.stop();
    }

    console.log("Starting device monitor...");
    this.intervalId = setInterval(() => {
      this.checkDevicesStatus();
    }, this.CHECK_INTERVAL);

    // Esegui subito il primo controllo
    this.checkDevicesStatus();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Device monitor stopped");
    }
  }

  private async checkDevicesStatus() {
    try {
      const devices = await storage.getAllDevices();
      const now = new Date();

      for (const device of devices) {
        if (!device.lastSeen) {
          // Dispositivo mai visto, mantieni stato attuale
          continue;
        }

        const lastSeenTime = new Date(device.lastSeen).getTime();
        const timeSinceLastSeen = now.getTime() - lastSeenTime;

        // Se il dispositivo non invia heartbeat da più di HEARTBEAT_TIMEOUT
        if (timeSinceLastSeen > this.HEARTBEAT_TIMEOUT) {
          if (device.status !== "offline") {
            console.log(`Device ${device.deviceId} is now offline (last seen: ${device.lastSeen})`);
            
            await storage.updateDevice(device.id, {
              status: "offline",
              isActive: false
            });

            // Aggiungi log di sistema
            await storage.addSystemLog({
              deviceId: device.id,
              level: "warning",
              category: "system",
              message: `Device ${device.deviceName || device.deviceId} went offline - no heartbeat for ${Math.round(timeSinceLastSeen / 1000 / 60)} minutes`
            });
          }
        } else {
          // Dispositivo attivo, assicurati che sia marcato come online
          if (device.status === "offline" && device.isActive === false) {
            console.log(`Device ${device.deviceId} is back online`);
            
            await storage.updateDevice(device.id, {
              status: "online",
              isActive: true
            });

            await storage.addSystemLog({
              deviceId: device.id,
              level: "info",
              category: "system",
              message: `Device ${device.deviceName || device.deviceId} is back online`
            });
          }
        }
      }
    } catch (error) {
      console.error("Error checking devices status:", error);
    }
  }

  // Metodo per aggiornare manualmente lo stato di un dispositivo quando riceve dati
  async updateDeviceActivity(deviceId: string) {
    try {
      const device = await storage.getDeviceByDeviceId(deviceId);
      if (!device) return;

      // Se il dispositivo era offline, marcalo come online
      if (device.status === "offline" || !device.isActive) {
        await storage.updateDevice(device.id, {
          status: "online",
          isActive: true,
          lastSeen: new Date()
        });

        await storage.addSystemLog({
          deviceId: device.id,
          level: "info",
          category: "system",
          message: `Device ${device.deviceName || device.deviceId} reconnected`
        });

        console.log(`Device ${deviceId} marked as online after receiving data`);
      } else {
        // Aggiorna solo il lastSeen
        await storage.updateDevice(device.id, {
          lastSeen: new Date()
        });
      }
    } catch (error) {
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

export const deviceMonitor = new DeviceMonitor();