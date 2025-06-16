import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

// Definizione minimale che copre gli endpoint principali
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'GPS Tracker API',
    version: '1.0.0',
    description:
      'API per il sistema GPS Tracker con supporto LilyGO TTGO T-SIM7000G',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
    { url: 'https://your-raspberry-ip', description: 'Production' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/ping': {
      get: {
        tags: ['System'],
        summary: 'Ping test',
        responses: {
          '200': {
            description: 'Pong',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/devices/register': {
      post: {
        tags: ['Devices'],
        summary: 'Registra dispositivo GPS',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceId'],
                properties: {
                  deviceId: {
                    type: 'string',
                    description: 'MAC Address dispositivo',
                  },
                  deviceName: { type: 'string' },
                  deviceType: { type: 'string', default: 'GPS_TRACKER' },
                },
              },
              example: {
                deviceId: 'LILYGO_MAC_ADDRESS',
                deviceName: 'GPS Tracker 001',
              },
            },
          },
        },
        responses: {
          '201': { description: 'Dispositivo registrato' },
          '409': { description: 'Dispositivo già esistente' },
        },
      },
    },
    '/api/devices/{deviceId}/location': {
      post: {
        tags: ['Location'],
        summary: 'Invia coordinate GPS',
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['latitude', 'longitude'],
                properties: {
                  latitude: { type: 'number', format: 'double' },
                  longitude: { type: 'number', format: 'double' },
                  altitude: { type: 'number' },
                  accuracy: { type: 'number' },
                  speed: { type: 'number' },
                  batteryLevel: { type: 'number' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
              example: {
                latitude: 45.464211,
                longitude: 9.191383,
                batteryLevel: 85,
                timestamp: '2024-01-15T10:30:00.000Z',
              },
            },
          },
        },
        responses: {
          '201': { description: 'Posizione salvata' },
          '404': { description: 'Dispositivo non trovato' },
        },
      },
    },
    '/api/devices/{deviceId}/heartbeat': {
      post: {
        tags: ['Devices'],
        summary: 'Invia heartbeat dispositivo',
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  batteryLevel: { type: 'number' },
                  signalStrength: { type: 'integer' },
                  status: {
                    type: 'string',
                    enum: ['online', 'offline', 'low_battery'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Heartbeat ricevuto' },
        },
      },
    },
    '/api/devices/{deviceId}/commands': {
      get: {
        tags: ['Commands'],
        summary: 'Scarica comandi pending',
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Lista comandi',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
      // AGGIUNGI QUESTO POST
      post: {
        tags: ['Commands'],
        summary: 'Invia comando al dispositivo',
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['commandType'],
                properties: {
                  commandType: {
                    type: 'string',
                    enum: [
                      'update_config',
                      'enable_lost_mode',
                      'disable_lost_mode',
                      'get_location',
                      'reboot',
                    ],
                    description: 'Tipo di comando da eseguire',
                  },
                  commandData: {
                    type: 'object',
                    description:
                      'Dati specifici del comando (es. nuova configurazione)',
                  },
                },
              },
              example: {
                commandType: 'update_config',
                commandData: {
                  gps_interval: 15000,
                  heartbeat_interval: 45000,
                  low_battery_threshold: 20,
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Comando creato e inviato' },
          '404': { description: 'Dispositivo non trovato' },
          '400': { description: 'Comando non valido' },
        },
      },
    },
    '/api/devices/{deviceId}/config': {
      get: {
        tags: ['Configuration'],
        summary: 'Scarica configurazione dispositivo',
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Configurazione dispositivo' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login utente web',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
  },
  tags: [
    { name: 'System', description: 'Sistema e health check' },
    { name: 'Devices', description: 'Gestione dispositivi' },
    { name: 'Location', description: 'Tracking GPS' },
    { name: 'Commands', description: 'Comandi remoti' },
    { name: 'Configuration', description: 'Configurazione' },
    { name: 'Authentication', description: 'Autenticazione web' },
  ],
};

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'GPS Tracker API',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
      },
    })
  );

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  console.log('📚 Swagger UI: http://localhost:3000/api-docs');
  console.log('📄 OpenAPI spec: http://localhost:3000/api-docs.json');
};
