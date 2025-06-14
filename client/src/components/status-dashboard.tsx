import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Cpu, MapPin, Power, Battery, Antenna, Settings, X, Clock, Wrench } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Device } from "@shared/schema";

interface StatusDashboardProps {
  device: Device;
}

export default function StatusDashboard({ device }: StatusDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query device status with pending commands
  const { data: deviceStatus, error: deviceStatusError } = useQuery({
    queryKey: [`/api/devices/${device.deviceId}/status`],
    refetchInterval: 3000,
    retry: 1,
  });

  // Handle device status error
  if (deviceStatusError) {
    console.error("Device status query error:", deviceStatusError);
  }

  const pendingCommand = (deviceStatus as any)?.lostModeCommand;
  const isLostMode = device.status === 'lost_mode';
  const hasPendingCommand = !!pendingCommand;
  const isPendingEnable = pendingCommand?.commandType === 'enable_lost_mode';
  const isPendingDisable = pendingCommand?.commandType === 'disable_lost_mode';
  
  const toggleLostModeMutation = useMutation({
    mutationFn: async (lostMode: boolean) => {
      const response = await apiRequest("POST", `/api/devices/${device.deviceId}/lost-mode`, {
        lostMode,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${device.deviceId}/status`] });
      toast({
        title: "Comando inviato",
        description: data?.message || "Comando inviato al dispositivo",
      });
    },
    onError: (error: any) => {
      console.error("Toggle lost mode error:", error);
      const errorMessage = error?.message || error?.toString() || "Errore sconosciuto";
      if (errorMessage.includes("already pending")) {
        toast({
          title: "Comando già in attesa",
          description: "C'è già un comando pending per questo dispositivo",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Errore",
          description: "Impossibile inviare comando",
          variant: "destructive",
        });
      }
    },
  });

  const cancelCommandMutation = useMutation({
    mutationFn: async () => {
      if (!pendingCommand) return;
      const response = await apiRequest("DELETE", `/api/devices/${device.deviceId}/commands/${pendingCommand.id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${device.deviceId}/status`] });
      toast({
        title: "Comando annullato",
        description: "Il comando è stato annullato con successo",
      });
    },
    onError: (error: any) => {
      console.error("Cancel command error:", error);
      toast({
        title: "Errore",
        description: "Impossibile annullare comando",
        variant: "destructive",
      });
    },
  });



  const handleToggleLostMode = () => {
    if (hasPendingCommand) {
      cancelCommandMutation.mutate();
    } else {
      toggleLostModeMutation.mutate(!isLostMode);
    }
  };

  const getSignalBars = (strength: number) => {
    const bars = Math.ceil((strength / 100) * 4);
    return Array.from({ length: 4 }, (_, i) => (
      <div
        key={i}
        className={`w-1 rounded-sm ${
          i < bars ? "bg-gps-secondary" : "bg-gray-600"
        }`}
        style={{ height: `${(i + 1) * 25}%` }}
      />
    ));
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    if (diff < 1) return "ora";
    if (diff < 60) return `${diff} minuti fa`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} ore fa`;
    const days = Math.floor(hours / 24);
    return `${days} giorni fa`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Device Status Card */}
      <Card className="bg-gps-surface border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900">Stato Dispositivo</CardTitle>
          <div className="flex items-center gap-2">
            <Link href={`/device/${device.deviceId}/config`}>
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs font-medium border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                <Wrench className="w-3 h-3 mr-1" />
                Config
              </Button>
            </Link>
            <Cpu className="w-5 h-5 gps-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">ID Dispositivo:</span>
            <span className="font-mono text-sm text-gray-900">{device.deviceId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Tipo:</span>
            <span className="text-sm text-gray-900">{device.deviceType || 'GPS Tracker'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Firmware:</span>
            <span className="text-sm text-gray-900">{device.firmwareVersion || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Stato:</span>
            <span className={`text-sm font-medium ${
              device.status === 'online' ? 'text-green-600' : 
              device.status === 'lost_mode' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {device.status === 'lost_mode' ? 'Lost Mode' : 
               device.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Ultimo aggiornamento:</span>
            <span className="text-sm text-gray-900">{formatLastSeen(device.lastSeen || new Date())}</span>
          </div>
        </CardContent>
      </Card>

      {/* Lost Mode Control */}
      <Card className="bg-gps-surface border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900">Modalità Smarrito</CardTitle>
          <MapPin className="w-5 h-5 gps-accent" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Stato:</span>
            <div className="flex items-center gap-2">
              <span className={isLostMode ? "text-red-600 font-medium" : "text-gray-500"}>
                {isLostMode ? "Attiva" : "Inattiva"}
              </span>
              {hasPendingCommand && (
                <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  <Clock className="w-3 h-3 mr-1" />
                  {isPendingEnable ? "Attivazione..." : "Disattivazione..."}
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={handleToggleLostMode}
            disabled={toggleLostModeMutation.isPending || cancelCommandMutation.isPending}
            className={`w-full font-medium transition-colors ${
              hasPendingCommand
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : isLostMode
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            {(toggleLostModeMutation.isPending || cancelCommandMutation.isPending) ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                {hasPendingCommand ? "Annullando..." : "Inviando..."}
              </div>
            ) : hasPendingCommand ? (
              <div className="flex items-center">
                <X className="w-4 h-4 mr-2" />
                Annulla Comando
              </div>
            ) : (
              <div className="flex items-center">
                <Power className="w-4 h-4 mr-2" />
                {isLostMode ? "Disattiva Modalità Smarrito" : "Attiva Modalità Smarrito"}
              </div>
            )}
          </Button>
          <p className="text-xs text-gray-500">
            {hasPendingCommand ? (
              isPendingEnable 
                ? "Comando di attivazione inviato - In attesa conferma dispositivo"
                : "Comando di disattivazione inviato - In attesa conferma dispositivo"
            ) : isLostMode ? (
              "TRACKING INTENSIVO: Posizione aggiornata ogni 5 secondi"
            ) : (
              "Quando attiva, il dispositivo invierà la posizione ogni 30 secondi"
            )}
          </p>
        </CardContent>
      </Card>


    </div>
  );
}
