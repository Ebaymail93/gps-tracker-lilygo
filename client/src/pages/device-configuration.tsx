import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DeviceConfig from "@/components/device-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { Link } from "wouter";
import type { Device } from "@shared/schema";

export default function DeviceConfigurationPage() {
  const params = useParams();
  const deviceId = params.deviceId as string;

  const { data: device, isLoading: deviceLoading } = useQuery<Device>({
    queryKey: [`/api/devices/${deviceId}`],
    enabled: !!deviceId,
  });

  if (deviceLoading) {
    return (
      <div className="container mx-auto p-6">
        <p>Caricamento dispositivo...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p>Dispositivo non trovato</p>
            <Link href="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Torna alla Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Configurazione Dispositivo
            </h1>
            <p className="text-muted-foreground">
              {device.deviceName || device.deviceId} - {device.deviceType}
            </p>
          </div>
        </div>
        <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
          {device.status}
        </Badge>
      </div>

      {/* Device Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informazioni Dispositivo</CardTitle>
          <CardDescription>
            Dettagli e stato attuale del dispositivo GPS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Device ID</label>
              <p className="font-mono text-sm">{device.deviceId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Firmware</label>
              <p className="text-sm">{device.firmwareVersion || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Ultima Connessione</label>
              <p className="text-sm">
                {device.lastSeen ? new Date(device.lastSeen).toLocaleString('it-IT') : "Mai"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Component */}
      <DeviceConfig deviceId={deviceId} />
    </div>
  );
}