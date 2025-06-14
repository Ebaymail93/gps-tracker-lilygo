# GPS Tracker - Guida Deployment Raspberry Pi

## Sistema Completo e Pronto

Il sistema GPS Tracker è completamente sviluppato e testato per il deployment su Raspberry Pi 4.

### 🚀 Deployment One-Command

```bash
git clone <repository-url>
cd gps-tracker
chmod +x scripts/deploy-raspberry.sh
./scripts/deploy-raspberry.sh
```

### 📋 Cosa Include

**Backend Completo:**
- API RESTful per dispositivi LilyGO TTGO T-SIM7000G
- Database PostgreSQL con schema completo
- Sistema di monitoraggio dispositivi real-time
- Gestione comandi bidirezionale
- Geofencing con alert automatici
- Sistema di configurazione avanzato

**Frontend Web:**
- Dashboard moderna React + TypeScript
- Mappe interattive con tracking real-time
- Gestione dispositivi completa
- Configurazione geofence
- Monitoraggio stato batteria
- Sistema alert e notifiche

**Deployment Production:**
- Docker Compose completo
- SSL/TLS automatico con Certbot
- Database backup automatico
- Log centralizzati
- Health monitoring
- Auto-restart container

### 🔧 File Chiave per Raspberry Pi

- `Dockerfile.raspberry` - Container ottimizzato
- `docker-compose.raspberry.yml` - Stack completo
- `package-raspberry.json` - Dipendenze verificate
- `.env.raspberry` - Configurazione ambiente
- `nginx/` - Configurazione SSL/proxy
- `scripts/deploy-raspberry.sh` - Deployment automatico

### 📡 API LilyGO TTGO T-SIM7000G

**Registrazione Dispositivo:**
```
POST /api/device/register
{
  "deviceId": "TTGO_001",
  "deviceName": "Tracker Auto",
  "firmware": "1.0.0"
}
```

**Invio Posizione GPS:**
```
POST /api/device/{deviceId}/location
{
  "latitude": 45.4642,
  "longitude": 9.1900,
  "altitude": 120,
  "speed": 50,
  "battery": 85
}
```

**Heartbeat:**
```
POST /api/device/{deviceId}/heartbeat
{
  "status": "online",
  "battery": 85,
  "signal": -70
}
```

**Recupero Comandi:**
```
GET /api/device/{deviceId}/commands
```

### 🌐 Accesso Sistema

Dopo il deployment:
- **Web Interface:** `https://[raspberry-pi-ip]`
- **API Base:** `https://[raspberry-pi-ip]/api`
- **Health Check:** `https://[raspberry-pi-ip]/api/health`

### 📊 Funzionalità Complete

**Tracking:**
- Posizione GPS real-time
- Storico tracciamento
- Ottimizzazione batteria
- Gestione offline

**Geofencing:**
- Creazione zone personalizzate
- Alert ingresso/uscita
- Notifiche automatiche
- Monitoring continuo

**Device Management:**
- Auto-registrazione
- Configurazione remota
- Aggiornamenti OTA
- Diagnostics completi

**Sistema:**
- Database PostgreSQL scalabile
- API RESTful complete
- Autenticazione sicura
- Backup automatico

### 💾 Requisiti Sistema

- **Raspberry Pi 4** (2GB+ RAM)
- **SD Card** 32GB+ (Classe 10)
- **Connessione Internet** stabile
- **Docker** installato
- **Porta 80/443** aperta

### 🔒 Sicurezza

- Certificati SSL automatici
- Database criptato
- API key authentication
- Rate limiting
- Input validation completa

Il sistema è production-ready e ottimizzato per uso 24/7 su Raspberry Pi.