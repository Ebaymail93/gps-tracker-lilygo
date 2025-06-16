# Configurazione Porta - GPS Tracker

## File Aggiornati per Porta 3000

### 1. `.env.raspberry`
```
PORT=3000
```

### 2. `docker-compose.raspberry.yml`
```yaml
services:
  gps-tracker:
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
```

### 3. `scripts/deploy-raspberry.sh`
```bash
PORT=3000
```

### 4. `Dockerfile.raspberry`
```dockerfile
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK CMD curl -f http://localhost:3000/api/health
```

## Risolto Problema Dipendenze

Il Dockerfile ora:
- Usa package.json originale invece di package-raspberry.json
- Installa dipendenze di produzione in directory separata
- Copia solo node_modules necessari per runtime
- Risolve errore "Cannot find package 'zod'"

## Deployment

Esegui semplicemente:
```bash
./scripts/deploy-raspberry.sh
```

L'applicazione sarà disponibile su porta 3000 con tutte le dipendenze correttamente installate.