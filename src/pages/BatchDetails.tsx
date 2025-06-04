
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Activity, Clock, CheckCircle, AlertCircle, Play, Pause, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const BatchDetails = () => {
  const { id } = useParams<{ id: string }>();

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
      return {
        ...data,
        progress: data.total_eids > 0 ? Math.round((data.processed_eids / data.total_eids) * 100) : 0
      };
    },
    enabled: !!id
  });

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

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['batch-logs', id],
    queryFn: async () => {
      if (!id) throw new Error('No batch ID provided');
      
      const { data, error } = await supabase
        .from('batch_logs')
        .select('*')
        .eq('batch_id', id)
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-blue-500';
      case 'COMPLETED': return 'bg-green-500';
      case 'FAILED': return 'bg-red-500';
      case 'PENDING': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <Activity className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      case 'FAILED': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'WARNING': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'INFO': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'DEBUG': return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center py-12">Batch not found</div>
        </div>
      </div>
    );
  }

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
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{batch.label}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {getStatusIcon(batch.status)}
                    <span className="ml-1">{batch.status}</span>
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Created {new Date(batch.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              {batch.status === 'RUNNING' ? (
                <Button variant="outline" size="sm">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              ) : batch.status === 'PENDING' && (
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600">
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Progress Overview */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-3xl font-bold text-blue-600">{batch.progress}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-3xl font-bold text-purple-600">{batch.processed_eids}/{batch.total_eids}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-3xl font-bold text-green-600">{batch.success_count}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-3xl font-bold text-red-600">{batch.failure_count}</p>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{batch.processed_eids}/{batch.total_eids} EIDs</span>
              </div>
              <Progress value={batch.progress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Detailed Tabs */}
        <Tabs defaultValue="results" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-[400px] mx-auto">
            <TabsTrigger value="results">eSIM Results</TabsTrigger>
            <TabsTrigger value="logs">Processing Logs</TabsTrigger>
            <TabsTrigger value="settings">Batch Settings</TabsTrigger>
          </TabsList>

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

          <TabsContent value="logs">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle>Processing Logs</CardTitle>
                <CardDescription>
                  Real-time logs from the batch processing engine
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="text-center py-8">Loading logs...</div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8">No logs found</div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="border-l-4 border-gray-200 pl-4 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className={`text-xs ${getLogLevelColor(log.level)}`}>
                              {log.level}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{log.message}</p>
                          {log.eid && (
                            <p className="text-xs text-muted-foreground font-mono">EID: {log.eid}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
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
