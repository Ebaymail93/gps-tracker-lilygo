import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, MapPin, AlertCircle, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Geofence, GeofenceAlert } from "@shared/schema";
import MapboxMap from "./mapbox-map";

interface GeofenceManagerProps {
  deviceId: string;
  currentLat?: number;
  currentLng?: number;
}

export default function GeofenceManager({ deviceId, currentLat, currentLng }: GeofenceManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [isSelectingFromMap, setIsSelectingFromMap] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    centerLat: Number(currentLat) || 45.4642,
    centerLng: Number(currentLng) || 9.1900,
    radius: 100,
    alertOnEnter: true,
    alertOnExit: true,
    isActive: true
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch geofences
  const { data: geofences, isLoading: loadingGeofences } = useQuery<Geofence[]>({
    queryKey: [`/api/devices/${deviceId}/geofences`],
    refetchInterval: 30000,
  });

  // Fetch alerts
  const { data: alerts, isLoading: loadingAlerts } = useQuery<GeofenceAlert[]>({
    queryKey: [`/api/devices/${deviceId}/geofence-alerts`],
    refetchInterval: 15000,
  });

  // Get unread alerts count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: [`/api/devices/${deviceId}/unread-alerts-count`],
    refetchInterval: 10000,
  });

  // Create geofence mutation
  const createGeofenceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/devices/${deviceId}/geofences`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error('Failed to create geofence');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/geofences`] });
      toast({ title: "Successo", description: "Zona geografica creata con successo" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Errore", description: "Errore nella creazione della zona geografica", variant: "destructive" });
    },
  });

  // Update geofence mutation
  const updateGeofenceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/geofences/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/geofences`] });
      toast({ title: "Successo", description: "Zona geografica aggiornata con successo" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Errore", description: "Errore nell'aggiornamento della zona geografica", variant: "destructive" });
    },
  });

  // Delete geofence mutation
  const deleteGeofenceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/geofences/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/geofences`] });
      toast({ title: "Successo", description: "Zona geografica eliminata con successo" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Errore nell'eliminazione della zona geografica", variant: "destructive" });
    },
  });

  // Mark alert as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: number) => {
      return apiRequest(`/api/geofence-alerts/${alertId}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/geofence-alerts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/unread-alerts-count`] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      centerLat: currentLat || 45.4642,
      centerLng: currentLng || 9.1900,
      radius: 100,
      alertOnEntry: true,
      alertOnExit: true,
      isActive: true
    });
    setIsCreating(false);
    setEditingGeofence(null);
    setIsSelectingFromMap(false);
  };

  const handleMapSelect = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      centerLat: lat,
      centerLng: lng
    }));
    setIsSelectingFromMap(false);
  };

  const startMapSelection = () => {
    setIsSelectingFromMap(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingGeofence) {
      updateGeofenceMutation.mutate({ id: editingGeofence.id, data: formData });
    } else {
      createGeofenceMutation.mutate(formData);
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setFormData({
      name: geofence.name,
      description: geofence.description || "",
      centerLat: geofence.centerLat,
      centerLng: geofence.centerLng,
      radius: geofence.radius,
      alertOnEntry: geofence.alertOnEntry,
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
        centerLat: currentLat,
        centerLng: currentLng
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
            {(unreadCount?.count || 0) > 0 && (
              <Badge variant="destructive">{unreadCount.count}</Badge>
            )}
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
          ) : alerts && alerts.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.isRead ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={alert.alertType === 'entry' ? 'default' : 'secondary'}>
                          {alert.alertType === 'entry' ? 'Entrata' : 'Uscita'}
                        </Badge>
                        {!alert.isRead && (
                          <Badge variant="destructive" className="text-xs">Nuovo</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleString('it-IT')}
                      </p>
                      <p className="text-xs text-gray-400">
                        Pos: {alert.triggerLat.toFixed(6)}, {alert.triggerLng.toFixed(6)}
                      </p>
                    </div>
                    {!alert.isRead && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsReadMutation.mutate(alert.id)}
                        disabled={markAsReadMutation.isPending}
                      >
                        Segna come letto
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">Nessun alert disponibile</p>
          )}
        </CardContent>
      </Card>

      {/* Geofences Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Zone Geografiche
            </div>
            <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
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
                    onChange={(e) => setFormData(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
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
                  <Label htmlFor="centerLat">Latitudine Centro</Label>
                  <Input
                    id="centerLat"
                    type="number"
                    step="0.000001"
                    value={formData.centerLat || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, centerLat: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="centerLng">Longitudine Centro</Label>
                  <Input
                    id="centerLng"
                    type="number"
                    step="0.000001"
                    value={formData.centerLng || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, centerLng: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseCurrentLocation}
                  disabled={!currentLat || !currentLng}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Usa Posizione Corrente
                </Button>
                <Button
                  type="button"
                  variant={isSelectingFromMap ? "default" : "outline"}
                  onClick={startMapSelection}
                  disabled={isSelectingFromMap}
                >
                  <Target className="h-4 w-4 mr-2" />
                  {isSelectingFromMap ? "Seleziona sulla Mappa..." : "Seleziona dalla Mappa"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="alertOnEntry"
                    checked={formData.alertOnEntry}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alertOnEntry: checked }))}
                  />
                  <Label htmlFor="alertOnEntry">Alert Entrata</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="alertOnExit"
                    checked={formData.alertOnExit}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alertOnExit: checked }))}
                  />
                  <Label htmlFor="alertOnExit">Alert Uscita</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Attiva</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createGeofenceMutation.isPending || updateGeofenceMutation.isPending}
                >
                  {editingGeofence ? 'Aggiorna' : 'Crea'} Zona
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
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
          ) : geofences && geofences.length > 0 ? (
            <div className="space-y-3">
              {geofences.map((geofence) => (
                <div key={geofence.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{geofence.name}</h3>
                        <Badge variant={geofence.isActive ? 'default' : 'secondary'}>
                          {geofence.isActive ? 'Attiva' : 'Inattiva'}
                        </Badge>
                        {geofence.alertOnEntry && (
                          <Badge variant="outline" className="text-xs">Entrata</Badge>
                        )}
                        {geofence.alertOnExit && (
                          <Badge variant="outline" className="text-xs">Uscita</Badge>
                        )}
                      </div>
                      {geofence.description && (
                        <p className="text-sm text-gray-600 mb-2">{geofence.description}</p>
                      )}
                      <div className="text-sm text-gray-500">
                        <p>Centro: {geofence.centerLat.toFixed(6)}, {geofence.centerLng.toFixed(6)}</p>
                        <p>Raggio: {geofence.radius}m</p>
                        <p>Creata: {new Date(geofence.createdAt).toLocaleDateString('it-IT')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(geofence)}
                        disabled={isCreating}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteGeofenceMutation.mutate(geofence.id)}
                        disabled={deleteGeofenceMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              Nessuna zona geografica configurata.
              <br />
              Crea la prima zona per iniziare il monitoraggio automatico.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Interactive Map for Geofence Selection */}
      {isSelectingFromMap && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Seleziona Posizione sulla Mappa
            </CardTitle>
            <CardDescription>
              Clicca sulla mappa per selezionare il centro della zona geografica. 
              Il cerchio blu mostra l'area con raggio {formData.radius}m.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 mb-4">
              <MapboxMap 
                deviceId={deviceId}
                onGeofenceSelect={handleMapSelect}
                isSelectingGeofence={isSelectingFromMap}
                geofenceRadius={formData.radius}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsSelectingFromMap(false)}
              >
                Annulla Selezione
              </Button>
              <div className="text-sm text-gray-600 flex items-center">
                Coordinate selezionate: {formData.centerLat.toFixed(6)}, {formData.centerLng.toFixed(6)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}