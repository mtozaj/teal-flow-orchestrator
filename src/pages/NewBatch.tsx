
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const NewBatch = () => {
  const [batchLabel, setBatchLabel] = useState('');
  const [maxParallelism, setMaxParallelism] = useState('8');
  const [inputMethod, setInputMethod] = useState<'csv' | 'manual'>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [manualEids, setManualEids] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive"
        });
        return;
      }
      setCsvFile(file);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Batch created successfully",
        description: `Processing ${inputMethod === 'csv' ? csvFile?.name : 'manual EIDs'} with ${maxParallelism} workers`,
      });
      
      // Navigate to batch details
      navigate('/batch/new-batch-id');
    } catch (error) {
      toast({
        title: "Error creating batch",
        description: "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getEidCount = () => {
    if (inputMethod === 'csv' && csvFile) {
      return '~1,250 EIDs'; // Simulated count
    }
    if (inputMethod === 'manual') {
      const lines = manualEids.split('\n').filter(line => line.trim().length > 0);
      return `${lines.length} EIDs`;
    }
    return '0 EIDs';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Create New Batch</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Batch Configuration */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <span>Batch Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure your eSIM activation batch settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batch-label">Batch Label</Label>
                  <Input
                    id="batch-label"
                    placeholder="e.g., Production Batch #248"
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-parallelism">Max Parallel Workers</Label>
                  <Select value={maxParallelism} onValueChange={setMaxParallelism}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 worker</SelectItem>
                      <SelectItem value="4">4 workers</SelectItem>
                      <SelectItem value="8">8 workers</SelectItem>
                      <SelectItem value="16">16 workers</SelectItem>
                      <SelectItem value="32">32 workers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EID Input */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <span>EID Input</span>
              </CardTitle>
              <CardDescription>
                Upload a CSV file or manually enter EIDs to process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input Method Selection */}
              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant={inputMethod === 'csv' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('csv')}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  CSV Upload
                </Button>
                <Button
                  type="button"
                  variant={inputMethod === 'manual' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('manual')}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Manual Entry
                </Button>
              </div>

              {/* CSV Upload */}
              {inputMethod === 'csv' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">Upload CSV File</p>
                      <p className="text-sm text-muted-foreground">
                        Select a CSV file containing EIDs (one per row)
                      </p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label htmlFor="csv-upload">
                        <Button type="button" variant="outline" className="cursor-pointer" asChild>
                          <span>Choose File</span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  
                  {csvFile && (
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800 dark:text-green-200">{csvFile.name}</p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {(csvFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{getEidCount()}</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Entry */}
              {inputMethod === 'manual' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-eids">EIDs (one per line)</Label>
                    <Textarea
                      id="manual-eids"
                      placeholder="8949000000000000001&#10;8949000000000000002&#10;8949000000000000003"
                      value={manualEids}
                      onChange={(e) => setManualEids(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Enter each EID on a new line
                      </p>
                      <Badge variant="secondary">{getEidCount()}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end space-x-4">
            <Link to="/">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={isUploading || (!csvFile && inputMethod === 'csv') || (!manualEids.trim() && inputMethod === 'manual')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Batch...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Batch
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewBatch;
