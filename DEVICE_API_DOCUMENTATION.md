# GPS Tracker Device API Documentation

## Base URL
```
https://your-raspberry-ip
```

## Authentication
Nessuna autenticazione richiesta per le API dispositivo. Le API web richiedono autenticazione utente.

---

## 🔄 Device Lifecycle APIs

### 1. Test Connectivity
**Endpoint:** `GET /api/ping`
**Purpose:** Verifica connettività server
**Response:**
```json
{
  "message": "pong",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Check Device Registration
**Endpoint:** `GET /api/device/:deviceId/exists`
**Purpose:** Verifica se dispositivo è registrato
**Response:**
```json
{
  "exists": true,
  "deviceId": "LILYGO_MAC_ADDRESS"
}
```

### 3. Register Device
**Endpoint:** `POST /api/device/register`
**Purpose:** Registra nuovo dispositivo
**Body:**
```json
{
  "deviceId": "LILYGO_MAC_ADDRESS",
  "name": "GPS Tracker 001",
  "type": "GPS_TRACKER",
  "model": "LILYGO TTGO T-SIM7000G",
  "version": "1.0.0"
}
```
**Response:**
```json
{
  "success": true,
  "device": {
    "id": "uuid",
    "deviceId": "LILYGO_MAC_ADDRESS",
    "name": "GPS Tracker 001",
    "isOnline": true
  }
}
```

---

## ⚙️ Configuration APIs

### 4. Get Device Configuration
**Endpoint:** `GET /api/device/:deviceId/config`
**Purpose:** Scarica configurazione operativa
**Response:**
```json
{
  "config": {
    "gps_interval": 10000,
    "heartbeat_interval": 30000,
    "lost_mode_interval": 15000,
    "low_battery_threshold": 15,
    "gpsUpdateInterval": 30,
    "gpsAccuracyThreshold": 10,
    "minSatellites": 4,
    "powerSaveMode": false,
    "sleepInterval": 1000,
    "batteryThreshold": 10,
    "heartbeatInterval": 300000,
    "commandPollInterval": 30000,
    "networkTimeout": 10000,
    "geofenceEnabled": true,
    "geofenceRadius": 100,
    "lostModeGpsInterval": 15000,
    "lostModeHeartbeat": 30000,
    "debugMode": false,
    "logLevel": "INFO",
    "serialBaudRate": 115200
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 📍 Location Tracking APIs

### 5. Send Location Data
**Endpoint:** `POST /api/device/:deviceId/location`
**Purpose:** Invia coordinate GPS
**Body:**
```json
{
  "latitude": 45.464211,
  "longitude": 9.191383,
  "altitude": 120.5,
  "accuracy": 5.2,
  "speed": 0,
  "heading": 0,
  "satellites": 8,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```
**Response:**
```json
{
  "success": true,
  "id": "location-uuid",
  "geofenceAlerts": []
}
```

---

## 💓 Heartbeat & Status APIs

### 6. Send Heartbeat
**Endpoint:** `POST /api/device/:deviceId/heartbeat`
**Purpose:** Notifica stato dispositivo (senza GPS)
**Body:**
```json
{
  "batteryLevel": 85,
  "signalStrength": -67,
  "status": "online",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```
**Response:**
```json
{
  "success": true,
  "config": {
    "gps_interval": 10000,
    "heartbeat_interval": 30000
  }
}
```

---

## 🎯 Command System APIs

### 7. Get Pending Commands
**Endpoint:** `GET /api/device/:deviceId/commands`
**Purpose:** Recupera comandi da eseguire
**Response:**
```json
[
  {
    "id": "command-uuid",
    "commandType": "get_location",
    "commandData": null,
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "command-uuid-2",
    "commandType": "update_config",
    "commandData": {
      "gps_interval": 5000,
      "powerSaveMode": true
    },
    "status": "pending",
    "createdAt": "2024-01-15T10:31:00.000Z"
  }
]
```

### 8. Acknowledge Command
**Endpoint:** `POST /api/device/:deviceId/commands/:commandId/ack`
**Purpose:** Conferma esecuzione comando
**Body:**
```json
{
  "status": "executed"
}
```
**Response:**
```json
{
  "success": true,
  "config": {
    "gps_interval": 5000,
    "heartbeat_interval": 30000
  },
  "timestamp": "2024-01-15T10:32:00.000Z"
}
```

---

## 📋 Command Types

### Available Commands:
- **`get_location`** - Richiede posizione GPS immediata
- **`enable_lost_mode`** - Attiva modalità smarrimento (GPS continuo)
- **`disable_lost_mode`** - Disattiva modalità smarrimento
- **`update_config`** - Aggiorna configurazione operativa
- **`reboot`** - Riavvia dispositivo
- **`enable_geofence_monitoring`** - Attiva monitoraggio geofence
- **`disable_geofence_monitoring`** - Disattiva monitoraggio geofence

### Command Status Values:
- **`pending`** - In attesa di esecuzione
- **`sent`** - Inviato al dispositivo
- **`acknowledged`** - Ricevuto dal dispositivo
- **`executed`** - Eseguito con successo
- **`failed`** - Esecuzione fallita
- **`expired`** - Comando scaduto

---

## 🛡️ Error Handling

### Standard Error Response:
```json
{
  "error": "Device not found",
  "code": 404,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Common HTTP Status Codes:
- **200** - Success
- **201** - Created
- **400** - Bad Request (validation error)
- **404** - Device/Resource not found
- **500** - Internal server error

---

## 🚀 Device Implementation Flow

### Startup Sequence:
```
1. GET /api/ping                     → Test connectivity
2. GET /api/device/{MAC}/exists      → Check registration
3. POST /api/device/register         → Register if needed
4. GET /api/device/{MAC}/config      → Download config
```

### Normal Operation Loop:
```
Every 5 minutes:
  POST /api/device/{MAC}/heartbeat   → Send status (no GPS)

Every 30 seconds:
  GET /api/device/{MAC}/commands     → Check for commands
  
On command execution:
  POST /api/device/{MAC}/commands/{ID}/ack → Acknowledge + get updated config
  
On GPS events:
  POST /api/device/{MAC}/location    → Send coordinates
```

### Power Management:
- **Normal Mode**: GPS OFF, heartbeat ogni 5 min, check comandi ogni 30s
- **Get Location**: GPS ON → send location → GPS OFF
- **Lost Mode**: GPS ON continuo, location ogni 15s
- **Power Save**: Intervalli estesi, GPS solo su comando

---

## 📊 Configuration Parameters

### GPS Settings:
- `gpsUpdateInterval`: Intervallo aggiornamento GPS (secondi)
- `gpsAccuracyThreshold`: Soglia accuratezza GPS (metri)
- `minSatellites`: Numero minimo satelliti richiesti

### Power Management:
- `powerSaveMode`: Modalità risparmio energetico
- `sleepInterval`: Intervallo sleep tra operazioni (ms)
- `batteryThreshold`: Soglia batteria critica (%)

### Network Settings:
- `heartbeatInterval`: Frequenza heartbeat (ms)
- `commandPollInterval`: Frequenza check comandi (ms)
- `networkTimeout`: Timeout connessioni di rete (ms)

### Geofencing:
- `geofenceEnabled`: Abilitazione monitoraggio geofence
- `geofenceRadius`: Raggio default geofence (metri)

### Lost Mode:
- `lostModeGpsInterval`: Frequenza GPS in modalità smarrimento (ms)
- `lostModeHeartbeat`: Frequenza heartbeat in modalità smarrimento (ms)

### Debug:
- `debugMode`: Modalità debug
- `logLevel`: Livello logging (DEBUG, INFO, WARN, ERROR)
- `serialBaudRate`: Velocità comunicazione seriale