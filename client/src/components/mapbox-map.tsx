import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import mapboxgl from "mapbox-gl";
import { type DeviceLocation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, Minus, Navigation } from "lucide-react";

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

// Debug token availability
console.log('Mapbox token available:', !!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);

interface MapboxMapProps {
  deviceId: string;
  onGeofenceSelect?: (lat: number, lng: number) => void;
  isSelectingGeofence?: boolean;
  geofenceRadius?: number;
}

export default function MapboxMap({ 
  deviceId, 
  onGeofenceSelect, 
  isSelectingGeofence = false, 
  geofenceRadius = 100 
}: MapboxMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const geofenceMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedGeofencePoint, setSelectedGeofencePoint] = useState<{lat: number, lng: number} | null>(null);

  const { data: deviceLocations, isLoading } = useQuery<DeviceLocation[]>({
    queryKey: [`/api/devices/${deviceId}/history`],
    refetchInterval: 10000,
  });

  const latestPoint = deviceLocations?.[0];

  // Convert meters to pixels at given latitude and zoom level
  const metersToPixels = (meters: number, latitude: number, zoom: number): number => {
    const earthCircumference = 40075017; // Earth's circumference in meters
    const latitudeRadians = latitude * (Math.PI / 180);
    const metersPerPixel = earthCircumference * Math.cos(latitudeRadians) / Math.pow(2, zoom + 8);
    return meters / metersPerPixel;
  };

  // Function to update geofence circle visualization
  const updateGeofenceCircle = (map: mapboxgl.Map, lat: number, lng: number, radiusMeters: number) => {
    const zoom = map.getZoom();
    const radiusPixels = metersToPixels(radiusMeters, lat, zoom);
    
    const source = map.getSource('geofence-circle') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });
      
      map.setPaintProperty('geofence-circle-fill', 'circle-radius', radiusPixels);
    }

    // Add or update geofence center marker
    if (geofenceMarkerRef.current) {
      geofenceMarkerRef.current.remove();
    }

    const markerElement = document.createElement('div');
    markerElement.className = 'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg';
    
    const marker = new mapboxgl.Marker(markerElement)
      .setLngLat([lng, lat])
      .addTo(map);

    geofenceMarkerRef.current = marker;
  };

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    if (!mapboxgl.accessToken) {
      setMapError('Token di accesso Mapbox non configurato');
      return;
    }

    try {
      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [9.1900, 45.4642], // Milan coordinates
        zoom: 15,
      });

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Errore nel caricamento della mappa');
      });

      map.on('load', () => {
        setIsMapLoaded(true);
        
        // Add controls
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add GPS track source
        map.addSource('gps-track', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });

        // Add GPS track line
        map.addLayer({
          id: 'gps-track-line',
          type: 'line',
          source: 'gps-track',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ff6b35',
            'line-width': 4,
            'line-opacity': 0.8
          }
        });

        // Add geofence circle source and layer
        map.addSource('geofence-circle', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            }
          }
        });

        map.addLayer({
          id: 'geofence-circle-fill',
          type: 'circle',
          source: 'geofence-circle',
          paint: {
            'circle-radius': 0,
            'circle-color': '#3b82f6',
            'circle-opacity': 0.1,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#3b82f6',
            'circle-stroke-opacity': 0.8
          }
        });
      });

      // Add click handler for geofence selection
      if (isSelectingGeofence) {
        map.getCanvas().style.cursor = 'crosshair';
        
        map.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          setSelectedGeofencePoint({ lat, lng });
          
          if (onGeofenceSelect) {
            onGeofenceSelect(lat, lng);
          }
          
          // Update geofence circle
          updateGeofenceCircle(map, lat, lng, geofenceRadius);
        });
      } else {
        map.getCanvas().style.cursor = '';
      }

      // Add zoom handler to update geofence circle radius
      map.on('zoom', () => {
        if (selectedGeofencePoint && isSelectingGeofence) {
          updateGeofenceCircle(map, selectedGeofencePoint.lat, selectedGeofencePoint.lng, geofenceRadius);
        }
      });

      mapInstanceRef.current = map;
    } catch (error) {
      console.error('Failed to initialize Mapbox:', error);
      setMapError('Errore nell\'inizializzazione della mappa');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isSelectingGeofence, onGeofenceSelect, geofenceRadius]);

  // Update marker and track when GPS data changes
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current || !deviceLocations?.length) return;

    const map = mapInstanceRef.current;
    
    // Update GPS track with all points
    const coordinates = deviceLocations
      .slice()
      .reverse()
      .map((point: DeviceLocation) => [parseFloat(point.longitude), parseFloat(point.latitude)]);

    const source = map.getSource('gps-track') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      });
    }

    // Update marker for latest position
    if (latestPoint) {
      const latitude = parseFloat(latestPoint.latitude);
      const longitude = parseFloat(latestPoint.longitude);
      
      // Remove existing marker
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Create custom marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'w-8 h-8 bg-orange-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse';
      markerElement.innerHTML = '<div class="w-2 h-2 bg-white rounded-full"></div>';

      // Create popup
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        closeButton: false,
        closeOnClick: false
      }).setHTML(`
        <div class="p-3">
          <h3 class="font-semibold mb-2">Posizione Attuale</h3>
          <div class="space-y-1 text-sm">
            <p><span class="font-medium">Lat:</span> ${latitude.toFixed(6)}</p>
            <p><span class="font-medium">Lng:</span> ${longitude.toFixed(6)}</p>
            <p><span class="font-medium">Velocità:</span> ${parseFloat(latestPoint.speed || '0').toFixed(1)} km/h</p>
            <p class="text-gray-500 text-xs mt-2">
              ${new Date(latestPoint.timestamp || latestPoint.createdAt).toLocaleString('it-IT')}
            </p>
          </div>
        </div>
      `);

      // Create and add marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map);

      markerRef.current = marker;

      // Center map on new position
      map.easeTo({
        center: [longitude, latitude],
        zoom: 17,
        duration: 1500
      });
    }
  }, [isMapLoaded, deviceLocations, latestPoint]);

  const centerOnDevice = () => {
    if (mapInstanceRef.current && latestPoint) {
      mapInstanceRef.current.easeTo({
        center: [parseFloat(latestPoint.longitude), parseFloat(latestPoint.latitude)],
        zoom: 17,
        duration: 1000
      });
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

  if (mapError) {
    return (
      <div className="w-full h-full bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
        <div className="text-center p-6">
          <div className="text-red-500 mb-2">
            <MapPin className="h-8 w-8 mx-auto" />
          </div>
          <p className="text-red-700 font-medium">{mapError}</p>
          <p className="text-red-600 text-sm mt-1">Controlla la configurazione Mapbox</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Caricamento mappa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg overflow-hidden shadow-lg"
        style={{ minHeight: '400px' }}
      />
      
      {/* Custom controls overlay */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <Button
          onClick={centerOnDevice}
          size="sm"
          className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-md"
          disabled={!latestPoint}
        >
          <Navigation className="h-4 w-4 mr-1" />
          Centra
        </Button>
        
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
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-orange-500" />
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
    </div>
  );
}