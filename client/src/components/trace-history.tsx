import { useQuery } from "@tanstack/react-query";
import { Route, Download, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Trace } from "@shared/schema";

interface TraceHistoryProps {
  deviceId: string;
}

interface TraceWithDetails extends Trace {
  totalPoints: number;
  totalDistance: number;
}

export default function TraceHistory({ deviceId }: TraceHistoryProps) {
  const { data: traces, isLoading } = useQuery<TraceWithDetails[]>({
    queryKey: ["/api/devices", deviceId, "traces"],
  });

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return "In corso...";
    
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (start: Date, end: Date | null) => {
    const startTime = new Date(start).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (!end) return `${startTime} - In corso`;
    
    const endTime = new Date(end).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `${startTime} - ${endTime}`;
  };

  const getTraceColor = (index: number) => {
    const colors = [
      'bg-gps-accent',
      'bg-gps-secondary', 
      'bg-gps-primary',
      'bg-purple-600',
      'bg-pink-600',
      'bg-indigo-600'
    ];
    return colors[index % colors.length];
  };

  const totalStats = traces?.reduce(
    (acc, trace) => ({
      totalTraces: acc.totalTraces + 1,
      totalDistance: acc.totalDistance + (trace.totalDistance || 0),
      totalPoints: acc.totalPoints + (trace.totalPoints || 0),
    }),
    { totalTraces: 0, totalDistance: 0, totalPoints: 0 }
  ) || { totalTraces: 0, totalDistance: 0, totalPoints: 0 };

  if (isLoading) {
    return (
      <Card className="bg-gps-surface border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Storico Tracce</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-lg"></div>
                  <div className="space-y-2">
                    <div className="w-32 h-4 bg-gray-300 rounded"></div>
                    <div className="w-24 h-3 bg-gray-300 rounded"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-16 h-4 bg-gray-300 rounded"></div>
                  <div className="w-12 h-3 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gps-surface border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Storico Tracce</CardTitle>
        <div className="flex items-center space-x-2">
          <Select defaultValue="7days">
            <SelectTrigger className="w-40 bg-white border-gray-300 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="7days">Ultimi 7 giorni</SelectItem>
              <SelectItem value="30days">Ultimo mese</SelectItem>
              <SelectItem value="90days">Ultimi 3 mesi</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="p-2 hover:bg-gray-100">
            <Download className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
          {traces?.length === 0 ? (
            <div className="text-center py-8">
              <Route className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nessuna traccia disponibile</p>
              <p className="text-sm text-gray-500">Attiva la modalità smarrito per iniziare a tracciare</p>
            </div>
          ) : (
            traces?.map((trace, index) => (
              <div
                key={trace.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${getTraceColor(index)} rounded-lg flex items-center justify-center`}>
                    <Route className="text-white w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{trace.name}</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(trace.startTime, trace.endTime)}</span>
                      <span>({formatDuration(trace.startTime, trace.endTime)})</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {trace.totalDistance ? `${trace.totalDistance.toFixed(1)} km` : "0 km"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {trace.totalPoints} punti
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        
        {traces && traces.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold gps-primary">{totalStats.totalTraces}</p>
                <p className="text-xs text-gray-500">Tracce totali</p>
              </div>
              <div>
                <p className="text-2xl font-bold gps-secondary">
                  {totalStats.totalDistance.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">km percorsi</p>
              </div>
              <div>
                <p className="text-2xl font-bold gps-accent">{totalStats.totalPoints}</p>
                <p className="text-xs text-gray-500">Punti GPS</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
