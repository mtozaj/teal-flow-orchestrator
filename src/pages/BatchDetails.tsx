import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Download, RefreshCw, Play, Pause, Terminal, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const BatchDetails = () => {
  const { id } = useParams();
  const [logs, setLogs] = useState<Array<any>>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [batchData, setBatchData] = useState<any>(null);
  const [results, setResults] = useState<Array<any>>([]);

  useEffect(() => {
    if (!id) return;

    supabase
      .from('batches')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setBatchData(data);
      });

    supabase
      .from('esim_results')
      .select('*')
      .eq('batch_id', id)
      .then(({ data }) => {
        setResults(data ?? []);
      });

    const channel = supabase
      .channel('realtime:public:batch_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'batch_logs', filter: `batch_id=eq.${id}` },
        payload => {
          setLogs(prev => [...prev.slice(-50), payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

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
      case 'WARN': return 'text-yellow-500';
      case 'INFO': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

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
                <h1 className="text-2xl font-bold">{batchData?.label}</h1>
                {batchData?.started && (
                  <p className="text-sm text-muted-foreground">
                    Started {new Date(batchData.started).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Failed
              </Button>
              <Button variant="outline" size="sm">
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
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xl font-bold">RUNNING</span>
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
                  <p className="text-xl font-bold">{batchData?.completed ?? 0}/{batchData?.total ?? 0}</p>
                  <Progress value={batchData?.progress ?? 0} className="h-2 mt-2" />
                </div>
                <span className="text-2xl font-bold text-blue-600">{batchData?.progress ?? 0}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {batchData && batchData.completed
                      ? (((batchData.completed - batchData.failed) / batchData.completed) * 100).toFixed(1)
                      : '0'}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-600">✅ {batchData ? batchData.completed - batchData.failed : 0}</p>
                  <p className="text-sm text-red-600">❌ {batchData?.failed ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Workers</p>
                  <p className="text-2xl font-bold text-purple-600">{batchData?.workers ?? 0}</p>
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
                      {results.map((result, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-mono text-sm">{result.eid}</td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.tmo)}`}>
                              {result.tmo}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.vzn)}`}>
                              {result.vzn}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.glb)}`}>
                              {result.glb}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={`text-xs ${getStatusColor(result.att)}`}>
                              {result.att}
                            </Badge>
                          </td>
                          <td className="p-2 text-right text-sm text-muted-foreground">
                            {result.timestamp}
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
                  Real-time output from worker processes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] rounded-md border p-4 bg-slate-950">
                  <div className="space-y-1 font-mono text-sm">
                    {logs.map((log, index) => (
                      <div key={index} className="text-slate-300">
                        <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        {' '}
                        <span className={getLogLevelColor(log.level)}>[{log.level}]</span>
                        {' '}
                        <span className="text-blue-400">[{log.eid}]</span>
                        {' '}
                        <span>{log.message}</span>
                      </div>
                    ))}
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