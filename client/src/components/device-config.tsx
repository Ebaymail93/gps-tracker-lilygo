import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Clock,
  Send,
  Battery,
  AlertTriangle,
  ArrowLeft,
  Wifi,
} from 'lucide-react';
import { Link } from 'wouter';

// ===== SCHEMA FINALE - 4 CONFIGURAZIONI ESSENZIALI =====
const deviceConfigSchema = z.object({
  heartbeatInterval: z.number().min(30).max(3600).default(300), // 30s-1h, default 5min
  lostModeInterval: z.number().min(5).max(60).default(15), // 5-60s, default 15s
  lowBatteryThreshold: z.number().min(5).max(50).default(15), // 5-50%, default 15%
  networkTimeout: z.number().min(5).max(60).default(15), // 5-60s, default 15s
});

type DeviceConfigForm = z.infer<typeof deviceConfigSchema>;

interface DeviceConfigProps {
  deviceId: string;
}

export default function DeviceConfig({ deviceId }: DeviceConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ===== FORM SETUP =====
  const form = useForm<DeviceConfigForm>({
    resolver: zodResolver(deviceConfigSchema),
    defaultValues: {
      heartbeatInterval: 300, // 5 minuti
      lostModeInterval: 15, // 15 secondi
      lowBatteryThreshold: 15, // 15%
      networkTimeout: 15, // 15 secondi
    },
  });

  // ===== LOAD CURRENT CONFIG =====
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: [`/api/devices/${deviceId}/config`],
    select: (data: any) => ({
      heartbeatInterval: Math.round(
        (data.config?.heartbeatInterval || 300000) / 1000
      ),
      lostModeInterval: Math.round(
        (data.config?.lostModeInterval || 15000) / 1000
      ),
      lowBatteryThreshold: data.config?.lowBatteryThreshold || 15,
      networkTimeout: Math.round((data.config?.networkTimeout || 15000) / 1000),
    }),
  });

  // ===== UPDATE FORM WHEN CONFIG LOADS =====
  useEffect(() => {
    if (currentConfig) {
      form.reset(currentConfig);
    }
  }, [currentConfig, form]);

  // ===== SEND CONFIG MUTATION =====
  const sendConfigMutation = useMutation({
    mutationFn: async (data: DeviceConfigForm) => {
      const devicePayload = {
        heartbeatInterval: data.heartbeatInterval * 1000,
        lostModeInterval: data.lostModeInterval * 1000,
        lowBatteryThreshold: data.lowBatteryThreshold,
        networkTimeout: data.networkTimeout * 1000,
      };

      console.log('📤 Invio configurazione come comando:', devicePayload);

      return apiRequest('POST', `/api/devices/${deviceId}/commands`, {
        commandType: 'update_config',
        payload: devicePayload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/devices/${deviceId}/config`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/devices/${deviceId}/commands`],
      });
      toast({
        title: '✅ Comando inviato',
        description:
          'Le nuove configurazioni saranno applicate al prossimo heartbeat',
      });
    },
    onError: (error: any) => {
      console.error('❌ Errore invio configurazione:', error);
      toast({
        title: '❌ Errore',
        description: 'Impossibile inviare la configurazione al dispositivo',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DeviceConfigForm) => {
    sendConfigMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento configurazione...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl min-h-screen">
      {/* === HEADER MOBILE-FRIENDLY === */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Link href={`/device/${deviceId}`}>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna al Dashboard
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold">Configurazione</h1>
          <p className="text-sm text-gray-600 font-mono break-all">
            {deviceId}
          </p>
        </div>
      </div>

      {/* === ALERT INFO === */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 text-sm sm:text-base">
                Configurazioni Essenziali
              </h3>
              <p className="text-xs sm:text-sm text-blue-700 mt-1">
                4 parametri core del dispositivo. Le zone geografiche
                (geofencing) si gestiscono nella dashboard principale.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === CONFIGURATION FORM === */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 sm:space-y-6"
        >
          {/* === TIMING SETTINGS === */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-blue-600" />
                Temporizzazioni
              </CardTitle>
              <CardDescription className="text-sm">
                Intervalli di comunicazione e GPS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <FormField
                control={form.control}
                name="heartbeatInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Heartbeat (secondi)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                        min="30"
                        max="3600"
                        className="text-base"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Frequenza segnali di vita al server (30-3600s, default:
                      300 = 5min)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lostModeInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      GPS Lost Mode (secondi)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                        min="5"
                        max="60"
                        className="text-base"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      GPS accelerato in modalità smarrito (5-60s, default: 15s)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* === THRESHOLDS === */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Battery className="h-5 w-5 text-orange-600" />
                Soglie e Limiti
              </CardTitle>
              <CardDescription className="text-sm">
                Allarmi e timeout di sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <FormField
                control={form.control}
                name="lowBatteryThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Batteria Bassa (%)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                        min="5"
                        max="50"
                        className="text-base"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Soglia risparmio energetico (5-50%, default: 15%)
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
                    <FormLabel className="text-sm font-medium">
                      Timeout Rete (secondi)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                        min="5"
                        max="60"
                        className="text-base"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Timeout richieste HTTP (5-60s, default: 15s)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* === SUBMIT SECTION === */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              {/* Mobile-first button */}
              <Button
                type="submit"
                disabled={sendConfigMutation.isPending}
                className="w-full mb-4 text-base py-3"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendConfigMutation.isPending
                  ? 'Invio comando...'
                  : 'Invia Configurazione'}
              </Button>

              <div className="flex items-center justify-center mb-4">
                <Badge variant="outline" className="text-xs">
                  <Wifi className="h-3 w-3 mr-1" />
                  Comando "update_config" via heartbeat
                </Badge>
              </div>

              <Separator className="my-4" />

              {/* === VALUES PREVIEW === */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-bold text-base text-gray-900 mb-1">
                    {form.watch('heartbeatInterval')}s
                  </div>
                  <div className="text-gray-600">Heartbeat</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-bold text-base text-gray-900 mb-1">
                    {form.watch('lostModeInterval')}s
                  </div>
                  <div className="text-gray-600">GPS Lost</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-bold text-base text-gray-900 mb-1">
                    {form.watch('lowBatteryThreshold')}%
                  </div>
                  <div className="text-gray-600">Batteria</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-bold text-base text-gray-900 mb-1">
                    {form.watch('networkTimeout')}s
                  </div>
                  <div className="text-gray-600">Timeout</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Bottom padding for mobile */}
      <div className="h-8"></div>
    </div>
  );
}
