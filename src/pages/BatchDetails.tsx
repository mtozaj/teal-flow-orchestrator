
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Activity, Clock, CheckCircle, AlertCircle, Play, Pause, Download, Terminal } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const BatchDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
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
    enabled: !!id
  });

  // Mutation to start batch processing with API keys
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
        description: "The batch processing has been initiated successfully using your API credentials.",
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

  // Mutation to pause batch processing
  const pauseBatchMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No batch ID provided');
      
      const { data, error } = await supabase
        .from('batches')
        .update({ 
          status: 'PENDING',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Batch Paused",
        description: "The batch processing has been paused.",
      });
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: (error) => {
      toast({
        title: "Error Pausing Batch",
        description: error instanceof Error ? error.message : "Failed to pause batch processing.",
        variant: "destructive",
      });
    }
  });

  const handleStartBatch = () => {
    startBatchMutation.mutate();
  };

  const handlePauseBatch = () => {
    pauseBatchMutation.mutate();
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
    enabled: !!id
  });

  // Real-time logs subscription with polling fallback
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

    // Set up real-time subscription
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

    // Poll for new logs in case realtime fails
    const pollInterval = setInterval(async () => {
      const since = lastTimestampRef.current || '1970-01-01T00:00:00Z';
      const { data, error } = await supabase
        .from('batch_logs')
        .select('*')
        .eq('batch_id', id)
        .gt('timestamp', since)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Polling logs error:', error);
        return;
      }

      if (data && data.length > 0) {
        lastTimestampRef.current = data[data.length - 1].timestamp;
        setLiveLogs(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const newLogs = data.filter(l => !existingIds.has(l.id));
          return [...prev, ...newLogs];
        });
      }
    }, 5000);

    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [id]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs]);

  // Real-time subscription for batch status updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`batch-updates-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'batches',
          filter: `id=eq.${id}`,
        },
        () => {
          console.log('Batch updated, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['batch', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'RUNNING':
        return <Badge variant="default" className="bg-blue-600"><Activity className="h-3 w-3 mr-1" />Running</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (batchLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center py-12">Loading batch details...</div>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Batch not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate progress percentage only after batch is loaded
  const progressPercentage = batch.total_eids > 0 ? (batch.processed_eids / batch.total_eids) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Batches
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{batch.label}</h1>
                  <p className="text-sm text-muted-foreground">Batch ID: {batch.id}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {getStatusBadge(batch.status)}
              {batch.status === 'RUNNING' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePauseBatch}
                  disabled={pauseBatchMutation.isPending}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  {pauseBatchMutation.isPending ? 'Pausing...' : 'Pause'}
                </Button>
              )}
              {batch.status === 'PENDING' && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={handleStartBatch}
                  disabled={startBatchMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startBatchMutation.isPending ? 'Starting...' : 'Start'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total EIDs</CardDescription>
              <CardTitle className="text-3xl">{batch.total_eids}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Processed</CardDescription>
              <CardTitle className="text-3xl">{batch.processed_eids}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Success</CardDescription>
              <CardTitle className="text-3xl text-green-600">{batch.success_count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failures</CardDescription>
              <CardTitle className="text-3xl text-red-600">{batch.failure_count}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Processing Progress</CardTitle>
            <CardDescription>
              {batch.processed_eids} of {batch.total_eids} EIDs processed ({progressPercentage.toFixed(1)}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercentage} className="h-2" />
          </CardContent>
        </Card>

        <Tabs defaultValue="terminal" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="terminal">Live Terminal</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal">
            <Card className="border-0 shadow-lg bg-black text-green-400 font-mono">
              <CardHeader className="bg-gray-900 text-white">
                <CardTitle className="flex items-center space-x-2">
                  <Terminal className="h-5 w-5" />
                  <span>Live Terminal Output</span>
                  <Badge variant="outline" className="ml-auto">
                    {liveLogs.length} logs
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Real-time processing logs and output
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-96 p-4">
                  {liveLogs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      No logs yet. Logs will appear here when processing starts.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {liveLogs.map((log, index) => (
                        <div key={log.id || index} className="text-sm">
                          <span className="text-gray-400">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>
                          <span className={`ml-2 ${
                            log.level === 'ERROR' ? 'text-red-400' : 
                            log.level === 'WARN' ? 'text-yellow-400' : 
                            'text-green-400'
                          }`}>
                            [{log.level}]
                          </span>
                          {log.eid && (
                            <span className="text-blue-400 ml-2">[{log.eid}]</span>
                          )}
                          <span className="ml-2">{log.message}</span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle>eSIM Processing Results</CardTitle>
                <CardDescription>
                  Detailed results for each EID in this batch
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resultsLoading ? (
                  <div className="text-center py-8">Loading results...</div>
                ) : esimResults.length === 0 ? (
                  <div className="text-center py-8">No results found</div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {esimResults.map((result) => (
                        <div key={result.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm">{result.eid}</span>
                            <div className="flex space-x-2">
                              {result.att_status && (
                                <Badge variant="outline" className="text-xs">
                                  AT&T: {result.att_status}
                                </Badge>
                              )}
                              {result.tmo_status && (
                                <Badge variant="outline" className="text-xs">
                                  T-Mobile: {result.tmo_status}
                                </Badge>
                              )}
                              {result.verizon_status && (
                                <Badge variant="outline" className="text-xs">
                                  Verizon: {result.verizon_status}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {result.error_message && (
                            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                              {result.error_message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle>Batch Configuration</CardTitle>
                <CardDescription>
                  Settings and parameters for this batch
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium">Batch Label</Label>
                    <p className="text-lg">{batch.label}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Max Parallelism</Label>
                    <p className="text-lg">{batch.max_parallelism} workers</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total EIDs</Label>
                    <p className="text-lg">{batch.total_eids}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">File Path</Label>
                    <p className="text-lg font-mono text-sm">{batch.file_path || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Created At</Label>
                    <p className="text-lg">{new Date(batch.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Last Updated</Label>
                    <p className="text-lg">{new Date(batch.updated_at).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BatchDetails;
