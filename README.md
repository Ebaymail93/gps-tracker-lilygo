# GPS Tracker System - Raspberry Pi

Sistema di tracking GPS completo per dispositivi LilyGO TTGO T-SIM7000G con deployment autonomo su Raspberry Pi 4.

## 🚀 Quick Start

### 1. Deployment su Raspberry Pi
```bash
# Clona il repository sul Raspberry Pi
git clone <repository-url> gps-tracker
cd gps-tracker

# Esegui deployment automatico
./scripts/deploy-raspberry.sh
```

### 2. Accesso al Sistema
- **Web Interface**: `https://raspberry-ip`
- **API Dispositivi**: `https://raspberry-ip/api/`
- **Health Check**: `https://raspberry-ip/api/health`

## 📚 Documentazione

### Per Amministratori Sistema
- **DEPLOYMENT_SUMMARY.md** - Guida completa deployment e gestione

### Per Sviluppatori Arduino
- **DEVICE_API_DOCUMENTATION.md** - Reference API complete per dispositivi

### Configurazione
- **.env.raspberry.example** - Template configurazione environment

## 🏗️ Architettura

```
Raspberry Pi 4
├── Docker Compose Stack
│   ├── GPS Tracker App (Node.js + React)
│   ├── PostgreSQL Database
│   └── Nginx Reverse Proxy
├── SSL Certificates (auto-generated)
├── Persistent Volumes
│   ├── Database Data
│   ├── Application Logs
│   └── Backup Files
└── Network Bridge (isolated)
```

## 🔧 Gestione Servizi

```bash
# Avvia servizi
docker-compose -f docker-compose.raspberry.yml --env-file .env.raspberry up -d

# Visualizza logs
docker-compose -f docker-compose.raspberry.yml --env-file .env.raspberry logs -f

# Aggiorna applicazione
git pull && docker-compose -f docker-compose.raspberry.yml --env-file .env.raspberry up -d --build

# Backup database
npm run backup
```

## 📱 Integrazione Dispositivi Arduino

### Flusso Base
```cpp
1. GET /api/ping → Test connettività
2. GET /api/device/{MAC}/exists → Verifica registrazione
3. POST /api/device/register → Registrazione dispositivo
4. GET /api/device/{MAC}/config → Download configurazione

Loop Operativo:
- POST /api/device/{MAC}/heartbeat (ogni 5 minuti)
- GET /api/device/{MAC}/commands (ogni 30 secondi)
- POST /api/device/{MAC}/location (eventi GPS)
- POST /api/device/{MAC}/commands/{ID}/ack (conferma comandi)
```

## ✨ Caratteristiche

- **Auto-registrazione** dispositivi via MAC address
- **Tracking real-time** ottimizzato per batteria
- **Sistema comandi** bidirezionale con acknowledgment
- **Configurazioni dinamiche** con override automatico
- **Geofencing automatico** server-side
- **Web interface** completa per gestione
- **Deploy autonomo** senza dipendenze cloud

## 🔒 Security

- HTTPS con certificati auto-generati
- Autenticazione session-based per web interface
- API dispositivi senza autenticazione (network isolation)
- Firewall e security headers configurati

## 📊 Monitoring

- Health check endpoint
- System logs centralizzati
- Database backup automatico
- Resource monitoring integrato

---

**Versione**: 1.0.0  
**Ambiente Target**: Raspberry Pi 4 + Docker  
**Dispositivi Supportati**: LilyGO TTGO T-SIM7000G