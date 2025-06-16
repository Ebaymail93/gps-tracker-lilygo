import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Expand, Layers, Crosshair, MapIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DeviceLocation } from "@shared/schema";

interface MapComponentProps {
  deviceId: number;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function MapComponent({ deviceId }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const { data: gpsPoints, isLoading, error } = useQuery<GpsPoint[]>({
    queryKey: [`/api/devices/${deviceId}/gps-points`],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const latestPoint = gpsPoints?.[0];



  useEffect(() => {
    if (typeof window !== "undefined" && window.L && mapRef.current && !mapInstanceRef.current) {
      // Initialize map
      const map = window.L.map(mapRef.current).setView([45.4642, 9.1900], 13);

      // Add tile layer
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setIsMapLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isMapLoaded && mapInstanceRef.current && latestPoint && latestPoint.latitude && latestPoint.longitude) {
      const { latitude, longitude } = latestPoint;
      
      // Remove existing marker
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
      }

      // Create custom icon
      const customIcon = window.L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="w-6 h-6 bg-orange-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
            <div class="w-2 h-2 bg-white rounded-full"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Add new marker
      const marker = window.L.marker([latitude, longitude], { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold mb-1 text-gray-900">Posizione Attuale</h3>
            <p class="text-sm text-gray-600">Lat: ${latitude.toFixed(6)}</p>
            <p class="text-sm text-gray-600">Lng: ${longitude.toFixed(6)}</p>
            <p class="text-xs text-gray-500 mt-1">${new Date(latestPoint.timestamp).toLocaleString('it-IT')}</p>
          </div>
        `);

      markerRef.current = marker;
      
      // Center map on new position
      mapInstanceRef.current.setView([latitude, longitude], 15);
    }
  }, [isMapLoaded, latestPoint]);

  const centerMap = () => {
    if (mapInstanceRef.current && latestPoint) {
      mapInstanceRef.current.setView([latestPoint.latitude, latestPoint.longitude], 15);
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
    return (
      <Card className="bg-gps-surface border-gray-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Mappa Tempo Reale</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-64 sm:h-80 lg:h-96 relative bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gps-primary rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <MapIcon className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-600">Caricamento mappa...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gps-surface border-gray-200 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Mappa Tempo Reale</CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="p-2 hover:bg-gray-100">
            <Expand className="w-4 h-4 text-gray-500" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2 hover:bg-gray-100">
            <Layers className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-64 sm:h-80 lg:h-96 relative">
          <div ref={mapRef} className="w-full h-full" />
          
          {/* Map Controls */}
          <div className="absolute top-4 left-4 space-y-2 z-[1000]">
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 p-0 bg-white text-gray-800 hover:bg-gray-100"
              onClick={zoomIn}
            >
              +
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 p-0 bg-white text-gray-800 hover:bg-gray-100"
              onClick={zoomOut}
            >
              -
            </Button>
          </div>
          
          <div className="absolute bottom-4 right-4 z-[1000]">
            <Button
              size="sm"
              onClick={centerMap}
              className="bg-gps-primary hover:bg-blue-700 text-white"
              disabled={!latestPoint}
            >
              <Crosshair className="w-4 h-4 mr-2" />
              Centra
            </Button>
          </div>

          {!latestPoint && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-gps-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapIcon className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-600">Nessuna posizione disponibile</p>
                <p className="text-sm text-gray-500">Attiva la modalità smarrito per iniziare il tracking</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
