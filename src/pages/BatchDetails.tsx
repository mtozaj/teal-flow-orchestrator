
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Download, RefreshCw, Play, Pause, Terminal, CheckCircle, AlertCircle, Clock, Square } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const BatchDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isProcessingStopped, setIsProcessingStopped] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ['batch', id],
    queryFn: async () => {
      if (!id) throw new Error('No batch ID provided');
      
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: 2000 // Refetch every 2 seconds to get latest status
  });

  // Set isRunning based on batch status
  useEffect(() => {
    if (batch) {
      const running = batch.status === 'RUNNING';
      setIsRunning(running);
      setIsProcessingStopped(batch.status === 'STOPPED' || batch.status === 'PAUSED');
    }
  }, [batch]);

  // Mutation to start batch processing
  const startBatchMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No batch ID provided');
      
      // Get API keys from localStorage
      const apiKey = localStorage.getItem('tealApiKey');
      const apiSecret = localStorage.getItem('tealApiSecret');
      const tmoUuid = localStorage.getItem('tmoUuid') || 'cda438862b284bcdaec82ee516eada14';
      const verizonUuid = localStorage.getItem('verizonUuid') || '3c8fbbbc3ab442b8bc2f244c5180f9d1';
      const globalUuid = localStorage.getItem('globalUuid') || '493bdfc2eccb415ea63796187f830784';
      const attUuid = localStorage.getItem('attUuid') || 'cd27b630772d4d8f915173488b7bfcf1';

      if (!apiKey || !apiSecret) {
        throw new Error('API keys not found. Please configure them in Settings first.');
      }

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('process-batch', {
        body: {
          batchId: id,
          apiKey,
          apiSecret,
          planUuids: {
            tmo: tmoUuid,
            verizon: verizonUuid,
            global: globalUuid,
            att: attUuid
          }
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Batch Processing Started",
        description: "The batch processing has been initiated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: (error) => {
      toast({
        title: "Error Starting Batch",
        description: error instanceof Error ? error.message : "Failed to start batch processing.",
        variant: "destructive",
      });
    }
  });

  // Mutation to stop batch processing
  const stopBatchMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No batch ID provided');
      
      // Update batch status to STOPPED to stop processing
      const { data, error } = await supabase
        .from('batches')
        .update({ 
          status: 'STOPPED',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the stop action
      await supabase
        .from('batch_logs')
        .insert({
          batch_id: id,
          level: 'INFO',
          message: 'Batch processing stopped by user',
          timestamp: new Date().toISOString()
        });
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Batch Stopped",
        description: "The batch processing has been stopped.",
      });
      setIsProcessingStopped(true);
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: (error) => {
      toast({
        title: "Error Stopping Batch",
        description: error instanceof Error ? error.message : "Failed to stop batch processing.",
        variant: "destructive",
      });
    }
  });

  const handleStartBatch = () => {
    setIsProcessingStopped(false);
    startBatchMutation.mutate();
  };

  const handleStopBatch = () => {
    stopBatchMutation.mutate();
  };

  const { data: esimResults = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['esim-results', id],
    queryFn: async () => {
      if (!id) throw new Error('No batch ID provided');
      
      const { data, error } = await supabase
        .from('esim_results')
        .select('*')
        .eq('batch_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: isRunning ? 5000 : false // Only refetch when running
  });

  // Real-time logs subscription
  useEffect(() => {
    if (!id) return;

    console.log('Setting up real-time subscription for batch logs:', id);

    const fetchInitialLogs = async () => {
      console.log('Fetching initial logs...');
      const { data, error } = await supabase
        .from('batch_logs')
        .select('*')
        .eq('batch_id', id)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching initial logs:', error);
      } else {
        console.log('Initial logs fetched:', data?.length || 0);
        if (data && data.length > 0) {
          lastTimestampRef.current = data[data.length - 1].timestamp;
        }
        setLiveLogs(data || []);
      }
    };

    fetchInitialLogs();

    const fetchLatestLogs = async () => {
      if (!lastTimestampRef.current) return;
      const { data, error } = await supabase
        .from('batch_logs')
        .select('*')
        .eq('batch_id', id)
        .gt('timestamp', lastTimestampRef.current)
        .order('timestamp', { ascending: true });

      if (!error && data && data.length > 0) {
        lastTimestampRef.current = data[data.length - 1].timestamp;
        setLiveLogs(prev => [...prev, ...data]);
      }
    };

    let intervalId: NodeJS.Timeout | null = null;

    // Only set up real-time subscription if not stopped
    if (!isProcessingStopped) {
      const channel = supabase
        .channel(`batch-logs-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'batch_logs',
            filter: `batch_id=eq.${id}`,
          },
          (payload) => {
            console.log('New log received:', payload.new);
            lastTimestampRef.current = payload.new.timestamp;
            setLiveLogs(prev => [...prev, payload.new]);
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
        });

      subscriptionRef.current = channel;

      intervalId = setInterval(fetchLatestLogs, 1000);

      return () => {
        console.log('Cleaning up subscription');
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [id, isProcessingStopped]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs]);

  // Export CSV functionality
  const handleExportCSV = () => {
    if (!esimResults.length) {
      toast({
        title: "No Data to Export",
        description: "There are no results to export yet.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'EID',
      'T-Mobile Status',
      'T-Mobile ICCID',
      'T-Mobile Timestamp',
      'Verizon Status',
      'Verizon ICCID', 
      'Verizon Timestamp',
      'Global Status',
      'Global ICCID',
      'Global Timestamp',
      'AT&T Status',
      'AT&T ICCID',
      'AT&T Timestamp',
      'Processing Duration (seconds)',
      'Error Message',
      'Created At'
    ];

    const csvContent = [
      headers.join(','),
      ...esimResults.map(result => [
        result.eid,
        result.tmo_status || '',
        result.tmo_iccid || '',
        result.tmo_timestamp || '',
        result.verizon_status || '',
        result.verizon_iccid || '',
        result.verizon_timestamp || '',
        result.global_status || '',
        result.global_iccid || '',
        result.global_timestamp || '',
        result.att_status || '',
        result.att_iccid || '',
        result.att_timestamp || '',
        result.processing_duration_seconds || '',
        result.error_message || '',
        new Date(result.created_at).toISOString()
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_${batch?.label || id}_results.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Exported",
      description: "The batch results have been exported successfully.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'bg-green-500 text-white';
      case 'FAILED': return 'bg-red-500 text-white';
      case 'PENDING': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-500';
      case 'WARNING': return 'text-yellow-500';
      case 'INFO': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  // Calculate progress and other derived values
  const progress = batch && batch.total_eids > 0 ? Math.round((batch.processed_eids / batch.total_eids) * 100) : 0;
  const successRate = batch && batch.processed_eids > 0 ? ((batch.success_count / batch.processed_eids) * 100).toFixed(1) : '0';

  if (batchLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading batch details...</div>;
  }

  if (!batch) {
    return <div className="min-h-screen flex items-center justify-center">Batch not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{batch?.label}</h1>
                {batch?.started_at && (
                  <p className="text-sm text-muted-foreground">
                    Started {new Date(batch.started_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isRunning && !isProcessingStopped && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartBatch}
                  disabled={startBatchMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
              {isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopBatch}
                  disabled={stopBatchMutation.isPending}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${batch.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' : batch.status === 'FAILED' ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                    <span className="text-xl font-bold">{batch.status}</span>
                  </div>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Progress</p>
                  <p className="text-xl font-bold">{batch.processed_eids}/{batch.total_eids}</p>
                  <Progress value={progress} className="h-2 mt-2" />
                </div>
                <span className="text-2xl font-bold text-blue-600">{progress}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{successRate}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-600">✅ {batch.success_count}</p>
                  <p className="text-sm text-red-600">❌ {batch.failure_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Workers</p>
                  <p className="text-2xl font-bold text-purple-600">{batch.max_parallelism}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-sm text-purple-600">~2.4 EIDs/sec</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="results" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-[400px] mx-auto">
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="logs">Live Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle>EID Processing Results</CardTitle>
                <CardDescription>
                  Real-time status of each EID across all carriers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-semibold">EID</th>
                        <th className="text-center p-2 font-semibold">T-Mobile</th>
                        <th className="text-center p-2 font-semibold">Verizon</th>
                        <th className="text-center p-2 font-semibold">Global</th>
                        <th className="text-center p-2 font-semibold">AT&T</th>
                        <th className="text-right p-2 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {esimResults.map((result, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-mono text-sm">{result.eid}</td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.tmo_status || 'PENDING')}`}>
                              {result.tmo_status || 'PENDING'}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.verizon_status || 'PENDING')}`}>
                              {result.verizon_status || 'PENDING'}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.global_status || 'PENDING')}`}>
                              {result.global_status || 'PENDING'}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.att_status || 'PENDING')}`}>
                              {result.att_status || 'PENDING'}
                            </Badge>
                          </td>
                          <td className="p-2 text-right text-sm text-muted-foreground">
                            {new Date(result.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle>Live Processing Logs</CardTitle>
                <CardDescription>
                  {isProcessingStopped ? 'Processing stopped - logs are paused' : 'Real-time output from worker processes'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] rounded-md border p-4 bg-slate-950">
                  <div className="space-y-1 font-mono text-sm">
                    {liveLogs.map((log, index) => (
                      <div key={index} className="text-slate-300">
                        <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        {' '}
                        <span className={getLogLevelColor(log.level)}>[{log.level}]</span>
                        {' '}
                        {log.eid && <span className="text-blue-400">[{log.eid}]</span>}
                        {' '}
                        <span>{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BatchDetails;
