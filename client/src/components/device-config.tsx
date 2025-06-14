import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Wifi, MapPin, Battery, Clock, Shield, Send } from "lucide-react";

interface DeviceConfigProps {
  deviceId: string;
}

const configSchema = z.object({
  // GPS Settings
  gpsUpdateInterval: z.number().min(5).max(3600),
  gpsAccuracyThreshold: z.number().min(1).max(50),
  minSatellites: z.number().min(3).max(20),
  
  // Power Management
  powerSaveMode: z.boolean(),
  sleepInterval: z.number().min(10).max(600),
  batteryThreshold: z.number().min(5).max(95),
  
  // Network Settings
  heartbeatInterval: z.number().min(30).max(900),
  commandPollInterval: z.number().min(5).max(300),
  networkTimeout: z.number().min(5).max(60),
  
  // Geofencing
  geofenceEnabled: z.boolean(),
  geofenceRadius: z.number().min(10).max(5000),
  
  // Lost Mode
  lostModeGpsInterval: z.number().min(5).max(60),
  lostModeHeartbeat: z.number().min(10).max(120),
  
  // Debug e Logging
  debugMode: z.boolean(),
  logLevel: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]),
  serialBaudRate: z.number(),
});

type ConfigFormData = z.infer<typeof configSchema>;

const defaultConfig: ConfigFormData = {
  gpsUpdateInterval: 30,
  gpsAccuracyThreshold: 10,
  minSatellites: 4,
  powerSaveMode: true,
  sleepInterval: 60,
  batteryThreshold: 20,
  heartbeatInterval: 60,
  commandPollInterval: 10,
  networkTimeout: 30,
  geofenceEnabled: true,
  geofenceRadius: 100,
  lostModeGpsInterval: 5,
  lostModeHeartbeat: 30,
  debugMode: false,
  logLevel: "INFO" as const,
  serialBaudRate: 115200,
};

export default function DeviceConfig({ deviceId }: DeviceConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<string>("gps");

  // Fetch current device configuration
  const { data: currentConfig, isLoading } = useQuery<{config: ConfigFormData}>({
    queryKey: [`/api/devices/${deviceId}/config`],
  });

  const formValues = useMemo(() => {
    return currentConfig?.config || defaultConfig;
  }, [currentConfig?.config]);

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: defaultConfig,
    values: formValues,
  });

  const sendConfigMutation = useMutation({
    mutationFn: async (configData: ConfigFormData) => {
      return apiRequest("POST", `/api/devices/${deviceId}/commands`, {
        commandType: "update_config",
        commandData: configData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/config`] });
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/status`] });
      toast({
        title: "Configurazione inviata",
        description: "La nuova configurazione è stata inviata al dispositivo",
      });
    },
    onError: (error: any) => {
      console.error("Send config error:", error);
      const errorMessage = error?.message || error?.toString() || "Errore sconosciuto";
      
      if (errorMessage.includes("already pending")) {
        toast({
          title: "Comando già in attesa",
          description: "C'è già un comando di configurazione in attesa per questo dispositivo",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Errore",
          description: "Impossibile inviare la configurazione al dispositivo",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: ConfigFormData) => {
    console.log("Form submitted with data:", data);
    sendConfigMutation.mutate(data);
  };

  const sections = [
    { id: "gps", label: "GPS", icon: MapPin },
    { id: "power", label: "Alimentazione", icon: Battery },
    { id: "network", label: "Rete", icon: Wifi },
    { id: "security", label: "Sicurezza", icon: Shield },
    { id: "debug", label: "Debug", icon: Settings },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurazione Dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Caricamento configurazione...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurazione Dispositivo
          </CardTitle>
          <CardDescription>
            Modifica i parametri operativi del dispositivo GPS. Le modifiche verranno inviate come comando al dispositivo.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sezioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <Button
                    key={section.id}
                    variant={activeSection === section.id ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {section.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Configuration Form */}
        <div className="lg:col-span-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* GPS Settings */}
              {activeSection === "gps" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Configurazione GPS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="gpsUpdateInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervallo Aggiornamento GPS (secondi)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Frequenza di invio delle posizioni GPS (5-3600 secondi)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gpsAccuracyThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Soglia Precisione GPS (metri)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Precisione minima richiesta per accettare una posizione GPS
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minSatellites"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Satelliti Minimi</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Numero minimo di satelliti per considerare valida la posizione
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Power Management */}
              {activeSection === "power" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Battery className="h-5 w-5" />
                      Gestione Alimentazione
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="powerSaveMode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Modalità Risparmio Energetico</FormLabel>
                            <FormDescription>
                              Attiva il risparmio energetico quando il dispositivo è inattivo
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sleepInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervallo Sleep (secondi)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Durata del periodo di sleep in modalità risparmio energetico
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="batteryThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Soglia Batteria Critica (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Livello batteria sotto il quale attivare la modalità emergenza
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Network Settings */}
              {activeSection === "network" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wifi className="h-5 w-5" />
                      Configurazione Rete
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="heartbeatInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervallo Heartbeat (secondi)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Frequenza di invio segnali di vita al server
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commandPollInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervallo Polling Comandi (secondi)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Frequenza di controllo per nuovi comandi dal server
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="networkTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timeout Rete (secondi)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Timeout per le richieste HTTP al server
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Security & Geofencing */}
              {activeSection === "security" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Sicurezza e Geofencing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="geofenceEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Geofencing Attivo</FormLabel>
                            <FormDescription>
                              Abilita il monitoraggio automatico delle zone geografiche
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="geofenceRadius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Raggio Geofence Default (metri)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Raggio di default per le nuove zone geofence
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Configurazione Lost Mode</h4>
                      
                      <FormField
                        control={form.control}
                        name="lostModeGpsInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intervallo GPS in Lost Mode (secondi)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Frequenza GPS accelerata quando il dispositivo è in modalità smarrito
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lostModeHeartbeat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Heartbeat Lost Mode (secondi)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Frequenza heartbeat in modalità smarrito
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Debug Settings */}
              {activeSection === "debug" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Debug e Diagnostica
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="debugMode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Modalità Debug</FormLabel>
                            <FormDescription>
                              Abilita logging dettagliato e output diagnostici
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="logLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Livello Log</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona livello log" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DEBUG">DEBUG - Molto dettagliato</SelectItem>
                              <SelectItem value="INFO">INFO - Informativo</SelectItem>
                              <SelectItem value="WARN">WARN - Solo warning</SelectItem>
                              <SelectItem value="ERROR">ERROR - Solo errori</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Controlla la verbosità dei log del dispositivo
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serialBaudRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Velocità Seriale (baud)</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona baud rate" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="9600">9600</SelectItem>
                              <SelectItem value="115200">115200</SelectItem>
                              <SelectItem value="230400">230400</SelectItem>
                              <SelectItem value="460800">460800</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Velocità comunicazione seriale per debug
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Submit Button */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Le modifiche verranno inviate come comando al dispositivo
                      </Badge>
                    </div>
                    <Button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        const formData = form.getValues();
                        console.log("Submitting form data:", formData);
                        
                        // Forza il submit ignorando gli errori di validazione
                        onSubmit(formData);
                      }}
                      disabled={sendConfigMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {sendConfigMutation.isPending ? "Invio..." : "Invia Configurazione"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}