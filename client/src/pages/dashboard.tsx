import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Satellite, Settings, Wifi, ChevronDown, Map, History, Command, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StatusDashboard from "@/components/status-dashboard";
import MapboxMap from "@/components/mapbox-map";
import TraceHistory from "@/components/trace-history";
import SystemLogs from "@/components/system-logs";
import GeofenceManager from "@/components/geofence-manager";
import DeviceCommands from "@/components/device-commands";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Device, DeviceLocation } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'history' | 'settings'>('dashboard');

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  // Auto-select first device if only one exists, otherwise use selected
  const device = devices?.length === 1 
    ? devices[0] 
    : devices?.find(d => d.deviceId === selectedDeviceId) || devices?.[0];

  // Fetch latest GPS location for the selected device
  // Use faster refresh for lost mode devices
  const isLostMode = device?.status === 'lost_mode';
  const { data: deviceLocations } = useQuery<DeviceLocation[]>({
    queryKey: [`/api/devices/${device?.deviceId}/history`],
    enabled: !!device?.deviceId,
    refetchInterval: isLostMode ? 5000 : 30000, // 5 seconds for lost mode, 30 seconds normal
  });

  const latestLocation = deviceLocations?.[0];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gps-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Satellite className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-400">Caricamento dispositivi...</p>
        </div>
      </div>
    );
  }

  // No devices registered
  if (!devices || devices.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gps-background">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Satellite className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Nessun dispositivo registrato
          </h2>
          <p className="text-gray-600 mb-6">
            I dispositivi GPS si registreranno automaticamente quando si
            connettono al server. Assicurati che il tuo dispositivo LilyGO TTGO
            T-SIM7000G sia acceso e configurato correttamente.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>Configurazione dispositivo:</strong>
              <br />
              Server: {window.location.origin}
              <br />
              Porta: 3000
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Multiple devices - need selection
  if (devices.length > 1 && !device) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gps-background">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gps-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Satellite className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Seleziona dispositivo
          </h2>
          <Select onValueChange={setSelectedDeviceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleziona un dispositivo GPS" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id.toString()}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${d.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <div className="font-medium">{d.deviceName || d.deviceId}</div>
                      <div className="text-sm text-gray-500">{d.deviceId}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gps-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Satellite className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-400">Caricamento dispositivo...</p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <StatusDashboard device={device} />
            <div className="mt-8">
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Map className="w-5 h-5 text-blue-500" />
                    Mappa GPS Tempo Reale
                  </h3>
                </div>
                <div className="p-0">
                  <div className="h-64 sm:h-80 lg:h-96 w-full">
                    {latestLocation ? (
                      <iframe
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(latestLocation.longitude) - 0.005},${parseFloat(latestLocation.latitude) - 0.005},${parseFloat(latestLocation.longitude) + 0.005},${parseFloat(latestLocation.latitude) + 0.005}&layer=mapnik&marker=${latestLocation.latitude},${latestLocation.longitude}`}
                        style={{ border: 0, width: '100%', height: '100%' }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <div className="h-full bg-gray-50 flex items-center justify-center">
                        <div className="text-center p-6">
                          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Map className="w-8 h-8 text-white" />
                          </div>
                          <p className="text-gray-600 mb-4">Nessuna posizione GPS disponibile</p>
                          <p className="text-sm text-gray-500 mb-4">
                            {device.deviceId} - {device.status === 'online' ? 'Online' : 'Offline'}
                          </p>
                          <Button
                            onClick={() => setActiveTab('map')}
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            Apri Mappa Completa
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {latestLocation && (
                    <div className="p-4 bg-gray-50 border-t">
                      <div className="flex justify-between items-center text-sm mb-2">
                        <div>
                          <strong>Ultima posizione:</strong> {parseFloat(latestLocation.latitude).toFixed(6)}, {parseFloat(latestLocation.longitude).toFixed(6)}
                        </div>
                        <div className="text-gray-500">
                          {new Date(latestLocation.timestamp || latestLocation.createdAt).toLocaleString('it-IT')}
                        </div>
                      </div>
                      {isLostMode && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-red-700 font-medium">MODALITÀ LOST MODE ATTIVA - Aggiornamenti ogni 5 secondi</span>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('map')}
                        >
                          Mappa Completa
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(
                            `https://www.openstreetmap.org/#map=17/${latestLocation.latitude}/${latestLocation.longitude}`,
                            '_blank'
                          )}
                        >
                          Apri in OpenStreetMap
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              <GeofenceManager deviceId={device.deviceId} />
              <DeviceCommands deviceId={device.deviceId} />
            </div>
            <SystemLogs deviceId={device.deviceId} />
          </>
        );
      case 'map':
        return (
          <div className="mt-6">
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Map className="w-5 h-5 text-blue-500" />
                  Mappa GPS Completa
                </h3>
              </div>
              <div className="p-0">
                <div className="h-96 w-full">
                  {latestLocation ? (
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(latestLocation.longitude) - 0.01},${parseFloat(latestLocation.latitude) - 0.01},${parseFloat(latestLocation.longitude) + 0.01},${parseFloat(latestLocation.latitude) + 0.01}&layer=mapnik&marker=${latestLocation.latitude},${latestLocation.longitude}`}
                      style={{ border: 0, width: '100%', height: '100%' }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="h-full bg-gray-50 flex items-center justify-center">
                      <div className="text-center p-6">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Map className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-gray-600 mb-4">Nessuna posizione GPS disponibile</p>
                        <p className="text-sm text-gray-500">
                          Il dispositivo {device.deviceId} non ha ancora inviato dati GPS
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 border-t">
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://www.openstreetmap.org/', '_blank')}
                    >
                      Apri OpenStreetMap
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://maps.google.com/', '_blank')}
                    >
                      Apri Google Maps
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('dashboard')}
                    >
                      Torna alla Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'history':
        return (
          <div className="mt-6">
            <TraceHistory deviceId={device.deviceId} />
          </div>
        );
      case 'settings':
        return (
          <div className="mt-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Impostazioni Dispositivo</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Dispositivo
                  </label>
                  <p className="text-sm text-gray-600">{device.deviceName || device.deviceId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Dispositivo
                  </label>
                  <p className="text-sm text-gray-600">{device.deviceId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Versione Firmware
                  </label>
                  <p className="text-sm text-gray-600">{device.firmwareVersion || 'Non disponibile'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hardware
                  </label>
                  <p className="text-sm text-gray-600">{device.hardwareVersion || 'Non disponibile'}</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gps-background">
      {/* Header */}
      <header className="bg-gps-surface border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gps-primary rounded-lg flex items-center justify-center">
                <Satellite className="text-white w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">GPS Tracker</h1>
                <p className="text-xs text-gray-500">{device.deviceName || device.deviceId}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Device Selector */}
              {devices && devices.length > 1 && (
                <Select value={device.deviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="w-48">
                    <SelectValue>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-sm truncate">{device.deviceName || device.deviceId}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <div className="font-medium">{d.deviceName || d.deviceId}</div>
                            <div className="text-xs text-gray-500">{d.deviceId}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  device.status === 'online' 
                    ? 'bg-green-500 animate-pulse' 
                    : 'bg-gray-400'
                }`}></div>
                <span className={`text-sm ${
                  device.status === 'online' 
                    ? 'text-green-600' 
                    : 'text-gray-500'
                }`}>
                  {device.status === 'online' ? "Connesso" : "Disconnesso"}
                </span>
              </div>
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Settings className="w-4 h-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b">
                    <p className="text-sm font-medium">{user?.firstName || "Utente"} {user?.lastName || ""}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        {renderTabContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        <div className="grid grid-cols-4 h-16">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'dashboard' ? 'text-gps-primary' : 'text-gray-400'
            }`}
          >
            <Satellite className="w-5 h-5" />
            <span className="text-xs">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'map' ? 'text-gps-primary' : 'text-gray-400'
            }`}
          >
            <Map className="w-5 h-5" />
            <span className="text-xs">Mappa</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'history' ? 'text-gps-primary' : 'text-gray-400'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-xs">Storico</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'settings' ? 'text-gps-primary' : 'text-gray-400'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs">Impostazioni</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
