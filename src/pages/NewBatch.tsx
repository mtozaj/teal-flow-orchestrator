
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
import { supabase } from '@/integrations/supabase/client';

const NewBatch = () => {
  const [batchLabel, setBatchLabel] = useState('');
  const [maxParallelism, setMaxParallelism] = useState('8');
  const [inputMethod, setInputMethod] = useState<'csv' | 'manual'>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvEidCount, setCsvEidCount] = useState<number | null>(null);
  const [manualEids, setManualEids] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  
  // Track user interactions
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [touchedFields, setTouchedFields] = useState({
    batchLabel: false,
    csvFile: false,
    manualEids: false
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const processCsvFile = useCallback(async (file: File) => {
    setIsProcessingCsv(true);
    try {
      const text = await file.text();
      const eids = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      setCsvEidCount(eids.length);
      console.log('CSV processed:', eids.length, 'EIDs found');
    } catch (error) {
      console.error('Error processing CSV:', error);
      setCsvEidCount(0);
    } finally {
      setIsProcessingCsv(false);
    }
  }, []);

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
      setCsvEidCount(null);
      setTouchedFields(prev => ({ ...prev, csvFile: true }));
      processCsvFile(file);
    }
  }, [toast, processCsvFile]);

  const parseEidsFromInput = async (): Promise<string[]> => {
    if (inputMethod === 'csv' && csvFile) {
      const text = await csvFile.text();
      return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    } else if (inputMethod === 'manual') {
      return manualEids.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setIsUploading(true);

    try {
      const eids = await parseEidsFromInput();

      if (eids.length === 0) {
        throw new Error('No EIDs provided');
      }

      const fileName = `${crypto.randomUUID()}.csv`;
      let uploadError;

      if (inputMethod === 'csv' && csvFile) {
        ({ error: uploadError } = await supabase.storage
          .from('batch-inputs')
          .upload(fileName, csvFile));
      } else {
        const blob = new Blob([eids.join('\n')], { type: 'text/csv' });
        ({ error: uploadError } = await supabase.storage
          .from('batch-inputs')
          .upload(fileName, blob));
      }

      if (uploadError) throw uploadError;

      // Create batch in database
      const { data: batch, error } = await supabase
        .from('batches')
        .insert({
          label: batchLabel,
          max_parallelism: parseInt(maxParallelism),
          total_eids: eids.length,
          status: 'PENDING',
          file_path: fileName
        })
        .select()
        .single();

      if (error) throw error;

      // Create eSIM result entries for each EID
      const esimResults = eids.map(eid => ({
        batch_id: batch.id,
        eid: eid
      }));

      const { error: resultsError } = await supabase
        .from('esim_results')
        .insert(esimResults);

      if (resultsError) throw resultsError;

      toast({
        title: "Batch created successfully",
        description: `Created batch with ${eids.length} EIDs and ${maxParallelism} max workers`,
      });
      
      // Navigate to batch details
      navigate(`/batch/${batch.id}`);
    } catch (error) {
      console.error('Error creating batch:', error);
      toast({
        title: "Error creating batch",
        description: error instanceof Error ? error.message : "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getEidCount = () => {
    if (inputMethod === 'csv') {
      if (!csvFile) return '0 EIDs';
      if (isProcessingCsv) return 'Processing...';
      if (csvEidCount !== null) return `${csvEidCount} EIDs`;
      return 'Processing...';
    }
    if (inputMethod === 'manual') {
      const lines = manualEids.split('\n').filter(line => line.trim().length > 0);
      return `${lines.length} EIDs`;
    }
    return '0 EIDs';
  };

  const getValidationErrors = () => {
    const errors = [];
    
    if (!batchLabel.trim()) {
      errors.push('Batch label is required');
    }
    
    if (inputMethod === 'csv') {
      if (!csvFile) {
        errors.push('CSV file must be uploaded');
      } else if (isProcessingCsv) {
        errors.push('CSV file is still processing');
      } else if (csvEidCount === null || csvEidCount === 0) {
        errors.push('CSV file must contain valid EIDs');
      }
    }
    
    if (inputMethod === 'manual') {
      if (!manualEids.trim()) {
        errors.push('EIDs must be entered manually');
      }
    }
    
    return errors;
  };

  const isFormValid = () => {
    console.log('Form validation check:', {
      batchLabel: batchLabel.trim(),
      inputMethod,
      csvFile: !!csvFile,
      isProcessingCsv,
      csvEidCount,
      manualEids: manualEids.trim()
    });

    // Must have a batch label
    if (!batchLabel.trim()) {
      console.log('Form invalid: no batch label');
      return false;
    }

    // For CSV input
    if (inputMethod === 'csv') {
      if (!csvFile) {
        console.log('Form invalid: no CSV file');
        return false;
      }
      if (isProcessingCsv) {
        console.log('Form invalid: still processing CSV');
        return false;
      }
      if (csvEidCount === null || csvEidCount === 0) {
        console.log('Form invalid: no EIDs in CSV');
        return false;
      }
    }

    // For manual input
    if (inputMethod === 'manual') {
      if (!manualEids.trim()) {
        console.log('Form invalid: no manual EIDs');
        return false;
      }
    }

    console.log('Form is valid');
    return true;
  };

  // Helper functions to determine when to show errors
  const shouldShowBatchLabelError = () => {
    return (hasAttemptedSubmit || touchedFields.batchLabel) && !batchLabel.trim();
  };

  const shouldShowCsvError = () => {
    return inputMethod === 'csv' && (hasAttemptedSubmit || touchedFields.csvFile) && !csvFile;
  };

  const shouldShowCsvContentError = () => {
    return inputMethod === 'csv' && csvFile && !isProcessingCsv && csvEidCount === 0;
  };

  const shouldShowManualEidsError = () => {
    return inputMethod === 'manual' && (hasAttemptedSubmit || touchedFields.manualEids) && !manualEids.trim();
  };

  const validationErrors = getValidationErrors();
  const hasErrors = validationErrors.length > 0;
  const shouldShowValidationSummary = hasAttemptedSubmit && hasErrors;

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
                  <Label htmlFor="batch-label" className="flex items-center space-x-1">
                    <span>Batch Label</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="batch-label"
                    placeholder="e.g., Production Batch #248"
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                    onBlur={() => setTouchedFields(prev => ({ ...prev, batchLabel: true }))}
                    required
                    className={shouldShowBatchLabelError() ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                  />
                  {shouldShowBatchLabelError() && (
                    <p className="text-sm text-red-600 flex items-center space-x-1">
                      <AlertCircle className="h-4 w-4" />
                      <span>Batch label is required</span>
                    </p>
                  )}
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
                <span className="text-red-500">*</span>
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
                  <div className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors ${
                    shouldShowCsvError() ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                  }`}>
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
                  
                  {shouldShowCsvError() && (
                    <p className="text-sm text-red-600 flex items-center space-x-1">
                      <AlertCircle className="h-4 w-4" />
                      <span>CSV file is required</span>
                    </p>
                  )}
                  
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

                  {shouldShowCsvContentError() && (
                    <p className="text-sm text-red-600 flex items-center space-x-1">
                      <AlertCircle className="h-4 w-4" />
                      <span>CSV file contains no valid EIDs</span>
                    </p>
                  )}
                </div>
              )}

              {/* Manual Entry */}
              {inputMethod === 'manual' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-eids" className="flex items-center space-x-1">
                      <span>EIDs (one per line)</span>
                      <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="manual-eids"
                      placeholder="8949000000000000001&#10;8949000000000000002&#10;8949000000000000003"
                      value={manualEids}
                      onChange={(e) => setManualEids(e.target.value)}
                      onBlur={() => setTouchedFields(prev => ({ ...prev, manualEids: true }))}
                      rows={8}
                      className={`font-mono text-sm ${shouldShowManualEidsError() ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-muted-foreground">
                          Enter each EID on a new line
                        </p>
                        {shouldShowManualEidsError() && (
                          <p className="text-sm text-red-600 flex items-center space-x-1">
                            <AlertCircle className="h-4 w-4" />
                            <span>EIDs are required</span>
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">{getEidCount()}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Summary - only show after submit attempt */}
          {shouldShowValidationSummary && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-800 dark:text-red-200">
                    Please fix the following issues:
                  </h3>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <div className="flex justify-end space-x-4">
            <Link to="/">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={isUploading || !isFormValid()}
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
