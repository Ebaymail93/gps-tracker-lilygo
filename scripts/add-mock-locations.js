#!/usr/bin/env node

// Script per aggiungere posizioni GPS mock per i dispositivi di test
import { Pool } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Posizioni mock per Milano e dintorni
const milanLocations = [
  // Duomo Milano
  { lat: 45.4642, lng: 9.1900, name: "Duomo di Milano" },
  // Castello Sforzesco
  { lat: 45.4706, lng: 9.1797, name: "Castello Sforzesco" },
  // Navigli
  { lat: 45.4520, lng: 9.1740, name: "Navigli" },
  // Porta Garibaldi
  { lat: 45.4850, lng: 9.1889, name: "Porta Garibaldi" },
  // Brera
  { lat: 45.4719, lng: 9.1881, name: "Brera" },
  // Stazione Centrale
  { lat: 45.4862, lng: 9.2051, name: "Stazione Centrale" },
  // Isola
  { lat: 45.4822, lng: 9.1889, name: "Isola" },
  // Città Studi
  { lat: 45.4784, lng: 9.2336, name: "Città Studi" },
];

// Posizioni mock per Bergamo
const bergamoLocations = [
  // Città Alta
  { lat: 45.7044, lng: 9.6692, name: "Città Alta Bergamo" },
  // Stazione Bergamo
  { lat: 45.6906, lng: 9.6719, name: "Stazione Bergamo" },
  // Aeroporto Orio
  { lat: 45.6739, lng: 9.7042, name: "Aeroporto Orio al Serio" },
  // Dalmine
  { lat: 45.7411, lng: 9.6158, name: "Dalmine" },
  // Treviglio
  { lat: 45.5211, lng: 9.5892, name: "Treviglio" },
];

async function addMockLocations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Aggiunta posizioni mock per i dispositivi...');
    
    // Trova i dispositivi esistenti
    const devicesResult = await client.query(
      'SELECT device_id FROM devices ORDER BY created_at LIMIT 2'
    );
    
    if (devicesResult.rows.length === 0) {
      console.log('❌ Nessun dispositivo trovato. Prima registra dei dispositivi.');
      return;
    }
    
    const devices = devicesResult.rows;
    console.log(`📱 Trovati ${devices.length} dispositivi:`);
    devices.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.device_id}`);
    });
    
    // Aggiungi posizioni per il primo dispositivo (Milano)
    if (devices[0]) {
      console.log(`\n📍 Aggiunta posizioni Milano per ${devices[0].device_id}...`);
      
      for (let i = 0; i < milanLocations.length; i++) {
        const location = milanLocations[i];
        const timestamp = new Date(Date.now() - (milanLocations.length - i - 1) * 10 * 60 * 1000); // 10 minuti di differenza
        
        await client.query(`
          INSERT INTO device_locations (device_id, latitude, longitude, altitude, speed, heading, accuracy, timestamp, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          devices[0].device_id,
          location.lat,
          location.lng,
          Math.floor(Math.random() * 50) + 100, // altitudine random 100-150m
          Math.floor(Math.random() * 30), // velocità random 0-30 km/h
          Math.floor(Math.random() * 360), // direzione random
          Math.floor(Math.random() * 10) + 5, // accuratezza 5-15m
          timestamp,
          timestamp
        ]);
        
        console.log(`   ✅ ${location.name}: ${location.lat}, ${location.lng}`);
      }
    }
    
    // Aggiungi posizioni per il secondo dispositivo (Bergamo) se esiste
    if (devices[1]) {
      console.log(`\n📍 Aggiunta posizioni Bergamo per ${devices[1].device_id}...`);
      
      for (let i = 0; i < bergamoLocations.length; i++) {
        const location = bergamoLocations[i];
        const timestamp = new Date(Date.now() - (bergamoLocations.length - i - 1) * 15 * 60 * 1000); // 15 minuti di differenza
        
        await client.query(`
          INSERT INTO device_locations (device_id, latitude, longitude, altitude, speed, heading, accuracy, timestamp, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          devices[1].device_id,
          location.lat,
          location.lng,
          Math.floor(Math.random() * 100) + 200, // altitudine random 200-300m
          Math.floor(Math.random() * 50), // velocità random 0-50 km/h
          Math.floor(Math.random() * 360), // direzione random
          Math.floor(Math.random() * 10) + 5, // accuratezza 5-15m
          timestamp,
          timestamp
        ]);
        
        console.log(`   ✅ ${location.name}: ${location.lat}, ${location.lng}`);
      }
    }
    
    // Aggiorna i dispositivi come online con l'ultima posizione più recente
    await client.query(`
      UPDATE devices 
      SET status = 'online', last_seen = NOW()
      WHERE device_id IN (${devices.map((_, i) => `$${i + 1}`).join(', ')})
    `, devices.map(d => d.device_id));
    
    console.log('\n✅ Posizioni mock aggiunte con successo!');
    console.log('🗺️  Ora puoi vedere le posizioni reali sulla dashboard');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta delle posizioni mock:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui lo script
addMockLocations().catch(console.error);