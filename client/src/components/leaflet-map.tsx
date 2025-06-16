import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus, Minus, Navigation, Crosshair } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DeviceLocation } from "@shared/schema";

declare global {
  interface Window {
    L: any;
  }
}

interface LeafletMapProps {
  deviceId: string;
  onGeofenceSelect?: (lat: number, lng: number) => void;
  isSelectingGeofence?: boolean;
  geofenceRadius?: number;
  showCard?: boolean;
}

export default function LeafletMap({ 
  deviceId, 
  onGeofenceSelect, 
  isSelectingGeofence = false, 
  geofenceRadius = 100,
  showCard = true
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geofenceMarkerRef = useRef<any>(null);
  const geofenceCircleRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const { data: deviceLocations, isLoading } = useQuery<DeviceLocation[]>({
    queryKey: [`/api/devices/${deviceId}/history`],
    refetchInterval: 30000,
  });

  const latestPoint = deviceLocations?.[0];

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Load Leaflet dynamically
    if (typeof window !== "undefined" && !window.L) {
      const leafletScript = document.createElement('script');
      leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      leafletScript.onload = initializeMap;
      document.head.appendChild(leafletScript);

      const leafletCss = document.createElement('link');
      leafletCss.rel = 'stylesheet';
      leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(leafletCss);
    } else if (window.L) {
      initializeMap();
    }

    function initializeMap() {
      if (!mapRef.current || mapInstanceRef.current) return;

      try {
        const map = window.L.map(mapRef.current).setView([45.4642, 9.1900], 13);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
        setIsMapLoaded(true);

        // Handle geofence selection
        if (isSelectingGeofence && onGeofenceSelect) {
          map.on('click', function(e: any) {
            const { lat, lng } = e.latlng;
            onGeofenceSelect(lat, lng);
            
            // Remove existing geofence marker
            if (geofenceMarkerRef.current) {
              map.removeLayer(geofenceMarkerRef.current);
            }
            if (geofenceCircleRef.current) {
              map.removeLayer(geofenceCircleRef.current);
            }

            // Add new geofence marker
            const marker = window.L.marker([lat, lng], {
              icon: window.L.divIcon({
                className: 'custom-geofence-marker',
                html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
              })
            }).addTo(map);

            // Add geofence circle
            const circle = window.L.circle([lat, lng], {
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              radius: geofenceRadius
            }).addTo(map);

            geofenceMarkerRef.current = marker;
            geofenceCircleRef.current = circle;
          });
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    }
  }, [isSelectingGeofence, onGeofenceSelect, geofenceRadius]);

  // Update marker when GPS data changes
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current || !latestPoint) return;

    const map = mapInstanceRef.current;
    const latitude = parseFloat(latestPoint.latitude);
    const longitude = parseFloat(latestPoint.longitude);

    if (isNaN(latitude) || isNaN(longitude)) return;

    // Remove existing marker
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    // Create custom GPS marker
    const gpsIcon = window.L.divIcon({
      className: 'custom-gps-marker',
      html: '<div style="background: #ff6b35; width: 20px; height: 20px; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = window.L.marker([latitude, longitude], { icon: gpsIcon })
      .addTo(map)
      .bindPopup(`
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 8px 0; font-weight: 600;">Posizione Attuale</h3>
          <p style="margin: 2px 0; font-size: 14px;"><strong>Lat:</strong> ${latitude.toFixed(6)}</p>
          <p style="margin: 2px 0; font-size: 14px;"><strong>Lng:</strong> ${longitude.toFixed(6)}</p>
          <p style="margin: 2px 0; font-size: 14px;"><strong>Velocità:</strong> ${parseFloat(latestPoint.speed || '0').toFixed(1)} km/h</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
            ${new Date(latestPoint.timestamp || latestPoint.createdAt).toLocaleString('it-IT')}
          </p>
        </div>
      `);

    markerRef.current = marker;

    // Center map on device if not selecting geofence
    if (!isSelectingGeofence) {
      map.setView([latitude, longitude], 15);
    }

    // Add CSS for pulsing animation
    if (!document.getElementById('leaflet-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-styles';
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }, [isMapLoaded, latestPoint, isSelectingGeofence]);

  const centerOnDevice = () => {
    if (mapInstanceRef.current && latestPoint) {
      mapInstanceRef.current.setView([
        parseFloat(latestPoint.latitude), 
        parseFloat(latestPoint.longitude)
      ], 17);
    }
  };

  const zoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  if (isLoading) {
    const loadingContent = (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600">Caricamento mappa...</p>
        </div>
      </div>
    );

    return showCard ? (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Mappa GPS Tempo Reale
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-64 sm:h-80 lg:h-96">
            {loadingContent}
          </div>
        </CardContent>
      </Card>
    ) : (
      <div className="h-full w-full">
        {loadingContent}
      </div>
    );
  }

  const mapContent = (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ minHeight: isSelectingGeofence ? '256px' : '400px' }}
      />
      
      {/* Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-[1000]">
        {!isSelectingGeofence && (
          <Button
            onClick={centerOnDevice}
            size="sm"
            className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-md"
            disabled={!latestPoint}
          >
            <Navigation className="h-4 w-4 mr-1" />
            Centra
          </Button>
        )}
        
        <div className="flex flex-col gap-1">
          <Button
            onClick={zoomIn}
            size="sm"
            className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-md w-8 h-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            onClick={zoomOut}
            size="sm"
            className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-md w-8 h-8 p-0"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* GPS status indicator */}
      {!isSelectingGeofence && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3 z-[1000]">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            <div className="text-sm">
              {latestPoint ? (
                <div>
                  <div className="font-medium text-gray-900">GPS Attivo</div>
                  <div className="text-gray-600 text-xs">
                    {deviceLocations?.length || 0} punti registrati
                  </div>
                </div>
              ) : (
                <div className="text-gray-600">Nessun dato GPS</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Geofence selection hint */}
      {isSelectingGeofence && (
        <div className="absolute top-4 left-4 bg-blue-50 border border-blue-200 rounded-lg shadow-md p-3 z-[1000]">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-blue-600" />
            <div className="text-sm text-blue-700">
              Clicca sulla mappa per selezionare la posizione
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return showCard ? (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          Mappa GPS Tempo Reale
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-64 sm:h-80 lg:h-96">
          {mapContent}
        </div>
      </CardContent>
    </Card>
  ) : (
    <div className="h-full w-full">
      {mapContent}
    </div>
  );
}