import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Power, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeviceCommandsProps {
  deviceId: string;
}

type CommandType = "enable_lost_mode" | "disable_lost_mode" | "get_location" | "reboot";

interface CommandOption {
  value: CommandType;
  label: string;
  description: string;
  icon: React.ReactNode;
  variant: "default" | "destructive" | "secondary" | "outline";
}

const commandOptions: CommandOption[] = [
  {
    value: "enable_lost_mode",
    label: "Attiva Modalità Smarrito",
    description: "Aumenta la frequenza di tracking per localizzazione rapida",
    icon: <AlertTriangle className="w-4 h-4" />,
    variant: "destructive"
  },
  {
    value: "disable_lost_mode", 
    label: "Disattiva Modalità Smarrito",
    description: "Ripristina la modalità di tracking normale",
    icon: <Power className="w-4 h-4" />,
    variant: "secondary"
  },
  {
    value: "get_location",
    label: "Richiedi Posizione",
    description: "Ottieni la posizione attuale immediatamente",
    icon: <MapPin className="w-4 h-4" />,
    variant: "outline"
  },
  {
    value: "reboot",
    label: "Riavvia Dispositivo",
    description: "Riavvia completamente il dispositivo GPS",
    icon: <RotateCcw className="w-4 h-4" />,
    variant: "destructive"
  }
];

export default function DeviceCommands({ deviceId }: DeviceCommandsProps) {
  const [selectedCommand, setSelectedCommand] = useState<CommandType | "">("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendCommandMutation = useMutation({
    mutationFn: async (commandType: CommandType) => {
      return apiRequest("POST", `/api/devices/${deviceId}/commands`, {
        commandType,
        payload: {}
      });
    },
    onSuccess: (data, commandType) => {
      const command = commandOptions.find(cmd => cmd.value === commandType);
      toast({
        title: "Comando Inviato",
        description: `${command?.label} inviato al dispositivo`,
      });
      
      // Invalida le cache per aggiornare i log
      queryClient.invalidateQueries({ queryKey: ["/api/system-logs"] });
      setSelectedCommand("");
    },
    onError: (error: any) => {
      console.error("Send command error:", error);
      const errorMessage = error?.message || error?.toString() || "Errore sconosciuto";
      
      if (errorMessage.includes("already pending")) {
        toast({
          title: "Comando già in attesa",
          description: "C'è già un comando dello stesso tipo in attesa per questo dispositivo",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Errore",
          description: "Impossibile inviare il comando al dispositivo",
          variant: "destructive",
        });
      }
    },
  });

  const handleSendCommand = () => {
    if (selectedCommand) {
      sendCommandMutation.mutate(selectedCommand);
    }
  };

  const getCommandInfo = (commandType: CommandType) => {
    return commandOptions.find(cmd => cmd.value === commandType);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="w-5 h-5" />
          Controllo Dispositivo
        </CardTitle>
        <CardDescription>
          Invia comandi remoti al dispositivo GPS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Seleziona Comando</label>
            <Select value={selectedCommand} onValueChange={(value) => setSelectedCommand(value as CommandType | "")}>
              <SelectTrigger>
                <SelectValue placeholder="Scegli un comando da inviare" />
              </SelectTrigger>
              <SelectContent>
                {commandOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCommand && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getCommandInfo(selectedCommand)?.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">
                    {getCommandInfo(selectedCommand)?.label}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getCommandInfo(selectedCommand)?.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleSendCommand}
            disabled={!selectedCommand || sendCommandMutation.isPending}
            variant={selectedCommand ? getCommandInfo(selectedCommand)?.variant : "default"}
            className="w-full"
          >
            {sendCommandMutation.isPending ? (
              <>
                <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                Invio comando...
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                Invia Comando
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Informazioni</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• I comandi vengono inviati al dispositivo al prossimo check (ogni 60 secondi)</p>
            <p>• La modalità smarrito aumenta la frequenza di invio dati</p>
            <p>• Il riavvio del dispositivo può richiedere alcuni minuti</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Badge variant="outline" className="text-xs">
            Sistema Comandi Attivo
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Database PostgreSQL
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}