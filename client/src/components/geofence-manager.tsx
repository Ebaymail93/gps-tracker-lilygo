import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Edit, Trash2, AlertCircle, Shield, Map } from "lucide-react";
import type { Geofence, GeofenceAlert } from "@shared/schema";
import MapboxMap from "@/components/mapbox-map";



interface GeofenceManagerProps {
  deviceId: string;
  currentLat?: number;
  currentLng?: number;
}

export default function GeofenceManager({ deviceId, currentLat, currentLng }: GeofenceManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    centerLatitude: "45.4642",
    centerLongitude: "9.1900", 
    radius: "100",
    alertOnEnter: true,
    alertOnExit: true,
    isActive: true
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch geofences
  const { data: geofences, isLoading: loadingGeofences } = useQuery({
    queryKey: ["/api/devices", deviceId, "geofences"],
  });

  // Fetch geofence alerts
  const { data: alerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ["/api/devices", deviceId, "geofence-alerts"],
  });

  // Fetch unread alerts count
  const { data: unreadCount } = useQuery({
    queryKey: ["/api/devices", deviceId, "unread-alerts-count"],
  });

  // Create geofence mutation
  const createMutation = useMutation({
    mutationFn: async (geofenceData: typeof formData) => {
      const response = await fetch(`/api/devices/${deviceId}/geofences`, {
        method: "POST",
        body: JSON.stringify(geofenceData),
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to create geofence");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices", deviceId, "geofences"] });
      toast({ title: "Geofence creata", description: "La zona geografica è stata creata con successo" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Errore nella creazione della geofence", 
        variant: "destructive" 
      });
    },
  });

  // Delete geofence mutation
  const deleteMutation = useMutation({
    mutationFn: async (geofenceId: string) => {
      const response = await apiRequest("DELETE", `/api/devices/${deviceId}/geofences/${geofenceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices", deviceId, "geofences"] });
      toast({ title: "Geofence eliminata", description: "La zona geografica è stata eliminata" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Errore nell'eliminazione della geofence", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      centerLatitude: "45.4642",
      centerLongitude: "9.1900",
      radius: "100",
      alertOnEnter: true,
      alertOnExit: true,
      isActive: true
    });
    setIsCreating(false);
    setEditingGeofence(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDelete = (geofenceId: string) => {
    if (confirm("Sei sicuro di voler eliminare questa geofence?")) {
      deleteMutation.mutate(geofenceId);
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setFormData({
      name: geofence.name,
      description: geofence.description || "",
      centerLatitude: geofence.centerLatitude,
      centerLongitude: geofence.centerLongitude,
      radius: geofence.radius,
      alertOnEnter: geofence.alertOnEnter,
      alertOnExit: geofence.alertOnExit,
      isActive: geofence.isActive
    });
    setEditingGeofence(geofence);
    setIsCreating(true);
  };

  const handleUseCurrentLocation = () => {
    if (currentLat && currentLng) {
      setFormData(prev => ({
        ...prev,
        centerLatitude: currentLat.toString(),
        centerLongitude: currentLng.toString()
      }));
      toast({ title: "Posizione aggiornata", description: "Utilizzata la posizione GPS corrente" });
    } else {
      toast({ title: "Attenzione", description: "Posizione GPS non disponibile", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Alert Geofencing
          </CardTitle>
          <CardDescription>
            Notifiche automatiche per entrate e uscite dalle zone geografiche
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAlerts ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
            </div>
          ) : alerts && Array.isArray(alerts) && alerts.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.isRead ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {alert.alertType === 'enter' ? '🔴 Entrata in zona' : '🟢 Uscita da zona'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString('it-IT') : 'Data non disponibile'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Coordinate: {parseFloat(alert.latitude).toFixed(6)}, {parseFloat(alert.longitude).toFixed(6)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              <Shield className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>Nessun alert geofencing</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geofences Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Zone Geofencing
            </div>
            <Button
              onClick={() => setIsCreating(!isCreating)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuova Zona
            </Button>
          </CardTitle>
          <CardDescription>
            Gestisci le zone geografiche per il monitoraggio automatico
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Create/Edit Form */}
          {isCreating && (
            <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 border rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome Zona</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Es. Casa, Ufficio, Scuola"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="radius">Raggio (metri)</Label>
                  <Input
                    id="radius"
                    type="number"
                    min="10"
                    max="10000"
                    value={formData.radius}
                    onChange={(e) => setFormData(prev => ({ ...prev, radius: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrizione (opzionale)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrizione della zona geografica"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="centerLatitude">Latitudine Centro</Label>
                  <Input
                    id="centerLatitude"
                    type="number"
                    step="0.000001"
                    value={formData.centerLatitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, centerLatitude: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="centerLongitude">Longitudine Centro</Label>
                  <Input
                    id="centerLongitude"
                    type="number"
                    step="0.000001"
                    value={formData.centerLongitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, centerLongitude: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMapSelector(!showMapSelector)}
                  className="flex items-center gap-2"
                >
                  <Map className="w-4 h-4" />
                  {showMapSelector ? "Nascondi Mappa" : "Seleziona dalla Mappa"}
                </Button>
              </div>

              {/* Map Selector */}
              {showMapSelector && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-medium mb-2 text-gray-700">
                    Seleziona posizione sulla mappa
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Modifica le coordinate manualmente o usa i pulsanti per la selezione automatica
                  </p>
                  <div className="h-64 rounded border overflow-hidden">
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(formData.centerLongitude) - 0.01},${parseFloat(formData.centerLatitude) - 0.01},${parseFloat(formData.centerLongitude) + 0.01},${parseFloat(formData.centerLatitude) + 0.01}&layer=mapnik&marker=${formData.centerLatitude},${formData.centerLongitude}`}
                      style={{ border: 0, width: '100%', height: '100%' }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.geolocation?.getCurrentPosition((position) => {
                          setFormData(prev => ({
                            ...prev,
                            centerLatitude: position.coords.latitude.toFixed(6),
                            centerLongitude: position.coords.longitude.toFixed(6)
                          }));
                        });
                      }}
                    >
                      Usa Posizione Attuale
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(
                        `https://www.openstreetmap.org/#map=15/${formData.centerLatitude}/${formData.centerLongitude}`,
                        '_blank'
                      )}
                    >
                      Apri Mappa Completa
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    Coordinate selezionate: {formData.centerLatitude}, {formData.centerLongitude}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="alertOnEnter"
                    checked={formData.alertOnEnter}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, alertOnEnter: checked as boolean }))
                    }
                  />
                  <Label htmlFor="alertOnEnter">Alert quando entra nella zona</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="alertOnExit"
                    checked={formData.alertOnExit}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, alertOnExit: checked as boolean }))
                    }
                  />
                  <Label htmlFor="alertOnExit">Alert quando esce dalla zona</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, isActive: checked as boolean }))
                    }
                  />
                  <Label htmlFor="isActive">Zona attiva</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creazione..." : editingGeofence ? "Aggiorna" : "Crea Zona"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Annulla
                </Button>
              </div>
            </form>
          )}

          {/* Geofences List */}
          {loadingGeofences ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : geofences && Array.isArray(geofences) && geofences.length > 0 ? (
            <div className="space-y-3">
              {geofences.map((geofence: any) => (
                <div
                  key={geofence.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{geofence.name}</h3>
                        <Badge variant={geofence.isActive ? "default" : "secondary"}>
                          {geofence.isActive ? "Attiva" : "Inattiva"}
                        </Badge>
                        {geofence.alertOnEnter && <Badge variant="outline">Entrata</Badge>}
                        {geofence.alertOnExit && <Badge variant="outline">Uscita</Badge>}
                      </div>
                      {geofence.description && (
                        <p className="text-sm text-gray-600 mb-2">{geofence.description}</p>
                      )}
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>
                          Centro: {parseFloat(geofence.centerLatitude).toFixed(6)}, {parseFloat(geofence.centerLongitude).toFixed(6)}
                        </div>
                        <div>Raggio: {geofence.radius}m</div>
                        <div>
                          Creata: {geofence.createdAt ? new Date(geofence.createdAt).toLocaleDateString('it-IT') : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(geofence)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(geofence.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Nessuna zona geofencing</p>
              <p className="text-sm mb-4">Crea la prima zona geografica per iniziare il monitoraggio</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crea Prima Zona
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}