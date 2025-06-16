import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, RotateCcw, Info, AlertTriangle, XCircle, Calendar, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SystemLog } from "@shared/schema";

interface SystemLogsProps {
  deviceId: string;
}

interface SystemLogsResponse {
  logs: SystemLog[];
  totalCount: number;
  hasMore: boolean;
}

export default function SystemLogs({ deviceId }: SystemLogsProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  const [offset, setOffset] = useState(0);
  const [allLogs, setAllLogs] = useState<SystemLog[]>([]);

  const { data: logsResponse, isLoading, refetch } = useQuery<SystemLogsResponse>({
    queryKey: ["/api/system-logs", deviceId, selectedDate, offset],
    queryFn: () => {
      const params = new URLSearchParams({
        deviceId,
        limit: "50",
        date: selectedDate,
        offset: offset.toString()
      });
      return fetch(`/api/system-logs?${params}`).then(res => res.json());
    },
    refetchInterval: offset === 0 ? 10000 : undefined, // Only auto-refetch first page
  });

  useEffect(() => {
    if (logsResponse) {
      if (offset === 0) {
        setAllLogs(logsResponse.logs);
      } else {
        setAllLogs(prev => [...prev, ...logsResponse.logs]);
      }
    }
  }, [logsResponse, offset]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setOffset(0);
    setAllLogs([]);
  };

  const loadMoreLogs = () => {
    if (logsResponse?.hasMore) {
      setOffset(prev => prev + 50);
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-2 h-2 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-2 h-2 text-yellow-500" />;
      default:
        return <div className="w-2 h-2 bg-gps-secondary rounded-full" />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  const displayLogs = offset === 0 ? logsResponse?.logs || [] : allLogs;

  if (isLoading) {
    return (
      <Card className="mt-6 bg-gps-surface border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Log Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start space-x-3 py-2 animate-pulse">
                <div className="w-12 h-3 bg-gray-300 rounded"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5"></div>
                <div className="flex-1 h-3 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 bg-gps-surface border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Log Sistema</CardTitle>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-2 hover:bg-gray-100"
            onClick={() => refetch()}
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-sm custom-scrollbar">
          {displayLogs.length === 0 ? (
            <div className="text-center py-8">
              <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nessun log disponibile</p>
            </div>
          ) : (
            displayLogs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 py-2">
                <span className="text-gray-500 text-xs whitespace-nowrap flex-shrink-0">
                  {formatTime(new Date(log.timestamp))}
                </span>
                <div className="mt-1.5 flex-shrink-0">
                  {getLogIcon(log.level)}
                </div>
                <span className={`${getLogColor(log.level)} flex-1 break-words`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          {logsResponse?.hasMore && (
            <div className="text-center py-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadMoreLogs}
                disabled={isLoading}
                className="text-xs"
              >
                <MoreHorizontal className="w-4 h-4 mr-2" />
                Carica altri log ({logsResponse.totalCount - displayLogs.length} rimanenti)
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
